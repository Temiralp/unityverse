#!/usr/bin/env node

// Admin kurs listesinden (filtre/arama ile) duzenlemeye girip Guncelle / Geri Don / Durum / Sil
// sonrasi ayni filtreli listeye donus: returnTo parametresi ve open-redirect korumasi.

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');

const { safeReturnTo } = require('../src/services/admin-return-to');

const root = path.resolve(__dirname, '..');
const options = { fallback: '/admin/products', allowedPrefix: '/admin/products' };
const filtered = '/admin/products?q=python&status=&categoryId=&lessonType=&discountType=&priceFrom=&priceTo=';

// 1) Guvenli degerler aynen doner
assert.equal(safeReturnTo(filtered, options), filtered);
assert.equal(safeReturnTo('/admin/products', options), '/admin/products');
assert.equal(safeReturnTo('/admin/products?q=%C3%BCye', options), '/admin/products?q=%C3%BCye');

// 2) Guvensiz / kapsam disi degerler fallback'e duser (open redirect korumasi)
[
  '', null, undefined, 42,
  'https://evil.example/admin/products',
  '//evil.example/admin/products',
  '/\\evil.example',
  'javascript:alert(1)',
  '/admin/products?q=a\r\nSet-Cookie: x=1',
  '/admin/productsx',
  '/admin/blog',
  'admin/products',
  '/admin/products/../../etc'
].forEach((value) => {
  assert.equal(safeReturnTo(value, options), '/admin/products', `beklenen fallback: ${JSON.stringify(value)}`);
});
assert.equal(safeReturnTo('/admin/products/283/edit', options), '/admin/products/283/edit');

// 3) Route sozlesmesi
const routes = fs.readFileSync(path.join(root, 'src/routes/admin.js'), 'utf8');
assert.match(routes, /require\('\.\.\/services\/admin-return-to'\)/);
assert.match(routes, /function productListReturnTo\(req\)/);
assert.match(routes, /listUrl: req\.originalUrl/);
// Guncelle, Durum, Sil: sabit '/admin/products' yerine returnTo
const productRedirects = routes.match(/res\.redirect\('\/admin\/products'\)/g) || [];
assert.equal(productRedirects.length, 1, 'yalnizca yeni kurs olusturma sabit listeye doner');
assert.equal((routes.match(/res\.redirect\(productListReturnTo\(req\)\)/g) || []).length, 3, 'update, status ve delete returnTo kullanmali');
// Varyant cocugu -> ana kurs yonlendirmesi query'yi korur
assert.match(routes, /\/admin\/products\/\$\{parentLink\.parentProductId\}\/edit\$\{returnToQuery\(req\)\}/);
// renderProductForm returnTo'yu merkezi hesaplar
assert.match(routes, /returnTo: productListReturnTo\(req\)/);

// 4) View sozlesmesi
const index = fs.readFileSync(path.join(root, 'src/views/admin/products/index.ejs'), 'utf8');
assert.match(index, /href="\/admin\/products\/<%= product\.id %>\/edit\?returnTo=<%= encodeURIComponent\(listUrl\) %>"/);
assert.equal((index.match(/<input type="hidden" name="returnTo" value="<%= listUrl %>">/g) || []).length, 2, 'durum ve sil formlari returnTo tasimali');
const form = fs.readFileSync(path.join(root, 'src/views/admin/products/form.ejs'), 'utf8');
assert.match(form, /<a class="button button-secondary" href="<%= returnTo %>">Geri Dön<\/a>/);
assert.match(form, /<input type="hidden" name="returnTo" value="<%= returnTo %>">/);

console.log('admin return-to OK');
