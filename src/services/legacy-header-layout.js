const LEGACY_HEADER_LAYOUT_MARKER = 'data-legacy-header-layout';
const LEGACY_HEADER_LAYOUT_VERSION = '20260714';

const legacyHeaderLayoutStylesheet = `<link rel="stylesheet" type="text/css" href="/public/tema10/css/legacy-header-layout.css?v=${LEGACY_HEADER_LAYOUT_VERSION}" ${LEGACY_HEADER_LAYOUT_MARKER}>`;

function ensureLegacyHeaderLayout(html) {
  if (typeof html !== 'string' || !/<\/head\s*>/i.test(html)) return html;
  if (html.includes(LEGACY_HEADER_LAYOUT_MARKER)) return html;

  return html.replace(/<\/head\s*>/i, `${legacyHeaderLayoutStylesheet}\n</head>`);
}

module.exports = {
  LEGACY_HEADER_LAYOUT_MARKER,
  LEGACY_HEADER_LAYOUT_VERSION,
  ensureLegacyHeaderLayout
};
