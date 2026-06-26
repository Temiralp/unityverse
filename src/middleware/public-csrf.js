const crypto = require('crypto');

const CSRF_ERROR_MESSAGE = 'Güvenlik oturumunuz yenilendi. Lütfen sayfayı yenileyip tekrar deneyin.';

function isPublicCsrfEnforced() {
  return String(process.env.PUBLIC_CSRF_ENFORCED || 'true').trim().toLowerCase() !== 'false';
}

function tokensMatch(suppliedToken, sessionToken) {
  if (!suppliedToken || !sessionToken) return false;

  const supplied = Buffer.from(String(suppliedToken));
  const expected = Buffer.from(String(sessionToken));

  return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
}

function requirePublicCsrf(req, res, next) {
  if (!isPublicCsrfEnforced() || ['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const suppliedToken = req.body?._csrf || req.get('x-csrf-token');
  const sessionToken = req.session?.csrfToken;

  if (tokensMatch(suppliedToken, sessionToken)) {
    return next();
  }

  res.set('Cache-Control', 'no-store');
  return res.status(403).json({
    status: 'failure',
    code: 'CSRF_TOKEN_INVALID',
    message: CSRF_ERROR_MESSAGE
  });
}

module.exports = {
  CSRF_ERROR_MESSAGE,
  requirePublicCsrf
};
