// Protected admin product-management API. Backs admin/dashboard.html and
// admin/product-form.html. All routes require an authenticated admin
// session (see middleware/require-admin.js) and never touch product_images
// except in the list-images / duplicate-images paths documented below.
const crypto = require('crypto');
const express = require('express');
const db = require('../db/client');
const r2 = require('../storage/r2-client');
const { serializeProduct } = require('../db/serialize-product');
const { requireAdminApi } = require('../middleware/require-admin');

const router = express.Router();

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  res.set('X-Content-Type-Options', 'nosniff');
  next();
});

router.use(requireAdminApi);

const ALLOWED_TYPES = ['computers', 'periphery'];
const ALLOWED_STATUSES = ['draft', 'published', 'hidden'];
const DESC_PART_KEYS = ['descPartOne', 'descPartTwo', 'descPartThree', 'descPartFour', 'descPartFive', 'descPartSix'];

// Product ids are generated here, never derived from the title and never
// editable afterwards (PUT /products/:id rejects any attempt to change id).
// Short random hex — independent of title, so renaming a product never
// has any reason to touch its id, its R2 folder, or anything that
// references it by id.
function generateProductId() {
  return crypto.randomBytes(5).toString('hex');
}

async function findFreeProductId(executor) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateProductId();
    const existing = await executor.query('SELECT 1 FROM products WHERE id = $1', [candidate]);
    if (!existing.rows.length) return candidate;
  }
  throw new Error('Could not generate a free product id after 5 attempts');
}

const PRODUCT_COLUMNS = `id, type, subtype, title, price, old_price, image, description,
       desc_part_one, desc_part_two, desc_part_three, desc_part_four,
       desc_part_five, desc_part_six, specs, full_specs, olx_url, prom_url,
       status, featured, sort_order, created_at, updated_at`;

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

// Maps a `products` row (+ ordered image URLs) into the shape the admin UI
// consumes. Wraps db/serialize-product.js for the publicPreview field so
// admins can see exactly what the public API would return for this row.
function rowToAdminProduct(row, images) {
  const orderedImages = images || [];
  return {
    id: row.id,
    type: row.type,
    subtype: row.subtype,
    title: row.title,
    price: Number(row.price),
    oldPrice: row.old_price !== null && row.old_price !== undefined ? Number(row.old_price) : null,
    status: row.status,
    featured: !!row.featured,
    sortOrder: row.sort_order,
    image: row.image,
    images: orderedImages,
    description: row.description,
    descPartOne: row.desc_part_one,
    descPartTwo: row.desc_part_two,
    descPartThree: row.desc_part_three,
    descPartFour: row.desc_part_four,
    descPartFive: row.desc_part_five,
    descPartSix: row.desc_part_six,
    specs: row.specs || {},
    full_specs: row.full_specs || {},
    olx_url: row.olx_url,
    prom_url: row.prom_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publicPreview: serializeProduct(row, orderedImages)
  };
}

