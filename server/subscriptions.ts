import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { merchants, users } from "../db/schema.js";
import { HttpError } from "./http.js";
import { MERCHANT_MONTHLY_FEE_PI, VIP_MONTHLY_FEE_PI } from "./pricing.js";

/**
 * Subscription plans. Prices come from pricing.ts so there is a single source of truth.
 * A subscription is only extended AFTER the Pi payment has been server-completed
 * (payments.status = "COMPLETED"), matching the existing fulfilment rule.
 */
export const PLANS = {
  VIP: { purpose: "VIP", pricePi: VIP_MONTHLY_FEE_PI, days: 30, memo: "Taxipic VIP - 30 days" },
  MERCHANT: { purpose: "MERCHANT_SUBSCRIPTION", pricePi: MERCHANT_MONTHLY_FEE_PI, days: 30, memo: "Taxipic Merchant plan - 30 days" },
} as const;

export type PlanId = keyof typeof PLANS;

export function getPlan(id: unknown) {
  if (typeof id !== "string" || !(id in PLANS)) throw new HttpError(400, "Unknown subscription plan");
  return PLANS[id as PlanId];
}

// Renewals stack: a new period starts at the later of now or the current expiry.
export function nextExpiry(current: Date | null | undefined, days: number, now = new Date()): Date {
  const start = current && current.getTime() > now.getTime() ? current : now;
  return new Date(start.getTime() + days * 24 * 3600 * 1000);
}

export async function activateVip(userId: string) {
  const [user] = await db.select({ vipUntil: users.vipUntil }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new HttpError(404, "User not found");
  const vipUntil = nextExpiry(user.vipUntil, PLANS.VIP.days);
  await db.update(users).set({ vipUntil }).where(eq(users.id, userId));
  return vipUntil;
}

export async function activateMerchantPlan(ownerId: string) {
  const [m] = await db
    .select({ id: merchants.id, until: merchants.subscriptionPaidUntil })
    .from(merchants)
    .where(eq(merchants.ownerId, ownerId))
    .limit(1);
  if (!m) throw new HttpError(404, "Merchant profile not found");
  const until = nextExpiry(m.until, PLANS.MERCHANT.days);
  await db
    .update(merchants)
    .set({ subscriptionPaidUntil: until, subscriptionType: "MONTHLY_FIXED" })
    .where(eq(merchants.id, m.id));
  return until;
}
