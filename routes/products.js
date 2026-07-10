// Read-only public products API, backed by PostgreSQL.
// Returns the same flat product shape the frontend already gets from
// data/products.json (see app.js / cart.js), so it can be swapped in later
// without a frontend rewrite. Not currently wired into the live catalog.
const express = require('express');
const db = require('../db/client');

const router = express.Router();

function toApiProduct(row, images) {
  const orderedImages = images.length ? images : (row.image ? [row.image] : []);

  const product = {
    id: row.id,
    type: row.type,
    title: row.title,
    price: Number(row.price),
    image: row.image || orderedImages[0] || null,
    images: orderedImages,
    specs: row.specs || {},
    full_specs: row.full_specs || {},
    description: row.description,
    descPartOne: row.desc_part_one,
    descPartTwo: row.desc_part_two,
    descPartThree: row.desc_part_three,
    descPartFour: row.desc_part_four,
    descPartFive: row.desc_part_five,
    descPartSix: row.desc_part_six,
    olx_url: row.olx_url,
    url: row.prom_url
  };

  if (row.subtype) product.subtype = row.subtype;
  if (row.old_price !== null && row.old_price !== undefined) product.oldPrice = Number(row.old_price);

  return product;
}

router.get('/products', async (req, res) => {
  if (!db.isConfigured) {
    return res.status(503).json({ error: 'Products database unavailable' });
  }

  try {
    const productsResult = await db.query(
      `SELECT id, type, subtype, title, price, old_price, image, description,
              desc_part_one, desc_part_two, desc_part_three, desc_part_four,
              desc_part_five, desc_part_six, specs, full_specs, olx_url, prom_url
       FROM products
       WHERE status = 'published'
       ORDER BY sort_order ASC, created_at ASC, id ASC`
    );

    const productIds = productsResult.rows.map((r) => r.id);
    const imagesByProduct = new Map();

    if (productIds.length) {
      const imagesResult = await db.query(
        `SELECT product_id, url
         FROM product_images
         WHERE product_id = ANY($1)
         ORDER BY product_id, sort_order ASC, id ASC`,
        [productIds]
      );
      for (const row of imagesResult.rows) {
        if (!imagesByProduct.has(row.product_id)) imagesByProduct.set(row.product_id, []);
        imagesByProduct.get(row.product_id).push(row.url);
      }
    }

    const products = productsResult.rows.map((row) =>
      toApiProduct(row, imagesByProduct.get(row.id) || [])
    );

    res.set('Content-Type', 'application/json; charset=utf-8');
    res.set('Cache-Control', 'no-store');
    return res.json(products);
  } catch (err) {
    console.error('[api/products] Query failed:', err.message);
    return res.status(503).json({ error: 'Products database unavailable' });
  }
});

module.exports = router;
