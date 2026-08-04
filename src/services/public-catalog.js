function publicCatalogProductWhere(additionalWhere = {}) {
  return {
    status: 'PUBLISHED',
    variantOfProducts: {
      none: {}
    },
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
    ...additionalWhere
  };
}

module.exports = {
  publicCatalogProductWhere
};
