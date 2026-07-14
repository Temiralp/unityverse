const LEGACY_HOMEPAGE_MARKER = 'mobile-only-layout';
const legacyHomepageUploadUrlPattern = /(\b(?:src|data-src)=["'])https:\/\/(?:www\.)?unityverseacademy\.com\/uploads\//gi;

function ensureLegacyHomepageLocalAssets(html) {
  if (typeof html !== 'string' || !html.includes(LEGACY_HOMEPAGE_MARKER)) return html;

  return html.replace(legacyHomepageUploadUrlPattern, '$1/uploads/');
}

module.exports = {
  LEGACY_HOMEPAGE_MARKER,
  ensureLegacyHomepageLocalAssets
};
