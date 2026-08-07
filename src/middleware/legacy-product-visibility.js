const path = require('path');
const {
  PUBLIC_VARIANT_SELECT,
  publicProductRouteDecision
} = require('../services/public-product-detail');

const PRODUCT_ROUTE_PATTERN = /^\/urun\/([^/]+)\/?$/;
const PRODUCT_CARD_SECTION_PATTERN = /<section\b[^>]*class=["'][^"']*\buv-product-card-area-4\b[^"']*["'][^>]*>[\s\S]*?<\/section>/gi;
const PRODUCT_CARD_START_PATTERN = /(?=<div\b[^>]*class=["'][^"']*\buv-product-card-item\b[^"']*["'][^>]*>)/gi;
const LEGACY_CARD_PAGE_PREFIXES = ['/kategori', '/marka', '/sayfa'];
const TITLE_SYNC_CATEGORY_SLUGS_BY_PATH = new Map([
  ['/kategori/oyun-gelistirme-egitimleri-244', ['oyun-gelistirme']],
  ['/kategori/oyun-gelistirme-egitimleri-244/', ['oyun-gelistirme']],
  ['/kategori/yazilim-egitimleri-245', ['yazilim', 'staj-garantili']],
  ['/kategori/yazilim-egitimleri-245/', ['yazilim', 'staj-garantili']],
  ['/kategori/grafik-tasarim-egitimleri-246', ['grafik-tasarim']],
  ['/kategori/grafik-tasarim-egitimleri-246/', ['grafik-tasarim']],
  ['/kategori/3d-modelleme-egitimleri-247', ['3d-modelleme']],
  ['/kategori/3d-modelleme-egitimleri-247/', ['3d-modelleme']]
]);
const TITLE_SYNC_DETAIL_CATEGORY_SLUGS = new Set(
  [...TITLE_SYNC_CATEGORY_SLUGS_BY_PATH.values()].flat()
);
const PRODUCT_CARD_IMAGE_PATTERN = /(<a\b[^>]*href=(["'])[^"']*\/urun\/([^/"']+)\/?\2[^>]*>\s*<img\b[^>]*\balt=(["']))[^"']*(\4)/gi;
const PRODUCT_CARD_NAME_PATTERN = /(<div\b[^>]*class=(["'])uv-product-card-item-name\2[^>]*>\s*<a\b[^>]*href=(["'])[^"']*\/urun\/([^/"']+)\/?\3[^>]*>)[\s\S]*?(<\/a>\s*<\/div>)/gi;
const PRODUCT_DETAIL_TITLE_PATTERN = /(<div\b[^>]*class=(["'])title-product\2[^>]*>\s*<h1\b[^>]*>)[\s\S]*?(<\/h1>)/i;

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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

function titleSyncCategorySlugsForRequest(req) {
  if (!['GET', 'HEAD'].includes(req.method)) return [];
  return TITLE_SYNC_CATEGORY_SLUGS_BY_PATH.get(String(req.path || '/')) || [];
}

function synchronizeLegacyProductCardTitles(html, products) {
  if (typeof html !== 'string' || !Array.isArray(products) || products.length === 0) {
    return html;
  }

  const titlesBySlug = new Map(products
    .map((product) => [
      String(product && product.slug || '').trim(),
      String(product && product.title || '').trim()
    ])
    .filter(([slug, title]) => slug && title));

  if (titlesBySlug.size === 0) return html;

  const withCurrentImageAltText = html.replace(
    PRODUCT_CARD_IMAGE_PATTERN,
    (match, prefix, hrefQuote, slug, altQuote, suffix) => {
      const title = titlesBySlug.get(slug);
      return title ? `${prefix}${escapeHtml(title)}${suffix}` : match;
    }
  );

  return withCurrentImageAltText.replace(
    PRODUCT_CARD_NAME_PATTERN,
    (match, prefix, classQuote, hrefQuote, slug, suffix) => {
      const title = titlesBySlug.get(slug);
      return title ? `${prefix}${escapeHtml(title)}${suffix}` : match;
    }
  );
}

function synchronizeLegacyProductDetailTitle(html, title) {
  const currentTitle = String(title || '').trim();
  if (typeof html !== 'string' || !currentTitle) return html;

  return html.replace(
    PRODUCT_DETAIL_TITLE_PATTERN,
    (match, prefix, classQuote, suffix) => `${prefix}${escapeHtml(currentTitle)}${suffix}`
  );
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

function legacyProductVariantContext(product, routeDecision) {
  if (!product || !routeDecision || routeDecision.action !== 'show') return null;

  if (routeDecision.group) {
    return {
      productId: product.id,
      variants: routeDecision.group.variants
    };
  }

  const duration = String(product.duration || '').trim();
  if (!duration) return null;

  return {
    productId: product.id,
    variants: [{
      id: product.id,
      parentProductId: product.id,
      variantProductId: product.id,
      label: duration,
      sortOrder: 0,
      isDefault: true,
      isActive: true,
      isArchived: false,
      variantProduct: product
    }]
  };
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
            id: true,
            slug: true,
            duration: true,
            status: true,
            title: true,
            tabs: {
              select: {
                systemKey: true,
                title: true,
                content: true,
                sortOrder: true
              },
              orderBy: { sortOrder: 'asc' }
            },
            category: {
              select: { slug: true }
            },
            productVariants: {
              select: PUBLIC_VARIANT_SELECT,
              orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }]
            },
            variantOfProducts: {
              select: {
                isActive: true,
                parentProduct: {
                  select: {
                    id: true,
                    slug: true,
                    status: true,
                    tabs: {
                      select: {
                        systemKey: true,
                        title: true,
                        content: true,
                        sortOrder: true
                      },
                      orderBy: { sortOrder: 'asc' }
                    },
                    productVariants: {
                      select: PUBLIC_VARIANT_SELECT,
                      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }]
                    }
                  }
                }
              },
              orderBy: { id: 'asc' },
              take: 1
            }
          }
        });

        const routeDecision = publicProductRouteDecision(product);
        if (product && routeDecision.action === 'not-found') {
          return res.status(404).send('404 File Not Found');
        }
        if (routeDecision.action === 'redirect') {
          return res.redirect(302, routeDecision.location);
        }

        res.locals.legacyProductHasVariants = Boolean(routeDecision.group);
        res.locals.legacyProductVariantContext = legacyProductVariantContext(
          product,
          routeDecision
        );
        res.locals.legacyProductTabs = routeDecision.group?.parent?.tabs || product?.tabs || null;
        res.locals.legacyProductPageOrigin = `${req.protocol}://${req.get('host')}`;
        res.locals.legacyProductDetailTitle = product
          && product.category
          && TITLE_SYNC_DETAIL_CATEGORY_SLUGS.has(product.category.slug)
          ? product.title
          : null;
        return next();
      }

      if (!isLegacyCardPageRequest(req)) return next();

      const titleCategorySlugs = titleSyncCategorySlugsForRequest(req);
      const [draftProducts, productTitles] = await Promise.all([
        prisma.product.findMany({
          where: { status: 'DRAFT' },
          select: { slug: true }
        }),
        titleCategorySlugs.length > 0
          ? prisma.product.findMany({
            where: {
              status: 'PUBLISHED',
              category: { is: { slug: { in: titleCategorySlugs } } }
            },
            select: { slug: true, title: true }
          })
          : Promise.resolve([])
      ]);

      res.locals.legacyDraftProducts = draftProducts;
      res.locals.legacyProductTitles = productTitles;
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
  isLegacyCardPageRequest,
  legacyProductVariantContext,
  synchronizeLegacyProductCardTitles,
  synchronizeLegacyProductDetailTitle,
  titleSyncCategorySlugsForRequest
};
