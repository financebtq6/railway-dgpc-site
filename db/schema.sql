-- Digital PC product database schema.
-- Compatible with the current data/products.json shape (54 products as of writing).
-- Safe to re-run: uses IF NOT EXISTS everywhere.

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'computers',
  subtype TEXT NULL,
  title TEXT NOT NULL,
  price INTEGER NOT NULL,
  old_price INTEGER NULL,
  image TEXT NULL,
  description TEXT NOT NULL,
  desc_part_one TEXT NULL,
  desc_part_two TEXT NULL,
  desc_part_three TEXT NULL,
  desc_part_four TEXT NULL,
  desc_part_five TEXT NULL,
  desc_part_six TEXT NULL,
  specs JSONB NOT NULL DEFAULT '{}',
  full_specs JSONB NOT NULL DEFAULT '{}',
  olx_url TEXT NULL,
  prom_url TEXT NULL,
  status TEXT NOT NULL DEFAULT 'published',
  featured BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_images (
  id BIGSERIAL PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_main BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_status ON products (status);
CREATE INDEX IF NOT EXISTS idx_products_type ON products (type);
CREATE INDEX IF NOT EXISTS idx_products_subtype ON products (subtype);
CREATE INDEX IF NOT EXISTS idx_products_sort_order ON products (sort_order);
CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images (product_id);
CREATE INDEX IF NOT EXISTS idx_product_images_sort_order ON product_images (sort_order);
