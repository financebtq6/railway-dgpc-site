// Read-only diagnostic for the "duplicate wipes original's photos" bug.
// Makes no writes to the database or to R2 — safe to run against production.
//
// Usage: needs the real DATABASE_URL (e.g. `railway run node scripts/diagnose-shared-images.js`).
// Section 3 just does plain public HTTPS HEAD requests, so no R2 credentials
// are needed for it.
//
// Reports:
//   1. Every image URL referenced by 2+ products (the actual collision class
//      that breaks when one of those products' images gets deleted/replaced).
//   2. The full image list for "Solid Mercury" specifically, cross-checked
//      against (1).
//   3. Every (product, image) row's url, HEAD-checked against its own public
//      address — reports the live HTTP status for each one.
const db = require('../db/client');

async function main() {
  if (!db.isConfigured) {
    console.error('DATABASE_URL is not set — cannot run. See the header comment for how to run this against production.');
    process.exitCode = 1;
    return;
  }

  console.log('=== 1. Image URLs shared by 2+ products ===');
  const sharedResult = await db.query(`
    SELECT url, array_agg(DISTINCT product_id ORDER BY product_id) AS product_ids, COUNT(DISTINCT product_id) AS product_count
    FROM product_images
    GROUP BY url
    HAVING COUNT(DISTINCT product_id) > 1
    ORDER BY product_count DESC, url
  `);
  if (!sharedResult.rows.length) {
    console.log('(none found)');
  } else {
    for (const row of sharedResult.rows) {
      console.log(`  ${row.product_count} products share: ${row.url}`);
      console.log(`    -> ${row.product_ids.join(', ')}`);
    }
  }

  console.log('\n=== 2. "Solid Mercury" image list ===');
  const mercuryResult = await db.query(`
    SELECT p.id, p.title, pi.id AS image_id, pi.url, pi.sort_order, pi.is_main
    FROM products p
    LEFT JOIN product_images pi ON pi.product_id = p.id
    WHERE p.title ILIKE '%Solid Mercury%'
    ORDER BY pi.sort_order ASC, pi.id ASC
  `);
  if (!mercuryResult.rows.length) {
    console.log('(no product with "Solid Mercury" in the title was found)');
  } else {
    const productId = mercuryResult.rows[0].id;
    console.log(`  product id: ${productId}`);
    for (const row of mercuryResult.rows) {
      if (row.image_id === null) {
        console.log('  (no product_images rows at all)');
        continue;
      }
      const sharedWith = sharedResult.rows.find((r) => r.url === row.url);
      const sharedNote = sharedWith ? `  [SHARED with: ${sharedWith.product_ids.filter((id) => id !== productId).join(', ')}]` : '';
      console.log(`  #${row.image_id} order=${row.sort_order} main=${row.is_main} ${row.url}${sharedNote}`);
    }
  }

  console.log('\n=== 3. HTTP HEAD check for every (product, image) row ===');
  const allRowsResult = await db.query(`
    SELECT p.id AS product_id, p.title AS product_title, pi.id AS image_id, pi.url
    FROM product_images pi
    JOIN products p ON p.id = pi.product_id
    ORDER BY p.id, pi.sort_order ASC, pi.id ASC
  `);

  async function headStatus(url) {
    if (!/^https?:\/\//i.test(url)) return 'LOCAL (не перевіряється)';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch(url, { method: 'HEAD', signal: controller.signal, redirect: 'follow' });
      return String(res.status);
    } catch (err) {
      return `ERROR (${err.message})`;
    } finally {
      clearTimeout(timeout);
    }
  }

  let brokenCount = 0;
  for (const row of allRowsResult.rows) {
    const status = await headStatus(row.url);
    const isBroken = /^\d+$/.test(status) && Number(status) >= 400;
    if (isBroken) brokenCount++;
    console.log(`  [${status}]${isBroken ? '  <-- BROKEN' : ''}  product=${row.product_id} (${row.product_title})  image#${row.image_id}  ${row.url}`);
  }
  console.log(`\n  checked ${allRowsResult.rows.length} rows, ${brokenCount} broken (HTTP 4xx/5xx)`);

  await db.pool.end();
}

main().catch((err) => {
  console.error('Diagnostic failed:', err);
  process.exitCode = 1;
});
