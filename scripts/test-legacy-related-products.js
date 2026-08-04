const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');

const { buildProductData } = require('../src/routes/admin');
const { renderLegacyProductDetails } = require('../src/routes/legacy-product-detail');
const {
  removeLegacyRelatedProducts
} = require('../src/services/legacy-related-products');
const { enhanceLegacyHtml } = require('../src/middleware/legacy-whatsapp');

const root = path.resolve(__dirname, '..');
const staticProductPath = path.join(
  root,
  'urun/yapay-zeka-destekli-unity-ile-oyun-gelistirme-egitimi-yuz-yuze-1680/index.html'
);

function product(overrides = {}) {
  return {
    id: 391,
    code: 'UV-TEST',
    title: 'Test Eğitimi',
    slug: 'test-egitimi',
    summary: 'Detay sayfasında gösterilmemesi gereken kısa metin',
    content: '',
    image: '/uploads/test.png',
    price: '1000.00',
    discountPrice: null,
    bankTransferDiscountRate: '10.00',
    duration: '3 ay',
    category: { name: 'Yazılım', slug: 'yazilim' },
    tabs: [],
    learningOutcomes: [],
    ...overrides
  };
}

function adminTests() {
  const form = fs.readFileSync(
    path.join(root, 'src/views/admin/products/form.ejs'),
    'utf8'
  );
  const data = buildProductData({
    title: 'Test Eğitimi',
    slug: 'test-egitimi',
    summary: 'İstemciden zorla gönderilen değer'
  });

  assert.doesNotMatch(form, /Kısa Metin/);
  assert.doesNotMatch(form, /name=["']summary["']/);
  assert.equal(Object.hasOwn(data, 'summary'), false);
}

function staticLegacyTests() {
  const source = fs.readFileSync(staticProductPath, 'utf8');
  const transformed = removeLegacyRelatedProducts(source);

  assert.notEqual(transformed, source);
  assert.doesNotMatch(transformed, /id=["']productsimilar["']/i);
  assert.doesNotMatch(transformed, /ajax\/productsimilar/i);
  assert.doesNotMatch(transformed, /class=["'][^"']*\brelated\b[^"']*\btitleLine\b/i);
  assert.match(transformed, /ajax\/productcomments/i);
  assert.match(transformed, /class=["'][^"']*\bproducttab\b/i);
  assert.equal(removeLegacyRelatedProducts(transformed), transformed);

  const enhanced = enhanceLegacyHtml(source);
  assert.doesNotMatch(enhanced, /id=["']productsimilar["']/i);
  assert.doesNotMatch(enhanced, /ajax\/productsimilar/i);
}

function dynamicLegacyTests() {
  const html = renderLegacyProductDetails(product(), 'http://localhost:8000');

  assert.doesNotMatch(html, /Benzer Eğitimler/i);
  assert.doesNotMatch(html, /releate-products/i);
  assert.doesNotMatch(html, /Detay sayfasında gösterilmemesi gereken kısa metin/);
  assert.match(html, /class="producttab col-xs-12"/);
}

function isolationTests() {
  const source = [
    '<html><body>',
    '<div class="related article-list"><p>İlgili yazılar korunmalı</p></div>',
    '<script>$.ajax({ url: "/ajax/productcomments" });</script>',
    '</body></html>'
  ].join('');

  assert.equal(removeLegacyRelatedProducts(source), source);
}

adminTests();
staticLegacyTests();
dynamicLegacyTests();
isolationTests();
console.log('Legacy related product removal tests passed.');
