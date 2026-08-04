const assert = require('assert/strict');

const {
  publicProductRouteDecision
} = require('../src/services/public-product-detail');

function variant(id, product, overrides = {}) {
  return {
    id,
    parentProductId: 10,
    variantProductId: product.id,
    label: product.duration,
    sortOrder: id,
    isDefault: false,
    isActive: true,
    isArchived: false,
    variantProduct: product,
    ...overrides
  };
}

function child(id, slug, status, duration) {
  return { id, slug, status, duration };
}

const visibleChildProduct = child(11, 'visible-child', 'PUBLISHED', '30 saat');
const draftChildProduct = child(12, 'draft-child', 'DRAFT', '60 saat');
const inactiveChildProduct = child(13, 'inactive-child', 'PUBLISHED', '90 saat');
const archivedChildProduct = child(14, 'archived-child', 'DRAFT', '120 saat');
const visibleRow = variant(1, visibleChildProduct);
const draftRow = variant(2, draftChildProduct);
const inactiveRow = variant(3, inactiveChildProduct, { isActive: false });
const archivedRow = variant(4, archivedChildProduct, {
  isActive: false,
  isArchived: true
});
const parent = {
  id: 10,
  slug: 'parent-course',
  status: 'PUBLISHED',
  productVariants: [visibleRow, draftRow, inactiveRow, archivedRow],
  variantOfProducts: []
};

assert.deepEqual(publicProductRouteDecision(null), { action: 'not-found' });
assert.deepEqual(
  publicProductRouteDecision({
    id: 1,
    slug: 'standalone-draft',
    status: 'DRAFT',
    productVariants: [],
    variantOfProducts: []
  }),
  { action: 'not-found' }
);

const parentDecision = publicProductRouteDecision(parent);
assert.equal(parentDecision.action, 'show');
assert.deepEqual(
  parentDecision.visibleVariants.map((row) => row.variantProductId),
  [11]
);

function linkedProduct(product, row) {
  return {
    ...product,
    productVariants: [],
    variantOfProducts: [{ ...row, parentProduct: parent }]
  };
}

assert.equal(
  publicProductRouteDecision(linkedProduct(visibleChildProduct, visibleRow)).action,
  'show'
);
assert.deepEqual(
  publicProductRouteDecision(linkedProduct(draftChildProduct, draftRow)),
  { action: 'redirect', location: '/urun/parent-course/' }
);
assert.deepEqual(
  publicProductRouteDecision(linkedProduct(inactiveChildProduct, inactiveRow)),
  { action: 'redirect', location: '/urun/parent-course/' }
);
assert.deepEqual(
  publicProductRouteDecision(linkedProduct(archivedChildProduct, archivedRow)),
  { action: 'redirect', location: '/urun/parent-course/' }
);

const emptyParent = {
  ...parent,
  id: 20,
  slug: 'empty-parent',
  productVariants: [draftRow, inactiveRow, archivedRow]
};
assert.deepEqual(
  publicProductRouteDecision(emptyParent),
  { action: 'redirect', location: '/tum-urunler/?pg=1' }
);

const draftParent = {
  ...emptyParent,
  status: 'DRAFT'
};
assert.deepEqual(
  publicProductRouteDecision(draftParent),
  { action: 'redirect', location: '/tum-urunler/?pg=1' }
);

const orphanedDraftChild = {
  ...draftChildProduct,
  productVariants: [],
  variantOfProducts: [{
    ...draftRow,
    parentProduct: emptyParent
  }]
};
assert.deepEqual(
  publicProductRouteDecision(orphanedDraftChild),
  { action: 'redirect', location: '/tum-urunler/?pg=1' }
);

const encodedParent = {
  ...parent,
  slug: 'parent course/özel'
};
const encodedDraft = {
  ...draftChildProduct,
  productVariants: [],
  variantOfProducts: [{ ...draftRow, parentProduct: encodedParent }]
};
assert.deepEqual(
  publicProductRouteDecision(encodedDraft),
  { action: 'redirect', location: '/urun/parent%20course%2F%C3%B6zel/' }
);

console.log('Public product detail visibility tests passed.');
