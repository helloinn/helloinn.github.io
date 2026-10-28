import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { and, eq, gt } from "drizzle-orm";
import { db } from "../db/index.js";
import { sessions, users, type Role } from "../db/schema.js";
import { HttpError } from "./http.js";
import { levelFor } from "./rewards.js";

const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;
const SESSION_DAYS = 30;

export type User = typeof users.$inferSelect;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, 64);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = await scryptAsync(password, Buffer.from(saltHex, "hex"), expected.length);
  return timingSafeEqual(expected, actual);
}

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db.insert(sessions).values({
    tokenHash: hashToken(token),
    userId,
    expiresAt: new Date(Date.now() + SESSION_DAYS * 24 * 3600 * 1000),
  });
  return token;
}

function bearerToken(req: Request): string | null {
  const header = req.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : null;
}

export async function destroySession(req: Request) {
  const token = bearerToken(req);
  if (token) await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
}

export async function optionalUser(req: Request): Promise<User | null> {
  const token = bearerToken(req);
  if (!token) return null;
  const [row] = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return row?.user ?? null;
}

export async function requireUser(req: Request, ...roles: Role[]): Promise<User> {
  const user = await optionalUser(req);
  if (!user) throw new HttpError(401, "Please sign in first");
  if (roles.length && !roles.includes(user.role)) throw new HttpError(403, "This action is not available for your role");
  return user;
}

export const isVip = (user: Pick<User, "vipUntil">) => !!user.vipUntil && user.vipUntil.getTime() > Date.now();

// The shape of a user that is safe to send to the browser.
export function publicUser(user: User) {
  const level = levelFor(user.xpPoints);
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    hasPiAccount: !!user.piUid,
    role: user.role,
    isVip: isVip(user),
    vipUntil: user.vipUntil,
    xpPoints: user.xpPoints,
    level: level.level,
    nextLevelXp: level.nextLevelXp,
    badges: level.badges.concat(isVip(user) ? ["VIP"] : []),
    reputationScore: Math.round(user.reputationScore * 100) / 100,
    ratingCount: user.ratingCount,
    walletBalancePi: Math.round(user.walletBalancePi * 10000) / 10000,
    walletAddress: user.walletAddress,
    rideCoupons: user.rideCoupons,
    language: user.language,
    createdAt: user.createdAt,
  };
}
