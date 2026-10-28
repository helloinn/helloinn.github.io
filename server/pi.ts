import { HttpError } from "./http.js";

const PI_API_BASE = "https://api.minepi.com";

export type PiPayment = {
  identifier: string;
  user_uid: string;
  amount: number;
  memo: string;
  metadata: Record<string, unknown>;
  from_address: string;
  to_address: string;
  direction: "user_to_app" | "app_to_user";
  network: string;
  status: {
    developer_approved: boolean;
    transaction_verified: boolean;
    developer_completed: boolean;
    cancelled: boolean;
    user_cancelled: boolean;
  };
  transaction: null | { txid: string; verified: boolean; _link: string };
};

export type PiUser = { uid: string; username: string; wallet_address?: string };

function serverApiKey(): string {
  const key = process.env.PI_API_KEY;
  if (!key) throw new HttpError(503, "Pi payments are not configured on the server (PI_API_KEY is missing)");
  return key;
}

async function piRequest<T>(path: string, init: RequestInit & { auth: string }): Promise<T> {
  const { auth, ...rest } = init;
  const res = await fetch(`${PI_API_BASE}${path}`, {
    ...rest,
    headers: { Authorization: auth, "Content-Type": "application/json", ...(rest.headers ?? {}) },
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`Pi Platform API ${rest.method ?? "GET"} ${path} -> ${res.status}: ${text}`);
    throw new HttpError(res.status === 401 ? 401 : 502, `Pi Platform API rejected the request (${res.status})`);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

const keyAuth = () => `Key ${serverApiKey()}`;

// Validates a user access token obtained from Pi.authenticate() on the frontend.
export function verifyAccessToken(accessToken: string) {
  return piRequest<PiUser>("/v2/me", { auth: `Bearer ${accessToken}` });
}

export const getPayment = (paymentId: string) =>
  piRequest<PiPayment>(`/v2/payments/${encodeURIComponent(paymentId)}`, { auth: keyAuth() });

export const approvePayment = (paymentId: string) =>
  piRequest<PiPayment>(`/v2/payments/${encodeURIComponent(paymentId)}/approve`, { method: "POST", auth: keyAuth() });

export const completePayment = (paymentId: string, txid: string) =>
  piRequest<PiPayment>(`/v2/payments/${encodeURIComponent(paymentId)}/complete`, {
    method: "POST",
    auth: keyAuth(),
    body: JSON.stringify({ txid }),
  });

export const cancelPayment = (paymentId: string) =>
  piRequest<PiPayment>(`/v2/payments/${encodeURIComponent(paymentId)}/cancel`, { method: "POST", auth: keyAuth() });

// Confirms with Pi that a rewarded ad was actually watched before granting anything.
export async function isAdRewardGranted(adId: string): Promise<boolean> {
  const status = await piRequest<{ mediator_ack_status: string | null }>(
    `/v2/ads_network/status/${encodeURIComponent(adId)}`,
    { auth: keyAuth() },
  );
  return status.mediator_ack_status === "granted";
}

export const isA2UConfigured = () => !!(process.env.PI_API_KEY && process.env.PI_WALLET_PRIVATE_SEED);

/**
 * App-to-User payment: creates the payment on the Pi Platform, signs and submits the
 * blockchain transaction from the app wallet, then completes it. Returns the Pi payment id and txid.
 */
export async function sendAppToUserPayment(opts: {
  uid: string;
  amount: number;
  memo: string;
  metadata: Record<string, unknown>;
  onCreated?: (paymentId: string) => Promise<void>;
}): Promise<{ paymentId: string; txid: string }> {
  const seed = process.env.PI_WALLET_PRIVATE_SEED;
  if (!seed) throw new HttpError(503, "App wallet is not configured for payouts");

  const { identifier } = await piRequest<PiPayment>("/v2/payments", {
    method: "POST",
    auth: keyAuth(),
    body: JSON.stringify({ payment: { amount: opts.amount, memo: opts.memo, metadata: opts.metadata, uid: opts.uid } }),
  });
  await opts.onCreated?.(identifier);
  const payment = await getPayment(identifier);

  const { Horizon, Keypair, TransactionBuilder, Operation, Asset, Memo } = await import("@stellar/stellar-sdk");
  const horizonUrl = payment.network === "Pi Network" ? "https://api.mainnet.minepi.com" : "https://api.testnet.minepi.com";
  const horizon = new Horizon.Server(horizonUrl);
  const keypair = Keypair.fromSecret(seed);
  const account = await horizon.loadAccount(keypair.publicKey());
  const baseFee = await horizon.fetchBaseFee();
  const timebounds = await horizon.fetchTimebounds(180);

  const tx = new TransactionBuilder(account, { fee: String(baseFee), networkPassphrase: payment.network, timebounds })
    .addOperation(
      Operation.payment({
        destination: payment.to_address,
        asset: Asset.native(),
        amount: payment.amount.toFixed(7).replace(/\.?0+$/, ""),
      }),
    )
    .addMemo(Memo.text(identifier))
    .build();
  tx.sign(keypair);
  const submitted = await horizon.submitTransaction(tx);
  const txid = (submitted as { id?: string; hash: string }).id ?? submitted.hash;

  await completePayment(identifier, txid);
  return { paymentId: identifier, txid };
}
