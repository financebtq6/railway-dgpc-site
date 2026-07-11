// Protected admin product-image management API. Mounted at
// /api/admin/products/:id/images (see server.js). Handles uploads to
// Cloudflare R2 and all product_images row mutations (order, main image,
// deletion). Never touches the `products` table or data/products.json.
const express = require('express');
const multer = require('multer');
const db = require('../db/client');
const r2 = require('../storage/r2-client');
const { requireAdminApi } = require('../middleware/require-admin');

const router = express.Router({ mergeParams: true });

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  res.set('X-Content-Type-Options', 'nosniff');
  next();
});

router.use(requireAdminApi);

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_FILES_PER_REQUEST = 10;
const MAX_IMAGES_PER_PRODUCT = 30;

const LOCAL_IMAGE_PREFIXES = ['./images/', '/images/', 'images/'];

// Checks the first bytes of the upload against the signature for its
// declared MIME type. This is not a full image-processing pass (no sharp
// or similar package is used, per the task's constraints) — it's a cheap
// guard against a file whose content doesn't match the type it claims,
// which combined with always setting our own ContentType on upload (see
// storage/r2-client.js) keeps R2 from ever serving a mismatched type.
const MAGIC_BYTE_CHECKS = {
  'image/jpeg': (buf) => buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff,
  'image/png': (buf) => buf.length > 8 &&
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a,
  'image/webp': (buf) => buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP'
};

function matchesMagicBytes(mimeType, buffer) {
  const check = MAGIC_BYTE_CHECKS[mimeType];
  return typeof check === 'function' && check(buffer);
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES_PER_REQUEST }
}).array('images', MAX_FILES_PER_REQUEST);

// Wraps multer so its errors (file too big, too many files) become the
// same controlled JSON shape as the rest of this API instead of an
// unhandled exception / default Express error page.
function uploadMiddleware(req, res, next) {
  upload(req, res, (err) => {
    if (!err) return next();

    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'One or more files exceed the 10 MB limit' });
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE' || err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({ error: 'Maximum 10 files per upload request' });
      }
      return res.status(400).json({ error: 'File upload error' });
    }

    console.error('[admin-images] Upload middleware error:', err.message);
    return res.status(400).json({ error: 'File upload error' });
  });
}

function classifySource(url) {
  if (typeof url !== 'string' || !url) return 'external';
  if (LOCAL_IMAGE_PREFIXES.some((prefix) => url.startsWith(prefix))) return 'local';
  if (r2.deriveKeyFromPublicUrl(url)) return 'r2';
  return 'external';
}

function serializeImageRow(row) {
  return {
    id: Number(row.id),
    url: row.url,
    sortOrder: row.sort_order,
    isMain: !!row.is_main,
    source: classifySource(row.url)
  };
}

async function fetchOrderedImages(executor, productId) {
  const result = await executor.query(
    'SELECT id, url, sort_order, is_main FROM product_images WHERE product_id = $1 ORDER BY sort_order ASC, id ASC',
    [productId]
  );
  return result.rows.map(serializeImageRow);
}

async function productExists(productId) {
  const result = await db.query('SELECT 1 FROM products WHERE id = $1', [productId]);
  return result.rows.length > 0;
}

function sendServerError(res, context, err) {
  console.error(`[admin-images] ${context} failed:`, err.message);
  return res.status(500).json({ error: 'Unexpected server error' });
}

function validateUploadFiles(files, existingCount) {
  const errors = [];

  if (!files || !files.length) {
    errors.push('No files provided');
    return errors;
  }

  if (files.length > MAX_FILES_PER_REQUEST) {
    errors.push(`Maximum ${MAX_FILES_PER_REQUEST} files per upload request`);
  }

  if (existingCount + files.length > MAX_IMAGES_PER_PRODUCT) {
    errors.push(`This product has ${existingCount} image(s); uploading ${files.length} more would exceed the ${MAX_IMAGES_PER_PRODUCT}-image limit`);
  }

  files.forEach((file, idx) => {
    const label = `File ${idx + 1}`;
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      errors.push(`${label} has an unsupported type (${file.mimetype}); only JPG, PNG and WEBP are allowed`);
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      errors.push(`${label} exceeds the 10 MB limit`);
      return;
    }
    if (!matchesMagicBytes(file.mimetype, file.buffer)) {
      errors.push(`${label} content does not match its declared type`);
    }
  });

  return errors;
}

