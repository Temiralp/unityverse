#!/usr/bin/env node

// GA4 purchase event (Cember 13): odeme sonuc sayfasi yalnizca basarili kart odemesinde,
// sunucu tarafinda hesaplanan payload ile, CSP uyumlu (JSON data-blogu + harici JS) event gonderir.

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const ejs = require('ejs');

const { buildPurchaseEvent, serializeForScript } = require('../src/services/analytics-events');

const root = path.resolve(__dirname, '..');
const registration = {
  id: 1234, courseTitle: 'Unity ile Oyun Geliştirme', totalAmount: '149000.00', couponCode: null,
  product: { slug: 'unity-ile-oyun-gelistirme-canli-online-egitimi-1478' }
};

// 1) Payload matrisi
const ok = buildPurchaseEvent({ type: 'success', resultMethod: null, registration });
assert.deepEqual(ok, {
  transaction_id: '1234',
  value: 149000,
  currency: 'TRY',
  items: [{ item_id: 'unity-ile-oyun-gelistirme-canli-online-egitimi-1478', item_name: 'Unity ile Oyun Geliştirme' }]
});
assert.equal(buildPurchaseEvent({ type: 'failure', resultMethod: null, registration }), null, 'basarisiz odeme');
assert.equal(buildPurchaseEvent({ type: 'success', resultMethod: 'bank', registration }), null, 'havale');
assert.equal(buildPurchaseEvent({ type: 'success', resultMethod: null, registration: null }), null, 'kayit yok');
assert.equal(buildPurchaseEvent({ type: 'success', registration: { ...registration, totalAmount: null } }), null, 'tutar yok');
assert.equal(buildPurchaseEvent({ type: 'success', registration: { ...registration, totalAmount: '0.00' } }), null, 'tutar 0');
assert.equal(buildPurchaseEvent({ type: 'success', registration: { ...registration, totalAmount: '12.5' } }).value, 12.5);
assert.equal(buildPurchaseEvent({ type: 'success', registration: { ...registration, couponCode: 'OKUL10' } }).coupon, 'OKUL10');
assert.equal('coupon' in ok, false);
const noSlug = buildPurchaseEvent({ type: 'success', registration: { ...registration, product: null } });
assert.deepEqual(noSlug.items, [{ item_name: 'Unity ile Oyun Geliştirme' }]);
assert.equal(buildPurchaseEvent({ type: 'success', registration: { ...registration, courseTitle: '', product: null } }), null, 'ne ad ne id');

// 2) JSON data-blogu icin guvenli serilestirme
const hostile = buildPurchaseEvent({ type: 'success', registration: { ...registration, courseTitle: 'Kurs </script><script>alert(1)</script>' } });
const serialized = serializeForScript(hostile);
assert.equal(serialized.includes('</script>'), false);
assert.equal(serialized.includes('<'), false);
assert.equal(JSON.parse(serialized).items[0].item_name, 'Kurs </script><script>alert(1)</script>');

// 3) View: gercek EJS render (ID + payload varsa iki script, nonce'lu JSON; yoksa hicbiri)
const viewPath = path.join(root, 'src/views/payments/result.ejs');
const viewSource = fs.readFileSync(viewPath, 'utf8')
  .replace(/<%- include\([^)]*\)[^%]*%>/g, '');  // header/footer partial'lari test disi
function render(locals) {
  return ejs.render(viewSource, {
    type: 'success', eyebrow: 'x', title: 'x', message: 'x', resultMethod: null, registration,
    paymentUrl: null, courseUrl: '/', cspNonce: 'NONCE123', ga4MeasurementId: null, ga4Purchase: null, serializeForScript, ...locals
  }, { filename: viewPath });
}
const withEvent = render({ ga4MeasurementId: 'G-TEST123', ga4Purchase: ok });
assert.match(withEvent, /<script type="application\/json" nonce="NONCE123" data-ga4-purchase data-measurement-id="G-TEST123">/);
const jsonText = withEvent.match(/data-measurement-id="G-TEST123">([\s\S]*?)<\/script>/)[1];
assert.deepEqual(JSON.parse(jsonText), ok);
assert.match(withEvent, /<script src="\/public\/tema10\/js\/ga4-purchase\.js\?v=2026091[7-9]-\d+"><\/script>/);
assert.equal((withEvent.match(/gtag\(/g) || []).length, 0, 'view icinde inline gtag olmamali');
const withoutId = render({ ga4MeasurementId: '', ga4Purchase: ok });
assert.equal(withoutId.includes('data-ga4-purchase'), false);
assert.equal(withoutId.includes('ga4-purchase.js'), false);
const withoutPayload = render({ ga4MeasurementId: 'G-TEST123', ga4Purchase: null });
assert.equal(withoutPayload.includes('ga4-purchase.js'), false);

// 4) Route: renderPaymentResult payload'i ve env ID'yi view'a verir
const payments = fs.readFileSync(path.join(root, 'src/routes/payments.js'), 'utf8');
assert.match(payments, /require\('\.\.\/services\/analytics-events'\)/);
assert.match(payments, /ga4MeasurementId: String\(process\.env\.GA4_MEASUREMENT_ID \|\| ''\)\.trim\(\)/);
assert.match(payments, /ga4Purchase: buildPurchaseEvent\(options\)/);
assert.match(payments, /^\s+serializeForScript$/m, 'view serializeForScript alir');

// 5) Harici JS: guard, gtag.js yukleme, event
const js = fs.readFileSync(path.join(root, 'public/tema10/js/ga4-purchase.js'), 'utf8');
assert.match(js, /data-ga4-purchase/);
assert.match(js, /uv-ga4-purchase-/);
assert.match(js, /https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=/);
assert.match(js, /gtag\('config'/);
assert.match(js, /gtag\('event', 'purchase'/);
assert.match(js, /localStorage/);

// 6) CSP: odeme sayfalari GA4'e izin verir
const csp = fs.readFileSync(path.join(root, 'src/config/csp.js'), 'utf8');
const paymentBlock = csp.slice(csp.indexOf('const GA4_SCRIPT_SOURCES'), csp.indexOf('function cspNonce'));
assert.match(paymentBlock, /\.\.\.GA4_CONNECT_SOURCES/);
assert.match(paymentBlock, /\.\.\.GA4_SCRIPT_SOURCES/);
assert.match(paymentBlock, /'https:\/\/www\.googletagmanager\.com'/);
assert.match(paymentBlock, /'https:\/\/\*\.google-analytics\.com'/);
assert.match(paymentBlock, /'https:\/\/\*\.analytics\.google\.com'/);
assert.match(paymentBlock, /'https:\/\/\*\.googletagmanager\.com'/);

// 7) Env anahtari belgelenmis (degersiz)
const envExample = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
assert.match(envExample, /^GA4_MEASUREMENT_ID=$/m);
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
assert.equal(pkg.scripts['test:ga4-purchase-event'], 'node scripts/test-ga4-purchase-event.js');

console.log('GA4 purchase event OK');