// Validates and normalizes an incoming create/update payload. Returns
// { errors, data } — errors is a list of user-readable strings (never raw
// SQL or driver output), data is ready to bind into parameterized queries.
// id is never read from the payload here — see generateProductId/
// findFreeProductId, which is the only thing that ever assigns a new id.
function validateProductPayload(body) {
  const errors = [];
  const data = {};
  const src = body && typeof body === 'object' ? body : {};

  const title = typeof src.title === 'string' ? src.title.trim() : '';
  if (!title) errors.push('title is required');
  else if (title.length > 300) errors.push('title must be 300 characters or fewer');
  data.title = title;

  const type = typeof src.type === 'string' ? src.type.trim() : '';
  if (!ALLOWED_TYPES.includes(type)) errors.push(`type must be one of: ${ALLOWED_TYPES.join(', ')}`);
  data.type = type;

  const subtype = typeof src.subtype === 'string' ? src.subtype.trim() : '';
  if (subtype.length > 100) errors.push('subtype must be 100 characters or fewer');
  data.subtype = subtype || null;

  const price = Number(src.price);
  if (!Number.isFinite(price) || !Number.isInteger(price) || price < 0) {
    errors.push('price must be a non-negative whole number');
  }
  data.price = price;

  let oldPrice = null;
  if (src.oldPrice !== undefined && src.oldPrice !== null && src.oldPrice !== '') {
    oldPrice = Number(src.oldPrice);
    if (!Number.isFinite(oldPrice) || !Number.isInteger(oldPrice) || oldPrice < 0) {
      errors.push('oldPrice must be a non-negative whole number');
    }
  }
  data.oldPrice = oldPrice;

  const status = typeof src.status === 'string' && src.status.trim() ? src.status.trim() : 'draft';
  if (!ALLOWED_STATUSES.includes(status)) errors.push(`status must be one of: ${ALLOWED_STATUSES.join(', ')}`);
  data.status = status;

  data.featured = src.featured === true || src.featured === 'true';

  let sortOrder = 0;
  if (src.sortOrder !== undefined && src.sortOrder !== null && src.sortOrder !== '') {
    sortOrder = Number(src.sortOrder);
    if (!Number.isFinite(sortOrder) || !Number.isInteger(sortOrder)) errors.push('sortOrder must be a whole number');
  }
  data.sortOrder = sortOrder;

  const description = typeof src.description === 'string' ? src.description.trim() : '';
  if (!description) errors.push('description is required');
  data.description = description;

  DESC_PART_KEYS.forEach((key) => {
    const val = typeof src[key] === 'string' ? src[key].trim() : '';
    data[key] = val || null;
  });

  data.specs = isPlainObject(src.specs) ? src.specs : {};

  if (src.full_specs !== undefined && !isPlainObject(src.full_specs)) {
    errors.push('full_specs must be a JSON object');
    data.full_specs = {};
  } else {
    data.full_specs = src.full_specs || {};
  }

  ['olx_url', 'prom_url'].forEach((key) => {
    const val = typeof src[key] === 'string' ? src[key].trim() : '';
    if (val && !/^https?:\/\/\S+$/i.test(val)) errors.push(`${key} must be a valid http(s) URL`);
    data[key] = val || null;
  });

  return { errors, data };
}

// Validates the { newTitle } body required by POST /duplicate. The new
// product's id is always server-generated (see findFreeProductId) — any
// id/newId the client sends is ignored.
function validateDuplicatePayload(body) {
  const errors = [];
  const src = body && typeof body === 'object' ? body : {};

  const newTitle = typeof src.newTitle === 'string' ? src.newTitle.trim() : '';
  if (!newTitle) errors.push('newTitle is required');
  else if (newTitle.length > 300) errors.push('newTitle must be 300 characters or fewer');

  return { errors, newTitle };
}

async function fetchImagesForIds(productIds) {
  const map = new Map();
  if (!productIds.length) return map;
  const result = await db.query(
    `SELECT product_id, url FROM product_images WHERE product_id = ANY($1) ORDER BY product_id, sort_order ASC, id ASC`,
    [productIds]
  );
  for (const row of result.rows) {
    if (!map.has(row.product_id)) map.set(row.product_id, []);
    map.get(row.product_id).push(row.url);
  }
  return map;
}

async function fetchImagesForId(productId) {
  const result = await db.query(
    `SELECT url FROM product_images WHERE product_id = $1 ORDER BY sort_order ASC, id ASC`,
    [productId]
  );
  return result.rows.map((row) => row.url);
}

// Logs the real error server-side and returns a controlled message with no
// SQL text or stack trace to the client.
function sendServerError(res, context, err) {
  console.error(`[admin-products] ${context} failed:`, err.message);
  return res.status(500).json({ error: 'Unexpected server error' });
}

