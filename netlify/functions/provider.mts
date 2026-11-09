import { and, eq } from "drizzle-orm";
import type { Config } from "@netlify/functions";
import { db } from "../../db/index.js";
import { merchants, menuItems, users } from "../../db/schema.js";
import { requireUser } from "../../server/auth.js";
import { HttpError, readJson, requireNumber, requireString, optionalString, router } from "../../server/http.js";

const providerTypes = new Set([
  "RESTAURANT", "SUPERMARKET", "GROCERY", "JUICE_SHOP", "BAKERY", "PHARMACY",
  "FASHION", "ELECTRONICS", "BEAUTY_SALON", "BARBER", "LAUNDRY", "HOME_SERVICES",
  "AUTO_SERVICE", "FLOWERS", "BOOKSTORE", "OTHER",
]);
const templates: Record<string, string> = {
  RESTAURANT: "restaurant", SUPERMARKET: "supermarket", GROCERY: "grocery",
  JUICE_SHOP: "juice-bar", BAKERY: "bakery", PHARMACY: "pharmacy",
  FASHION: "fashion", ELECTRONICS: "electronics", BEAUTY_SALON: "salon",
  BARBER: "barber", LAUNDRY: "laundry", HOME_SERVICES: "home-services",
  AUTO_SERVICE: "auto-service", FLOWERS: "florist", BOOKSTORE: "bookstore", OTHER: "general",
};
const templateFor = (type: string) => templates[type] ?? "general";

async function getOwnedMerchant(userId: string) {
  const [merchant] = await db.select().from(merchants).where(eq(merchants.ownerId, userId)).limit(1);
  return merchant ?? null;
}
function optionalHttpsUrl(value: unknown, max = 500): string | undefined {
  const raw = optionalString(value, max);
  if (!raw) return undefined;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:") throw new Error("https required");
  } catch {
    throw new HttpError(400, "Image URLs must be valid HTTPS URLs");
  }
  return raw;
}

function cleanOptions(value: unknown) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new HttpError(400, "Options must be a list");
  if (value.length > 20) throw new HttpError(400, "Too many option groups");
  return value.map((entry) => {
    if (!entry || typeof entry !== "object") throw new HttpError(400, "Invalid option group");
    const group = entry as { name?: unknown; values?: unknown };
    if (typeof group.name !== "string" || !group.name.trim() || !Array.isArray(group.values) || !group.values.length || group.values.length > 20) {
      throw new HttpError(400, "Each option group needs a name and 1–20 values");
    }
    if (group.values.some((v) => typeof v !== "string" || !v.trim() || v.length > 60)) {
      throw new HttpError(400, "Option values must be non-empty strings of at most 60 characters");
    }
    return { name: group.name.trim().slice(0, 60), values: group.values.map((v: string) => v.trim()) };
  });
}

