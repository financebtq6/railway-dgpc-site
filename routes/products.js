// Read-only public products API, backed by PostgreSQL.
// Returns the same flat product shape the frontend previously got from
// data/products.json (see app.js / cart.js via js/products-loader.js),
// which is now used only as an offline fallback if this endpoint fails.
const express = require('express');
const db = require('../db/client');
const { serializeProduct } = require('../db/serialize-product');

const router = express.Router();

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
      serializeProduct(row, imagesByProduct.get(row.id) || [])
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
