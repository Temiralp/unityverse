// Cember 18: statik kurs sayfalari da "Egitime Ilk Bakis" duzenleyicisini (course-overview.js)
// yuklemeli. Bugune kadar bu script yalnizca DINAMIK kurs sayfasina (legacy-product-detail.js)
// ekleniyordu; statik HTML dosyasi olan 438 kurs onsuz kaliyordu — iki sayfa tipi arasindaki
// gorunum farkinin kok nedeni buydu (2026-09-23 canli Chrome ile kanitlandi).
//
// data-course-overview isaretini zincirde synchronizeLegacyProductTabs koyar; bu yuzden
// enjeksiyon ondan SONRA calisan ensureLegacyAssetVersions icinde yapilir.

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const {
  LEGACY_COURSE_OVERVIEW_JS_VERSION,
  ensureLegacyAssetVersions
} = require('../src/services/legacy-assets');

function occurrences(value, needle) {
  return value.split(needle).length - 1;
}

const overviewPage = '<!doctype html><html><head><title>K</title></head><body>'
  + '<div id="product_details_content"><div id="tab-info" data-course-overview>icerik</div></div>'
  + '</body></html>';

// 1) Isaretli sayfaya script bir kez, defer ile, mutlak yol ve surum parametresiyle eklenir.
const injected = ensureLegacyAssetVersions(overviewPage);
assert.match(
  injected,
  new RegExp(`<script src="/public/tema10/js/course-overview\\.js\\?v=${LEGACY_COURSE_OVERVIEW_JS_VERSION}" defer></script>`),
  'course-overview.js statik kurs sayfasina eklenmeli'
);
assert.equal(occurrences(injected, 'course-overview.js'), 1, 'script tek olmali');
assert.ok(
  injected.indexOf('course-overview.js') < injected.indexOf('</body>'),
  'script </body> oncesinde olmali'
);

// 2) Idempotent: ikinci gecis yeni etiket eklemez.
assert.equal(ensureLegacyAssetVersions(injected), injected, 'idempotent olmali');

// 3) Dinamik sayfa scripti zaten tasiyor -> tekrar eklenmez.
const dynamicPage = '<!doctype html><html><head></head><body>'
  + '<div id="tab-info" data-course-overview>x</div>'
  + '<script src="../../public/tema10/js/course-overview.js?v=20260726-2" defer></script>'
  + '</body></html>';
assert.equal(occurrences(ensureLegacyAssetVersions(dynamicPage), 'course-overview.js'), 1);

// 4) Kurs olmayan sayfa etkilenmez (blog, ana sayfa...).
const otherPage = '<!doctype html><html><head></head><body><main>blog</main></body></html>';
assert.doesNotMatch(ensureLegacyAssetVersions(otherPage), /course-overview\.js/);

// 5) Govdesi olmayan parca/null girdide davranis degismez.
assert.equal(ensureLegacyAssetVersions('<div>fragment</div>'), '<div>fragment</div>');
assert.equal(ensureLegacyAssetVersions(null), null);

// 6) SISTEM KORUMASI: isareti koyan adim, enjeksiyondan once calismali. Zincir yeniden
// siralanirsa bu test kirmizi olur (aksi halde sessizce hicbir sayfaya eklenmez).
const middleware = fs.readFileSync(path.join(rootDir, 'src/middleware/legacy-whatsapp.js'), 'utf8');
const tabsIndex = middleware.indexOf('synchronizeLegacyProductTabs(');
const assetsIndex = middleware.indexOf('ensureLegacyAssetVersions(');
assert.ok(tabsIndex > -1 && assetsIndex > -1, 'zincirde iki adim da bulunmali');
assert.ok(tabsIndex < assetsIndex, 'data-course-overview isareti asset enjeksiyonundan once konmali');

// 7) Dinamik sayfa ile ayni surum kullanilmali (tek kaynak; surum kaymasini yakalar).
const dynamicRoute = fs.readFileSync(path.join(rootDir, 'src/routes/legacy-product-detail.js'), 'utf8');
assert.ok(
  dynamicRoute.includes(`course-overview.js?v=${LEGACY_COURSE_OVERVIEW_JS_VERSION}`),
  'dinamik sayfadaki surum ile ayni olmali'
);

console.log('test-legacy-course-overview-script OK');
