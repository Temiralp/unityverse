const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');

const {
  ProductVariantValidationError,
  normalizeProductVariantRows,
  productVariantParticipation,
  publicProductVariants,
  setParentProductStatus,
  syncManagedProductVariants
} = require('../src/services/product-variants');

function createStore() {
  const products = new Map([[1, {
    id: 1,
    code: 'COURSE',
    title: 'Course',
    slug: 'course',
    summary: 'Summary',
    content: 'Content',
    image: '/course.jpg',
    price: '100.00',
    discountType: null,
    discountValue: null,
    discountPrice: null,
    vatRate: '20.00',
    bankTransferDiscountRate: '10.00',
    duration: '30 saat',
    lessonType: 'Online',
    certificate: 'Certificate',
    status: 'PUBLISHED',
    sortOrder: 0,
    categoryId: 2
  }]]);
  const links = new Map();
  let nextProductId = 2;
  let nextLinkId = 1;

  const tx = {
    product: {
      async findUnique({ where }) {
        if (where.id) return products.get(where.id) || null;
        return [...products.values()].find((product) => product.slug === where.slug) || null;
      },
      async create({ data }) {
        const product = { id: nextProductId++, ...data };
        products.set(product.id, product);
        return { id: product.id };
      },
      async update({ where, data }) {
        const product = products.get(where.id);
        Object.assign(product, data);
        return product;
      }
    },
    productVariant: {
      async findFirst({ where }) {
        const productIds = new Set((where.OR || []).flatMap((condition) => [
          condition.parentProductId,
          condition.variantProductId
        ]).filter(Boolean));
        return [...links.values()].find((link) => (
          productIds.has(link.parentProductId) || productIds.has(link.variantProductId)
        )) || null;
      },
      async findMany({ where }) {
        return [...links.values()]
          .filter((link) => (
            (where.parentProductId == null || link.parentProductId === where.parentProductId)
            && (where.variantProductId == null || link.variantProductId === where.variantProductId)
            && (where.isArchived === undefined || link.isArchived === where.isArchived)
          ))
          .map((link) => ({ ...link, variantProduct: products.get(link.variantProductId) }));
      },
      async findUnique({ where }) {
        return [...links.values()].find((link) => (
          link.variantProductId === where.variantProductId
        )) || null;
      },
      async updateMany({ where, data }) {
        [...links.values()]
          .filter((link) => link.parentProductId === where.parentProductId)
          .forEach((link) => Object.assign(link, data));
      },
      async update({ where, data }) {
        const link = links.get(where.id);
        Object.assign(link, data);
        return link;
      },
      async create({ data }) {
        const link = { id: nextLinkId++, ...data };
        links.set(link.id, link);
        return link;
      }
    }
  };

  return { links, products, tx };
}

function row(label, price, overrides = {}) {
  return {
    label,
    price,
    status: 'PUBLISHED',
    isActivePresent: '1',
    isActive: '1',
    ...overrides
  };
}

async function scalarTest() {
  const store = createStore();
  const result = await syncManagedProductVariants(store.tx, 1, [row('60 saat', '2500')], 0);
  assert.equal(result.mode, 'scalar');
  assert.equal(store.links.size, 0);
  assert.equal(store.products.get(1).duration, '60 saat');
  assert.equal(store.products.get(1).price, '2500.00');
}

