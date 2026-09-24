// Çember 18 geri alındı: overview işareti otomatik düzenleyici yükleme izni değildir.
// Dinamik sayfanın önceden var olan scripti ve Çember 17 CSS'i korunur.

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const {
  ensureLegacyAssetVersions
} = require('../src/services/legacy-assets');

function occurrences(value, needle) {
  return value.split(needle).length - 1;
}

const overviewPage = '<!doctype html><html><head><title>K</title></head><body>'
  + '<div id="product_details_content"><div id="tab-info" data-course-overview>icerik</div></div>'
  + '</body></html>';

// 1) İşaretli statik sayfaya script eklenmez; mevcut içerik korunur.
const injected = ensureLegacyAssetVersions(overviewPage);
assert.doesNotMatch(injected, /course-overview\.js/, 'statik kurs otomatik düzenlenmemeli');
assert.equal(injected.slice(injected.indexOf('<body>')), overviewPage.slice(overviewPage.indexOf('<body>')));
assert.match(injected, /course-content\.css\?v=/, 'Çember 17 CSS korunmalı');

// 2) Idempotent: ikinci gecis yeni etiket eklemez.
assert.equal(ensureLegacyAssetVersions(injected), injected, 'idempotent olmali');

// 3) Dinamik sayfa scripti zaten tasiyor -> tekrar eklenmez.
const dynamicPage = '<!doctype html><html><head></head><body>'
  + '<div id="tab-info" data-course-overview>x</div>'
  + '<script src="../../public/tema10/js/course-overview.js?v=20260726-2" defer></script>'
  + '</body></html>';
assert.equal(occurrences(ensureLegacyAssetVersions(dynamicPage), 'course-overview.js'), 1);
assert.equal(ensureLegacyAssetVersions(dynamicPage), dynamicPage);

// 4) Kurs olmayan sayfa etkilenmez (blog, ana sayfa...).
const otherPage = '<!doctype html><html><head></head><body><main>blog</main></body></html>';
assert.doesNotMatch(ensureLegacyAssetVersions(otherPage), /course-overview\.js/);

// 5) Govdesi olmayan parca/null girdide davranis degismez.
assert.equal(ensureLegacyAssetVersions('<div>fragment</div>'), '<div>fragment</div>');
assert.equal(ensureLegacyAssetVersions(null), null);

// 6) Çember 18 öncesindeki dinamik sayfa davranışı korunmalı.
const dynamicRoute = fs.readFileSync(path.join(rootDir, 'src/routes/legacy-product-detail.js'), 'utf8');
assert.ok(
  dynamicRoute.includes('course-overview.js?v=20260726-2'),
  'dinamik sayfanın mevcut scripti korunmalı'
);

console.log('test-legacy-course-overview-script OK');
