// R13: GTM'in enjekte ettigi widget'lar legacy CSP tarafindan engelleniyordu.
// Kanit (2026-09-23, canli Chrome): elfsight platform.js ve delightchat embed.min.js
// encodedBodySize=0 / duration=0 -> hic indirilmedi; connect.facebook.net (110 KB) calisiyor.
// Bu test gercek middleware'i calistirip Content-Security-Policy basligini okur.

const assert = require('assert/strict');
const { enforceLegacyCsp, enforceEjsCsp } = require('../src/config/csp');

// --- Yardimci: middleware'i sahte req/res ile calistirip baslik sozlugunu dondurur.
function directivesFrom(middleware, { url = '/', view = null } = {}) {
  const headers = {};
  const res = {
    setHeader(name, value) { headers[String(name).toLowerCase()] = value; },
    getHeader(name) { return headers[String(name).toLowerCase()]; },
    locals: { cspNonce: 'TESTNONCE' },
    render() { return this; }
  };
  const req = { originalUrl: url, url, method: 'GET' };

  middleware(req, res, () => {});
  if (view !== null) res.render(view, {});

  const header = headers['content-security-policy'] || '';
  const map = {};
  header.split(';').map((part) => part.trim()).filter(Boolean).forEach((part) => {
    const [name, ...values] = part.split(/\s+/);
    map[name] = values;
  });
  return map;
}

const legacy = directivesFrom(enforceLegacyCsp);

// 1) Engellenen iki host script-src'ye eklenmeli.
assert.ok(
  legacy['script-src'].includes('https://static.elfsight.com'),
  'elfsight platform.js hosti script-src icinde olmali'
);
assert.ok(
  legacy['script-src'].includes('https://d2mpatx37cqexb.cloudfront.net'),
  'delightchat embed hosti script-src icinde olmali'
);

// 2) Widget'larin calisma anindaki uc noktalari connect-src'de olmali.
assert.ok(legacy['connect-src'].includes('https://*.elfsight.com'), 'elfsight API connect-src icinde olmali');
assert.ok(legacy['connect-src'].includes('https://*.delightchat.io'), 'delightchat API connect-src icinde olmali');

// 2b) Delightchat widget'i kendi CSS'ini de yukluyor (yerel kanit: style-src-elem ihlali).
assert.ok(
  legacy['style-src'].includes('https://d2mpatx37cqexb.cloudfront.net'),
  'delightchat CSS hosti legacy style-src icinde olmali'
);

// 3) Onceden calisan kaynaklar aynen korunmali (regresyon).
[
  'https://www.googletagmanager.com',
  'https://connect.facebook.net',
  'https://embed.tawk.to',
  'https://www.youtube.com',
  "'self'"
].forEach((source) => {
  assert.ok(legacy['script-src'].includes(source), `${source} script-src'den dusmemeli`);
});
[
  'https://*.google-analytics.com',
  'https://*.facebook.com',
  'https://restcountries.com'
].forEach((source) => {
  assert.ok(legacy['connect-src'].includes(source), `${source} connect-src'den dusmemeli`);
});

// 4) Widget'lar YALNIZCA legacy statik sayfalara ait: odeme ve diger EJS sayfalari degismemeli.
const payment = directivesFrom(enforceEjsCsp, { url: '/odeme/1', view: 'payments/result' });
const ejs = directivesFrom(enforceEjsCsp, { url: '/uye/profil', view: 'members/profile' });
[payment, ejs].forEach((map, index) => {
  const label = index === 0 ? 'odeme' : 'EJS';
  assert.ok(
    !map['script-src'].some((s) => s.includes('elfsight') || s.includes('cloudfront')),
    `${label} sayfasinin script-src'sine widget hosti sizmamali`
  );
  assert.ok(
    !map['style-src'].some((s) => s.includes('cloudfront')),
    `${label} sayfasinin style-src'sine widget hosti sizmamali`
  );
});

// 5) Odeme sayfasi GA4 izinlerini korumali (Cember 13 regresyonu).
assert.ok(payment['script-src'].includes('https://www.googletagmanager.com'));
assert.ok(payment['connect-src'].includes('https://*.google-analytics.com'));

console.log('test-legacy-csp-widgets OK');