// GET /api/admin/products/:id/images — full ordered image list for the
// admin gallery (ids, order, main flag, source). Not part of the four
// mutation routes the spec enumerates, but required for the admin UI to
// have image ids to operate on — the product GET endpoint in
// routes/admin-products.js only ever returns a flat url array.
router.get('/', async (req, res) => {
  try {
    const productId = req.params.id;
    if (!(await productExists(productId))) return res.status(404).json({ error: 'Product not found' });

    const images = await fetchOrderedImages(db, productId);
    return res.json({ images });
  } catch (err) {
    return sendServerError(res, 'list images', err);
  }
});

// POST /api/admin/products/:id/images — upload one or more images to R2
// and append them as product_images rows in sequential sort_order after
// any existing images. Files are processed one at a time so a mid-batch
// failure can be pinpointed and compensated without touching earlier
// files that already succeeded (see failure handling below).
router.post('/', uploadMiddleware, async (req, res) => {
  const productId = req.params.id;
  try {
    if (!(await productExists(productId))) return res.status(404).json({ error: 'Product not found' });

    if (!r2.isR2Configured()) {
      return res.status(503).json({ error: 'Image storage is not configured' });
    }

    const countResult = await db.query(
      'SELECT COUNT(*)::int AS count, COALESCE(MAX(sort_order), -1)::int AS max_order FROM product_images WHERE product_id = $1',
      [productId]
    );
    const existingCount = countResult.rows[0].count;
    let nextSortOrder = countResult.rows[0].max_order + 1;

    const validationErrors = validateUploadFiles(req.files, existingCount);
    if (validationErrors.length) {
      return res.status(400).json({ error: 'Validation failed', details: validationErrors });
    }

    const shouldSetFirstAsMain = existingCount === 0;

    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];

      let uploaded;
      try {
        uploaded = await r2.uploadProductImage(productId, file.buffer, file.mimetype);
      } catch (uploadErr) {
        console.error('[admin-images] R2 upload failed:', uploadErr.message);
        return res.status(502).json({
          error: 'Failed to upload image to storage',
          details: [`File ${i + 1} could not be uploaded; no files after it were processed`]
        });
      }

      const isMain = shouldSetFirstAsMain && i === 0;
      try {
        await db.query(
          'INSERT INTO product_images (product_id, url, sort_order, is_main) VALUES ($1, $2, $3, $4)',
          [productId, uploaded.url, nextSortOrder, isMain]
        );
        nextSortOrder += 1;
      } catch (dbErr) {
        console.error('[admin-images] DB insert failed after R2 upload, attempting compensating delete:', dbErr.message);
        try {
          await r2.deleteProductImage(uploaded.key);
        } catch (compErr) {
          console.warn('[admin-images] Compensating R2 delete failed; orphan object left in bucket at key:', uploaded.key);
        }
        return res.status(500).json({
          error: 'Failed to save image record',
          details: [`File ${i + 1} was not saved; no files after it were processed`]
        });
      }
    }

    const images = await fetchOrderedImages(db, productId);
    return res.status(201).json({ images });
  } catch (err) {
    return sendServerError(res, 'upload images', err);
  }
});

// PUT /api/admin/products/:id/images/order — { imageIds: [1,2,3] }.
// Requires the full current set, no more, no less. imageIds[0] becomes
// the main image.
router.put('/order', async (req, res) => {
  const productId = req.params.id;
  try {
    if (!(await productExists(productId))) return res.status(404).json({ error: 'Product not found' });

    const imageIdsRaw = req.body && req.body.imageIds;
    if (!Array.isArray(imageIdsRaw) || !imageIdsRaw.length) {
      return res.status(400).json({ error: 'imageIds must be a non-empty array' });
    }

    const imageIds = imageIdsRaw.map((v) => Number(v));
    if (imageIds.some((v) => !Number.isInteger(v) || v <= 0)) {
      return res.status(400).json({ error: 'imageIds must contain only positive integers' });
    }
    if (new Set(imageIds).size !== imageIds.length) {
      return res.status(400).json({ error: 'imageIds contains duplicate values' });
    }

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const currentResult = await client.query(
        'SELECT id FROM product_images WHERE product_id = $1 FOR UPDATE',
        [productId]
      );
      const currentIds = new Set(currentResult.rows.map((r) => Number(r.id)));

      if (currentIds.size !== imageIds.length || imageIds.some((id) => !currentIds.has(id))) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'imageIds must contain every current product image exactly once, with no foreign ids' });
      }

      for (let i = 0; i < imageIds.length; i++) {
        await client.query(
          'UPDATE product_images SET sort_order = $1, is_main = $2 WHERE id = $3 AND product_id = $4',
          [i, i === 0, imageIds[i], productId]
        );
      }

      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK').catch(() => {});
      throw txErr;
    } finally {
      client.release();
    }

    const images = await fetchOrderedImages(db, productId);
    return res.json({ images });
  } catch (err) {
    return sendServerError(res, 'reorder images', err);
  }
});

