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

const adminRoutes = require('./routes/admin');
const apiRoutes = require('./routes/api');
const catalogRoutes = require('./routes/catalog');
const enrollmentRoutes = require('./routes/enrollments');
const leadRoutes = require('./routes/leads');
const memberRoutes = require('./routes/members');
const paymentRoutes = require('./routes/payments');
const paytrRoutes = require('./routes/paytr');
const { cspNonce, enforceEjsCsp, enforceLegacyCsp } = require('./config/csp');
const { requireSessionSecret } = require('./config/session');
const { parseTrustProxy } = require('./config/trust-proxy');

const app = express();
const port = process.env.PORT || 8000;
const rootDir = path.resolve(__dirname, '..');
const sessionSecret = requireSessionSecret();
const trustProxy = parseTrustProxy(process.env.TRUST_PROXY);
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
app.use('/', catalogRoutes);
app.use('/odeme', paymentRoutes);
app.use('/ajax', leadRoutes);
app.use('/ajax/enroll', enrollmentRoutes);
app.use('/ajax/member', memberRoutes);
app.use('/ajax/paytr', paytrRoutes);

app.get(['/uye-ol', '/uye-ol/'], (req, res) => {
  res.redirect(301, '/uye-girisi/?tab=register');
});

app.use(express.static(rootDir, {
  extensions: ['html'],
  index: 'index.html',
  setHeaders: (res, filePath) => {
    const ext = path.extname(filePath).toLowerCase();

    if (longCacheExtensions.has(ext)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return;
    }

    if (ext === '.html') {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

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
});
