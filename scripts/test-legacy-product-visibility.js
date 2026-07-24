const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');

const {
  createLegacyProductVisibility,
  decodedProductSlug,
  filterLegacyDraftProductCards,
  isLegacyCardPageRequest,
  synchronizeLegacyProductCardTitles,
  synchronizeLegacyProductDetailTitle,
  titleSyncCategorySlugsForRequest
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

function titleSynchronizationTests() {
  const html = [
    '<section class="pbl-product-card-area-4 pbl-product-card-area-mobile-2">',
    '<div class="pbl-product-card-item">',
    '<div class="pbl-product-card-item-image ratio-1"><a href="../../urun/game-course/"><img src="game.jpg" alt="Old game title"></a></div>',
    '<div class="pbl-product-card-item-name"><a href="../../urun/game-course/">Old game title</a></div>',
    '</div>',
    '<div class="pbl-product-card-item">',
    '<div class="pbl-product-card-item-image ratio-1"><a href="../../urun/other-course/"><img src="other.jpg" alt="Other title"></a></div>',
    '<div class="pbl-product-card-item-name"><a href="../../urun/other-course/">Other title</a></div>',
    '</div>',
    '</section>'
  ].join('');
  const synchronized = synchronizeLegacyProductCardTitles(html, [{
    slug: 'game-course',
    title: 'Unity & C# <Master> Course'
  }]);

  assert.match(synchronized, /alt="Unity &amp; C# &lt;Master&gt; Course"/);
  assert.match(synchronized, />Unity &amp; C# &lt;Master&gt; Course<\/a><\/div>/);
  assert.match(synchronized, /href="\.\.\/\.\.\/urun\/game-course\/"/);
  assert.match(synchronized, /alt="Other title"/);
  assert.match(synchronized, />Other title<\/a><\/div>/);
  assert.equal(synchronizeLegacyProductCardTitles(synchronized, []), synchronized);
  assert.equal(synchronizeLegacyProductCardTitles(null, [{ slug: 'game-course', title: 'Title' }]), null);

  const detailHtml = '<div class="title-product">\n<h1>Static detail title</h1>\n</div>';
  const synchronizedDetail = synchronizeLegacyProductDetailTitle(
    detailHtml,
    'Current DB & <Admin> Title'
  );
  assert.match(synchronizedDetail, /<h1>Current DB &amp; &lt;Admin&gt; Title<\/h1>/);
  assert.equal(synchronizeLegacyProductDetailTitle(detailHtml, ''), detailHtml);
  assert.equal(synchronizeLegacyProductDetailTitle(null, 'Title'), null);
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

  assert.deepEqual(
    titleSyncCategorySlugsForRequest({ method: 'GET', path: '/kategori/oyun-gelistirme-egitimleri-244/' }),
    ['oyun-gelistirme']
  );
  assert.deepEqual(
    titleSyncCategorySlugsForRequest({ method: 'HEAD', path: '/kategori/yazilim-egitimleri-245' }),
    ['yazilim', 'staj-garantili']
  );
  assert.deepEqual(
    titleSyncCategorySlugsForRequest({ method: 'GET', path: '/kategori/grafik-tasarim-egitimleri-246/' }),
    ['grafik-tasarim']
  );
  assert.deepEqual(
    titleSyncCategorySlugsForRequest({ method: 'GET', path: '/kategori/3d-modelleme-egitimleri-247/' }),
    ['3d-modelleme']
  );
  assert.deepEqual(
    titleSyncCategorySlugsForRequest({ method: 'GET', path: '/kategori/animasyon-egitimleri-248/' }),
    []
  );
  assert.deepEqual(
    titleSyncCategorySlugsForRequest({ method: 'POST', path: '/kategori/yazilim-egitimleri-245/' }),
    []
  );
}

async function invoke(middleware, req) {
  const result = {
    nextCalled: false,
    nextError: null,
    redirect: null,
    response: null
  };
  const res = {
    locals: {},
    statusCode: 200,
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    send(body) {
      result.response = { statusCode: this.statusCode, body };
      return this;
    },
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
    ['draft-course', {
      status: 'DRAFT',
      title: 'Draft title',
      category: { slug: 'oyun-gelistirme' },
      productVariants: [],
      variantOfProducts: []
    }],
    ['published-course', {
      status: 'PUBLISHED',
      title: 'Published title',
      category: { slug: 'other-category' },
      productVariants: [],
      variantOfProducts: []
    }],
    ['variant-course', {
      status: 'PUBLISHED',
      title: 'Current game detail title',
      category: { slug: 'oyun-gelistirme' },
      productVariants: [{ id: 1 }],
      variantOfProducts: []
    }],
    ['software-course', {
      status: 'PUBLISHED',
      title: 'Current software detail title',
      category: { slug: 'yazilim' },
      productVariants: [],
      variantOfProducts: []
    }],
    ['internship-course', {
      status: 'PUBLISHED',
      title: 'Current internship detail title',
      category: { slug: 'staj-garantili' },
      productVariants: [],
      variantOfProducts: []
    }],
    ['graphic-course', {
      status: 'PUBLISHED',
      title: 'Current graphic design detail title',
      category: { slug: 'grafik-tasarim' },
      productVariants: [],
      variantOfProducts: []
    }],
    ['modeling-course', {
      status: 'PUBLISHED',
      title: 'Current 3D modeling detail title',
      category: { slug: '3d-modelleme' },
      productVariants: [],
      variantOfProducts: []
    }]
  ]);
  const calls = { findUnique: 0, draftFindMany: 0, titleCategorySlugs: [] };
  const middleware = createLegacyProductVisibility({
    product: {
      async findUnique({ where, select }) {
        calls.findUnique += 1;
        assert.deepEqual(select, {
          status: true,
          title: true,
          category: {
            select: { slug: true }
          },
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
        if (where.status === 'DRAFT') {
          calls.draftFindMany += 1;
          assert.deepEqual(where, { status: 'DRAFT' });
          assert.deepEqual(select, { slug: true });
          return [{ slug: 'draft-course' }];
        }

        const categorySlugs = where.category.is.slug.in;
        calls.titleCategorySlugs.push(categorySlugs);
        assert.deepEqual(where, {
          status: 'PUBLISHED',
          category: { is: { slug: { in: categorySlugs } } }
        });
        assert.deepEqual(select, { slug: true, title: true });
        if (categorySlugs.includes('yazilim')) {
          return [
            { slug: 'software-course', title: 'Current software detail title' },
            { slug: 'internship-course', title: 'Current internship detail title' }
          ];
        }

        if (categorySlugs.includes('grafik-tasarim')) {
          return [{ slug: 'graphic-course', title: 'Current graphic design detail title' }];
        }

        return categorySlugs.includes('3d-modelleme')
          ? [{ slug: 'modeling-course', title: 'Current 3D modeling detail title' }]
          : [{ slug: 'variant-course', title: 'Current game detail title' }];
      }
    }
  });

  const draft = await invoke(middleware, { method: 'GET', path: '/urun/draft-course/' });
  assert.deepEqual(draft.response, { statusCode: 404, body: '404 File Not Found' });
  assert.equal(draft.redirect, null);
  assert.equal(draft.nextCalled, false);

  const published = await invoke(middleware, { method: 'GET', path: '/urun/published-course/' });
  assert.equal(published.redirect, null);
  assert.equal(published.nextCalled, true);
  assert.equal(published.nextError, null);
  assert.equal(published.locals.legacyProductHasVariants, false);
  assert.equal(published.locals.legacyProductDetailTitle, null);

  const variant = await invoke(middleware, { method: 'GET', path: '/urun/variant-course/' });
  assert.equal(variant.nextCalled, true);
  assert.equal(variant.locals.legacyProductHasVariants, true);
  assert.equal(variant.locals.legacyProductDetailTitle, 'Current game detail title');

  const software = await invoke(middleware, { method: 'GET', path: '/urun/software-course/' });
  assert.equal(software.nextCalled, true);
  assert.equal(software.locals.legacyProductDetailTitle, 'Current software detail title');

  const internship = await invoke(middleware, { method: 'GET', path: '/urun/internship-course/' });
  assert.equal(internship.nextCalled, true);
  assert.equal(internship.locals.legacyProductDetailTitle, 'Current internship detail title');

  const graphic = await invoke(middleware, { method: 'GET', path: '/urun/graphic-course/' });
  assert.equal(graphic.nextCalled, true);
  assert.equal(graphic.locals.legacyProductDetailTitle, 'Current graphic design detail title');

  const modeling = await invoke(middleware, { method: 'GET', path: '/urun/modeling-course/' });
  assert.equal(modeling.nextCalled, true);
  assert.equal(modeling.locals.legacyProductDetailTitle, 'Current 3D modeling detail title');

  const category = await invoke(middleware, { method: 'GET', path: '/kategori/test/' });
  assert.equal(category.nextCalled, true);
  assert.deepEqual(category.locals.legacyDraftProducts, [{ slug: 'draft-course' }]);
  assert.deepEqual(category.locals.legacyProductTitles, []);

  const gameCategory = await invoke(middleware, {
    method: 'GET',
    path: '/kategori/oyun-gelistirme-egitimleri-244/'
  });
  assert.equal(gameCategory.nextCalled, true);
  assert.deepEqual(gameCategory.locals.legacyDraftProducts, [{ slug: 'draft-course' }]);
  assert.deepEqual(gameCategory.locals.legacyProductTitles, [{
    slug: 'variant-course',
    title: 'Current game detail title'
  }]);

  const softwareCategory = await invoke(middleware, {
    method: 'GET',
    path: '/kategori/yazilim-egitimleri-245/'
  });
  assert.equal(softwareCategory.nextCalled, true);
  assert.deepEqual(softwareCategory.locals.legacyDraftProducts, [{ slug: 'draft-course' }]);
  assert.deepEqual(softwareCategory.locals.legacyProductTitles, [
    { slug: 'software-course', title: 'Current software detail title' },
    { slug: 'internship-course', title: 'Current internship detail title' }
  ]);

  const graphicCategory = await invoke(middleware, {
    method: 'GET',
    path: '/kategori/grafik-tasarim-egitimleri-246/'
  });
  assert.equal(graphicCategory.nextCalled, true);
  assert.deepEqual(graphicCategory.locals.legacyDraftProducts, [{ slug: 'draft-course' }]);
  assert.deepEqual(graphicCategory.locals.legacyProductTitles, [{
    slug: 'graphic-course',
    title: 'Current graphic design detail title'
  }]);

  const modelingCategory = await invoke(middleware, {
    method: 'GET',
    path: '/kategori/3d-modelleme-egitimleri-247/'
  });
  assert.equal(modelingCategory.nextCalled, true);
  assert.deepEqual(modelingCategory.locals.legacyDraftProducts, [{ slug: 'draft-course' }]);
  assert.deepEqual(modelingCategory.locals.legacyProductTitles, [{
    slug: 'modeling-course',
    title: 'Current 3D modeling detail title'
  }]);

  const asset = await invoke(middleware, { method: 'GET', path: '/public/test.css' });
  assert.equal(asset.nextCalled, true);
  assert.equal(calls.draftFindMany, 5);
  assert.deepEqual(calls.titleCategorySlugs, [
    ['oyun-gelistirme'],
    ['yazilim', 'staj-garantili'],
    ['grafik-tasarim'],
    ['3d-modelleme']
  ]);
  assert.equal(calls.findUnique, 7);
}

async function run() {
  filterTests();
  titleSynchronizationTests();
  requestTests();
  await middlewareTests();
  console.log('Legacy product visibility tests passed.');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
