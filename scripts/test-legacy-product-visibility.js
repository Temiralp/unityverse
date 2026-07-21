const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');

const {
  createLegacyProductVisibility,
  decodedProductSlug,
  filterLegacyDraftProductCards,
  isLegacyCardPageRequest
} = require('../src/middleware/legacy-product-visibility');

function productCard(slug, title) {
  return `<div class="pbl-product-card-item"><a href="../../urun/${slug}/">${title}</a></div>`;
}

function filterTests() {
  const html = [
    '<html><body>',
    '<section class="pbl-product-card-area-4 pbl-product-card-area-mobile-2" style="--gap:10px">',
    productCard('published-course-1', 'Published'),
    productCard('draft-course-2', 'Draft'),
    productCard('draft-course-3', 'Last draft'),
    '</section>',
    '<footer>Footer remains</footer>',
    '</body></html>'
  ].join('');
  const filtered = filterLegacyDraftProductCards(html, [
    { slug: 'draft-course-2' },
    { slug: 'draft-course-3' }
  ]);

  assert.match(filtered, /published-course-1/);
  assert.doesNotMatch(filtered, /draft-course-2/);
  assert.doesNotMatch(filtered, /draft-course-3/);
  assert.match(filtered, /<\/section><footer>Footer remains/);
  assert.equal(filterLegacyDraftProductCards(filtered, []), filtered);
  assert.equal(filterLegacyDraftProductCards(null, [{ slug: 'draft-course-2' }]), null);

  const categoryHtml = fs.readFileSync(path.join(
    __dirname,
    '../kategori/oyun-gelistirme-egitimleri-244/index.html'
  ), 'utf8');
  const draftHref = 'href="../../urun/unity-ile-oyun-gelistirme-canli-online-egitimi-1478/"';
  const publishedHref = 'href="../../urun/unity-ile-oyun-gelistirme-yuz-yuze-egitimi-1481/"';
  const filteredCategory = filterLegacyDraftProductCards(categoryHtml, [{
    slug: 'unity-ile-oyun-gelistirme-canli-online-egitimi-1478'
  }]);

  assert.match(categoryHtml, new RegExp(draftHref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(filteredCategory, new RegExp(draftHref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(filteredCategory, new RegExp(publishedHref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}

function requestTests() {
  assert.equal(decodedProductSlug('/urun/test-course/'), 'test-course');
  assert.equal(decodedProductSlug('/tum-urunler/'), null);
  assert.equal(decodedProductSlug('/urun/%E0%A4%A/'), null);

  assert.equal(isLegacyCardPageRequest({ method: 'GET', path: '/' }), true);
  assert.equal(isLegacyCardPageRequest({ method: 'GET', path: '/kategori/test/' }), true);
  assert.equal(isLegacyCardPageRequest({ method: 'GET', path: '/marka/test/' }), true);
  assert.equal(isLegacyCardPageRequest({ method: 'GET', path: '/sayfa/test/' }), true);
  assert.equal(isLegacyCardPageRequest({ method: 'GET', path: '/public/test.css' }), false);
  assert.equal(isLegacyCardPageRequest({ method: 'POST', path: '/kategori/test/' }), false);
}

async function invoke(middleware, req) {
  const result = {
    nextCalled: false,
    nextError: null,
    redirect: null
  };
  const res = {
    locals: {},
    redirect(status, location) {
      result.redirect = { status, location };
      return this;
    }
  };

  await middleware(req, res, (error) => {
    result.nextCalled = true;
    result.nextError = error || null;
  });

  return { ...result, locals: res.locals };
}

async function middlewareTests() {
  const products = new Map([
    ['draft-course', { status: 'DRAFT', productVariants: [], variantOfProducts: [] }],
    ['published-course', { status: 'PUBLISHED', productVariants: [], variantOfProducts: [] }],
    ['variant-course', {
      status: 'PUBLISHED',
      productVariants: [{ id: 1 }],
      variantOfProducts: []
    }]
  ]);
  const calls = { findUnique: 0, findMany: 0 };
  const middleware = createLegacyProductVisibility({
    product: {
      async findUnique({ where, select }) {
        calls.findUnique += 1;
        assert.deepEqual(select, {
          status: true,
          productVariants: {
            select: { id: true },
            take: 1
          },
          variantOfProducts: {
            where: { isActive: true },
            select: { id: true },
            take: 1
          }
        });
        return products.get(where.slug) || null;
      },
      async findMany({ where, select }) {
        calls.findMany += 1;
        assert.deepEqual(where, { status: 'DRAFT' });
        assert.deepEqual(select, { slug: true });
        return [{ slug: 'draft-course' }];
      }
    }
  });

  const draft = await invoke(middleware, { method: 'GET', path: '/urun/draft-course/' });
  assert.deepEqual(draft.redirect, { status: 302, location: '/tum-urunler/' });
  assert.equal(draft.nextCalled, false);

  const published = await invoke(middleware, { method: 'GET', path: '/urun/published-course/' });
  assert.equal(published.redirect, null);
  assert.equal(published.nextCalled, true);
  assert.equal(published.nextError, null);
  assert.equal(published.locals.legacyProductHasVariants, false);

  const variant = await invoke(middleware, { method: 'GET', path: '/urun/variant-course/' });
  assert.equal(variant.nextCalled, true);
  assert.equal(variant.locals.legacyProductHasVariants, true);

  const category = await invoke(middleware, { method: 'GET', path: '/kategori/test/' });
  assert.equal(category.nextCalled, true);
  assert.deepEqual(category.locals.legacyDraftProducts, [{ slug: 'draft-course' }]);

  const asset = await invoke(middleware, { method: 'GET', path: '/public/test.css' });
  assert.equal(asset.nextCalled, true);
  assert.equal(calls.findMany, 1);
  assert.equal(calls.findUnique, 3);
}

async function run() {
  filterTests();
  requestTests();
  await middlewareTests();
  console.log('Legacy product visibility tests passed.');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
