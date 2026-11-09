import { and, eq } from "drizzle-orm";
import type { Config } from "@netlify/functions";
import { db } from "../../db/index.js";
import { merchants, menuItems, users } from "../../db/schema.js";
import { optionalUser, requireUser } from "../../server/auth.js";
import { HttpError, readJson, requireNumber, requireString, optionalString, router } from "../../server/http.js";

const providerTypes = new Set([
  "RESTAURANT", "SUPERMARKET", "GROCERY", "JUICE_SHOP", "BAKERY", "PHARMACY",
  "FASHION", "ELECTRONICS", "BEAUTY_SALON", "BARBER", "LAUNDRY", "HOME_SERVICES",
  "AUTO_SERVICE", "FLOWERS", "BOOKSTORE", "OTHER",
]);
const templateFor = (type: string) => ({
  RESTAURANT: "restaurant", SUPERMARKET: "supermarket", GROCERY: "grocery",
  JUICE_SHOP: "juice-bar", BAKERY: "bakery", PHARMACY: "pharmacy",
  FASHION: "fashion", ELECTRONICS: "electronics", BEAUTY_SALON: "salon",
  BARBER: "barber", LAUNDRY: "laundry", HOME_SERVICES: "home-services",
  AUTO_SERVICE: "auto-service", FLOWERS: "florist", BOOKSTORE: "bookstore", OTHER: "general",
}[type] ?? "general");

async function getOwnedMerchant(userId: string) {
  const [merchant] = await db.select().from(merchants).where(eq(merchants.ownerId, userId)).limit(1);
  return merchant ?? null;
}
function cleanOptions(value: unknown) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new HttpError(400, "Options must be a list");
  return value.slice(0, 20).map((entry) => {
    if (!entry || typeof entry !== "object") throw new HttpError(400, "Invalid option group");
    const group = entry as { name?: unknown; values?: unknown };
    if (typeof group.name !== "string" || !Array.isArray(group.values)) throw new HttpError(400, "Invalid option group");
    return { name: group.name.trim().slice(0, 60), values: group.values.filter((v): v is string => typeof v === "string").slice(0, 20).map(v => v.slice(0, 60)) };
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
    const latitude = body.latitude === undefined || body.latitude === "" ? 0 : requireNumber(body.latitude, "latitude", -90, 90);
    const longitude = body.longitude === undefined || body.longitude === "" ? 0 : requireNumber(body.longitude, "longitude", -180, 180);
    const address = optionalString(body.address, 255) ?? "";
    const serviceMode = body.serviceMode === "PICKUP_ONLY" || body.serviceMode === "ON_SITE" ? body.serviceMode : "DELIVERY_AND_PICKUP";
    const values = {
      ownerId: user.id, businessName, merchantType: type, templateKey: templateFor(type), serviceMode,
      description: optionalString(body.description, 1000) ?? "", cuisine: optionalString(body.cuisine, 60) ?? "",
      latitude, longitude, address, logoUrl: optionalString(body.logoUrl, 500), coverUrl: optionalString(body.coverUrl, 500),
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
      imageUrl: optionalString(body.imageUrl, 500), options: cleanOptions(body.options),
      isAvailable: body.isAvailable !== false,
    }).returning();
    return Response.json({ item }, { status: 201 });
  }],
  ["PATCH", "/api/provider/items/:id", async (req, params) => {
    const user = await requireUser(req, "MERCHANT");
    const merchant = await getOwnedMerchant(user.id);
    if (!merchant) throw new HttpError(404, "Provider profile not found");
    const body = await readJson<Record<string, unknown>>(req);
    const values: Record<string, unknown> = {};
    if (body.title !== undefined) values.title = requireString(body.title, "title", 150);
    if (body.pricePi !== undefined) values.pricePi = requireNumber(body.pricePi, "pricePi", 0.0000001, 100000000);
    if (body.isAvailable !== undefined) values.isAvailable = body.isAvailable === true;
    if (body.stockQuantity !== undefined) values.stockQuantity = body.stockQuantity === null ? null : requireNumber(body.stockQuantity, "stockQuantity", 0, 100000000);
    if (body.description !== undefined) values.description = optionalString(body.description, 1000) ?? "";
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
