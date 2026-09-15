#!/usr/bin/env node

// Kategori sayfalarina (kategori/<slug>/index.html sablonlari) /tum-urunler/ ile ayni
// kurs arama formunun, paginasyonun ve legacy-course-catalog.js kontrolcusunun
// sunucu tarafinda eklenmesini dogrular.

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');

const { ensureLegacyCategorySearch } = require('../src/services/legacy-category-search');
const {
  ensureLegacyAssetVersions,
  LEGACY_CATALOG_JS_VERSION,
  LEGACY_UNITYVERSE_CSS_VERSION
} = require('../src/services/legacy-assets');
const { renderLegacyProductListing } = require('../src/routes/legacy-catalog');

const root = path.resolve(__dirname, '..');
const categoryRoot = path.join(root, 'kategori');
const template = fs.readFileSync(path.join(categoryRoot, 'yazilim-egitimleri-245/index.html'), 'utf8');
const actionPath = '/kategori/yazilim-egitimleri-245/';

function count(html, needle) {
  return html.split(needle).length - 1;
}

// 1) Form bir kez eklenir, baslik ve sonuc sayaci korunur
const injected = ensureLegacyCategorySearch(template, actionPath);
assert.notEqual(injected, template);
assert.equal(count(injected, 'class="course-search-form"'), 1);
assert.equal(count(injected, 'id="course-search-input"'), 1);
assert.equal(count(injected, 'id="search_result"'), 1);
assert.match(injected, /<div class="category-page-title category-page-title--with-search">\s*<h1 class="modtitle">\s*Yazılım Eğitimleri/);
assert.match(injected, /<\/h1>\s*<div class="category-page-search">\s*<form class="course-search-form" action="\/kategori\/yazilim-egitimleri-245\/" method="get" role="search">/);
assert.match(injected, /<input id="course-search-input" name="q" type="search" placeholder="Eğitim ara\.\.\." autocomplete="off" maxlength="100" aria-describedby="search_result">/);
assert.match(injected, /<button type="submit" aria-label="Eğitim ara">Ara<\/button>/);
// Form, sonuc sayacindan once gelir (tum-urunler ile ayni sira)
assert.ok(injected.indexOf('class="course-search-form"') < injected.indexOf('id="search_result"'));

// 2) Idempotent: ikinci cagri hicbir sey degistirmez
assert.equal(ensureLegacyCategorySearch(injected, actionPath), injected);

// 3) Gizli paginasyon gorunur hale gelir (kontrolcu 12/sayfa paginasyon cizer)
assert.match(template, /<ul class="pagination" style="display:none !important;"/);
assert.doesNotMatch(injected, /class="pagination"[^>]*display:none/);
assert.equal(count(injected, '<ul class="pagination">'), 1);

// 4) Kontrolcu scripti kok-gorece yolla </body> onune eklenir; surum normalize edilir
assert.match(injected, /<script type="text\/javascript" src="\/public\/tema10\/js\/legacy-course-catalog\.js\?v=[^"]+"><\/script>\s*<\/body>/);
assert.equal(count(injected, 'legacy-course-catalog.js'), 1);
assert.match(
  ensureLegacyAssetVersions(injected),
  new RegExp(`legacy-course-catalog\\.js\\?v=${LEGACY_CATALOG_JS_VERSION}"`)
);

// 5) Kategori olmayan HTML'e dokunulmaz
assert.equal(ensureLegacyCategorySearch('<html><body><p>x</p></body></html>', actionPath), '<html><body><p>x</p></body></html>');
assert.equal(ensureLegacyCategorySearch('', actionPath), '');

// 6) Action yolu HTML kacisli yazilir
assert.ok(ensureLegacyCategorySearch(template, '/kategori/a"b/').includes('action="/kategori/a&quot;b/"'));

// 7) 21 sablonun tamami: DB grid render + arama enjeksiyonu birlikte calisir
const slugs = fs.readdirSync(categoryRoot).filter((slug) => (
  fs.existsSync(path.join(categoryRoot, slug, 'index.html'))
));
assert.ok(slugs.length >= 21, `beklenen >=21 kategori sablonu, bulunan ${slugs.length}`);
slugs.forEach((slug) => {
  const source = fs.readFileSync(path.join(categoryRoot, slug, 'index.html'), 'utf8');
  const rendered = ensureLegacyCategorySearch(
    renderLegacyProductListing(source, [{ id: 1, title: 'Test', slug: 'test-1', image: null }]),
    `/kategori/${slug}/`
  );
  assert.equal(count(rendered, 'class="course-search-form"'), 1, `${slug}: form sayisi`);
  assert.equal(count(rendered, 'id="search_result"'), 1, `${slug}: sonuc sayaci`);
  assert.equal(count(rendered, 'legacy-course-catalog.js'), 1, `${slug}: script`);
  assert.doesNotMatch(rendered, /class="pagination"[^>]*display:none/, `${slug}: paginasyon`);
});

// 8) Route servisi kullanir
const routeSource = fs.readFileSync(path.join(root, 'src/routes/legacy-catalog.js'), 'utf8');
assert.match(routeSource, /require\('\.\.\/services\/legacy-category-search'\)/);
assert.match(routeSource, /ensureLegacyCategorySearch\(\s*renderLegacyProductListing\(template, products\),\s*req\.path\s*\)/);

// 9) CSS: kategori sayfalari icin arama stilleri; h1 gorunur kalir; cache-bust surumu artti
const css = fs.readFileSync(path.join(root, 'public/tema10/css/unityverse.css'), 'utf8');
assert.match(css, /html\.uv-kategori \.category-page-title--with-search \{/);
assert.match(css, /html\.uv-kategori \.course-search-control input \{|html\.uv-kategori \.course-search-control input,|,\s*html\.uv-kategori \.course-search-control input \{/);
assert.match(css, /html\.uv-kategori \.course-search-control button/);
assert.match(css, /html\.uv-kategori \.uv-product-card-area-4 \.uv-product-card-item\[hidden\]/);
assert.doesNotMatch(css, /html\.uv-kategori \.category-page-title--with-search h1\.modtitle \{[^}]*clip:/);
assert.match(css, /html\.uv-tum-urunler \.category-page-title--with-search h1\.modtitle \{[^}]*clip:/, 'tum-urunler h1 davranisi degismemeli');
assert.equal(LEGACY_UNITYVERSE_CSS_VERSION, '5.4.110');

console.log('legacy category search injection OK');
