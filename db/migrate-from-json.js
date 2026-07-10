// One-time, manually-run migration: data/products.json -> PostgreSQL.
//
// Safe to re-run: products are upserted by their existing id (id is never
// regenerated), and each product's images are replaced wholesale so re-runs
// don't accumulate duplicate image rows.
//
// Usage: npm run db:migrate-products
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const PRODUCTS_JSON_PATH = path.join(__dirname, '..', 'data', 'products.json');

const FIELD_MAP = {
  descPartOne: 'desc_part_one',
  descPartTwo: 'desc_part_two',
  descPartThree: 'desc_part_three',
  descPartFour: 'desc_part_four',
  descPartFive: 'desc_part_five',
  descPartSix: 'desc_part_six',
  url: 'prom_url'
};

function loadProducts() {
  const raw = fs.readFileSync(PRODUCTS_JSON_PATH, 'utf8');
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) {
    throw new Error('data/products.json root value must be an array.');
  }
  return data;
}

function validateProducts(products) {
  const failures = [];
  const seenIds = new Map();

  products.forEach((p, index) => {
    const label = p && p.id ? p.id : `#${index}`;
    const missing = [];
    if (!p || typeof p !== 'object') {
      failures.push(`${label}: not an object`);
      return;
    }
    if (!p.id) missing.push('id');
    if (!p.title) missing.push('title');
    if (p.price === undefined || p.price === null || Number.isNaN(Number(p.price))) missing.push('price');
    if (!p.description) missing.push('description');

    if (missing.length) {
      failures.push(`${label}: missing/invalid ${missing.join(', ')}`);
      return;
    }

    if (seenIds.has(p.id)) {
      failures.push(`${label}: duplicate id (also at index ${seenIds.get(p.id)})`);
    } else {
      seenIds.set(p.id, index);
    }
  });

  return failures;
}

function normalizeProduct(p) {
  const type = p.type && String(p.type).trim() ? p.type : 'computers';
  const subtype = p.subtype || null;

  const images = Array.isArray(p.images) && p.images.length
    ? p.images
    : (p.image ? [p.image] : []);

  return {
    id: p.id,
    type,
    subtype,
    title: p.title,
    price: Math.round(Number(p.price)),
    old_price: p.oldPrice !== undefined && p.oldPrice !== null ? Math.round(Number(p.oldPrice)) : null,
    image: p.image || (images[0] || null),
    description: p.description,
    desc_part_one: p.descPartOne || null,
    desc_part_two: p.descPartTwo || null,
    desc_part_three: p.descPartThree || null,
    desc_part_four: p.descPartFour || null,
    desc_part_five: p.descPartFive || null,
    desc_part_six: p.descPartSix || null,
    specs: p.specs || {},
    full_specs: p.full_specs || p.fullSpecs || {},
    olx_url: p.olx_url || null,
    prom_url: p.url || p.prom_url || null,
    images
  };
}

async function migrate() {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.error('[migrate] DATABASE_URL is not set. Aborting — nothing was touched.');
    process.exitCode = 1;
    return;
  }

  console.log('[migrate] Reading data/products.json ...');
  const rawProducts = loadProducts();
  console.log(`[migrate] Found ${rawProducts.length} products.`);

  const failures = validateProducts(rawProducts);
  if (failures.length) {
    console.error(`[migrate] Validation failed for ${failures.length} product(s):`);
    failures.forEach((f) => console.error(`  - ${f}`));
    console.error('[migrate] Aborting — no database changes were made.');
    process.exitCode = 1;
    return;
  }
  console.log('[migrate] Validation passed. No duplicate or invalid products.');

  const useSSL = /railway|render|neon|supabase/i.test(DATABASE_URL) || process.env.DATABASE_SSL === 'true';
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: useSSL ? { rejectUnauthorized: false } : false
  });

  const client = await pool.connect();
  let insertedOrUpdated = 0;
  let imagesInserted = 0;

  try {
    await client.query('BEGIN');

    for (const raw of rawProducts) {
      const p = normalizeProduct(raw);

      await client.query(
        `INSERT INTO products (
           id, type, subtype, title, price, old_price, image, description,
           desc_part_one, desc_part_two, desc_part_three, desc_part_four,
           desc_part_five, desc_part_six, specs, full_specs, olx_url, prom_url,
           updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8,
           $9, $10, $11, $12,
           $13, $14, $15, $16, $17, $18,
           NOW()
         )
         ON CONFLICT (id) DO UPDATE SET
           type = EXCLUDED.type,
           subtype = EXCLUDED.subtype,
           title = EXCLUDED.title,
           price = EXCLUDED.price,
           old_price = EXCLUDED.old_price,
           image = EXCLUDED.image,
           description = EXCLUDED.description,
           desc_part_one = EXCLUDED.desc_part_one,
           desc_part_two = EXCLUDED.desc_part_two,
           desc_part_three = EXCLUDED.desc_part_three,
           desc_part_four = EXCLUDED.desc_part_four,
           desc_part_five = EXCLUDED.desc_part_five,
           desc_part_six = EXCLUDED.desc_part_six,
           specs = EXCLUDED.specs,
           full_specs = EXCLUDED.full_specs,
           olx_url = EXCLUDED.olx_url,
           prom_url = EXCLUDED.prom_url,
           updated_at = NOW()`,
        [
          p.id, p.type, p.subtype, p.title, p.price, p.old_price, p.image, p.description,
          p.desc_part_one, p.desc_part_two, p.desc_part_three, p.desc_part_four,
          p.desc_part_five, p.desc_part_six, JSON.stringify(p.specs), JSON.stringify(p.full_specs),
          p.olx_url, p.prom_url
        ]
      );
      insertedOrUpdated += 1;

      // Replace this product's images wholesale so re-running the migration
      // doesn't accumulate duplicates and stays in sync with the JSON order.
      await client.query('DELETE FROM product_images WHERE product_id = $1', [p.id]);

      for (let i = 0; i < p.images.length; i += 1) {
        await client.query(
          `INSERT INTO product_images (product_id, url, sort_order, is_main)
           VALUES ($1, $2, $3, $4)`,
          [p.id, p.images[i], i, i === 0]
        );
        imagesInserted += 1;
      }
    }

    await client.query('COMMIT');

    console.log('[migrate] Summary:');
    console.log(`  products processed: ${rawProducts.length}`);
    console.log(`  products inserted/updated: ${insertedOrUpdated}`);
    console.log(`  images inserted: ${imagesInserted}`);
    console.log(`  validation failures: 0`);
    console.log('[migrate] Done. data/products.json was not modified.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[migrate] Error during migration, rolled back all changes:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
