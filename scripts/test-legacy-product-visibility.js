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
  return `<div class="uv-product-card-item"><a href="../../urun/${slug}/">${title}</a></div>`;
}

function filterTests() {
  const html = [
    '<html><body>',
    '<section class="uv-product-card-area-4 uv-product-card-area-mobile-2" style="--gap:10px">',
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
    '<section class="uv-product-card-area-4 uv-product-card-area-mobile-2">',
    '<div class="uv-product-card-item">',
    '<div class="uv-product-card-item-image ratio-1"><a href="../../urun/game-course/"><img src="game.jpg" alt="Old game title"></a></div>',
    '<div class="uv-product-card-item-name"><a href="../../urun/game-course/">Old game title</a></div>',
    '</div>',
    '<div class="uv-product-card-item">',
    '<div class="uv-product-card-item-image ratio-1"><a href="../../urun/other-course/"><img src="other.jpg" alt="Other title"></a></div>',
    '<div class="uv-product-card-item-name"><a href="../../urun/other-course/">Other title</a></div>',
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

  const normalizedRequest = {
    protocol: 'http',
    get(name) {
      return name === 'host' ? 'localhost:8000' : undefined;
    },
    ...req
  };

  await middleware(normalizedRequest, res, (error) => {
    result.nextCalled = true;
    result.nextError = error || null;
  });

  return { ...result, locals: res.locals };
}

async function middlewareTests() {
  const visibleVariant = {
    id: 1,
    parentProductId: 10,
    variantProductId: 11,
    label: '8 ay',
    sortOrder: 0,
    isDefault: true,
    isActive: true,
    variantProduct: {
      id: 11,
      slug: 'visible-variant-course',
      duration: '8 ay',
      status: 'PUBLISHED'
    }
  };
  const draftVariant = {
    ...visibleVariant,
    id: 2,
    variantProductId: 12,
    label: '4 ay',
    isDefault: false,
    variantProduct: {
      id: 12,
      slug: 'draft-variant-course',
      duration: '4 ay',
      status: 'DRAFT'
    }
  };
  const archivedVariant = {
    ...draftVariant,
    id: 4,
    variantProductId: 13,
    label: '12 ay',
    isArchived: true,
    variantProduct: {
      id: 13,
      slug: 'archived-variant-course',
      duration: '12 ay',
      status: 'DRAFT'
    }
  };
  const variantParent = {
    id: 10,
    slug: 'variant-course',
    duration: null,
    status: 'PUBLISHED',
    title: 'Current game detail title',
    category: { slug: 'oyun-gelistirme' },
    tabs: [
      { systemKey: 'CURRICULUM', title: 'Parent curriculum', content: '<p>Shared parent content</p>', sortOrder: 20 }
    ],
    productVariants: [visibleVariant, draftVariant, archivedVariant],
    variantOfProducts: []
  };
  const products = new Map([
    ['draft-course', {
      id: 1,
      slug: 'draft-course',
      duration: null,
      status: 'DRAFT',
      title: 'Draft title',
      category: { slug: 'oyun-gelistirme' },
      productVariants: [],
      variantOfProducts: []
    }],
    ['published-course', {
      id: 2,
      slug: 'published-course',
      duration: '4 ay',
      status: 'PUBLISHED',
      title: 'Published title',
      tabs: [
        { systemKey: 'OVERVIEW', title: 'DB overview', content: '<p>Overview</p>', sortOrder: 10 },
        { systemKey: 'CURRICULUM', title: 'DB curriculum', content: '<p>Curriculum</p>', sortOrder: 20 },
        { systemKey: 'WHY', title: 'Neden Bu Eğitim', content: '<p>Why</p>', sortOrder: 30 }
      ],
      category: { slug: 'other-category' },
      productVariants: [],
      variantOfProducts: []
    }],
    ['variant-course', variantParent],
    ['visible-variant-course', {
      ...visibleVariant.variantProduct,
      title: 'Visible variant',
      category: { slug: 'oyun-gelistirme' },
      tabs: [],
      productVariants: [],
      variantOfProducts: [{ isActive: true, parentProduct: variantParent }]
    }],
    ['draft-variant-course', {
      ...draftVariant.variantProduct,
      title: 'Draft variant',
      category: { slug: 'oyun-gelistirme' },
      tabs: [],
      productVariants: [],
      variantOfProducts: [{ isActive: true, parentProduct: variantParent }]
    }],
    ['archived-variant-course', {
      ...archivedVariant.variantProduct,
      title: 'Archived variant',
      category: { slug: 'oyun-gelistirme' },
      tabs: [],
      productVariants: [],
      variantOfProducts: [{ isActive: false, parentProduct: variantParent }]
    }],
    ['empty-variant-parent', {
      id: 20,
      slug: 'empty-variant-parent',
      duration: null,
      status: 'PUBLISHED',
      title: 'Unavailable parent',
      category: { slug: 'oyun-gelistirme' },
      tabs: [],
      productVariants: [{ ...draftVariant, id: 3, parentProductId: 20 }],
      variantOfProducts: []
    }],
    ['software-course', {
      id: 3,
      slug: 'software-course',
      duration: null,
      status: 'PUBLISHED',
      title: 'Current software detail title',
      category: { slug: 'yazilim' },
      productVariants: [],
      variantOfProducts: []
    }],
    ['internship-course', {
      id: 4,
      slug: 'internship-course',
      duration: null,
      status: 'PUBLISHED',
      title: 'Current internship detail title',
      category: { slug: 'staj-garantili' },
      productVariants: [],
      variantOfProducts: []
    }],
    ['graphic-course', {
      id: 5,
      slug: 'graphic-course',
      duration: null,
      status: 'PUBLISHED',
      title: 'Current graphic design detail title',
      category: { slug: 'grafik-tasarim' },
      productVariants: [],
      variantOfProducts: []
    }],
    ['modeling-course', {
      id: 6,
      slug: 'modeling-course',
      duration: null,
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
        assert.equal(select.id, true);
        assert.equal(select.slug, true);
        assert.equal(select.status, true);
        assert.equal(select.productVariants.select.isActive, true);
        assert.equal(select.productVariants.select.isArchived, true);
        assert.equal(select.productVariants.select.variantProduct.select.status, true);
        assert.equal(select.variantOfProducts.select.parentProduct.select.status, true);
        assert.equal(
          select.variantOfProducts.select.parentProduct.select.productVariants.select.isActive,
          true
        );
        assert.equal(
          select.variantOfProducts.select.parentProduct.select.productVariants.select.isArchived,
          true
        );
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
  assert.equal(published.locals.legacyProductVariantContext.productId, 2);
  assert.equal(published.locals.legacyProductVariantContext.variants.length, 1);
  assert.equal(published.locals.legacyProductVariantContext.variants[0].label, '4 ay');
  assert.equal(
    published.locals.legacyProductVariantContext.variants[0].variantProduct.slug,
    'published-course'
  );
  assert.equal(published.locals.legacyProductDetailTitle, null);
  assert.deepEqual(published.locals.legacyProductTabs, products.get('published-course').tabs);
  assert.equal(published.locals.legacyProductPageOrigin, 'http://localhost:8000');

  const variant = await invoke(middleware, { method: 'GET', path: '/urun/variant-course/' });
  assert.equal(variant.nextCalled, true);
  assert.equal(variant.locals.legacyProductHasVariants, true);
  assert.equal(variant.locals.legacyProductDetailTitle, 'Current game detail title');
  assert.equal(variant.locals.legacyProductVariantContext.productId, 10);
  assert.equal(variant.locals.legacyProductVariantContext.variants.length, 3);

  const visibleChild = await invoke(middleware, {
    method: 'GET',
    path: '/urun/visible-variant-course/'
  });
  assert.equal(visibleChild.nextCalled, true);
  assert.equal(visibleChild.redirect, null);
  assert.equal(visibleChild.locals.legacyProductVariantContext.productId, 11);
  assert.deepEqual(visibleChild.locals.legacyProductTabs, variantParent.tabs);

  const draftChild = await invoke(middleware, {
    method: 'GET',
    path: '/urun/draft-variant-course/'
  });
  assert.deepEqual(draftChild.redirect, {
    status: 302,
    location: '/urun/variant-course/'
  });
  assert.equal(draftChild.nextCalled, false);

  const archivedChild = await invoke(middleware, {
    method: 'GET',
    path: '/urun/archived-variant-course/'
  });
  assert.deepEqual(archivedChild.redirect, {
    status: 302,
    location: '/urun/variant-course/'
  });
  assert.equal(archivedChild.nextCalled, false);

  const unavailableParent = await invoke(middleware, {
    method: 'GET',
    path: '/urun/empty-variant-parent/'
  });
  assert.deepEqual(unavailableParent.redirect, {
    status: 302,
    location: '/tum-urunler/?pg=1'
  });
  assert.equal(unavailableParent.nextCalled, false);

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
  assert.equal(calls.findUnique, 11);
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
