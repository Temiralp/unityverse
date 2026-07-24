const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');

const {
  legacyCategoryCandidateSlugs,
  publishedProductsForLegacyCategory,
  renderLegacyProductListing
} = require('../src/routes/legacy-catalog');
const { buildFilterPayload } = require('../src/routes/legacy-filters');
const { publicCatalogProductWhere } = require('../src/services/public-catalog');

function product(overrides = {}) {
  return {
    id: 101,
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
    variantOfProducts: {
      none: { isActive: true }
    }
  });
  assert.deepEqual(publicCatalogProductWhere({ categoryId: 12 }), {
    status: 'PUBLISHED',
    variantOfProducts: {
      none: { isActive: true }
    },
    categoryId: 12
  });
}

async function publishedCategoryQueryTest() {
  const expectedProducts = [product()];
  const prisma = {
    product: {
      async findMany(query) {
        assert.deepEqual(query, {
          where: {
            status: 'PUBLISHED',
            variantOfProducts: {
              none: { isActive: true }
            },
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
    '<section class="pbl-product-card-area-4 pbl-product-card-area-mobile-2" style="--gap:10px">',
    '<div class="pbl-product-card-item"><a href="/urun/draft-course/">Draft Course</a></div>',
    '</section>',
    '</body></html>'
  ].join('');
  const html = renderLegacyProductListing(template, [product()]);

  assert.match(html, /1 ürün bulundu/);
  assert.match(html, /href="\/urun\/published-course\/"/);
  assert.match(html, />Published Course<\/a>/);
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
    assert.equal((rendered.match(/class="pbl-product-card-item"/g) || []).length, 1);
  });
}

function serverRoutingContractTest() {
  const source = fs.readFileSync(path.join(__dirname, '../src/server.js'), 'utf8');

  assert.ok(source.includes("if (/^\\/urun\\/[^/]+\\/?$/.test(req.path)) {"));
  assert.ok(source.includes('return legacyProductDetailRoutes(req, res, next);'));
  assert.doesNotMatch(
    source,
    /legacyProductHasVariants\s*&&\s*\/\^\\\/urun/
  );
}

async function run() {
  categoryAliasTests();
  publicCatalogVisibilityTests();
  await publishedCategoryQueryTest();
  await filterPayloadVisibilityTest();
  listingRenderTests();
  serverRoutingContractTest();
  console.log('Legacy public catalog publication tests passed.');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
