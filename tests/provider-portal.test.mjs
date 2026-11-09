import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("provider schema and migration expose the same marketplace fields", async () => {
  const schema = await read("../db/schema.ts");
  const migration = await read("../netlify/database/migrations/0002_provider_marketplace.sql");
  for (const field of ["merchantType", "templateKey", "serviceMode", "logoUrl", "coverUrl", "settings"]) {
    assert.match(schema, new RegExp("\\b" + field + "\\b"), `schema field missing: ${field}`);
  }
  for (const column of ["merchant_type", "template_key", "service_mode", "logo_url", "cover_url", "settings"]) {
    assert.ok(migration.includes(column), `migration column missing: ${column}`);
  }
  for (const column of ["item_type", "sku", "stock_quantity", "unit", "image_url", "options"]) {
    assert.ok(migration.includes(column), `catalog migration column missing: ${column}`);
  }
});

test("provider API contains every category and owner-scoped catalog mutations", async () => {
  const api = await read("../netlify/functions/provider.mts");
  const expected = [
    "RESTAURANT", "SUPERMARKET", "GROCERY", "JUICE_SHOP", "BAKERY", "PHARMACY",
    "FASHION", "ELECTRONICS", "BEAUTY_SALON", "BARBER", "LAUNDRY", "HOME_SERVICES",
    "AUTO_SERVICE", "FLOWERS", "BOOKSTORE", "OTHER",
  ];
  for (const type of expected) assert.ok(api.includes(`"${type}"`), `provider category missing: ${type}`);
  assert.match(api, /GET", "\/api\/provider\/catalog"/);
  assert.match(api, /PUT", "\/api\/provider\/profile"/);
  assert.match(api, /POST", "\/api\/provider\/items"/);
  assert.match(api, /PATCH", "\/api\/provider\/items\/:id"/);
  assert.match(api, /DELETE", "\/api\/provider\/items\/:id"/);
  assert.match(api, /eq\(menuItems\.merchantId, merchant\.id\)/);
  assert.match(api, /eq\(menuItems\.merchantId, merchant\.id\)\)\)\.returning/);
  assert.match(api, /function optionalHttpsUrl/);
  assert.match(api, /parsed\.protocol !== "https:"/);
  assert.match(api, /Too many option groups/);
});

test("provider portal has Pi authentication and accessible status feedback", async () => {
  const html = await read("../public/provider-portal.html");
  assert.match(html, /sdk\.minepi\.com\/pi-sdk\.js/);
  assert.match(html, /Pi\.authenticate\(\["username"\]/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /id="merchantType"/);
  assert.match(html, /id="profile-form"/);
  assert.match(html, /id="item-form"/);
});
