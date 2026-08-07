const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');

const {
  LEGACY_UNITYVERSE_CSS_VERSION,
  ensureLegacyAssetVersions
} = require('../src/services/legacy-assets');

const root = path.resolve(__dirname, '..');
const turkishPricePrompt = 'Fiyatı görmek için giriş yapın';
const legacyCss = fs.readFileSync(path.join(root, 'public/tema10/css/unityverse.css'), 'utf8');
const componentCss = fs.readFileSync(path.join(root, 'public/tema10/css/components.css'), 'utf8');
const detailRoute = fs.readFileSync(path.join(root, 'src/routes/legacy-product-detail.js'), 'utf8');
const ejsHeader = fs.readFileSync(path.join(root, 'src/views/partials/header.ejs'), 'utf8');

[legacyCss, componentCss, detailRoute].forEach((source) => {
  assert(source.includes(turkishPricePrompt));
  assert(!source.includes('Qiyməti görmək üçün giriş edin'));
});

assert(legacyCss.includes('body:not(.member-logged-in)'));
assert(componentCss.includes('body:not(.member-logged-in)'));
assert(ejsHeader.includes('components.css?v=20260722-1'));

const updatedLegacyHtml = ensureLegacyAssetVersions(
  '<link rel="stylesheet" href="/public/tema10/css/unityverse.css?v=5.4.103">'
);
assert(updatedLegacyHtml.includes(`unityverse.css?v=${LEGACY_UNITYVERSE_CSS_VERSION}`));

console.log('Price visibility language tests passed.');
