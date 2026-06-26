function requireAdmin(req, res, next) {
  if (req.session && req.session.adminUser) {
    return next();
  }

  if (req.session && req.method === 'GET') {
    req.session.returnTo = req.originalUrl;
  }

  return res.redirect('/admin/login');
}

function redirectIfLoggedIn(req, res, next) {
  if (req.session && req.session.adminUser) {
    return res.redirect(req.session.returnTo || '/admin');
  }

  return next();
}

module.exports = { requireAdmin, redirectIfLoggedIn };
