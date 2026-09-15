#!/usr/bin/env node

// Dinamik (statik dosyasi olmayan) kurs detay sayfasinin <head> meta etiketleri
// sablon (Python kursu) yerine kursun kendi verisini tasimali: og:image, itemprop=image,
// og:description. WhatsApp/Facebook onizlemesi bu etiketleri kullanir.

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');

const { renderPage } = require('../src/routes/legacy-product-detail');

const root = path.resolve(__dirname, '..');
const template = fs.readFileSync(
  path.join(root, 'urun/2026-python-bootcamp-sifirdan-python-canli-online-egitimi-8/index.html'),
  'utf8'
);
const origin = 'https://unityverseacademy.com';
const baseProduct = {
  id: 999,
  slug: 'online-blender-egitimi-30-saat',
  title: 'Online Blender Eğitimi 30 Saat',
  summary: 'Blender ile 3D modelleme "temelleri" & animasyon',
  image: '/uploads/products/1787572803122-9e2530954c1ace1db57b88df.jpg',
  price: null,
  tabs: [],
  category: null
};

function metaContent(html, attribute, name) {
  const pattern = new RegExp(`<meta\\s+${attribute}=["']${name}["']\\s+content=["']([^"']*)["']`, 'i');
  const match = html.match(pattern);
  return match ? match[1] : null;
}

// Sablonda Python verisi oldugunu dogrula (testin anlamli olmasi icin)
assert.match(metaContent(template, 'property', 'og:image'), /python/);
assert.match(metaContent(template, 'property', 'og:description'), /Python/);

// 1) Admin yuklemeli gorsel: mutlak URL, origin + kok-gorece yol
const html = renderPage(template, '', baseProduct, origin);
assert.equal(metaContent(html, 'property', 'og:image'), `${origin}${baseProduct.image}`);
assert.equal(metaContent(html, 'itemprop', 'image'), `${origin}${baseProduct.image}`);
assert.equal(metaContent(html, 'property', 'og:description'), 'Blender ile 3D modelleme &quot;temelleri&quot; &amp; animasyon');
assert.equal(metaContent(html, 'name', 'description'), 'Blender ile 3D modelleme &quot;temelleri&quot; &amp; animasyon');
assert.equal(metaContent(html, 'property', 'og:title'), baseProduct.title);
assert.equal(metaContent(html, 'property', 'og:url'), `${origin}/urun/${baseProduct.slug}/`);
assert.equal((html.match(/property="og:image"/g) || []).length, 1);
// Head'deki hicbir <meta> etiketi sablonun (Python) verisini tasimamali.
const head = html.slice(0, html.indexOf('</head>'));
const headMetaTags = head.match(/<meta\b[^>]*>/g) || [];
assert.equal(headMetaTags.some((tag) => tag.includes('python-canli-online-egitimi_2.jpeg')), false, 'Python gorseli meta icinde kalmamali');
assert.equal(headMetaTags.some((tag) => /Python/i.test(tag)), false, 'Python metni meta icinde kalmamali');
assert.equal(metaContent(html, 'name', 'title'), baseProduct.title);
assert.equal(metaContent(html, 'itemprop', 'name'), baseProduct.title);
assert.equal(metaContent(html, 'itemprop', 'description'), 'Blender ile 3D modelleme &quot;temelleri&quot; &amp; animasyon');
assert.equal(metaContent(html, 'name', 'keywords'), 'Online Blender Eğitimi 30 Saat, Unityverse Academy');
assert.equal(metaContent(html, 'property', 'og:keywords'), 'Online Blender Eğitimi 30 Saat, Unityverse Academy');
const withCategory = renderPage(template, '', { ...baseProduct, category: { name: '3D Modelleme', slug: '3d-modelleme' } }, origin);
assert.equal(metaContent(withCategory, 'name', 'keywords'), 'Online Blender Eğitimi 30 Saat, 3D Modelleme, Unityverse Academy');

