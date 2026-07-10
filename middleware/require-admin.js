// Shared admin auth gate. Two flavors: a JSON-responding guard for future
// admin API routes, and a redirect-responding guard for admin HTML pages.
// Both treat a missing session store (DATABASE_URL/SESSION_SECRET not
// configured) the same as "not authenticated" rather than throwing.

function isAuthenticated(req) {
  return !!(req.session && req.session.admin && req.session.admin.email);
}

function requireAdminApi(req, res, next) {
  if (!req.session) {
    return res.status(503).json({ error: 'Admin authentication unavailable' });
  }
  if (!isAuthenticated(req)) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  return next();
}

function requireAdminPage(req, res, next) {
  if (!isAuthenticated(req)) {
    return res.redirect('/admin/login.html');
  }
  return next();
}

module.exports = { requireAdminApi, requireAdminPage, isAuthenticated };
