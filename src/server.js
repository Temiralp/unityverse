require('dotenv').config();

const path = require('path');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const { Pool } = require('pg');
const compression = require('compression');
const helmet = require('helmet');
const methodOverride = require('method-override');
const prisma = require('./db');

const adminRoutes = require('./routes/admin');
const apiRoutes = require('./routes/api');
const catalogRoutes = require('./routes/catalog');
const enrollmentRoutes = require('./routes/enrollments');
const leadRoutes = require('./routes/leads');
const legacyFilterRoutes = require('./routes/legacy-filters');
const legacyCatalogRoutes = require('./routes/legacy-catalog');
const legacyProductDetailRoutes = require('./routes/legacy-product-detail');
const memberRoutes = require('./routes/members');
const createSocialAuthRouter = require('./routes/social-auth');
const paymentRoutes = require('./routes/payments');
const paytrRoutes = require('./routes/paytr');
const { cspNonce, enforceEjsCsp, enforceLegacyCsp } = require('./config/csp');
const { requireSessionSecret } = require('./config/session');
const { parseTrustProxy } = require('./config/trust-proxy');
const {
  injectLegacyWhatsappIntoHtmlResponses,
  sendLegacyHtmlFile,
  serveLegacyHtmlWithWhatsapp
} = require('./middleware/legacy-whatsapp');
const {
  createLegacyProductVisibility
} = require('./middleware/legacy-product-visibility');
const { redirectLegacyBlogImage } = require('./services/blog-images');

const app = express();
const port = process.env.PORT || 8000;
const rootDir = path.resolve(__dirname, '..');
const sessionSecret = requireSessionSecret();
const trustProxy = parseTrustProxy(process.env.TRUST_PROXY);
const legacyFrontendMode = String(process.env.LEGACY_FRONTEND_MODE || '')
  .trim()
  .toLowerCase() === 'true';
const longCacheExtensions = new Set([
  '.css',
  '.js',
  '.mjs',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.avif',
  '.svg',
  '.ico',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot'
]);
const staticRootFiles = new Map([
  ['/', 'index.html'],
  ['/index.html', 'index.html'],
  ['/admin.css', 'admin.css'],
  ['/filters.js', 'filters.js'],
  // ['/googleec1b8b1917d61361.html', 'googleec1b8b1917d61361.html'],
  ['/googlebccf539627981dfd.html', 'googlebccf539627981dfd.html'],
  ['/robots.txt', 'robots.txt'],
  ['/sitemap.xml', 'sitemap.xml']
]);
const legacyStaticDirectories = [
  'ajax',
  'blog',
  'blog-detay',
  'form',
  'kategori',
  'marka',
  'os',
  'partials',
  'public',
  'sayfa',
  'sifremi-unuttum',
  'siparis-takip',
  'tum-urunler',
  'uploads',
  'urun',
  'uye',
  'uye-girisi',
  'uye-ol'
];
function setStaticCacheHeaders(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();

  if (longCacheExtensions.has(ext)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return;
  }

  if (ext === '.html') {
    res.setHeader('Cache-Control', 'no-cache');
  }
}
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', trustProxy);

app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(cspNonce);
app.use(enforceLegacyCsp);
app.use(enforceEjsCsp);
app.use(compression());
app.post('/csp-report', express.json({
  limit: '32kb',
  type: ['application/csp-report', 'application/reports+json', 'application/json']
}), (req, res) => {
  const reports = Array.isArray(req.body) ? req.body : [req.body];

  reports.slice(0, 10).forEach((entry) => {
    const report = entry && (entry['csp-report'] || entry.body || entry);
    if (!report || typeof report !== 'object') return;

    const value = (key) => String(report[key] || '').slice(0, 500);
    console.warn('[CSP violation]', {
      documentUri: value('document-uri') || value('documentURL'),
      violatedDirective: value('violated-directive') || value('effectiveDirective'),
      blockedUri: value('blocked-uri') || value('blockedURL'),
      sourceFile: value('source-file') || value('sourceFile'),
      lineNumber: report['line-number'] || report.lineNumber || null
    });
  });

  res.sendStatus(204);
});
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));
app.use(methodOverride('_method'));

