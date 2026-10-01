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
// Cember 21: kapsam daraltildi — overview script'inin (course-overview.js) ele aldigi dinamik
// sayfalara DOKUNULMAZ, aksi halde iki sistem ayni gorselleri ayri ayri yerlestirir.
// Canli olcum (2026-10-01): bu daraltma olmadan temiz ornek sayfada 18 gorselin 5'i kayiyordu.
const ALLOWED_ROOT = ':is(#tab-info, #tab-additional-content2, #tab-additional-content3, .jodit-wysiwyg):not(.uv-course-overview)';
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
// Cember 22: olculer TAHMIN DEGIL — canli referans galeriden (course-overview.js) alindi.
assert.match(withoutComments, /max-width:\s*min\(100%,\s*600px\)/, 'gorsel genislik tavani');
assert.match(withoutComments, /gap:\s*22px/, 'olculen referans bosluk: 22px');
assert.match(withoutComments, /padding:\s*10px/, 'olculen kart ic bosluğu: 10px');
assert.match(withoutComments, /border-radius:\s*14px/, 'olculen kart kose yaricapi: 14px');
assert.match(withoutComments, /#f8f9fc/i, 'olculen kart arka plani');
assert.match(withoutComments, /object-fit:\s*contain/, 'gorseller kirpilmadan sigmali');
// Siniflar render aninda eklenir; CSS yalnizca onlari hedefler.
assert.match(withoutComments, /\.uv-ov-media\b/, 'uv-ov-media sinifi stillenmeli');
assert.match(withoutComments, /\.uv-ov-gallery\b/, 'uv-ov-gallery sinifi stillenmeli');
assert.match(withoutComments, /\.uv-ov-gallery-item\b/, 'uv-ov-gallery-item sinifi stillenmeli');
// Mobil davranis zorunlu (Mimar: taşma olmayacak).
assert.match(withoutComments, /@media \(max-width:\s*767px\)/, 'mobil kurallari bulunmali');
// CTA kutusu galeri onune tasiniyor; iki yandan da nefes payi almali (Mimar, 2026-10-01).
assert.match(withoutComments, /\.alert-success/, 'CTA kutusu icin bosluk kurali olmali');
assert.match(withoutComments, /flex-wrap:\s*wrap/, 'coklu gorsel bloklari sarmalayarak hizalanmali');
assert.match(withoutComments, /display:\s*grid/, '5+ gorsel kartli grid olmali');
// Cember 22: :has() tahminine son verildi. Blok siniflandirmasi SUNUCUDA yapilir
// (legacy-overview-layout.js) — CSS metin olup olmadigini goremez, bu yuzden 2026-10-01'de
// 534 karakterlik bir paragraf yanlislikla flex'e donusmustu.
assert.doesNotMatch(withoutComments, /:has\(/, 'metin tespiti CSS ile degil sunucuda yapilmali');
assert.doesNotMatch(withoutComments, /img\s*\+\s*img/, 'bitisik kardes secicisi gercek yapiyi tutmuyor');

// Mimar karari GUNCELLENDI (2026-10-01): tek gorselli bloklar da ortalanir. Gerekce: olcumde
// en kotu gorunum tam da bunlardaydi (180px gorselin sagında 1088px bosluk). Yeni kapsam
// daraltmasi sayesinde temiz ornek sayfada 0 degisiklik olculdu.

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
