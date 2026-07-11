require('dotenv').config();

const express = require('express');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// Locally, TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID come from the .env file
// (via dotenv, above). On Railway, dotenv.config() is a harmless no-op
// when there's no .env file — the same variables are provided instead via
// Railway's own "Variables" tab, which are already present in
// process.env before this process starts.
const TELEGRAM_CONFIGURED = !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
console.log('Telegram env configured:', TELEGRAM_CONFIGURED);

app.use(express.json());

// Railway terminates TLS at its edge proxy; trust the first hop so
// express-session can detect the request is secure and set secure cookies.
app.set('trust proxy', 1);

const db = require('./db/client');
const SESSION_SECRET = process.env.SESSION_SECRET;
const SESSIONS_CONFIGURED = db.isConfigured && !!SESSION_SECRET;

if (SESSIONS_CONFIGURED) {
  const session = require('express-session');
  const pgSession = require('connect-pg-simple')(session);
  app.use(session({
    store: new pgSession({ pool: db.pool, tableName: 'session', createTableIfMissing: true }),
    name: 'dpc.sid',
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 10 * 60 * 60 * 1000 // 10 hours
    }
  }));
} else {
  console.warn('[admin] DATABASE_URL and/or SESSION_SECRET missing. Admin auth routes will respond 503.');
}

// Admin auth API and the protected dashboard page. Mounted before the
// generic static file server below so an unauthenticated request for
// admin/dashboard.html can never be served directly by express.static.
const { requireAdminPage } = require('./middleware/require-admin');
app.use('/api/admin', require('./routes/admin-auth'));
app.use('/api/admin', require('./routes/admin-products'));
app.get('/admin/dashboard.html', requireAdminPage, (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.set('X-Content-Type-Options', 'nosniff');
  res.sendFile(path.join(__dirname, 'admin', 'dashboard.html'));
});
app.get('/admin/product-form.html', requireAdminPage, (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.set('X-Content-Type-Options', 'nosniff');
  res.sendFile(path.join(__dirname, 'admin', 'product-form.html'));
});
app.use('/admin', express.static(path.join(__dirname, 'admin'), {
  setHeaders: (res) => {
    res.set('X-Content-Type-Options', 'nosniff');
  }
}));

// This serves your index.html and app.js
app.use(express.static(path.join(__dirname, '/')));

// Read-only products API backed by PostgreSQL (see routes/products.js and
// db/client.js). Not used by the live catalog yet — data/products.json
// remains the frontend's source of truth.
app.use('/api', require('./routes/products'));

// Reusable server-side Telegram sender. Never logs or returns the token/
// chat id — only Telegram's own response (which doesn't contain them).
async function sendTelegramMessage(text) {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

  if (!BOT_TOKEN || !CHAT_ID) {
    console.error('[telegram-notify] Missing TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID in the environment.');
    const err = new Error('Telegram is not configured on the server.');
    err.status = 500;
    throw err;
  }

  const tgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT_ID, text })
  });
  const tgData = await tgRes.json().catch(() => ({}));

  if (!tgRes.ok || !tgData.ok) {
    console.error('[telegram-notify] Telegram API rejected the message. HTTP status:', tgRes.status, 'description:', tgData.description || '(none)');
    const err = new Error('Telegram rejected the message.');
    err.status = 502;
    throw err;
  }
}

// Relays a pre-formatted lead/order notification to Telegram. Keeps the
// bot token and chat id server-side (read from environment variables)
// instead of exposed in frontend JS. Used by both the "Зв'яжіться з нами"
// contact form and the cart checkout form.
app.post('/api/telegram-notify', async (req, res) => {
  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  if (!text) {
    console.error('[telegram-notify] Request rejected: missing text field.');
    return res.status(400).json({ ok: false, error: 'Missing text' });
  }

  try {
    await sendTelegramMessage(text);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(err.status || 502).json({ ok: false, error: err.message });
  }
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Server listening on port ${port}`);
});
