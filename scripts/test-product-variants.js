const assert = require('assert/strict');

const {
  ProductVariantValidationError,
  normalizeProductVariantRows,
  replaceProductVariants
} = require('../src/services/product-variants');
const {
  loadProductVariantContext,
  publicProductVariants,
  renderProductVariantOptions,
  selectDefaultVariantProduct
} = require('../src/routes/legacy-product-detail');

function product(id, overrides = {}) {
  return {
    id,
    slug: `course-${id}`,
    title: `Course ${id}`,
    duration: `${id} ay`,
    status: 'PUBLISHED',
    tabs: [],
    learningOutcomes: [],
    category: null,
    ...overrides
  };
}

function variant(id, variantProduct, overrides = {}) {
  return {
    id,
    parentProductId: 1,
    variantProductId: variantProduct.id,
    variantProduct,
    label: variantProduct.duration,
    sortOrder: id,
    isDefault: false,
    isActive: true,
    ...overrides
  };
}

function normalizationTests() {
  const rows = normalizeProductVariantRows({
    0: {
      variantProductId: '2',
      label: ' 8 ay ',
      sortOrder: '20',
      isActivePresent: '1',
      isActive: '1'
    },
    1: {
      variantProductId: '3',
      label: '',
      sortOrder: '10',
      isActivePresent: '1'
    }
  }, '1');

  assert.deepEqual(rows, [
    {
      variantProductId: 2,
      label: '8 ay',
      sortOrder: 20,
      isDefault: true,
      isActive: true
    },
    {
      variantProductId: 3,
      label: null,
      sortOrder: 10,
      isDefault: false,
      isActive: false
    }
  ]);

  assert.throws(
    () => normalizeProductVariantRows([
      { variantProductId: '2' },
      { variantProductId: '2' }
    ], 0),
    ProductVariantValidationError
  );
}

async function replacementTests() {
  const calls = [];
  const tx = {
    product: {
      async findMany({ where }) {
        return where.id.in.map((id) => ({ id }));
      }
    },
    productVariant: {
      async findMany() {
        return [];
      },
      async deleteMany(args) {
        calls.push(['deleteMany', args]);
      },
      async createMany(args) {
        calls.push(['createMany', args]);
      }
    }
  };

  await replaceProductVariants(tx, 1, [
    { variantProductId: 2, isActive: true },
    { variantProductId: 3, isActive: true }
  ], 0);

  assert.equal(calls[0][0], 'deleteMany');
  assert.equal(calls[1][0], 'createMany');
  assert.equal(calls[1][1].data.length, 2);

  await assert.rejects(
    () => replaceProductVariants(tx, 1, [{ variantProductId: 1 }], 0),
    ProductVariantValidationError
  );

  tx.productVariant.findMany = async () => [{ variantProductId: 2 }];
  await assert.rejects(
    () => replaceProductVariants(tx, 1, [{ variantProductId: 2 }], 0),
    /ana kursun eğitim seçeneği/
  );
}

function publicRenderingTests() {
  const parent = product(1);
  const eightMonth = product(2, { duration: '8 ay' });
  const draft = product(3, { status: 'DRAFT' });
  const disabled = product(4);
  const rows = [
    variant(20, eightMonth, { isDefault: true }),
    variant(30, draft),
    variant(40, disabled, { isActive: false })
  ];

  assert.deepEqual(publicProductVariants(rows).map((row) => row.variantProductId), [2]);
  assert.equal(selectDefaultVariantProduct(parent, rows).id, 2);
  assert.equal(selectDefaultVariantProduct(eightMonth, rows).id, 2);

  const html = renderProductVariantOptions(eightMonth, rows);
  assert.match(html, /data-product-id="2"/);
  assert.match(html, /class="active "/);
  assert.match(html, /href="\.\.\/\.\.\/urun\/course-2"/);
  assert.doesNotMatch(html, /course-3|course-4/);
}

async function contextTests() {
  const parent = product(1, {
    productVariants: [],
    variantOfProducts: []
  });
  const eightMonth = product(2, { duration: '8 ay' });
  parent.productVariants = [variant(1, eightMonth, { isDefault: true })];

  const calls = [];
  const parentPrisma = {
    product: {
      async findFirst(args) {
        calls.push(args);
        return calls.length === 1 ? parent : eightMonth;
      }
    },
    productVariant: {
      async findMany() {
        throw new Error('Parent variants should already be loaded.');
      }
    }
  };

  const parentContext = await loadProductVariantContext(parentPrisma, parent.slug);
  assert.equal(parentContext.product.id, 2);
  assert.equal(parentContext.variants.length, 1);
  assert.equal(calls.length, 2);

  const child = product(2, {
    productVariants: [],
    variantOfProducts: [{ parentProductId: 1 }]
  });
  const childPrisma = {
    product: {
      async findFirst() {
        return child;
      }
    },
    productVariant: {
      async findMany() {
        return [variant(1, child, { isDefault: true })];
      }
    }
  };

  const childContext = await loadProductVariantContext(childPrisma, child.slug);
  assert.equal(childContext.product.id, 2);
  assert.equal(childContext.variants.length, 1);
}

async function run() {
  normalizationTests();
  await replacementTests();
  publicRenderingTests();
  await contextTests();
  console.log('Product variant tests passed.');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
