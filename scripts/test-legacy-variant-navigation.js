const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const {
  LEGACY_SCRIPTS_VERSION,
  ensureLegacyAssetVersions
} = require('../src/services/legacy-assets');

const root = path.resolve(__dirname, '..');
const parentSlug = 'unity-ile-oyun-gelistirme-canli-online-egitimi-1478';
const eightMonthSlug = 'unity-ile-oyun-gelistirme-canli-online-egitimi-8-ay-1479';
const fourMonthSlug = 'unity-ile-oyun-gelistirme-canli-online-egitimi-4-ay-1480';

function courseSource(slug) {
  return fs.readFileSync(path.join(root, 'urun', slug, 'index.html'), 'utf8');
}

function basePrice(source) {
  const match = source.match(/\bvar\s+base_price\s*=\s*([0-9]+(?:\.[0-9]+)?)/);
  assert(match, 'Course base price should exist');
  return Number(match[1]);
}

function option(source, productId) {
  const $ = cheerio.load(source);
  const item = $(`li[data-product-id="${productId}"][producturl]`).first();

  assert.equal(item.length, 1, `Variant option ${productId} should exist`);
  return {
    active: item.hasClass('active'),
    label: item.text().replace(/\s+/g, ' ').trim(),
    url: item.attr('producturl')
  };
}

function enrollmentProductId(source) {
  const match = source.match(/<button\s+onclick="__addToBasket\((\d+),[^"]*"[^>]*>Kursa Kayıt ol<\/button>/);
  assert(match, 'Enrollment button product id should exist');
  return Number(match[1]);
}

function frontendContractTest() {
  const scriptsSource = fs.readFileSync(path.join(root, 'public/tema10/js/scripts.js'), 'utf8');
  const navigationGuard = scriptsSource.indexOf('if(modal === false && navigateToLegacyVariant(product_id))');
  const legacyAjax = scriptsSource.indexOf('url: site_url + "ajax/productdetails"');

  assert.match(scriptsSource, /function legacyVariantProductUrl\(productId\)/);
  assert.match(scriptsSource, /resolvedUrl\.origin === window\.location\.origin/);
  assert.match(scriptsSource, /hideSiteLoading\(\)/);
  assert(navigationGuard >= 0, 'Variant navigation guard should exist');
  assert(legacyAjax > navigationGuard, 'Variant navigation should run before the legacy AJAX fallback');
}

function variantPagesTest() {
  const parentSource = courseSource(parentSlug);
  const eightMonthSource = courseSource(eightMonthSlug);
  const fourMonthSource = courseSource(fourMonthSlug);
  const parentEightMonth = option(parentSource, 1479);
  const parentFourMonth = option(parentSource, 1480);
  const eightMonth = option(eightMonthSource, 1479);
  const fourMonth = option(fourMonthSource, 1480);

  assert.equal(parentEightMonth.label, '8 ay');
  assert.match(parentEightMonth.url, new RegExp(`${eightMonthSlug}$`));
  assert.equal(parentFourMonth.label, '4 ay');
  assert.match(parentFourMonth.url, new RegExp(`${fourMonthSlug}$`));

  assert.equal(basePrice(eightMonthSource), 98750);
  assert.equal(basePrice(fourMonthSource), 49000);
  assert.notEqual(basePrice(eightMonthSource), basePrice(fourMonthSource));

  assert.equal(eightMonth.active, true);
  assert.equal(fourMonth.active, true);
  assert.equal(enrollmentProductId(eightMonthSource), 1479);
  assert.equal(enrollmentProductId(fourMonthSource), 1480);
}

function cacheVersionTest() {
  const html = '<script src="../../public/tema10/js/scripts.js?v=5.4.106"></script>';
  const updated = ensureLegacyAssetVersions(html);

  assert.match(updated, new RegExp(`scripts\\.js\\?v=${LEGACY_SCRIPTS_VERSION.replace(/\./g, '\\.')}`));
}

frontendContractTest();
variantPagesTest();
cacheVersionTest();
console.log('Legacy variant navigation tests passed.');