// GET /api/admin/products — paginated, filterable list.
router.get('/products', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 20));
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const type = typeof req.query.type === 'string' ? req.query.type.trim() : '';
    const subtype = typeof req.query.subtype === 'string' ? req.query.subtype.trim() : '';
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';

    const conditions = [];
    const params = [];

    if (type) { params.push(type); conditions.push(`type = $${params.length}`); }
    if (subtype) { params.push(subtype); conditions.push(`subtype = $${params.length}`); }
    if (status) { params.push(status); conditions.push(`status = $${params.length}`); }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(title ILIKE $${params.length} OR id ILIKE $${params.length})`);
    }

    const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await db.query(`SELECT COUNT(*)::int AS count FROM products ${whereSql}`, params);
    const total = countResult.rows[0].count;

    const listParams = params.slice();
    listParams.push(pageSize);
    const limitIdx = listParams.length;
    listParams.push((page - 1) * pageSize);
    const offsetIdx = listParams.length;

    const productsResult = await db.query(
      `SELECT ${PRODUCT_COLUMNS}
       FROM products
       ${whereSql}
       ORDER BY sort_order ASC, created_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      listParams
    );

    const imagesByProduct = await fetchImagesForIds(productsResult.rows.map((row) => row.id));
    const products = productsResult.rows.map((row) => rowToAdminProduct(row, imagesByProduct.get(row.id) || []));

    return res.json({
      products,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize))
      }
    });
  } catch (err) {
    return sendServerError(res, 'list products', err);
  }
});

// GET /api/admin/products/:id — single product with full detail.
router.get('/products/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const result = await db.query(`SELECT ${PRODUCT_COLUMNS} FROM products WHERE id = $1`, [id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Product not found' });

    const images = await fetchImagesForId(id);
    return res.json(rowToAdminProduct(result.rows[0], images));
  } catch (err) {
    return sendServerError(res, 'get product', err);
  }
});

// POST /api/admin/products — create. id is always generated here (see
// generateProductId/findFreeProductId) — never taken from the request body
// and never derived from the title — and is immutable afterwards (PUT below
// never changes it). New products start with no product_images rows; image
// upload is out of scope for Stage 4.
router.post('/products', async (req, res) => {
  try {
    const { errors, data } = validateProductPayload(req.body);
    if (errors.length) return res.status(400).json({ error: 'Validation failed', details: errors });

    const id = await findFreeProductId(db);

    const insertResult = await db.query(
      `INSERT INTO products (
         id, type, subtype, title, price, old_price, description,
         desc_part_one, desc_part_two, desc_part_three, desc_part_four,
         desc_part_five, desc_part_six, specs, full_specs, olx_url, prom_url,
         status, featured, sort_order, updated_at
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,
         $8,$9,$10,$11,
         $12,$13,$14,$15,$16,$17,
         $18,$19,$20, NOW()
       ) RETURNING ${PRODUCT_COLUMNS}`,
      [
        id, data.type, data.subtype, data.title, data.price, data.oldPrice, data.description,
        data.descPartOne, data.descPartTwo, data.descPartThree, data.descPartFour,
        data.descPartFive, data.descPartSix, JSON.stringify(data.specs), JSON.stringify(data.full_specs),
        data.olx_url, data.prom_url,
        data.status, data.featured, data.sortOrder
      ]
    );

    return res.status(201).json(rowToAdminProduct(insertResult.rows[0], []));
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'A product with this id already exists' });
    return sendServerError(res, 'create product', err);
  }
});

