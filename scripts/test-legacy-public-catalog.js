const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');

const {
  legacyCategoryCandidateSlugs,
  publishedProductsForLegacyCategory,
  renderLegacyProductListing,
  shouldIncludeProduct
} = require('../src/routes/legacy-catalog');
const { buildFilterPayload } = require('../src/routes/legacy-filters');
const { publicCatalogProductWhere } = require('../src/services/public-catalog');
const {
  LEGACY_CATALOG_JS_VERSION,
  LEGACY_FILTERS_VERSION,
  ensureLegacyAssetVersions
} = require('../src/services/legacy-assets');
const {
  MAX_QUERY_LENGTH,
  SEARCH_DEBOUNCE_MS,
  filterTitles,
  normalizeQuery,
  normalizeSearchText,
  paginationPages
} = require('../public/tema10/js/legacy-course-catalog');

function product(overrides = {}) {
  return {
    id: 101,
    code: 'PUB101',
    slug: 'published-course',
    title: 'Published Course',
    image: '/uploads/published.jpg',
    summary: 'Summary',
    content: '',
    duration: '4 ay',
    lessonType: 'Online',
    certificate: 'Sertifika',
    category: { name: 'Yazılım', slug: 'yazilim' },
    ...overrides
  };
}

function categoryAliasTests() {
  assert.deepEqual(
    legacyCategoryCandidateSlugs('yazilim-egitimleri-245'),
    ['yazilim', 'staj-garantili']
  );
  assert.deepEqual(
    legacyCategoryCandidateSlugs('animasyon-egitimleri-248'),
    ['animasyon-egitimleri', 'animasyon']
  );
  assert.deepEqual(
    legacyCategoryCandidateSlugs('staj-garantili-egitimler-266'),
    ['staj-garantili-egitimler', 'staj-garantili']
  );
  assert.deepEqual(legacyCategoryCandidateSlugs('../admin'), []);
}

function publicCatalogVisibilityTests() {
  assert.deepEqual(publicCatalogProductWhere(), {
    status: 'PUBLISHED',
    variantOfProducts: { none: {} },
    OR: [
      { productVariants: { none: {} } },
      {
        productVariants: {
          some: {
            isActive: true,
            isArchived: false,
            variantProduct: { is: { status: 'PUBLISHED' } }
          }
        }
      }
    ]
  });
  assert.deepEqual(publicCatalogProductWhere({ categoryId: 12 }), {
    status: 'PUBLISHED',
    variantOfProducts: { none: {} },
    OR: [
      { productVariants: { none: {} } },
      {
        productVariants: {
          some: {
            isActive: true,
            isArchived: false,
            variantProduct: { is: { status: 'PUBLISHED' } }
          }
        }
      }
    ],
    categoryId: 12
  });
}

function catalogSearchTests() {
  const unityCourse = product({
    title: 'Unity ile Oyun Geliştirme Eğitimi',
    summary: 'Oyun geliştirmeyi öğrenin'
  });
  const brandOnlyMatch = product({
    title: 'ZBrush ile Takı Tasarımı',
    summary: 'Unityverse Academy eğitimi',
    slug: 'zbrush-course'
  });

  assert.equal(shouldIncludeProduct(unityCourse, 'unity', ''), true);
  assert.equal(shouldIncludeProduct(unityCourse, 'UNITY', ''), true);
  assert.equal(shouldIncludeProduct(brandOnlyMatch, 'unity', ''), false);
  assert.equal(shouldIncludeProduct(unityCourse, 'PUB101', ''), true);
  assert.equal(shouldIncludeProduct(unityCourse, 'published-course', ''), true);
  assert.equal(shouldIncludeProduct(unityCourse, 'unity', 'oyun-gelistirme'), false);
  assert.equal(normalizeSearchText('İLERİ Düzey'), 'ileri duzey');
  assert.equal(SEARCH_DEBOUNCE_MS, 200);
  assert.equal(MAX_QUERY_LENGTH, 100);
  assert.equal(normalizeQuery(`unity${'x'.repeat(200)}`).length, 100);
  assert.deepEqual(
    filterTitles([
      'Unity ile Oyun Geliştirme',
      'ZBrush Eğitimi',
      'Çocuklar İçin UNITY Kursu'
    ], 'unity'),
    ['Unity ile Oyun Geliştirme', 'Çocuklar İçin UNITY Kursu']
  );
  assert.deepEqual(paginationPages(1, 3), [1, 2, 3]);
  assert.deepEqual(paginationPages(6, 12), [1, 'ellipsis', 4, 5, 6, 7, 8, 'ellipsis', 12]);
}

