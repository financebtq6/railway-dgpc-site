// Thin PostgreSQL access layer. Reads DATABASE_URL from the environment and
// exposes a single `query` helper plus an `isConfigured` flag. Never crashes
// the process if DATABASE_URL is missing — callers must check isConfigured
// and degrade gracefully (see routes/products.js).
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || '';
const isConfigured = !!DATABASE_URL;

let pool = null;

if (isConfigured) {
  // Railway-managed Postgres requires SSL but uses a self-signed chain,
  // so certificate verification is disabled the same way Railway's own
  // docs recommend for app-side connections.
  const useSSL = /railway|render|neon|supabase/i.test(DATABASE_URL) || process.env.DATABASE_SSL === 'true';
  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: useSSL ? { rejectUnauthorized: false } : false
  });

  pool.on('error', (err) => {
    console.error('[db] Unexpected error on idle PostgreSQL client:', err.message);
  });
} else {
  console.warn('[db] DATABASE_URL is not set. Database-backed routes will respond with 503.');
}

async function query(text, params) {
  if (!pool) {
    const err = new Error('Database is not configured (DATABASE_URL missing).');
    err.code = 'DB_NOT_CONFIGURED';
    throw err;
  }
  return pool.query(text, params);
}

module.exports = { query, isConfigured, pool };
