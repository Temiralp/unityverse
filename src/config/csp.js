const crypto = require('crypto');
const helmet = require('helmet');

// GTM konteynerinin enjekte ettigi 3. taraf widget'lar (R13, 2026-09-23 canli Chrome kaniti:
// bu iki script encodedBodySize=0 ile engelleniyordu). Kaynak GTM oldugu icin repoda izleri yok.
const WIDGET_SCRIPT_SOURCES = [
  'https://static.elfsight.com',
  'https://d2mpatx37cqexb.cloudfront.net'
];

// Delightchat embed'i kendi CSS'ini de <link> ile ekliyor (yerel kanit: style-src-elem ihlali).
const WIDGET_STYLE_SOURCES = ['https://d2mpatx37cqexb.cloudfront.net'];

const WIDGET_CONNECT_SOURCES = [
  'https://*.elfsight.com',
  'https://*.delightchat.io'
];

const LEGACY_SCRIPT_SOURCES = [
  "'self'",
  ...WIDGET_SCRIPT_SOURCES,
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
  ...WIDGET_CONNECT_SOURCES,
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

const PAYTR_FRAME_SOURCES = [
  'https://www.paytr.com',
  'https://goguvenliodeme.bkm.com.tr'
];

const COMMON_STYLE_SOURCES = ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'];

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
    styleSrc: COMMON_STYLE_SOURCES,
    workerSrc: ["'self'", 'blob:'],
    reportUri: ['/csp-report'],
    upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
  };
}

const legacyCsp = helmet.contentSecurityPolicy({
  directives: {
    ...commonDirectives(),
    connectSrc: LEGACY_CONNECT_SOURCES,
    scriptSrc: [...LEGACY_SCRIPT_SOURCES, "'unsafe-inline'"],
    styleSrc: [...COMMON_STYLE_SOURCES, ...WIDGET_STYLE_SOURCES]
  }
});

const ejsCsp = helmet.contentSecurityPolicy({
  directives: {
    ...commonDirectives(),
    connectSrc: ["'self'", 'https://www.paytr.com'],
    frameSrc: [...COMMON_FRAME_SOURCES, ...PAYTR_FRAME_SOURCES],
    scriptSrc: [
      "'self'",
      'https://www.paytr.com',
      (req, res) => `'nonce-${res.locals.cspNonce}'`
    ]
  }
});

// Odeme sayfalari: PayTR + GA4 (purchase olayi icin gtag.js ve olcum uc noktalari)
const GA4_SCRIPT_SOURCES = ['https://www.googletagmanager.com'];
const GA4_CONNECT_SOURCES = [
  'https://*.google-analytics.com',
  'https://*.analytics.google.com',
  'https://*.googletagmanager.com'
];

const paymentCsp = helmet.contentSecurityPolicy({
  directives: {
    ...commonDirectives(),
    connectSrc: ["'self'", 'https://www.paytr.com', ...GA4_CONNECT_SOURCES],
    frameSrc: [...COMMON_FRAME_SOURCES, ...PAYTR_FRAME_SOURCES, 'https:'],
    scriptSrc: [
      "'self'",
      'https://www.paytr.com',
      ...GA4_SCRIPT_SOURCES,
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

function isPaymentRender(req, view) {
  return String(req.originalUrl || req.url || '').startsWith('/odeme')
    || String(view || '').startsWith('payments/');
}

function enforceEjsCsp(req, res, next) {
  const render = res.render.bind(res);

  res.render = function renderWithEjsCsp(view, options, callback) {
    const csp = isPaymentRender(req, view) ? paymentCsp : ejsCsp;
    csp(req, res, () => {});
    return render(view, options, callback);
  };

  next();
}

module.exports = {
  cspNonce,
  enforceEjsCsp,
  enforceLegacyCsp
};
