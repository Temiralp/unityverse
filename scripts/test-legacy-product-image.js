#!/usr/bin/env node

// Statik kurs detay sayfasindaki ana gorselin DB (admin) gorseli ile senkronu
// ve admin kurs formundaki gorsel kaldirma / tam boyut goruntuleme kontrolleri.

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');

const {
  synchronizeLegacyProductDetailImage
} = require('../src/services/legacy-product-image');
const { enhanceLegacyHtml } = require('../src/middleware/legacy-whatsapp');

const root = path.resolve(__dirname, '..');
const staticDetailHtml = fs.readFileSync(
  path.join(root, 'urun/full-stack-development-canli-online-egitim-1563/index.html'),
  'utf8'
);
const LEGACY_IMAGE = '../../uploads/p/p/full-stack-development-canli-online-egitim_1.jpg?v=1726224678';
const NEW_IMAGE = '/uploads/products/1757900000000-abcdef.jpg';
const PLACEHOLDER = '../../uploads/fm/placeholder-social.png';

function slideCount(html, sliderClass) {
  const pattern = new RegExp(
    `<div[^>]*class="swiper ${sliderClass}"[^>]*>\\s*<div class="swiper-wrapper">([\\s\\S]*?)<\\/div>\\s*<div class="swiper-button-prev">`
  );
  const match = html.match(pattern);
  assert.ok(match, `${sliderClass} slider bulunamadi`);
  return (match[1].match(/class="swiper-slide/g) || []).length;
}

// 1) DB gorseli statik gorselle ayni (yalnizca ../../ ve ?v= farki) -> HTML dokunulmadan kalir
assert.equal(
  synchronizeLegacyProductDetailImage(staticDetailHtml, { image: LEGACY_IMAGE }),
  staticDetailHtml
);
assert.equal(
  synchronizeLegacyProductDetailImage(staticDetailHtml, {
    image: '/uploads/p/p/full-stack-development-canli-online-egitim_1.jpg'
  }),
  staticDetailHtml
);

// 2) Baglam yok (kurs sayfasi degil) -> dokunulmaz
assert.equal(synchronizeLegacyProductDetailImage(staticDetailHtml, null), staticDetailHtml);
assert.equal(synchronizeLegacyProductDetailImage('', { image: NEW_IMAGE }), '');

// 3) Admin yeni gorsel yukledi -> ana slider ve thumbnail tek slayt olarak yeni gorseli gosterir
const updated = synchronizeLegacyProductDetailImage(staticDetailHtml, { image: NEW_IMAGE });
assert.notEqual(updated, staticDetailHtml);
assert.equal(updated.includes(LEGACY_IMAGE), false, 'eski gorsel yolu kalmamali');
assert.equal(slideCount(updated, 'uv-product-slider'), 1);
assert.equal(slideCount(updated, 'uv-product-slider-thumb'), 1);
assert.match(updated, /<a data-fancybox="gallery" data-index="0" title="Full Stack Development Canlı \( Online \) Eğitim" href="\/uploads\/products\/1757900000000-abcdef\.jpg">/);
assert.match(updated, /<img class="img_zoom lazy" data-zoom-image="\/uploads\/products\/1757900000000-abcdef\.jpg" data-og-src="\/uploads\/products\/1757900000000-abcdef\.jpg" src="\/uploads\/products\/1757900000000-abcdef\.jpg" title="Full Stack Development Canlı \( Online \) Eğitim" alt="Full Stack Development Canlı \( Online \) Eğitim"\/>/);
assert.match(updated, /<div class="swiper-slide thumbnail-slide"><img src="\/uploads\/products\/1757900000000-abcdef\.jpg" data-zoom-image="\/uploads\/products\/1757900000000-abcdef\.jpg"/);
// Sayfanin geri kalani (baslik, sekmeler) degismemeli
assert.ok(updated.includes('<div class="title-product">'));
assert.equal(updated.split('uv-product-page-pictures').length, staticDetailHtml.split('uv-product-page-pictures').length);

// 3b) og:image / itemprop mutlak URL (https://unityverseacademy.com/...) olan sayfalar:
//     meta, JSON-LD ve paylasim linkindeki eski gorsel de yeni gorsele doner, origin korunur
const absoluteMetaHtml = fs.readFileSync(
  path.join(root, 'urun/full-stack-development-canli-online-egitim-1059/index.html'),
  'utf8'
);
assert.match(absoluteMetaHtml, /og:image" content="https:\/\/unityverseacademy\.com\/uploads\/p\/p\//);
const updatedAbsolute = synchronizeLegacyProductDetailImage(absoluteMetaHtml, { image: NEW_IMAGE });
assert.equal((updatedAbsolute.match(/full-stack-development-canli-online-egitim_1\.jpg/g) || []).length, 0);
assert.ok(updatedAbsolute.includes(`<meta property="og:image" content="https://unityverseacademy.com${NEW_IMAGE}" />`));
assert.ok(updatedAbsolute.includes(`<meta itemprop="image" content="https://unityverseacademy.com${NEW_IMAGE}" />`));
assert.ok(updatedAbsolute.includes(`&amp;media=${NEW_IMAGE}"`));
// Nisbi meta formunda da (1563) og:image ve JSON-LD yeni gorseli gosterir
assert.ok(updated.includes(`<meta property="og:image" content="${NEW_IMAGE}" />`));
assert.ok(updated.includes(`"image": "${NEW_IMAGE}"`));
// Yeni gorsel harici bir URL ise origin one eklenmez
const externalImage = 'https://cdn.example.com/kurs.jpg?w=800';
const updatedExternal = synchronizeLegacyProductDetailImage(absoluteMetaHtml, { image: externalImage });
assert.ok(updatedExternal.includes(`<meta property="og:image" content="${externalImage}" />`));
assert.equal(updatedExternal.includes('unityverseacademy.com/https://'), false);

// 3c) origin verilirse og:image / itemprop image her durumda mutlak URL olur
//     (gorsel degismemis olsa bile; OG spesifikasyonu mutlak URL ister)
const ORIGIN = 'https://unityverseacademy.com';
const unchangedAbsolute = synchronizeLegacyProductDetailImage(staticDetailHtml, { image: LEGACY_IMAGE, origin: ORIGIN });
assert.notEqual(unchangedAbsolute, staticDetailHtml);
assert.ok(unchangedAbsolute.includes(`<meta property="og:image" content="${ORIGIN}/uploads/p/p/full-stack-development-canli-online-egitim_1.jpg?v=1726224678" />`));
assert.ok(unchangedAbsolute.includes(`<meta itemprop="image" content="${ORIGIN}/uploads/p/p/full-stack-development-canli-online-egitim_1.jpg?v=1726224678" />`));
// Slider ve sayfanin geri kalani degismez (yalnizca 2 meta)
assert.equal(unchangedAbsolute.replace(/<meta (property="og:image"|itemprop="image") content="[^"]*" \/>/g, ''), staticDetailHtml.replace(/<meta (property="og:image"|itemprop="image") content="[^"]*" \/>/g, ''));
// Idempotent
assert.equal(synchronizeLegacyProductDetailImage(unchangedAbsolute, { image: LEGACY_IMAGE, origin: ORIGIN }), unchangedAbsolute);
// Gorsel degisince de mutlak
const changedAbsolute = synchronizeLegacyProductDetailImage(staticDetailHtml, { image: NEW_IMAGE, origin: ORIGIN });
assert.ok(changedAbsolute.includes(`<meta property="og:image" content="${ORIGIN}${NEW_IMAGE}" />`));
assert.ok(changedAbsolute.includes(`<meta itemprop="image" content="${ORIGIN}${NEW_IMAGE}" />`));
// Zaten mutlak olan (1059) origin'i korur, cift origin olmaz
const alreadyAbsolute = synchronizeLegacyProductDetailImage(absoluteMetaHtml, { image: LEGACY_IMAGE, origin: 'http://127.0.0.1:8765' });
assert.equal(alreadyAbsolute, absoluteMetaHtml);
// origin yoksa eski davranis (dokunulmaz)
assert.equal(synchronizeLegacyProductDetailImage(staticDetailHtml, { image: LEGACY_IMAGE }), staticDetailHtml);

// 4) Gorsel yolu HTML kacisli yazilir
const escaped = synchronizeLegacyProductDetailImage(staticDetailHtml, { image: '/uploads/products/a"b.jpg' });
assert.ok(escaped.includes('/uploads/products/a&quot;b.jpg'));
assert.equal(escaped.includes('a"b.jpg'), false);

// 5) Admin gorseli kaldirdi (null) -> liste sayfasiyla ayni placeholder
const cleared = synchronizeLegacyProductDetailImage(staticDetailHtml, { image: null });
assert.equal(cleared.includes(LEGACY_IMAGE), false);
assert.ok(cleared.includes(`src="${PLACEHOLDER}"`));
assert.equal(slideCount(cleared, 'uv-product-slider'), 1);

// 6) Dinamik route ciktisi (DB gorseli zaten kullaniliyor) ayni kaliyor
const dynamicLike = updated;
assert.equal(synchronizeLegacyProductDetailImage(dynamicLike, { image: NEW_IMAGE }), dynamicLike);

// 7) enhanceLegacyHtml 10. parametre olarak gorsel baglamini uygular
const enhanced = enhanceLegacyHtml(
  staticDetailHtml, [], [], null, null, null, [], null, null, { image: NEW_IMAGE }
);
assert.ok(enhanced.includes(NEW_IMAGE));
assert.equal(enhanced.includes(LEGACY_IMAGE), false);
const enhancedWithoutImage = enhanceLegacyHtml(staticDetailHtml, [], [], null, null, null, [], null, null);
assert.ok(enhancedWithoutImage.includes(LEGACY_IMAGE));

// 8) Admin formu: onizleme tam boyut linki + gorseli kaldir dugmesi
const formView = fs.readFileSync(path.join(root, 'src/views/admin/products/form.ejs'), 'utf8');
assert.match(formView, /<a href="<%= productImagePreviewUrl %>" target="_blank" rel="noopener"[^>]*>\s*<img src="<%= productImagePreviewUrl %>"/);
assert.match(formView, /<button type="button"[^>]*data-remove-product-image[^>]*>Görseli Kaldır<\/button>/);
assert.match(formView, /admin-product-editor\.js\?v=2026091[5-9]/, 'script cache-bust guncellenmeli');

// 9) Admin editor JS: kaldir dugmesi URL ve dosya alanini temizler, onizlemeyi gizler
const editorJs = fs.readFileSync(path.join(root, 'public/tema10/js/admin-product-editor.js'), 'utf8');
assert.match(editorJs, /data-remove-product-image/);
assert.match(editorJs, /input\[name="image"\]/);
assert.match(editorJs, /input\[name="productImage"\]/);

console.log('legacy product image sync + admin image controls OK');
