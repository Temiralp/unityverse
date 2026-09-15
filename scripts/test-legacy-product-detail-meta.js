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
// Head'deki hicbir <meta> etiketi sablonun (Python) gorselini tasimamali.
// Not: JSON-LD Product blogu ve name=title/keywords/itemprop name-description etiketleri
// bu cemberin kapsami disindadir (PROJECT_STATE backlog).
const headMetaTags = html.slice(0, html.indexOf('</head>')).match(/<meta\b[^>]*>/g) || [];
assert.equal(headMetaTags.some((tag) => tag.includes('python-canli-online-egitimi_2.jpeg')), false, 'Python gorseli meta icinde kalmamali');

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
