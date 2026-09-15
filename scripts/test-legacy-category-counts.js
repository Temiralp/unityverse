#!/usr/bin/env node

// Listeleme sayfalarindaki (tum-urunler + kategori/*) statik yan panel kategori
// sayaclarinin ("Oyun Geliştirme Eğitimleri (23)") DB'deki yayinlanmis kurs sayisiyla
// degistirilmesini dogrular. Sayim, kategori sayfasinin kendisiyle ayni tanimi kullanir
// (legacyCategoryCandidateSlugs alias haritasi).

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');

const {
  extractLegacyCategorySlugs,
  countProductsByLegacyCategory,
  loadLegacyCategoryCounts,
  synchronizeLegacyCategoryCounts
} = require('../src/services/legacy-category-counts');
const { legacyCategoryCandidateSlugs } = require('../src/routes/legacy-catalog');

const root = path.resolve(__dirname, '..');
const template = fs.readFileSync(path.join(root, 'tum-urunler/index.html'), 'utf8');
const FALLBACK_START = '<!-- legacy-static-filter-fallback:start -->';
const FALLBACK_END = '<!-- legacy-static-filter-fallback:end -->';

function fallbackBlock(html) {
  return html.slice(html.indexOf(FALLBACK_START), html.indexOf(FALLBACK_END));
}

// 1) Slug cikarma: yalnizca fallback blogundaki 13 kategori
const slugs = extractLegacyCategorySlugs(template);
assert.equal(slugs.length, 13);
assert.ok(slugs.includes('oyun-gelistirme-egitimleri-244'));
assert.ok(slugs.includes('mimarlik-egitimleri-259'));
assert.deepEqual(extractLegacyCategorySlugs('<p>no fallback</p>'), []);

// 2) Sayim: alias haritasi (yazilim = yazilim + staj-garantili), kategorisiz urun sayilmaz
const products = [
  { category: { slug: 'oyun-gelistirme' } },
  { category: { slug: 'oyun-gelistirme' } },
  { category: { slug: 'yazilim' } },
  { category: { slug: 'staj-garantili' } },
  { category: { slug: 'mimarlik' } },
  { category: null },
  {}
];
const counts = countProductsByLegacyCategory(products, slugs, legacyCategoryCandidateSlugs);
assert.equal(counts.get('oyun-gelistirme-egitimleri-244'), 2);
assert.equal(counts.get('yazilim-egitimleri-245'), 2);
assert.equal(counts.get('mimarlik-egitimleri-259'), 1);
assert.equal(counts.get('dil-egitimleri-257'), 0);

// 3) HTML senkronu: yalnizca fallback blogunda, ad ve href korunur
const synced = synchronizeLegacyCategoryCounts(template, counts);
assert.notEqual(synced, template);
const block = fallbackBlock(synced);
assert.match(block, /href="\/kategori\/oyun-gelistirme-egitimleri-244\/" onclick="return getresults\(0, '\/kategori\/oyun-gelistirme-egitimleri-244\/'\)">Oyun Geliştirme Eğitimleri \(2\)<\/a>/);
assert.match(block, /Yazılım Eğitimleri \(2\)<\/a>/);
assert.match(block, /Dil Eğitimleri \(0\)<\/a>/);
assert.equal(block.includes('(23)'), false);
// Fallback disindaki icerik bayt bayt ayni
assert.equal(synced.slice(0, synced.indexOf(FALLBACK_START)), template.slice(0, template.indexOf(FALLBACK_START)));
assert.equal(synced.slice(synced.indexOf(FALLBACK_END)), template.slice(template.indexOf(FALLBACK_END)));
// Idempotent
assert.equal(synchronizeLegacyCategoryCounts(synced, counts), synced);
// Bos sayim haritasi / fallback olmayan HTML -> dokunulmaz
assert.equal(synchronizeLegacyCategoryCounts(template, new Map()), template);
assert.equal(synchronizeLegacyCategoryCounts('<p>x</p>', counts), '<p>x</p>');

// 4) loadLegacyCategoryCounts: tek sorgu, yalnizca kategori slug'i secilir, public where kullanilir
const calls = [];
const fakePrisma = {
  product: {
    async findMany(args) {
      calls.push(args);
      return products;
    }
  }
};
loadLegacyCategoryCounts(fakePrisma, slugs, legacyCategoryCandidateSlugs).then((loaded) => {
  assert.equal(calls.length, 1);
  assert.equal(calls[0].where.status, 'PUBLISHED');
  assert.deepEqual(calls[0].select, { category: { select: { slug: true } } });
  assert.equal(loaded.get('oyun-gelistirme-egitimleri-244'), 2);
  return loadLegacyCategoryCounts(fakePrisma, [], legacyCategoryCandidateSlugs);
}).then((empty) => {
  assert.equal(empty.size, 0);
  assert.equal(calls.length, 1, 'slug yoksa sorgu atilmaz');

  // 5) 22 sablonun tamami (tum-urunler + 21 kategori) fallback blogu tasir ve senkron olur
  const categoryRoot = path.join(root, 'kategori');
  const files = [path.join(root, 'tum-urunler/index.html')].concat(
    fs.readdirSync(categoryRoot).map((slug) => path.join(categoryRoot, slug, 'index.html'))
  ).filter((file) => fs.existsSync(file));
  assert.ok(files.length >= 22);
  files.forEach((file) => {
    const html = fs.readFileSync(file, 'utf8');
    const fileSlugs = extractLegacyCategorySlugs(html);
    assert.equal(fileSlugs.length, 13, `${file}: 13 kategori bekleniyor`);
    const out = synchronizeLegacyCategoryCounts(html, counts);
    assert.equal(fallbackBlock(out).includes('(23)'), false, `${file}: sabit sayac kaldi`);
  });

  // 6) Route'lar servisi kullanir
  const routeSource = fs.readFileSync(path.join(root, 'src/routes/legacy-catalog.js'), 'utf8');
  assert.match(routeSource, /require\('\.\.\/services\/legacy-category-counts'\)/);
  assert.equal((routeSource.match(/withLegacyCategoryCounts\(/g) || []).length >= 3, true, 'tum-urunler ve kategori route\'larinda cagrilmali');

  console.log('legacy category counts OK');
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
