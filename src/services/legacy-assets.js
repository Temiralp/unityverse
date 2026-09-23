const LEGACY_HOME_CSS_VERSION = '5.4.106';
const LEGACY_UNITYVERSE_CSS_VERSION = '5.4.110';
const LEGACY_SCRIPTS_VERSION = '5.4.119';
const LEGACY_ENROLLMENT_LOCATION_VERSION = '20260811-1';
const LEGACY_BANK_TRANSFER_CSS_VERSION = '20260807-1';
const LEGACY_COURSE_CONTENT_CSS_VERSION = '20260923-1';
// Dinamik kurs sayfasindaki surumle ayni olmalidir (legacy-product-detail.js).
const LEGACY_COURSE_OVERVIEW_JS_VERSION = '20260726-2';
const LEGACY_CATALOG_JS_VERSION = '20260807-1';
const LEGACY_FILTERS_VERSION = '5.4.99';

const homeCssPattern = /((?:href)=["'][^"']*public\/tema10\/css\/home2\.css\?v=)[^"'&]+/gi;
const unityverseCssPattern = /((?:href)=["'][^"']*public\/tema10\/css\/unityverse\.css\?v=)[^"'&]+/gi;
const scriptsPattern = /((?:src)=["'][^"']*public\/tema10\/js\/scripts\.js\?v=)[^"'&]+/gi;
const bankTransferCssPattern = /((?:href)=["'][^"']*public\/tema10\/css\/bank-transfer-discount\.css\?v=)[^"'&]+/gi;
const catalogScriptsPattern = /((?:src)=["'][^"']*public\/tema10\/js\/legacy-course-catalog\.js\?v=)[^"'&]+/gi;
const filtersPattern = /((?:src)=["'][^"']*public\/tema10\/js\/filters\.js\?v=)[^"'&]+/gi;
const productDetailsPattern = /id=["']product_details_content["']/i;
// "Egitime Ilk Bakis" duzenleyicisi: isareti (data-course-overview) zincirde
// synchronizeLegacyProductTabs koyar, bu yuzden burada aranabilir.
const courseOverviewMarkerPattern = /data-course-overview\b/i;
const courseOverviewScriptPattern = /<script\b[^>]*src=["'][^"']*course-overview\.js(?:\?[^"']*)?["'][^>]*><\/script>/i;
const courseContentCssLinkPattern = /<link\b[^>]*href=["'][^"']*course-content\.css(?:\?[^"']*)?["'][^>]*>/i;
const bankTransferCssLinkPattern = /<link\b[^>]*href=["'][^"']*public\/tema10\/css\/bank-transfer-discount\.css(?:\?[^"']*)?["'][^>]*>/i;
const enrollmentLocationScriptPattern = /<script\b[^>]*src=["'][^"']*public\/tema10\/js\/enrollment-location\.js(?:\?[^"']*)?["'][^>]*><\/script>/i;
const legacyScriptsTagPattern = /<script\b[^>]*src=["'][^"']*public\/tema10\/js\/scripts\.js(?:\?[^"']*)?["'][^>]*><\/script>/i;

function ensureLegacyAssetVersions(html) {
  if (typeof html !== 'string') return html;

  let updated = html
    .replace(homeCssPattern, `$1${LEGACY_HOME_CSS_VERSION}`)
    .replace(unityverseCssPattern, `$1${LEGACY_UNITYVERSE_CSS_VERSION}`)
    .replace(scriptsPattern, `$1${LEGACY_SCRIPTS_VERSION}`)
    .replace(bankTransferCssPattern, `$1${LEGACY_BANK_TRANSFER_CSS_VERSION}`)
    .replace(catalogScriptsPattern, `$1${LEGACY_CATALOG_JS_VERSION}`)
    .replace(filtersPattern, `$1${LEGACY_FILTERS_VERSION}`);

  if (
    productDetailsPattern.test(updated)
    && !bankTransferCssLinkPattern.test(updated)
    && /<\/head>/i.test(updated)
  ) {
    updated = updated.replace(
      /<\/head>/i,
      `<link rel="stylesheet" href="../../public/tema10/css/bank-transfer-discount.css?v=${LEGACY_BANK_TRANSFER_CSS_VERSION}"></head>`
    );
  }

  if (
    productDetailsPattern.test(updated)
    && !courseContentCssLinkPattern.test(updated)
    && /<\/head>/i.test(updated)
  ) {
    updated = updated.replace(
      /<\/head>/i,
      `<link rel="stylesheet" href="/public/tema10/css/course-content.css?v=${LEGACY_COURSE_CONTENT_CSS_VERSION}"></head>`
    );
  }

  // Statik kurs sayfalari da dinamik sayfalarla ayni duzenleyiciyi yuklesin (Cember 18).
  if (
    courseOverviewMarkerPattern.test(updated)
    && !courseOverviewScriptPattern.test(updated)
    && /<\/body>/i.test(updated)
  ) {
    updated = updated.replace(
      /<\/body>/i,
      `<script src="/public/tema10/js/course-overview.js?v=${LEGACY_COURSE_OVERVIEW_JS_VERSION}" defer></script></body>`
    );
  }

  if (
    !enrollmentLocationScriptPattern.test(updated)
    && legacyScriptsTagPattern.test(updated)
  ) {
    updated = updated.replace(
      legacyScriptsTagPattern,
      (scriptsTag) => `<script src="/public/tema10/js/enrollment-location.js?v=${LEGACY_ENROLLMENT_LOCATION_VERSION}"></script>${scriptsTag}`
    );
  }

  return updated;
}

module.exports = {
  LEGACY_BANK_TRANSFER_CSS_VERSION,
  LEGACY_COURSE_CONTENT_CSS_VERSION,
  LEGACY_COURSE_OVERVIEW_JS_VERSION,
  LEGACY_CATALOG_JS_VERSION,
  LEGACY_FILTERS_VERSION,
  LEGACY_ENROLLMENT_LOCATION_VERSION,
  LEGACY_HOME_CSS_VERSION,
  LEGACY_UNITYVERSE_CSS_VERSION,
  LEGACY_SCRIPTS_VERSION,
  ensureLegacyAssetVersions
};