// JSON-LD: WebSite blogu aynen kalir, Product blogu kursun verisiyle yeniden uretilir
const jsonLdBlocks = head.match(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g) || [];
assert.equal(jsonLdBlocks.length, 2);
assert.match(jsonLdBlocks[0], /"@type": "WebSite"/);
assert.equal(jsonLdBlocks[0], (template.match(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g) || [])[0], 'WebSite JSON-LD degismemeli');
const productLd = JSON.parse(jsonLdBlocks[1].replace(/^<script[^>]*>/, '').replace(/<\/script>$/, ''));
assert.equal(productLd['@type'], 'Product');
assert.equal(productLd.name, baseProduct.title);
assert.equal(productLd.image, `${origin}${baseProduct.image}`);
assert.equal(productLd.description, 'Blender ile 3D modelleme "temelleri" & animasyon');
assert.equal(productLd.sku, 'UV-999');
assert.equal(productLd.brand.name, 'Unityverse Academy');
assert.equal(productLd.offers['@type'], 'Offer');
assert.equal(productLd.offers.priceCurrency, 'TRY');
assert.equal(productLd.offers.price, '0');
assert.equal(productLd.offers.url, `${origin}/urun/${baseProduct.slug}/`);
assert.equal(productLd.offers.priceValidUntil, `${new Date().getFullYear()}-12-31`);
assert.equal(productLd.offers.availability, 'https://schema.org/InStock');
assert.equal(jsonLdBlocks[1].includes('Python'), false);
// Fiyat ve urun kodu varsa yansir
const priced = renderPage(template, '', { ...baseProduct, code: 'BL-30', price: '12500.00', discountPrice: '9999.50' }, origin);
const pricedLd = JSON.parse((priced.match(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g) || [])[1].replace(/^<script[^>]*>/, '').replace(/<\/script>$/, ''));
assert.equal(pricedLd.sku, 'BL-30');
assert.equal(pricedLd.offers.price, '9999.50');
// summary icindeki HTML ve </script> guvenli: JSON-LD duz metin, script kapanisi kacisli
const hostile = renderPage(template, '', { ...baseProduct, summary: '<b>Kalın</b> metin </script><script>alert(1)</script>' }, origin);
const hostileHead = hostile.slice(0, hostile.indexOf('</head>'));
assert.equal((hostileHead.match(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g) || []).length, 2);
const hostileLd = JSON.parse((hostileHead.match(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g) || [])[1].replace(/^<script[^>]*>/, '').replace(/<\/script>$/, ''));
assert.equal(hostileLd.description, 'Kalın metin alert(1)');
assert.equal(hostileHead.includes('<script>alert(1)</script>'), false);

// 2) Legacy goreli yol (../../uploads/...?v=) -> origin + /uploads/...?v=
const legacy = renderPage(template, '', {
  ...baseProduct,
  image: '../../uploads/p/p/blender_1.jpg?v=1726224678'
}, origin);
assert.equal(metaContent(legacy, 'property', 'og:image'), `${origin}/uploads/p/p/blender_1.jpg?v=1726224678`);

// 3) Harici URL oldugu gibi kalir
const external = renderPage(template, '', { ...baseProduct, image: 'https://cdn.example.com/k.jpg' }, origin);
assert.equal(metaContent(external, 'property', 'og:image'), 'https://cdn.example.com/k.jpg');

// 4) Gorsel yoksa placeholder (slider ile ayni)
const noImage = renderPage(template, '', { ...baseProduct, image: null }, origin);
assert.equal(metaContent(noImage, 'property', 'og:image'), `${origin}/uploads/fm/placeholder-social.png`);

// 5) Summary yoksa og:description = "<baslik> - Unityverse Academy"
const noSummary = renderPage(template, '', { ...baseProduct, summary: null }, origin);
assert.equal(metaContent(noSummary, 'property', 'og:description'), 'Online Blender Eğitimi 30 Saat - Unityverse Academy');

console.log('legacy product detail meta OK');