// PUT /api/admin/products/:id/images/:imageId/main — makes one image the
// main image (sort_order 0, is_main true) while preserving the relative
// order of the rest.
router.put('/:imageId/main', async (req, res) => {
  const productId = req.params.id;
  const imageId = Number(req.params.imageId);
  try {
    if (!Number.isInteger(imageId) || imageId <= 0) {
      return res.status(400).json({ error: 'Invalid image id' });
    }
    if (!(await productExists(productId))) return res.status(404).json({ error: 'Product not found' });

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const currentResult = await client.query(
        'SELECT id FROM product_images WHERE product_id = $1 ORDER BY sort_order ASC, id ASC FOR UPDATE',
        [productId]
      );
      const currentIds = currentResult.rows.map((r) => Number(r.id));

      if (!currentIds.includes(imageId)) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Image not found for this product' });
      }

      const newOrder = [imageId, ...currentIds.filter((id) => id !== imageId)];
      for (let i = 0; i < newOrder.length; i++) {
        await client.query(
          'UPDATE product_images SET sort_order = $1, is_main = $2 WHERE id = $3',
          [i, i === 0, newOrder[i]]
        );
      }

      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK').catch(() => {});
      throw txErr;
    } finally {
      client.release();
    }

    const images = await fetchOrderedImages(db, productId);
    return res.json({ images });
  } catch (err) {
    return sendServerError(res, 'set main image', err);
  }
});

// DELETE /api/admin/products/:id/images/:imageId — requires
// { confirm: true }. Always removes the product_images row; only deletes
// the underlying object from R2 when the stored URL strictly maps to a
// key under our R2_PUBLIC_BASE_URL + products/ prefix. Local git image
// paths (./images/..., /images/..., images/...) are never touched on disk.
router.delete('/:imageId', async (req, res) => {
  const productId = req.params.id;
  const imageId = Number(req.params.imageId);
  try {
    if (!Number.isInteger(imageId) || imageId <= 0) {
      return res.status(400).json({ error: 'Invalid image id' });
    }
    if (!req.body || req.body.confirm !== true) {
      return res.status(400).json({ error: 'Deletion requires { "confirm": true } in the request body' });
    }
    if (!(await productExists(productId))) return res.status(404).json({ error: 'Product not found' });

    let deletedUrl = null;
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const targetResult = await client.query(
        'SELECT id, url FROM product_images WHERE id = $1 AND product_id = $2 FOR UPDATE',
        [imageId, productId]
      );
      if (!targetResult.rows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Image not found for this product' });
      }
      deletedUrl = targetResult.rows[0].url;

      await client.query('DELETE FROM product_images WHERE id = $1', [imageId]);

      const remainingResult = await client.query(
        'SELECT id FROM product_images WHERE product_id = $1 ORDER BY sort_order ASC, id ASC FOR UPDATE',
        [productId]
      );
      for (let i = 0; i < remainingResult.rows.length; i++) {
        await client.query(
          'UPDATE product_images SET sort_order = $1, is_main = $2 WHERE id = $3',
          [i, i === 0, remainingResult.rows[i].id]
        );
      }

      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK').catch(() => {});
      throw txErr;
    } finally {
      client.release();
    }

    const images = await fetchOrderedImages(db, productId);

    let warning = null;
    const r2Key = r2.deriveKeyFromPublicUrl(deletedUrl);
    if (r2Key) {
      try {
        await r2.deleteProductImage(r2Key);
      } catch (r2Err) {
        console.warn('[admin-images] DB row removed but R2 object delete failed; orphan left at key:', r2Key);
        warning = 'Image record removed, but the stored file could not be deleted from R2 storage.';
      }
    }

    const response = { images };
    if (warning) response.warning = warning;
    return res.json(response);
  } catch (err) {
    return sendServerError(res, 'delete image', err);
  }
});

module.exports = router;
