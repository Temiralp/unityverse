function publicCatalogProductWhere(additionalWhere = {}) {
  return {
    status: 'PUBLISHED',
    variantOfProducts: {
      none: { isActive: true }
    },
    ...additionalWhere
  };
}

module.exports = {
  publicCatalogProductWhere
};