const pgPool = new Pool({ connectionString: process.env.DATABASE_URL }); 

app.use(session({
  store: new PgSession({
    pool: pgPool,
    tableName: 'user_sessions',
    createTableIfMissing: true
  }),
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 8
  }
}));

app.use((req, res, next) => {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }

  res.locals.adminUser = req.session.adminUser || null;
  res.locals.currentPath = req.path;
  res.locals.activeNav = null;
  res.locals.csrfToken = req.session.csrfToken;
  next();
});

app.use('/vendor/jodit', express.static(path.join(rootDir, 'node_modules/jodit/es2021'), {
  immutable: true,
  maxAge: '1y'
}));


app.use('/admin', adminRoutes);
app.use('/api', apiRoutes);
if (legacyFrontendMode) {
  app.use(createLegacyProductVisibility(prisma));
  app.use(injectLegacyWhatsappIntoHtmlResponses);
  app.use((req, res, next) => {
    // ROLLBACK: Statik HTML dosyalarını doğrudan servis et (SEO fix)
    // if (/^\/urun\/[^/]+\/?$/.test(req.path)) {
    //   return legacyProductDetailRoutes(req, res, next);
    // }

    return next();
  });
}
// In legacy frontend mode, keep the original presentation while rendering
// public course lists and detail pages from admin-managed DB records.
if (legacyFrontendMode) {
  app.use('/', legacyCatalogRoutes);
} else {
  app.use('/', catalogRoutes);
}
app.use('/odeme', paymentRoutes);
app.use('/ajax', legacyFilterRoutes);
app.use('/ajax', leadRoutes);
app.use('/ajax/enroll', enrollmentRoutes);
app.use('/ajax/member', memberRoutes);
app.use('/auth', createSocialAuthRouter());
app.use('/ajax/paytr', paytrRoutes);

app.get(['/uye-ol', '/uye-ol/'], (req, res) => {
  res.redirect(301, '/uye-girisi/?tab=register');
});

app.get(['/uye', '/uye/'], (req, res) => {
  res.render('members/profile', {
    activeNav: '',
    pageTitle: 'Profilim | Unityverse Academy',
    noindex: true,
    bodyClass: 'member-profile-page',
    extraStyles: [
      '/public/tema10/css/payment.css',
      '/public/tema10/css/member-profile.css?v=20260724-2'
    ],
    extraScripts: ['/public/tema10/js/member-profile.js']
  });
});

const legacyStaticOptions = {
  extensions: ['html'],
  index: 'index.html',
  setHeaders: setStaticCacheHeaders
};

staticRootFiles.forEach((fileName, routePath) => {
  app.get(routePath, async (req, res, next) => {
    const filePath = path.join(rootDir, fileName);
    if (legacyFrontendMode && path.extname(filePath).toLowerCase() === '.html') {
      try {
        return await sendLegacyHtmlFile(res, filePath, setStaticCacheHeaders);
      } catch (error) {
        return next(error);
      }
    }

    setStaticCacheHeaders(res, filePath);
    return res.sendFile(filePath, (error) => {
      if (error) next(error);
    });
  });
});

app.use('/uploads', redirectLegacyBlogImage);

if (legacyFrontendMode) {
  app.use('/urun', (req, res, next) => {
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });
}

legacyStaticDirectories.forEach((directory) => {
  if (legacyFrontendMode) {
    app.use(`/${directory}`, serveLegacyHtmlWithWhatsapp(
      path.join(rootDir, directory),
      setStaticCacheHeaders
    ));
  }

  app.use(`/${directory}`, express.static(path.join(rootDir, directory), legacyStaticOptions));
});

app.use((req, res) => {
  res.status(404).send('404 File Not Found');
});

app.use((error, req, res, next) => {
  console.error(error);
  if (res.headersSent) return next(error);
  res.status(500).send('Server error');
});

app.listen(port, () => {
  console.log(`Unityverse backend running at http://localhost:${port}`);
  console.log(`Admin panel: http://localhost:${port}/admin`);
  if (legacyFrontendMode) {
    console.log('Legacy frontend mode: public course lists and detail pages are DB-backed.');
  }
});
