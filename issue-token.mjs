// Issues the Taxipic app token on the Pi blockchain (Stellar-based).
// Run on TESTNET first:  node token/issue-token.mjs
// All values come from environment variables — never commit seeds.
//
// Required env:
//   PI_NETWORK                 "testnet" (default) or "mainnet"
//   TOKEN_CODE                 1-12 alphanumeric chars, e.g. TAXI
//   TOKEN_SUPPLY               total amount to mint to the distributor, e.g. 1000000
//   TOKEN_ISSUER_SECRET        S... seed of the issuer account (funded)
//   TOKEN_DISTRIBUTOR_SECRET   S... seed of the distributor account (funded)
// Optional env:
//   TOKEN_HOME_DOMAIN          domain serving /.well-known/stellar.toml (e.g. taxipic.netlify.app)
//   TOKEN_LOCK_ISSUER          "true" to permanently lock the issuer (fixed supply)
import { Asset, Horizon, Keypair, Operation, TransactionBuilder } from '@stellar/stellar-sdk';

const NETWORKS = {
    testnet: { horizon: 'https://api.testnet.minepi.com', passphrase: 'Pi Testnet' },
    mainnet: { horizon: 'https://api.mainnet.minepi.com', passphrase: 'Pi Network' },
};

function env(name, { required = true } = {}) {
    const v = process.env[name]?.trim();
    if (required && !v) throw new Error(`Missing env var ${name}`);
    return v;
}

const net = NETWORKS[env('PI_NETWORK', { required: false }) || 'testnet'];
if (!net) throw new Error('PI_NETWORK must be "testnet" or "mainnet"');
const code = env('TOKEN_CODE');
if (!/^[A-Za-z0-9]{1,12}$/.test(code)) throw new Error('TOKEN_CODE must be 1-12 alphanumeric characters');
const supply = env('TOKEN_SUPPLY');
if (!/^\d+(\.\d{1,7})?$/.test(supply)) throw new Error('TOKEN_SUPPLY must be a positive number (max 7 decimals)');

const issuer = Keypair.fromSecret(env('TOKEN_ISSUER_SECRET'));
const distributor = Keypair.fromSecret(env('TOKEN_DISTRIBUTOR_SECRET'));
const homeDomain = env('TOKEN_HOME_DOMAIN', { required: false });
const lockIssuer = env('TOKEN_LOCK_ISSUER', { required: false }) === 'true';

const server = new Horizon.Server(net.horizon);
const asset = new Asset(code, issuer.publicKey());

async function submit(source, signer, ops) {
    const account = await server.loadAccount(source.publicKey());
    const fee = String(await server.fetchBaseFee());
    let builder = new TransactionBuilder(account, { fee, networkPassphrase: net.passphrase }).setTimeout(180);
    for (const op of ops) builder = builder.addOperation(op);
    const tx = builder.build();
    tx.sign(signer);
    const res = await server.submitTransaction(tx);
    return res.hash;
}

console.log(`Network: ${net.passphrase}\nAsset: ${code}:${issuer.publicKey()}`);

// 1. Distributor trusts the asset.
console.log('trustline tx:', await submit(distributor, distributor, [Operation.changeTrust({ asset })]));

// 2. Issuer optionally sets home domain, then mints the supply to the distributor.
const issuerOps = [];
if (homeDomain) issuerOps.push(Operation.setOptions({ homeDomain }));
issuerOps.push(Operation.payment({ destination: distributor.publicKey(), asset, amount: supply }));
console.log('mint tx:', await submit(issuer, issuer, issuerOps));

// 3. Optional: lock issuer so no more tokens can ever be minted.
if (lockIssuer) {
    console.log('lock tx:', await submit(issuer, issuer, [Operation.setOptions({ masterWeight: 0 })]));
}

console.log('\nDone. Set these in Netlify env vars:');
console.log(`TOKEN_CODE=${code}`);
console.log(`TOKEN_ISSUER_PUBLIC=${issuer.publicKey()}`);
console.log(`TOKEN_DISTRIBUTOR_PUBLIC=${distributor.publicKey()}`);