// PUT /api/admin/products/:id — edit. Only updates the `products` row;
// product_images is never touched here, so existing images survive
// unchanged through any number of normal edits.
router.put('/products/:id', async (req, res) => {
  try {
    const id = req.params.id;

    const bodyHasId = req.body && Object.prototype.hasOwnProperty.call(req.body, 'id') &&
      req.body.id !== undefined && req.body.id !== null && String(req.body.id).trim() !== '';
    if (bodyHasId && String(req.body.id).trim() !== id) {
      return res.status(400).json({ error: 'Product id is immutable and cannot be changed via this request' });
    }

    const { errors, data } = validateProductPayload(req.body);
    if (errors.length) return res.status(400).json({ error: 'Validation failed', details: errors });

    const updateResult = await db.query(
      `UPDATE products SET
         type = $1, subtype = $2, title = $3, price = $4, old_price = $5, description = $6,
         desc_part_one = $7, desc_part_two = $8, desc_part_three = $9, desc_part_four = $10,
         desc_part_five = $11, desc_part_six = $12, specs = $13, full_specs = $14,
         olx_url = $15, prom_url = $16, status = $17, featured = $18, sort_order = $19,
         updated_at = NOW()
       WHERE id = $20
       RETURNING ${PRODUCT_COLUMNS}`,
      [
        data.type, data.subtype, data.title, data.price, data.oldPrice, data.description,
        data.descPartOne, data.descPartTwo, data.descPartThree, data.descPartFour,
        data.descPartFive, data.descPartSix, JSON.stringify(data.specs), JSON.stringify(data.full_specs),
        data.olx_url, data.prom_url, data.status, data.featured, data.sortOrder,
        id
      ]
    );

    if (!updateResult.rows.length) return res.status(404).json({ error: 'Product not found' });

    const images = await fetchImagesForId(id);
    return res.json(rowToAdminProduct(updateResult.rows[0], images));
  } catch (err) {
    return sendServerError(res, 'update product', err);
  }
});

// POST /api/admin/products/:id/duplicate — copies the product row under a
// server-generated id (see findFreeProductId; any id/newId in the body is
// ignored) and a client-supplied newTitle. Every R2-backed image is
// physically copied to a brand-new key under the new product's own id —
// never reusing the source's url — so the copy never shares a physical
// file with the source. (Reusing urls is what originally let deleting a
// photo on one product silently delete it for every other product that
// happened to share that same url — see routes/admin-images.js's DELETE
// route.) Local git paths and external urls have nothing to physically
// copy and are carried over as-is, same as before. The copy always starts
// as status='draft' and featured=false so it can't go live, or show up in
// a featured slot, before an admin reviews it.
//
// R2 copies happen inside the same DB transaction as the row inserts: if
// anything fails partway, the transaction rolls back AND any R2 copies
// already made this request are deleted again, so a failed duplicate never
// leaves orphan files or a partial product behind.
router.post('/products/:id/duplicate', async (req, res) => {
  const sourceId = req.params.id;
  const { errors, newTitle } = validateDuplicatePayload(req.body);
  if (errors.length) return res.status(400).json({ error: 'Validation failed', details: errors });

  const client = await db.pool.connect();
  const copiedR2Keys = [];

  async function compensateR2Copies() {
    for (const key of copiedR2Keys) {
      try {
        await r2.deleteProductImage(key);
      } catch (compErr) {
        console.warn('[admin-products] Compensating R2 delete failed; orphan object left at key:', key);
      }
    }
  }

  try {
    await client.query('BEGIN');

    const sourceResult = await client.query(`SELECT ${PRODUCT_COLUMNS} FROM products WHERE id = $1 FOR UPDATE`, [sourceId]);
    if (!sourceResult.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Product not found' });
    }
    const source = sourceResult.rows[0];

    const newId = await findFreeProductId(client);

    const sourceImages = await client.query(
      'SELECT url, sort_order, is_main FROM product_images WHERE product_id = $1 ORDER BY sort_order ASC, id ASC',
      [sourceId]
    );

    const newImages = [];
    for (const img of sourceImages.rows) {
      const sourceKey = r2.deriveKeyFromPublicUrl(img.url);
      if (!sourceKey) {
        newImages.push({ url: img.url, sort_order: img.sort_order, is_main: img.is_main });
        continue;
      }

      let copied;
      try {
        copied = await r2.copyProductImage(sourceKey, newId);
      } catch (copyErr) {
        await client.query('ROLLBACK');
        await compensateR2Copies();
        console.error('[admin-products] Failed to copy image during duplicate:', copyErr.message);
        return res.status(502).json({ error: 'Failed to copy one of the product images to storage' });
      }
      copiedR2Keys.push(copied.key);
      newImages.push({ url: copied.url, sort_order: img.sort_order, is_main: img.is_main });
    }

    // Mirrors whichever copied url replaced the source's `image` value;
    // falls back to the source's value unchanged if it wasn't one of the
    // images above (e.g. a local path, or simply null).
    const sourceImageIndex = sourceImages.rows.findIndex((row) => row.url === source.image);
    const newImageValue = sourceImageIndex !== -1 ? newImages[sourceImageIndex].url : source.image;

    const insertResult = await client.query(
      `INSERT INTO products (
         id, type, subtype, title, price, old_price, image, description,
         desc_part_one, desc_part_two, desc_part_three, desc_part_four,
         desc_part_five, desc_part_six, specs, full_specs, olx_url, prom_url,
         status, featured, sort_order, updated_at
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,
         $9,$10,$11,$12,
         $13,$14,$15,$16,$17,$18,
         $19,$20,$21, NOW()
       ) RETURNING ${PRODUCT_COLUMNS}`,
      [
        newId, source.type, source.subtype, newTitle, source.price, source.old_price, newImageValue, source.description,
        source.desc_part_one, source.desc_part_two, source.desc_part_three, source.desc_part_four,
        source.desc_part_five, source.desc_part_six, JSON.stringify(source.specs), JSON.stringify(source.full_specs),
        source.olx_url, source.prom_url,
        'draft', false, source.sort_order
      ]
    );

    for (const img of newImages) {
      await client.query(
        'INSERT INTO product_images (product_id, url, sort_order, is_main) VALUES ($1,$2,$3,$4)',
        [newId, img.url, img.sort_order, img.is_main]
      );
    }

    await client.query('COMMIT');

    return res.status(201).json(rowToAdminProduct(insertResult.rows[0], newImages.map((img) => img.url)));
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    await compensateR2Copies();
    return sendServerError(res, 'duplicate product', err);
  } finally {
    client.release();
  }
});

