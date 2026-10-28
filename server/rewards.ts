import { eq, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { merchants, users } from "../db/schema.js";

export const XP = {
  CUSTOMER_JOB_COMPLETED: 10,
  PROVIDER_JOB_COMPLETED: 20,
  FIVE_STAR_RECEIVED: 5,
  RATING_GIVEN: 2,
  FAST_COMPLETION: 5,
  AD_REWARD: 15,
} as const;

export const VIP_XP_MULTIPLIER = 1.5;

const BADGES: [minXp: number, name: string][] = [
  [100, "Rising Star"],
  [500, "Trusted Pioneer"],
  [2000, "Road Legend"],
  [5000, "Taxipic Icon"],
];

export function levelFor(xp: number) {
  const level = Math.floor(Math.sqrt(xp / 50)) + 1;
  return {
    level,
    nextLevelXp: 50 * level * level,
    badges: BADGES.filter(([min]) => xp >= min).map(([, name]) => name),
  };
}

type Executor = Pick<typeof db, "update">;

export async function awardXp(userId: string, amount: number, executor: Executor = db) {
  // VIP members earn XP faster; the multiplier is resolved in SQL so it is always current.
  await executor
    .update(users)
    .set({
      xpPoints: sql`${users.xpPoints} + CASE WHEN ${users.vipUntil} > now() THEN ${Math.round(
        amount * VIP_XP_MULTIPLIER,
      )} ELSE ${amount} END`,
    })
    .where(eq(users.id, userId));
}

// Rolling average reputation score.
export async function applyUserRating(userId: string, stars: number, executor: Executor = db) {
  await executor
    .update(users)
    .set({
      reputationScore: sql`(${users.reputationScore} * ${users.ratingCount} + ${stars}) / (${users.ratingCount} + 1)`,
      ratingCount: sql`${users.ratingCount} + 1`,
    })
    .where(eq(users.id, userId));
}

export async function applyMerchantRating(merchantId: string, stars: number, executor: Executor = db) {
  await executor
    .update(merchants)
    .set({
      rating: sql`(${merchants.rating} * ${merchants.ratingCount} + ${stars}) / (${merchants.ratingCount} + 1)`,
      ratingCount: sql`${merchants.ratingCount} + 1`,
    })
    .where(eq(merchants.id, merchantId));
}