const handler = router([
  ["GET", "/api/provider/catalog", async (req) => {
    const user = await requireUser(req);
    const merchant = await getOwnedMerchant(user.id);
    if (!merchant) return Response.json({ profile: null, items: [] });
    const items = await db.select().from(menuItems).where(eq(menuItems.merchantId, merchant.id));
    return Response.json({ profile: merchant, items });
  }],
  ["PUT", "/api/provider/profile", async (req) => {
    const user = await requireUser(req);
    const body = await readJson<Record<string, unknown>>(req);
    const type = requireString(body.merchantType, "merchantType", 40).toUpperCase();
    if (!providerTypes.has(type)) throw new HttpError(400, "Unsupported provider category");
    const businessName = requireString(body.businessName, "businessName", 150);
    const latitude = requireNumber(body.latitude, "latitude", -90, 90);
    const longitude = requireNumber(body.longitude, "longitude", -180, 180);
    const address = optionalString(body.address, 255) ?? "";
    const serviceMode = body.serviceMode === "PICKUP_ONLY" || body.serviceMode === "ON_SITE" ? body.serviceMode : "DELIVERY_AND_PICKUP";
    const values = {
      ownerId: user.id, businessName, merchantType: type, templateKey: templateFor(type), serviceMode,
      description: optionalString(body.description, 1000) ?? "", cuisine: optionalString(body.cuisine, 60) ?? "",
      latitude, longitude, address, logoUrl: optionalHttpsUrl(body.logoUrl), coverUrl: optionalHttpsUrl(body.coverUrl),
    };
    const [merchant] = await db.insert(merchants).values(values)
      .onConflictDoUpdate({ target: merchants.ownerId, set: { ...values, ownerId: user.id } }).returning();
    await db.update(users).set({ role: "MERCHANT" }).where(eq(users.id, user.id));
    return Response.json({ profile: merchant }, { status: 200 });
  }],
  ["POST", "/api/provider/items", async (req) => {
    const user = await requireUser(req, "MERCHANT");
    const merchant = await getOwnedMerchant(user.id);
    if (!merchant) throw new HttpError(404, "Create your provider profile first");
    const body = await readJson<Record<string, unknown>>(req);
    const title = requireString(body.title, "title", 150);
    const pricePi = requireNumber(body.pricePi, "pricePi", 0.0000001, 100000000);
    const itemType = body.itemType === "SERVICE" ? "SERVICE" : "PRODUCT";
    const stockQuantity = body.stockQuantity === "" || body.stockQuantity === undefined || body.stockQuantity === null
      ? null : requireNumber(body.stockQuantity, "stockQuantity", 0, 100000000);
    const [item] = await db.insert(menuItems).values({
      merchantId: merchant.id, title, pricePi,
      itemType, description: optionalString(body.description, 1000) ?? "",
      ingredients: optionalString(body.details, 1000) ?? "",
      category: optionalString(body.category, 60) ?? "",
      sku: optionalString(body.sku, 80), stockQuantity,
      unit: optionalString(body.unit, 30) ?? (itemType === "SERVICE" ? "service" : "item"),
      imageUrl: optionalHttpsUrl(body.imageUrl), options: cleanOptions(body.options),
      isAvailable: body.isAvailable !== false,
    }).returning();
    return Response.json({ item }, { status: 201 });
  }],
  ["PATCH", "/api/provider/items/:id", async (req, params) => {
    const user = await requireUser(req, "MERCHANT");
    const merchant = await getOwnedMerchant(user.id);
    if (!merchant) throw new HttpError(404, "Provider profile not found");
    const body = await readJson<Record<string, unknown>>(req);
    const values: Partial<typeof menuItems.$inferInsert> = {};
    if (body.title !== undefined) values.title = requireString(body.title, "title", 150);
    if (body.pricePi !== undefined) values.pricePi = requireNumber(body.pricePi, "pricePi", 0.0000001, 100000000);
    if (body.isAvailable !== undefined) {
      if (typeof body.isAvailable !== "boolean") throw new HttpError(400, "isAvailable must be a boolean");
      values.isAvailable = body.isAvailable;
    }
    if (body.stockQuantity !== undefined) values.stockQuantity = body.stockQuantity === null ? null : requireNumber(body.stockQuantity, "stockQuantity", 0, 100000000);
    if (body.description !== undefined) values.description = optionalString(body.description, 1000) ?? "";
    if (body.category !== undefined) values.category = optionalString(body.category, 60) ?? "";
    if (body.itemType !== undefined) {
      if (body.itemType !== "PRODUCT" && body.itemType !== "SERVICE") throw new HttpError(400, "itemType must be PRODUCT or SERVICE");
      values.itemType = body.itemType;
    }
    if (body.sku !== undefined) values.sku = optionalString(body.sku, 80);
    if (body.unit !== undefined) values.unit = optionalString(body.unit, 30) ?? "item";
    if (body.imageUrl !== undefined) values.imageUrl = optionalHttpsUrl(body.imageUrl);
    if (body.options !== undefined) values.options = cleanOptions(body.options);
    if (body.details !== undefined) values.ingredients = optionalString(body.details, 1000) ?? "";
    if (!Object.keys(values).length) throw new HttpError(400, "No supported fields were supplied");
    const [item] = await db.update(menuItems).set(values).where(and(eq(menuItems.id, params.id), eq(menuItems.merchantId, merchant.id))).returning();
    if (!item) throw new HttpError(404, "Catalog item not found");
    return Response.json({ item });
  }],
  ["DELETE", "/api/provider/items/:id", async (req, params) => {
    const user = await requireUser(req, "MERCHANT");
    const merchant = await getOwnedMerchant(user.id);
    if (!merchant) throw new HttpError(404, "Provider profile not found");
    const [item] = await db.delete(menuItems).where(and(eq(menuItems.id, params.id), eq(menuItems.merchantId, merchant.id))).returning({ id: menuItems.id });
    if (!item) throw new HttpError(404, "Catalog item not found");
    return Response.json({ deleted: true, id: item.id });
  }],
]);

export default handler;
export const config: Config = { path: "/api/provider/*" };