async function publishedCategoryQueryTest() {
  const expectedProducts = [product()];
  const prisma = {
    product: {
      async findMany(query) {
        assert.deepEqual(query, {
          where: {
            status: 'PUBLISHED',
            variantOfProducts: { none: {} },
            OR: [
              { productVariants: { none: {} } },
              {
                productVariants: {
                  some: {
                    isActive: true,
                    isArchived: false,
                    variantProduct: { is: { status: 'PUBLISHED' } }
                  }
                }
              }
            ],
            category: {
              is: {
                slug: { in: ['yazilim', 'staj-garantili'] }
              }
            }
          },
          include: { category: true },
          orderBy: [{ sortOrder: 'asc' }, { id: 'desc' }]
        });
        return expectedProducts;
      }
    }
  };

  assert.equal(
    await publishedProductsForLegacyCategory(prisma, '../admin').then((items) => items.length),
    0
  );
  assert.deepEqual(
    await publishedProductsForLegacyCategory(prisma, 'yazilim-egitimleri-245'),
    expectedProducts
  );
}

async function filterPayloadVisibilityTest() {
  const visibleProduct = product({
    price: 59000,
    discountPrice: null
  });
  const prisma = {
    product: {
      async findMany(query) {
        assert.deepEqual(query.where, publicCatalogProductWhere());
        return [visibleProduct];
      }
    }
  };
  const payload = await buildFilterPayload(prisma);

  assert.equal(payload.total_product_count, 1);
  assert.equal(payload.brand_filters[0].pcount, 1);
  assert.equal(payload.sub_category_list[0].count, 1);
}

function listingRenderTests() {
  const template = [
    '<html><body>',
    '<span id="search_result">999 ürün bulundu</span>',
    '<section class="uv-product-card-area-4 uv-product-card-area-mobile-2" style="--gap:10px">',
    '<div class="uv-product-card-item"><a href="/urun/draft-course/">Draft Course</a></div>',
    '</section>',
    '</body></html>'
  ].join('');
  const html = renderLegacyProductListing(template, [product()]);

  assert.match(html, /1 ürün bulundu/);
  assert.match(html, /href="\/urun\/published-course\/"/);
  assert.match(html, />Published Course<\/a>/);
  assert.match(html, /PUB101 published-course/);
  assert.doesNotMatch(html, /draft-course|Draft Course/);
  assert.throws(
    () => renderLegacyProductListing('<html>No product grid</html>', []),
    /product grid template could not be found/
  );

  const requestedParentSlug = 'yazilim-uzmanligi-canli-online-egitim-1468';
  const parentHtml = renderLegacyProductListing(template, [product({
    id: 1468,
    slug: requestedParentSlug
  })]);
  assert.match(parentHtml, new RegExp(`href="/urun/${requestedParentSlug}/"`));
  assert.doesNotMatch(parentHtml, /yazilim-uzmanligi-canli-online-egitim-8-ay-1471/);

  [
    'oyun-gelistirme-egitimleri-244',
    'yazilim-egitimleri-245',
    'grafik-tasarim-egitimleri-246',
    '3d-modelleme-egitimleri-247',
    'animasyon-egitimleri-248',
    'ses-tasarim-egitimleri-251',
    'senaryo-sinema-ve-yonetmenlik-egitimleri-252',
    'endustriyel-urun-tasarim-egitimleri-253',
    'dijital-pazarlama-egitimleri-255',
    'ozel-dersler-256',
    'dil-egitimleri-257',
    'muhasebe-ve-ofis-egitimleri-258',
    'mimarlik-egitimleri-259'
  ].forEach((legacySlug) => {
    const categoryTemplate = fs.readFileSync(path.join(
      __dirname,
      '../kategori',
      legacySlug,
      'index.html'
    ), 'utf8');
    const rendered = renderLegacyProductListing(categoryTemplate, [product()]);

    assert.match(rendered, /href="\/urun\/published-course\/"/);
    assert.equal((rendered.match(/class="uv-product-card-item"/g) || []).length, 1);
  });
}

