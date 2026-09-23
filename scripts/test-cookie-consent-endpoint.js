// R14: cerez banner'inin POST /ajax/cookieselection istegi 404 donmemeli.
// Kapsam kararı (2026-09-23, Mimar): istek kabul edilir, HICBIR sey saklanmaz
// (DB yok, oturum yazimi yok, log yok) -> yan etkisi olmadigi icin CSRF/rate-limit gerekmez.

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const cookieConsentRouter = require('../src/routes/cookie-consent');

// --- Yardimci: router'i gercek Express uygulamasinda calistirmadan, katman tablosunu okur.
function routerLayers(router) {
  return (router.stack || []).map((layer) => ({
    path: layer.route && layer.route.path,
    methods: layer.route ? Object.keys(layer.route.methods) : [],
    handlerCount: layer.route ? layer.route.stack.length : 0
  }));
}

// 1) Router yalnizca POST /cookieselection tanimlar ve tek handler tasir (ara katman yok).
const layers = routerLayers(cookieConsentRouter);
assert.equal(layers.length, 1, 'router yalnizca tek route tanimlamali');
assert.equal(layers[0].path, '/cookieselection');
assert.deepEqual(layers[0].methods, ['post']);
assert.equal(layers[0].handlerCount, 1, 'CSRF/rate-limit ara katmani eklenmemeli (yan etki yok)');

// 2) Handler 200 + JSON doner, onbelleklenmez, govdeyi okumaz.
function invokeHandler(requestBody) {
  const handler = cookieConsentRouter.stack[0].route.stack[0].handle;
  const captured = { status: null, headers: {}, body: null };
  const res = {
    status(code) { captured.status = code; return this; },
    set(name, value) { captured.headers[String(name).toLowerCase()] = value; return this; },
    json(payload) { captured.body = payload; return this; }
  };
  handler({ body: requestBody }, res, () => { throw new Error('next() cagrilmamali'); });
  return captured;
}

const accepted = invokeHandler({ first: 1, accepttype: 'all', acceptedcategories: ['necessary', 'analitics'] });
assert.equal(accepted.status, 200);
assert.deepEqual(accepted.body, { status: 'ok' });
assert.equal(accepted.headers['cache-control'], 'no-store');

// 3) Bozuk/bos govde de ayni yaniti almali (banner asla hata gormemeli).
for (const body of [undefined, null, {}, 'metin', []]) {
  const result = invokeHandler(body);
  assert.equal(result.status, 200, `govde ${JSON.stringify(body)} icin de 200 donmeli`);
  assert.deepEqual(result.body, { status: 'ok' });
}

// 4) Route sunucuya /ajax altinda baglanmis olmali (banner ../../ajax/cookieselection cagiriyor).
const serverSource = fs.readFileSync(path.join(rootDir, 'src/server.js'), 'utf8');
assert.match(serverSource, /const cookieConsentRoutes = require\('\.\/routes\/cookie-consent'\);/);
assert.match(serverSource, /app\.use\('\/ajax', cookieConsentRoutes\);/);

// 5) Servis hicbir kalici kaynaga dokunmamali: prisma/session/console kullanimi olmamali.
const routerSource = fs.readFileSync(path.join(rootDir, 'src/routes/cookie-consent.js'), 'utf8');
assert.doesNotMatch(routerSource, /prisma|session|console\./, 'endpoint durum saklamamali ve log uretmemeli');

console.log('test-cookie-consent-endpoint OK');
