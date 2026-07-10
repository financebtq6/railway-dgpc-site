// Admin login/logout/session API. Single admin identity, no admin_users
// table — email and password hash come from environment variables
// (ADMIN_EMAIL, ADMIN_PASSWORD_HASH), verified here with bcrypt.
const express = require('express');
const bcrypt = require('bcrypt');

const router = express.Router();

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  res.set('X-Content-Type-Options', 'nosniff');
  next();
});

// In-memory per-IP failed-login tracker. Intentionally not persisted:
// it only needs to slow down brute-force bursts against the single admin
// account, and resets on every deploy/restart (documented behavior, not a bug).
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const BLOCK_MS = 15 * 60 * 1000;
const failedAttempts = new Map();

function pruneIfExpired(key) {
  const entry = failedAttempts.get(key);
  if (!entry) return;
  const now = Date.now();
  const windowExpired = now - entry.firstAttempt > WINDOW_MS;
  const blockExpired = !entry.blockedUntil || now > entry.blockedUntil;
  if (windowExpired && blockExpired) failedAttempts.delete(key);
}

function isBlocked(key) {
  const entry = failedAttempts.get(key);
  return !!(entry && entry.blockedUntil && Date.now() < entry.blockedUntil);
}

function recordFailure(key) {
  const now = Date.now();
  let entry = failedAttempts.get(key);
  if (!entry || now - entry.firstAttempt > WINDOW_MS) {
    entry = { count: 0, firstAttempt: now, blockedUntil: 0 };
  }
  entry.count += 1;
  if (entry.count >= MAX_ATTEMPTS) {
    entry.blockedUntil = now + BLOCK_MS;
  }
  failedAttempts.set(key, entry);
}

function clearFailures(key) {
  failedAttempts.delete(key);
}

const GENERIC_ERROR = { error: 'Invalid email or password' };

router.post('/login', async (req, res) => {
  if (!req.session) {
    return res.status(503).json({ error: 'Admin authentication unavailable' });
  }

  const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
  const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD_HASH) {
    console.error('[admin-auth] ADMIN_EMAIL / ADMIN_PASSWORD_HASH not configured.');
    return res.status(503).json({ error: 'Admin authentication unavailable' });
  }

  const key = req.ip;
  pruneIfExpired(key);
  if (isBlocked(key)) {
    return res.status(429).json({ error: 'Too many attempts. Try again later.' });
  }

  const email = req.body && req.body.email;
  const password = req.body && req.body.password;

  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
    recordFailure(key);
    return res.status(401).json(GENERIC_ERROR);
  }

  const emailMatches = email.trim().toLowerCase() === ADMIN_EMAIL.trim().toLowerCase();
  // Always run bcrypt.compare (even when the email is already wrong) so a
  // wrong-email response doesn't take a different amount of time than a
  // wrong-password response.
  const passwordMatches = await bcrypt.compare(password, ADMIN_PASSWORD_HASH).catch(() => false);

  if (!emailMatches || !passwordMatches) {
    recordFailure(key);
    return res.status(401).json(GENERIC_ERROR);
  }

  clearFailures(key);

  req.session.regenerate((regenErr) => {
    if (regenErr) {
      console.error('[admin-auth] Session regenerate failed:', regenErr.message);
      return res.status(500).json({ error: 'Login failed' });
    }
    req.session.admin = { email: ADMIN_EMAIL };
    req.session.save((saveErr) => {
      if (saveErr) {
        console.error('[admin-auth] Session save failed:', saveErr.message);
        return res.status(500).json({ error: 'Login failed' });
      }
      return res.json({ ok: true });
    });
  });
});

router.post('/logout', (req, res) => {
  if (!req.session) {
    return res.json({ ok: true });
  }
  req.session.destroy((err) => {
    if (err) {
      console.error('[admin-auth] Session destroy failed:', err.message);
    }
    res.clearCookie('dpc.sid', { httpOnly: true, sameSite: 'lax' });
    return res.json({ ok: true });
  });
});

router.get('/session', (req, res) => {
  if (req.session && req.session.admin && req.session.admin.email) {
    return res.json({ authenticated: true, email: req.session.admin.email });
  }
  return res.json({ authenticated: false });
});

module.exports = router;