function serverRoutingContractTest() {
  const source = fs.readFileSync(path.join(__dirname, '../src/server.js'), 'utf8');
  const modernCatalogSource = fs.readFileSync(
    path.join(__dirname, '../src/routes/catalog.js'),
    'utf8'
  );

  assert.ok(source.includes("const match = String(req.path || '').match(/^\\/urun\\/([^/]+)\\/?$/);"));
  assert.ok(source.includes('return legacyProductDetailRoutes(req, res, next);'));
  assert.doesNotMatch(
    source,
    /legacyProductHasVariants\s*&&\s*\/\^\\\/urun/
  );
  assert.match(modernCatalogSource, /const where = publicCatalogProductWhere\(\);/);
  assert.match(modernCatalogSource, /publicProductRouteDecision\(product\)/);
  assert.match(modernCatalogSource, /res\.redirect\(302, routeDecision\.location\)/);
}

function frontendSearchContractTest() {
  const root = path.resolve(__dirname, '..');
  const template = fs.readFileSync(path.join(root, 'tum-urunler/index.html'), 'utf8');
  const controller = fs.readFileSync(
    path.join(root, 'public/tema10/js/legacy-course-catalog.js'),
    'utf8'
  );
  const filters = fs.readFileSync(path.join(root, 'public/tema10/js/filters.js'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'public/tema10/css/unityverse.css'), 'utf8');
  const versionedTemplate = ensureLegacyAssetVersions(template);

  assert.match(template, /id="course-search-input"[^>]*maxlength="100"/);
  assert.match(template, /legacy-course-catalog\.js\?v=20260804-1/);
  assert.doesNotMatch(template, /function applyLegacyCourseFilters/);
  assert.doesNotMatch(template, /setTimeout\(refreshLegacyCourseFilters/);

  assert.match(controller, /SEARCH_DEBOUNCE_MS = 200/);
  assert.match(controller, /\.uv-product-card-item-name/);
  assert.match(controller, /entry\.searchText\.indexOf\(normalizedQuery\)/);
  assert.doesNotMatch(controller, /pbl-product-card-item-brand/);
  assert.match(controller, /windowObject\.clearTimeout\(state\.timer\)/);
  assert.match(controller, /windowObject\.history\[mode \+ 'State'\]/);
  assert.match(controller, /state\.result\.textContent/);
  assert.doesNotMatch(controller, /state\.result\.innerHTML/);

  assert.match(filters, /legacyCourseCatalog\.refreshFromUrl\(\)/);
  assert.match(css, /\.uv-product-card-item\[hidden\][\s\S]*display: none !important/);
  assert.match(
    versionedTemplate,
    new RegExp(`legacy-course-catalog\\.js\\?v=${LEGACY_CATALOG_JS_VERSION}`)
  );
  assert.match(
    versionedTemplate,
    new RegExp(`filters\\.js\\?v=${LEGACY_FILTERS_VERSION.replace(/\./g, '\\.')}`)
  );
  assert.equal(ensureLegacyAssetVersions(versionedTemplate), versionedTemplate);
}

async function run() {
  categoryAliasTests();
  publicCatalogVisibilityTests();
  catalogSearchTests();
  await publishedCategoryQueryTest();
  await filterPayloadVisibilityTest();
  listingRenderTests();
  serverRoutingContractTest();
  frontendSearchContractTest();
  console.log('Legacy public catalog publication tests passed.');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
