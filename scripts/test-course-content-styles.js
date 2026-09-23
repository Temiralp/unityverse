// B4-a: kurs sekmelerindeki gorsellerin hizalanmasi TEK bir CSS dosyasindan yonetilir.
// Kural: bu dosya yalnizca kurs sekmesi kaplarini ve admin editor onizlemesini hedefler;
// global bir secici (img{}, p{} gibi) sizarsa tum site etkilenir -> test bunu engeller.

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const {
  LEGACY_COURSE_CONTENT_CSS_VERSION,
  ensureLegacyAssetVersions
} = require('../src/services/legacy-assets');

const cssPath = path.join(rootDir, 'public/tema10/css/course-content.css');
assert.ok(fs.existsSync(cssPath), 'course-content.css olusturulmali');
const css = fs.readFileSync(cssPath, 'utf8');

// --- 1) Kapsam kilidi: her secici yalnizca izinli koklerden biriyle baslamali.
const ALLOWED_ROOT = ':is(#tab-info, #tab-additional-content2, #tab-additional-content3, .jodit-wysiwyg)';
const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
const selectorGroups = [...withoutComments.matchAll(/(^|[};])\s*([^{};@]+)\{/g)]
  .map((m) => m[2].replace(/\s+/g, ' ').trim());
assert.ok(selectorGroups.length > 0, 'CSS kurali bulunamadi');
// Virgulle ayirirken :is(a, b) gibi parantez ici virguller bolunmemeli.
function splitTopLevel(group) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const char of group) {
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    if (char === ',' && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  parts.push(current);
  return parts.map((part) => part.trim()).filter(Boolean);
}

selectorGroups.forEach((group) => {
  splitTopLevel(group).forEach((selector) => {
    assert.ok(
      selector.startsWith(ALLOWED_ROOT),
      `secici kurs sekmesi disina tasiyor: "${selector}"`
    );
  });
});

// --- 2) Olculen iki sorunu da karsilamali (kanit: 27 tasan gorsel, 46 coklu gorsel blogu).
assert.match(withoutComments, /max-width:\s*100%/, 'gorseller konteynerden tasmamali');
assert.match(withoutComments, /flex-wrap:\s*wrap/, 'coklu gorsel bloklari sarmalayarak hizalanmali');
assert.match(withoutComments, /:has\(/, 'coklu gorsel bloklari :has() ile secilmeli');
// Canli kanit (2026-09-23): gercek yapi <p><img><span>..</span><img></p> — bitisik kardes
// secicisi bu blogu TUTMAZ, genel kardes gerekir.
assert.match(withoutComments, /:has\(>\s*img\s*~\s*img\)/, 'genel kardes secicisi (img ~ img) kullanilmali');
assert.doesNotMatch(withoutComments, /img\s*\+\s*img/, 'bitisik kardes secicisi gercek yapiyi tutmuyor');

// Mimar karari (2026-09-23): TEK gorselli paragraflar ortalanmaz (B4-b'de tekrar bakilacak).
assert.doesNotMatch(
  withoutComments,
  /:has\(\s*>\s*img:only-child\s*\)/,
  'tek gorselli paragraflar bu cemberde hedeflenmemeli'
);

// --- 3) Enjeksiyon: yalnizca kurs detay sayfalarina, tek sefer.
const linkPattern = new RegExp(
  `<link[^>]+course-content\\.css\\?v=${LEGACY_COURSE_CONTENT_CSS_VERSION}`
);
function occurrences(value, needle) {
  return value.split(needle).length - 1;
}

const coursePage = '<!doctype html><html><head><title>K</title></head>'
  + '<body><div id="product_details_content"><div id="tab-info">icerik</div></div></body></html>';
const injected = ensureLegacyAssetVersions(coursePage);
assert.match(injected, linkPattern, 'kurs sayfasina CSS linki eklenmeli');
assert.equal(occurrences(injected, 'course-content.css'), 1, 'link tek olmali');
assert.equal(ensureLegacyAssetVersions(injected), injected, 'idempotent olmali');

const otherPage = '<!doctype html><html><head><title>B</title></head><body><main>blog</main></body></html>';
assert.doesNotMatch(
  ensureLegacyAssetVersions(otherPage),
  /course-content\.css/,
  'kurs olmayan sayfaya eklenmemeli'
);

// --- 4) Admin editor onizlemesi ayni dosyayi kullanmali (tek stil kaynagi).
const adminHeader = fs.readFileSync(path.join(rootDir, 'src/views/admin/partials/header.ejs'), 'utf8');
assert.match(adminHeader, /course-content\.css\?v=/, 'admin header ayni CSS-i yuklemeli');

console.log('test-course-content-styles OK');
