// Cloudflare R2 client (S3-compatible API) for product image uploads.
// Reads configuration from process.env and never logs credential values.
// Everything here is optional at boot: if the R2_* variables are missing,
// isR2Configured() returns false and callers (routes/admin-images.js) must
// respond with a controlled 503 instead of throwing.
const crypto = require('crypto');
const { S3Client, PutObjectCommand, DeleteObjectCommand, CopyObjectCommand } = require('@aws-sdk/client-s3');

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || '';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || '';
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || '';
const R2_PUBLIC_BASE_URL_RAW = process.env.R2_PUBLIC_BASE_URL || '';

const CONFIGURED = !!(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET_NAME && R2_PUBLIC_BASE_URL_RAW);

// Strips trailing slashes so `${base}/${key}` never produces a double slash,
// regardless of how the operator entered the variable on Railway.
const R2_PUBLIC_BASE_URL = R2_PUBLIC_BASE_URL_RAW.replace(/\/+$/, '');

const MIME_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
};

let client = null;
if (CONFIGURED) {
  client = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY
    },
    // R2 doesn't support virtual-hosted-style addressing (bucket.account.r2...)
    // out of the box for the S3-compatible endpoint; path-style is what
    // Cloudflare's own docs use.
    forcePathStyle: true
  });
} else {
  console.warn('[r2] R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET_NAME / R2_PUBLIC_BASE_URL not fully configured. Image upload API will respond 503.');
}

function isR2Configured() {
  return CONFIGURED;
}

// Object id sanitizing is defense-in-depth only — product ids are already
// restricted to [A-Za-z0-9_-] by routes/admin-products.js's ID_PATTERN
// before they ever reach here, and the database id itself is never
// modified by this function.
function sanitizeProductIdForKey(productId) {
  const cleaned = String(productId || '').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 100);
  return cleaned || 'unknown';
}

// products/<product-id>/<timestamp>-<random>.<ext> — timestamp+random makes
// collisions negligible, which is how "never overwrite an existing object"
// is satisfied without a pre-check round trip to R2.
function buildKeyWithExtension(productId, ext) {
  const safeId = sanitizeProductIdForKey(productId);
  const timestamp = Date.now();
  const random = crypto.randomBytes(6).toString('hex');
  return `products/${safeId}/${timestamp}-${random}.${ext}`;
}

function buildObjectKey(productId, mimeType) {
  const ext = MIME_EXTENSIONS[mimeType];
  if (!ext) {
    throw new Error(`Unsupported mime type for object key: ${mimeType}`);
  }
  return buildKeyWithExtension(productId, ext);
}

function buildPublicUrl(key) {
  return `${R2_PUBLIC_BASE_URL}/${key}`;
}

// Maps a stored image URL back to its R2 object key using a strict prefix
// check against the configured public base URL. Returns null (never
// guesses) if the URL doesn't unambiguously belong to our R2 bucket under
// the products/ prefix — callers must treat null as "do not call R2".
function deriveKeyFromPublicUrl(url) {
  if (!CONFIGURED || typeof url !== 'string') return null;
  const prefix = `${R2_PUBLIC_BASE_URL}/`;
  if (!url.startsWith(prefix)) return null;

  const key = url.slice(prefix.length);
  if (!key || !key.startsWith('products/')) return null;
  if (key.includes('..') || key.includes('\\')) return null;

  return key;
}

async function uploadProductImage(productId, buffer, mimeType) {
  if (!CONFIGURED || !client) {
    const err = new Error('R2 is not configured');
    err.code = 'R2_NOT_CONFIGURED';
    throw err;
  }

  const key = buildObjectKey(productId, mimeType);

  await client.send(new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: mimeType
  }));

  return { key, url: buildPublicUrl(key) };
}

// Physically duplicates an existing object under a brand-new key scoped to
// destProductId, so the copy is a fully independent file — deleting either
// the source or the copy afterwards never affects the other. Used by
// routes/admin-products.js's duplicate endpoint instead of reusing the
// source product's url, which is what originally let one product's image
// delete silently wipe another product's photo (both pointed at the same
// R2 object).
async function copyProductImage(sourceKey, destProductId) {
  if (!CONFIGURED || !client) {
    const err = new Error('R2 is not configured');
    err.code = 'R2_NOT_CONFIGURED';
    throw err;
  }
  if (!sourceKey || !sourceKey.startsWith('products/')) {
    throw new Error('Refusing to copy an object outside the products/ prefix');
  }

  const extMatch = sourceKey.match(/\.([a-z0-9]+)$/i);
  const ext = extMatch ? extMatch[1].toLowerCase() : 'jpg';
  const destKey = buildKeyWithExtension(destProductId, ext);

  await client.send(new CopyObjectCommand({
    Bucket: R2_BUCKET_NAME,
    CopySource: `${encodeURIComponent(R2_BUCKET_NAME)}/${sourceKey.split('/').map(encodeURIComponent).join('/')}`,
    Key: destKey
  }));

  return { key: destKey, url: buildPublicUrl(destKey) };
}

// Safe to call with any key derived via deriveKeyFromPublicUrl; never
// called with an arbitrary external URL by routes/admin-images.js.
async function deleteProductImage(key) {
  if (!CONFIGURED || !client) {
    const err = new Error('R2 is not configured');
    err.code = 'R2_NOT_CONFIGURED';
    throw err;
  }
  if (!key || !key.startsWith('products/')) {
    throw new Error('Refusing to delete an object outside the products/ prefix');
  }

  await client.send(new DeleteObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key
  }));
}

module.exports = {
  isR2Configured,
  uploadProductImage,
  copyProductImage,
  deleteProductImage,
  buildObjectKey,
  deriveKeyFromPublicUrl,
  MIME_EXTENSIONS
};
