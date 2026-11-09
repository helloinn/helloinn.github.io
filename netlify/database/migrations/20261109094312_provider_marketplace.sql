ALTER TABLE merchants
  ADD COLUMN IF NOT EXISTS merchant_type varchar(40) NOT NULL DEFAULT 'RESTAURANT',
  ADD COLUMN IF NOT EXISTS template_key varchar(60) NOT NULL DEFAULT 'restaurant',
  ADD COLUMN IF NOT EXISTS service_mode varchar(30) NOT NULL DEFAULT 'DELIVERY_AND_PICKUP',
  ADD COLUMN IF NOT EXISTS logo_url varchar(500),
  ADD COLUMN IF NOT EXISTS cover_url varchar(500),
  ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS item_type varchar(20) NOT NULL DEFAULT 'PRODUCT',
  ADD COLUMN IF NOT EXISTS sku varchar(80),
  ADD COLUMN IF NOT EXISTS stock_quantity integer,
  ADD COLUMN IF NOT NULL DEFAULT 'item',
  ADD COLUMN IF NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS merchants_type_open_idx ON merchants (merchant_type, is_open);
CREATE INDEX IF NOT EXISTS menu_items_merchant_available_idx ON menu_items (merchant_id, is_available);
