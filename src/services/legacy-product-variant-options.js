const {
  productVariantLabel,
  publicProductVariants
} = require('./product-variants');

const LEGACY_DURATION_LIST_PATTERN = /(<ul\b(?=[^>]*\bid=["']poptions1_\d+["'])[^>]*>)([\s\S]*?)(<\/ul>)/i;
const LEGACY_DURATION_LISTS_PATTERN = /(<ul\b(?=[^>]*\bid=["']poptions1_\d+["'])[^>]*>)([\s\S]*?)(<\/ul>)/gi;
const LEGACY_PRODUCT_CONTAINER_PATTERN = /(<div\b[^>]*\bid=["']product["'][^>]*>)/i;

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function publicVariantOptionRows(variants) {
  return publicProductVariants(variants)
    .filter((variant) => productVariantLabel(variant));
}

function legacyAttribute(attributes, name) {
  const pattern = new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, 'i');
  const match = String(attributes || '').match(pattern);
  return match ? match[2] : '';
}

function legacyVariantValues(markup) {
  const values = new Map();
  const itemPattern = /<li\b([^>]*)>/gi;
  let match;

  while ((match = itemPattern.exec(String(markup || '')))) {
    const productId = legacyAttribute(match[1], 'data-product-id');
    const productUrl = legacyAttribute(match[1], 'producturl');
    const optionValue = legacyAttribute(match[1], 'value');
    const slugMatch = productUrl.match(/\/urun\/([^/?#]+)/i);
    if (!optionValue) continue;
    if (/^[1-9]\d*$/.test(productId)) values.set(productId, optionValue);
    if (slugMatch) values.set(`slug:${slugMatch[1]}`, optionValue);
  }

  return values;
}

function managedListOpeningTag(openingTag) {
  if (/\bdata-uv-managed-variants\s*=/i.test(openingTag)) return openingTag;
  return openingTag.replace(/>$/, ' data-uv-managed-variants="true">');
}

function displayOnlyVariantItems(markup) {
  return String(markup || '')
    .replace(/<li\b[^>]*>/gi, (openingTag) => {
      let updated = openingTag.replace(/\s+onclick\s*=\s*(["'])[\s\S]*?\1/gi, '');
      if (!/\bdata-uv-managed-variant\s*=/i.test(updated)) {
        updated = updated.replace(/>$/, ' data-uv-managed-variant="true">');
      }
      return updated;
    })
    .replace(/<a\b[^>]*>/gi, (openingTag) => {
      let updated = openingTag;
      if (/\baria-disabled\s*=/i.test(updated)) {
        updated = updated.replace(/\baria-disabled\s*=\s*(["']).*?\1/i, 'aria-disabled="true"');
      } else {
        updated = updated.replace(/>$/, ' aria-disabled="true">');
      }
      if (/\btabindex\s*=/i.test(updated)) {
        updated = updated.replace(/\btabindex\s*=\s*(["']).*?\1/i, 'tabindex="-1"');
      } else {
        updated = updated.replace(/>$/, ' tabindex="-1">');
      }
      return updated;
    });
}

function makeLegacyDurationOptionsDisplayOnly(html) {
  if (typeof html !== 'string') return html;

  return html.replace(
    LEGACY_DURATION_LISTS_PATTERN,
    (match, openingTag, items, closingTag) => (
      `${managedListOpeningTag(openingTag)}${displayOnlyVariantItems(items)}${closingTag}`
    )
  );
}

function renderLegacyVariantItems(currentProductId, variants, optionValues = new Map()) {
  return publicVariantOptionRows(variants).map((variant) => {
    const product = variant.variantProduct;
    const label = escapeHtml(productVariantLabel(variant));
    const slug = encodeURIComponent(String(product.slug || '').trim());
    const optionUrl = `../../urun/${slug}`;
    const optionValue = escapeHtml(
      optionValues.get(`slug:${product.slug}`)
      || optionValues.get(String(product.id))
      || product.id
    );

    return `<li data-product-id="${product.id}" producturl="${optionUrl}" value="${optionValue}" class="" data-uv-managed-variant="true" data-bs-toggle="tooltip" data-bs-title="${label}"><a href="${optionUrl}" aria-disabled="true" tabindex="-1">${label}</a></li>`;
  }).join('\n');
}

function renderLegacyVariantBlock(context) {
  const productId = Number(context && context.productId);
  const items = renderLegacyVariantItems(productId, context && context.variants);
  if (!items) return '';

  return `<h4>Eğitim Seçenekleri</h4>
<div class="w-100">
  <div class="attr-detail attr-size ">
    <strong class="mr-10">Eğitim Saatleri: </strong>
    <ul class="list-filter size-filter font-small " name="poptions1_${productId}" id="poptions1_${productId}" data-uv-managed-variants="true">
      ${items}
    </ul>
  </div>
</div>`;
}

function synchronizeLegacyProductVariantOptions(html, context) {
  if (typeof html !== 'string') return html;

  if (!context || !Array.isArray(context.variants)) {
    return makeLegacyDurationOptionsDisplayOnly(html);
  }

  let synchronized = html;
  if (LEGACY_DURATION_LIST_PATTERN.test(html)) {
    synchronized = html.replace(
      LEGACY_DURATION_LIST_PATTERN,
      (match, openingTag, originalItems, closingTag) => {
        const items = renderLegacyVariantItems(
          context.productId,
          context.variants,
          legacyVariantValues(originalItems)
        );
        if (!items) return match;
        return `${managedListOpeningTag(openingTag)}\n${items}\n${closingTag}`;
      }
    );
    return makeLegacyDurationOptionsDisplayOnly(synchronized);
  }

  const block = renderLegacyVariantBlock(context);
  if (!block) return makeLegacyDurationOptionsDisplayOnly(html);
  synchronized = html.replace(
    LEGACY_PRODUCT_CONTAINER_PATTERN,
    (container) => `${container}\n${block}`
  );
  return makeLegacyDurationOptionsDisplayOnly(synchronized);
}

module.exports = {
  legacyVariantValues,
  makeLegacyDurationOptionsDisplayOnly,
  managedListOpeningTag,
  publicVariantOptionRows,
  renderLegacyVariantBlock,
  renderLegacyVariantItems,
  synchronizeLegacyProductVariantOptions
};
