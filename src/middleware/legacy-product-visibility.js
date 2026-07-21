const path = require('path');

const PRODUCT_ROUTE_PATTERN = /^\/urun\/([^/]+)\/?$/;
const PRODUCT_CARD_SECTION_PATTERN = /<section\b[^>]*class=["'][^"']*\bpbl-product-card-area-4\b[^"']*["'][^>]*>[\s\S]*?<\/section>/gi;
const PRODUCT_CARD_START_PATTERN = /(?=<div\b[^>]*class=["'][^"']*\bpbl-product-card-item\b[^"']*["'][^>]*>)/gi;
const LEGACY_CARD_PAGE_PREFIXES = ['/kategori', '/marka', '/sayfa'];

function decodedProductSlug(requestPath) {
  const match = String(requestPath || '').match(PRODUCT_ROUTE_PATTERN);
  if (!match) return null;

  try {
    return decodeURIComponent(match[1]);
  } catch (error) {
    return null;
  }
}

function isLegacyCardPageRequest(req) {
  if (!['GET', 'HEAD'].includes(req.method)) return false;

  const requestPath = String(req.path || '/');
  if (requestPath === '/') return true;
  if (path.extname(requestPath)) return false;

  return LEGACY_CARD_PAGE_PREFIXES.some((prefix) => (
    requestPath === prefix || requestPath.startsWith(`${prefix}/`)
  ));
}

function cardContainsDraftProduct(card, draftSlugs) {
  return draftSlugs.some((slug) => (
    card.includes(`/urun/${slug}/`) ||
    card.includes(`/urun/${slug}"`) ||
    card.includes(`/urun/${slug}'`)
  ));
}

function filterProductCardSection(section, draftSlugs) {
  const openingTagEnd = section.indexOf('>') + 1;
  const closingTagStart = section.toLowerCase().lastIndexOf('</section>');
  if (openingTagEnd <= 0 || closingTagStart < openingTagEnd) return section;

  const openingTag = section.slice(0, openingTagEnd);
  const content = section.slice(openingTagEnd, closingTagStart);
  const closingTag = section.slice(closingTagStart);
  const chunks = content.split(PRODUCT_CARD_START_PATTERN);

  return openingTag + chunks
    .filter((chunk) => !cardContainsDraftProduct(chunk, draftSlugs))
    .join('') + closingTag;
}

function filterLegacyDraftProductCards(html, draftProducts) {
  if (typeof html !== 'string' || !Array.isArray(draftProducts) || draftProducts.length === 0) {
    return html;
  }

  const draftSlugs = draftProducts
    .map((product) => String(product && product.slug || '').trim())
    .filter(Boolean);
  if (draftSlugs.length === 0) return html;

  return html.replace(
    PRODUCT_CARD_SECTION_PATTERN,
    (section) => filterProductCardSection(section, draftSlugs)
  );
}

function createLegacyProductVisibility(prisma) {
  if (!prisma || !prisma.product) {
    throw new TypeError('Prisma product client is required.');
  }

  return async function legacyProductVisibility(req, res, next) {
    if (!['GET', 'HEAD'].includes(req.method)) return next();

    try {
      const productSlug = decodedProductSlug(req.path);
      if (productSlug) {
        const product = await prisma.product.findUnique({
          where: { slug: productSlug },
          select: {
            status: true,
            productVariants: {
              select: { id: true },
              take: 1
            },
            variantOfProducts: {
              where: { isActive: true },
              select: { id: true },
              take: 1
            }
          }
        });

        if (product && product.status !== 'PUBLISHED') {
          return res.redirect(302, '/tum-urunler/');
        }

        res.locals.legacyProductHasVariants = Boolean(
          product
          && (product.productVariants.length || product.variantOfProducts.length)
        );
        return next();
      }

      if (!isLegacyCardPageRequest(req)) return next();

      res.locals.legacyDraftProducts = await prisma.product.findMany({
        where: { status: 'DRAFT' },
        select: { slug: true }
      });
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = {
  createLegacyProductVisibility,
  decodedProductSlug,
  filterLegacyDraftProductCards,
  isLegacyCardPageRequest
};
