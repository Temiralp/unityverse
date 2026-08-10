const fs = require('fs/promises');
const path = require('path');
const {
  filterLegacyDraftProductCards,
  synchronizeLegacyProductCardTitles,
  synchronizeLegacyProductDetailTitle
} = require('./legacy-product-visibility');
const { ensureLegacyAssetVersions } = require('../services/legacy-assets');
const { ensureLegacyHeaderLayout } = require('../services/legacy-header-layout');
const { ensureLegacyHomepageLocalAssets } = require('../services/legacy-homepage');
const { ensureLegacyWhatsappButton } = require('../services/legacy-whatsapp');
const { synchronizeLegacyProductTabs } = require('../services/legacy-product-tabs');
const { removeLegacyRelatedProducts } = require('../services/legacy-related-products');
const {
  synchronizeLegacyProductVariantOptions
} = require('../services/legacy-product-variant-options');
const {
  synchronizeLegacyCorporateReferences
} = require('../services/legacy-corporate-references');

const excludedPublicPrefixes = [
  '/admin',
  '/api',
  '/ajax',
  '/csp-report',
  '/vendor'
];

function isPublicPageRequest(req) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;

  const requestPath = String(req.path || '/');
  return !excludedPublicPrefixes.some((prefix) => (
    requestPath === prefix || requestPath.startsWith(`${prefix}/`)
  ));
}

function enhanceLegacyHtml(
  html,
  draftProducts = [],
  productTitles = [],
  productDetailTitle = null,
  productTabs = null,
  productPageOrigin = null,
  corporateReferences = [],
  productVariantContext = null,
  canonicalUrl = null
) {
  const withVisibleProducts = filterLegacyDraftProductCards(html, draftProducts);
  const withCurrentProductTitles = synchronizeLegacyProductCardTitles(
    withVisibleProducts,
    productTitles
  );
  const withCurrentDetailTitle = synchronizeLegacyProductDetailTitle(
    withCurrentProductTitles,
    productDetailTitle
  );
  const withCurrentProductTabs = synchronizeLegacyProductTabs(
    withCurrentDetailTitle,
    productTabs,
    productPageOrigin
  );
  const withCurrentVariantOptions = synchronizeLegacyProductVariantOptions(
    withCurrentProductTabs,
    productVariantContext
  );
  const withoutRelatedProducts = removeLegacyRelatedProducts(withCurrentVariantOptions);
  const withCorporateReferences = synchronizeLegacyCorporateReferences(
    withoutRelatedProducts,
    corporateReferences
  );
  const withCurrentAssets = ensureLegacyAssetVersions(withCorporateReferences);
  const withLocalHomepageAssets = ensureLegacyHomepageLocalAssets(withCurrentAssets);
  const withCanonical = canonicalUrl
    ? withLocalHomepageAssets.replace(
        /<link\s+rel=["']canonical["']\s+href=["'][^"']*["']\s*\/?>/i,
        `<link rel="canonical" href="${canonicalUrl}" />`
      )
    : withLocalHomepageAssets;
  return ensureLegacyWhatsappButton(ensureLegacyHeaderLayout(withCanonical));
}

function injectLegacyWhatsappIntoHtmlResponses(req, res, next) {
  if (!isPublicPageRequest(req)) return next();

  const send = res.send.bind(res);
  res.send = function sendWithLegacyWhatsapp(body) {
    if (typeof body === 'string') {
      return send(enhanceLegacyHtml(
        body,
        res.locals.legacyDraftProducts,
        res.locals.legacyProductTitles,
        res.locals.legacyProductDetailTitle,
        res.locals.legacyProductTabs,
        res.locals.legacyProductPageOrigin,
        res.locals.legacyCorporateReferences,
        res.locals.legacyProductVariantContext,
        res.locals.legacyCanonicalUrl
      ));
    }

    if (Buffer.isBuffer(body)) {
      const source = body.toString('utf8');
      const transformed = enhanceLegacyHtml(
        source,
        res.locals.legacyDraftProducts,
        res.locals.legacyProductTitles,
        res.locals.legacyProductDetailTitle,
        res.locals.legacyProductTabs,
        res.locals.legacyProductPageOrigin,
        res.locals.legacyCorporateReferences,
        res.locals.legacyProductVariantContext,
        res.locals.legacyCanonicalUrl
      );
      return send(transformed === source ? body : Buffer.from(transformed));
    }

    return send(body);
  };

  return next();
}

function htmlFileCandidates(staticRoot, requestPath) {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(requestPath);
  } catch (error) {
    return [];
  }

  if (decodedPath.includes('\0')) return [];

  const relativePath = decodedPath.replace(/^\/+/, '');
  const requestedExtension = path.extname(relativePath).toLowerCase();
  const relativeCandidates = [];

  if (!relativePath || decodedPath.endsWith('/')) {
    relativeCandidates.push(path.join(relativePath, 'index.html'));
  } else if (requestedExtension === '.html') {
    relativeCandidates.push(relativePath);
  } else if (!requestedExtension) {
    relativeCandidates.push(`${relativePath}.html`, path.join(relativePath, 'index.html'));
  }

  const resolvedRoot = path.resolve(staticRoot);
  return relativeCandidates
    .map((candidate) => path.resolve(resolvedRoot, candidate))
    .filter((candidate) => candidate.startsWith(`${resolvedRoot}${path.sep}`));
}

async function findHtmlFile(staticRoot, requestPath) {
  const candidates = htmlFileCandidates(staticRoot, requestPath);

  for (const candidate of candidates) {
    try {
      const stats = await fs.stat(candidate);
      if (stats.isFile()) return candidate;
    } catch (error) {
      if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error;
    }
  }

  return null;
}

function serveLegacyHtmlWithWhatsapp(staticRoot, setHeaders) {
  return async function legacyHtmlWithWhatsapp(req, res, next) {
    if (!isPublicPageRequest(req)) return next();

    try {
      const htmlFile = await findHtmlFile(staticRoot, req.path);
      if (!htmlFile) return next();

      const html = await fs.readFile(htmlFile, 'utf8');
      if (typeof setHeaders === 'function') setHeaders(res, htmlFile);
      res.type('html');
      return res.send(enhanceLegacyHtml(
        html,
        res.locals.legacyDraftProducts,
        res.locals.legacyProductTitles,
        res.locals.legacyProductDetailTitle,
        res.locals.legacyProductTabs,
        res.locals.legacyProductPageOrigin,
        res.locals.legacyCorporateReferences,
        res.locals.legacyProductVariantContext,
        res.locals.legacyCanonicalUrl
      ));
    } catch (error) {
      return next(error);
    }
  };
}

async function sendLegacyHtmlFile(res, filePath, setHeaders) {
  const html = await fs.readFile(filePath, 'utf8');
  if (typeof setHeaders === 'function') setHeaders(res, filePath);
  res.type('html');
  return res.send(enhanceLegacyHtml(
    html,
    res.locals.legacyDraftProducts,
    res.locals.legacyProductTitles,
    res.locals.legacyProductDetailTitle,
    res.locals.legacyProductTabs,
    res.locals.legacyProductPageOrigin,
    res.locals.legacyCorporateReferences,
    res.locals.legacyProductVariantContext,
    res.locals.legacyCanonicalUrl
  ));
}

module.exports = {
  enhanceLegacyHtml,
  htmlFileCandidates,
  injectLegacyWhatsappIntoHtmlResponses,
  isPublicPageRequest,
  sendLegacyHtmlFile,
  serveLegacyHtmlWithWhatsapp
};
