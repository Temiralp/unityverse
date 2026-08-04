const { publicProductVariants } = require('./product-variants');

const PUBLIC_VARIANT_SELECT = {
  id: true,
  parentProductId: true,
  variantProductId: true,
  label: true,
  sortOrder: true,
  isDefault: true,
  isActive: true,
  isArchived: true,
  variantProduct: {
    select: {
      id: true,
      slug: true,
      duration: true,
      status: true
    }
  }
};

function productVariantGroup(product) {
  if (!product) return null;

  if (Array.isArray(product.productVariants) && product.productVariants.length) {
    return {
      parent: product,
      variants: product.productVariants
    };
  }

  const parentLink = Array.isArray(product.variantOfProducts)
    ? product.variantOfProducts[0]
    : null;
  if (!parentLink || !parentLink.parentProduct) return null;

  return {
    parent: parentLink.parentProduct,
    variants: parentLink.parentProduct.productVariants || []
  };
}

function variantRedirectLocation(group, visibleVariants) {
  if (visibleVariants.length) {
    return `/urun/${encodeURIComponent(group.parent.slug)}/`;
  }

  return '/tum-urunler/?pg=1';
}

function publicProductRouteDecision(product) {
  if (!product) return { action: 'not-found' };

  const group = productVariantGroup(product);
  const visibleVariants = group && group.parent.status === 'PUBLISHED'
    ? publicProductVariants(group.variants)
    : [];
  const isVariantChild = Boolean(
    group && Number(group.parent.id) !== Number(product.id)
  );
  const currentChildIsVisible = visibleVariants.some((variant) => (
    Number(variant.variantProductId) === Number(product.id)
  ));

  if (product.status !== 'PUBLISHED') {
    if (isVariantChild) {
      return {
        action: 'redirect',
        location: variantRedirectLocation(group, visibleVariants)
      };
    }
    if (group) {
      return { action: 'redirect', location: '/tum-urunler/?pg=1' };
    }
    return { action: 'not-found' };
  }

  if (isVariantChild && !currentChildIsVisible) {
    return {
      action: 'redirect',
      location: variantRedirectLocation(group, visibleVariants)
    };
  }

  if (group && !visibleVariants.length) {
    return { action: 'redirect', location: '/tum-urunler/?pg=1' };
  }

  return {
    action: 'show',
    group,
    visibleVariants
  };
}

module.exports = {
  PUBLIC_VARIANT_SELECT,
  productVariantGroup,
  publicProductRouteDecision,
  variantRedirectLocation
};