async function transitionArchiveAndRestoreTest() {
  const store = createStore();
  const first = await syncManagedProductVariants(store.tx, 1, [
    row('30 saat', '1000'),
    row('60 saat', '1800')
  ], 0);

  assert.equal(first.mode, 'variants');
  assert.equal(first.createdProductIds.length, 2);
  assert.equal(store.links.size, 2);
  const initialLinks = [...store.links.values()].sort((a, b) => a.sortOrder - b.sortOrder);
  assert.equal(store.products.get(initialLinks[0].variantProductId).slug, 'course-30-saat');
  assert.equal(store.products.get(initialLinks[1].variantProductId).slug, 'course-60-saat');
  const existingSecondSlug = store.products.get(initialLinks[1].variantProductId).slug;
  const existingSecondTitle = store.products.get(initialLinks[1].variantProductId).title;

  await syncManagedProductVariants(store.tx, 1, [row('30 saat', '1100', {
    id: initialLinks[0].id,
    variantProductId: initialLinks[0].variantProductId
  })], 0);
  assert.equal(store.links.get(initialLinks[1].id).isArchived, true);
  assert.equal(store.links.get(initialLinks[1].id).isActive, false);
  assert.equal(store.products.get(initialLinks[1].variantProductId).status, 'DRAFT');

  const restored = await syncManagedProductVariants(store.tx, 1, [
    row('30 saat', '1100', {
      id: initialLinks[0].id,
      variantProductId: initialLinks[0].variantProductId
    }),
    row(' 60   SAAT ', '1900')
  ], 1);
  assert.equal(restored.createdProductIds.length, 0);
  assert.equal(store.links.size, 2);
  assert.equal(store.links.get(initialLinks[1].id).isArchived, false);
  assert.equal(store.links.get(initialLinks[1].id).isActive, true);
  assert.equal(store.products.get(initialLinks[1].variantProductId).status, 'PUBLISHED');
  assert.equal(store.products.get(initialLinks[1].variantProductId).price, '1900.00');
  assert.equal(store.products.get(initialLinks[1].variantProductId).slug, existingSecondSlug);
  assert.equal(store.products.get(initialLinks[1].variantProductId).title, existingSecondTitle);

  assert.ok(await productVariantParticipation(store.tx, 1));
  assert.ok(await productVariantParticipation(store.tx, initialLinks[0].variantProductId));
  assert.equal(await productVariantParticipation(store.tx, 999), null);

  await setParentProductStatus(store.tx, 1, 'DRAFT', { cascadeDraft: true });
  assert.equal(store.products.get(1).status, 'DRAFT');
  assert.equal(store.products.get(initialLinks[0].variantProductId).status, 'DRAFT');
  assert.equal(store.products.get(initialLinks[1].variantProductId).status, 'DRAFT');
  assert.equal(store.links.get(initialLinks[0].id).isActive, false);
  assert.equal(store.links.get(initialLinks[1].id).isActive, false);

  await syncManagedProductVariants(store.tx, 1, [
    row('30 saat', '1100', {
      id: initialLinks[0].id,
      variantProductId: initialLinks[0].variantProductId
    }),
    row('60 saat', '1900', {
      id: initialLinks[1].id,
      variantProductId: initialLinks[1].variantProductId,
      status: 'DRAFT',
      isActive: '0'
    })
  ], 0);
  assert.equal(store.products.get(1).status, 'DRAFT');
  assert.equal(store.products.get(initialLinks[0].variantProductId).status, 'PUBLISHED');
  assert.equal(store.products.get(initialLinks[1].variantProductId).status, 'DRAFT');

  await setParentProductStatus(store.tx, 1, 'PUBLISHED');
  assert.equal(store.products.get(1).status, 'PUBLISHED');
  assert.equal(store.products.get(initialLinks[0].variantProductId).status, 'PUBLISHED');
  assert.equal(store.products.get(initialLinks[1].variantProductId).status, 'DRAFT');
}

function deleteRouteContractTest() {
  const adminSource = fs.readFileSync(path.resolve(__dirname, '../src/routes/admin.js'), 'utf8');
  assert.match(adminSource, /router\.post\('\/products\/:id\/delete'[\s\S]*productVariantParticipation\(tx, productId\)/);
  assert.match(adminSource, /if \(!deleted\) \{[\s\S]*res\.status\(409\)/);
  assert.match(adminSource, /Süreyi ana kursun düzenleme ekranından kaldırın veya taslak yapın/);
}

function validationTests() {
  assert.throws(() => normalizeProductVariantRows([
    row('30 saat', '1000'),
    row(' 30 SAAT ', '1200')
  ], 0, { allowNewProducts: true, requireManagedFields: true }), ProductVariantValidationError);
  assert.throws(() => normalizeProductVariantRows([
    row('30 saat', '0')
  ], 0, { allowNewProducts: true, requireManagedFields: true }), /sıfırdan büyük/);

  assert.deepEqual(publicProductVariants([
    { id: 1, isActive: true, isArchived: true, variantProduct: { status: 'PUBLISHED' } },
    { id: 2, isActive: true, isArchived: false, variantProduct: { status: 'PUBLISHED' } }
  ]).map((variant) => variant.id), [2]);

  const migration = fs.readFileSync(path.resolve(
    __dirname,
    '../prisma/migrations/20260804120000_normalize_draft_variant_links/migration.sql'
  ), 'utf8');
  assert.match(migration, /duration_product\."status" = 'DRAFT'/);
  assert.match(migration, /"isActive" = false/);
  assert.match(migration, /"isDefault" = false/);
  assert.doesNotMatch(migration, /UPDATE "Product"/);
}

async function run() {
  validationTests();
  deleteRouteContractTest();
  await scalarTest();
  await transitionArchiveAndRestoreTest();
  console.log('Managed product variant tests passed.');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