// POST /api/admin/products/:id/status — generic status setter (used by the
// dashboard's "hide" action with { status: 'hidden' }). No hard delete
// exists anywhere in this API; ALLOWED_STATUSES has no destructive value.
router.post('/products/:id/status', async (req, res) => {
  try {
    const id = req.params.id;
    const status = typeof req.body?.status === 'string' ? req.body.status.trim() : '';
    if (!ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${ALLOWED_STATUSES.join(', ')}` });
    }

    const result = await db.query(
      'UPDATE products SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING ' + PRODUCT_COLUMNS,
      [status, id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Product not found' });

    const images = await fetchImagesForId(id);
    return res.json(rowToAdminProduct(result.rows[0], images));
  } catch (err) {
    return sendServerError(res, 'update product status', err);
  }
});

// POST /api/admin/products/:id/restore — brings a hidden product back to
// 'draft', never straight to 'published'. A single restore click must not
// make a previously hidden product publicly visible again; the admin has
// to explicitly publish it afterwards via the status control (PUT with
// status: 'published', or POST /status).
router.post('/products/:id/restore', async (req, res) => {
  try {
    const id = req.params.id;
    const result = await db.query(
      `UPDATE products SET status = 'draft', updated_at = NOW() WHERE id = $1 RETURNING ${PRODUCT_COLUMNS}`,
      [id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Product not found' });

    const images = await fetchImagesForId(id);
    return res.json(rowToAdminProduct(result.rows[0], images));
  } catch (err) {
    return sendServerError(res, 'restore product', err);
  }
});

module.exports = router;
