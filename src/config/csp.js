const crypto = require('crypto');
const helmet = require('helmet');

const LEGACY_SCRIPT_SOURCES = [
  "'self'",
  'https://www.googletagmanager.com',
  'https://connect.facebook.net',
  'https://embed.tawk.to',
  'https://*.tawk.to',
  'https://maps.googleapis.com',
  'https://maps.gstatic.com',
  'https://www.youtube.com',
  'https://googleads.g.doubleclick.net'
];

const LEGACY_CONNECT_SOURCES = [
  "'self'",
  'https://*.google-analytics.com',
  'https://*.analytics.google.com',
  'https://*.googletagmanager.com',
  'https://*.facebook.com',
  'https://*.tawk.to',
  'wss://*.tawk.to',
  'https://ad.doubleclick.net',
  'https://stats.g.doubleclick.net',
  'https://analytics.google.com',
  'https://www.google.com',
  'https://restcountries.com'
];

const COMMON_FRAME_SOURCES = [
  "'self'",
  'https://www.google.com',
  'https://www.youtube.com',
  'https://www.youtube-nocookie.com',
  'https://*.tawk.to'
];

function commonDirectives() {
  return {
    defaultSrc: ["'self'"],
    baseUri: ["'self'"],
    fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
    formAction: ["'self'"],
    frameAncestors: ["'self'"],
    frameSrc: COMMON_FRAME_SOURCES,
    imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
    mediaSrc: ["'self'", 'blob:', 'https:'],
    objectSrc: ["'none'"],
    scriptSrcAttr: ["'unsafe-inline'"],
    styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    workerSrc: ["'self'", 'blob:'],
    reportUri: ['/csp-report'],
    upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
  };
}

const legacyCsp = helmet.contentSecurityPolicy({
  directives: {
    ...commonDirectives(),
    connectSrc: LEGACY_CONNECT_SOURCES,
    scriptSrc: [...LEGACY_SCRIPT_SOURCES, "'unsafe-inline'"]
  }
});

const ejsCsp = helmet.contentSecurityPolicy({
  directives: {
    ...commonDirectives(),
    connectSrc: ["'self'"],
    frameSrc: [...COMMON_FRAME_SOURCES, 'https://www.paytr.com'],
    scriptSrc: [
      "'self'",
      'https://www.paytr.com',
      (req, res) => `'nonce-${res.locals.cspNonce}'`
    ]
  }
});

function cspNonce(req, res, next) {
  res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
  next();
}

function enforceLegacyCsp(req, res, next) {
  legacyCsp(req, res, next);
}

function enforceEjsCsp(req, res, next) {
  const render = res.render.bind(res);

  res.render = function renderWithEjsCsp(view, options, callback) {
    ejsCsp(req, res, () => {});
    return render(view, options, callback);
  };

  next();
}

module.exports = {
  cspNonce,
  enforceEjsCsp,
  enforceLegacyCsp
};
