const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');

const {
  legacyVariantValues,
  makeLegacyDurationOptionsDisplayOnly,
  synchronizeLegacyProductVariantOptions
} = require('../src/services/legacy-product-variant-options');
const { enhanceLegacyHtml } = require('../src/middleware/legacy-whatsapp');

function variant(id, overrides = {}) {
  return {
    id,
    parentProductId: 10,
    variantProductId: id + 100,
    label: `${id} saat`,
    sortOrder: id,
    isDefault: false,
    isActive: true,
    variantProduct: {
      id: id + 100,
      slug: `course-${id}`,
      duration: `${id} saat`,
      status: 'PUBLISHED'
    },
    ...overrides
  };
}

const visible = variant(1, {
  label: '<script>alert(1)</script> 30 saat',
  variantProduct: {
    id: 101,
    slug: 'course-30-saat',
    duration: '30 saat',
    status: 'PUBLISHED'
  }
});
const newVisible = variant(5, {
  label: '60 saat',
  variantProduct: {
    id: 105,
    slug: 'course-60-saat',
    duration: '60 saat',
    status: 'PUBLISHED'
  }
});
const inactive = variant(2, { isActive: false });
const archived = variant(4, { isArchived: true });
const draft = variant(3, {
  variantProduct: {
    id: 103,
    slug: 'draft-course',
    duration: '60 saat',
    status: 'DRAFT'
  }
});
const context = {
  productId: 101,
  variants: [draft, inactive, archived, visible, newVisible]
};

const staleHtml = [
  '<div id="product">',
  '<h4>Eğitim Seçenekleri</h4>',
  '<ul class="list-filter" id="poptions1_10">',
  '<li data-product-id="9991" value="355" producturl="../../urun/course-30-saat">Old current</li>',
  '<li data-product-id="999" producturl="../../urun/stale-course">Stale</li>',
  '</ul>',
  '</div>'
].join('');
const synchronized = synchronizeLegacyProductVariantOptions(staleHtml, context);

assert.doesNotMatch(synchronized, /stale-course|draft-course|course-2|course-4/);
assert.match(synchronized, /data-product-id="101"/);
assert.match(synchronized, /data-product-id="101"[^>]*value="355"/);
assert.match(synchronized, /data-product-id="105"[^>]*value="105"/);
assert.match(synchronized, /producturl="\.\.\/\.\.\/urun\/course-30-saat"/);
assert.doesNotMatch(synchronized, /class="active/);
assert.match(synchronized, /data-uv-managed-variants="true"/);
assert.match(synchronized, /data-uv-managed-variant="true"/);
assert.match(synchronized, /href="\.\.\/\.\.\/urun\/course-30-saat" aria-disabled="true" tabindex="-1"/);
assert.match(synchronized, /&lt;script&gt;alert\(1\)&lt;\/script&gt; 30 saat/);
assert.doesNotMatch(synchronized, /<script>alert\(1\)<\/script>/);
assert.equal(legacyVariantValues(staleHtml).get('slug:course-30-saat'), '355');

const enhanced = enhanceLegacyHtml(staleHtml, [], [], null, null, null, [], context);
assert.match(enhanced, /data-product-id="101"/);
assert.doesNotMatch(enhanced, /stale-course|draft-course|course-2|course-4/);

const withoutBlock = '<main><div id="product"><p>Buy box</p></div></main>';
const inserted = synchronizeLegacyProductVariantOptions(withoutBlock, context);
assert.match(inserted, /Eğitim Seçenekleri/);
assert.match(inserted, /id="poptions1_101"/);
assert.match(inserted, /<p>Buy box<\/p>/);

const displayOnlyFallback = synchronizeLegacyProductVariantOptions(staleHtml, null);
assert.match(displayOnlyFallback, /data-uv-managed-variants="true"/);
assert.match(displayOnlyFallback, /data-uv-managed-variant="true"/);

const clickableLegacyHtml = [
  '<ul class="list-filter size-filter" id="poptions1_1535">',
  '<li onclick="enabledVariants_1535(2, this.value, true)" data-product-id="1537">',
  '<a href="../../urun/draft-duration">3 ay</a>',
  '</li>',
  '</ul>'
].join('');
const inertLegacyHtml = makeLegacyDurationOptionsDisplayOnly(clickableLegacyHtml);
assert.doesNotMatch(inertLegacyHtml, /onclick=/);
assert.match(inertLegacyHtml, /data-uv-managed-variants="true"/);
assert.match(inertLegacyHtml, /data-uv-managed-variant="true"/);
assert.match(inertLegacyHtml, /href="\.\.\/\.\.\/urun\/draft-duration"/);
assert.match(inertLegacyHtml, /aria-disabled="true"/);
assert.match(inertLegacyHtml, /tabindex="-1"/);

const homeStyles = fs.readFileSync(
  path.join(__dirname, '../public/tema10/css/home2.css'),
  'utf8'
);
assert.match(homeStyles, /list-filter\[id\^="poptions1_"\] li\s*\{[\s\S]*?pointer-events: none/);
assert.match(homeStyles, /list-filter\[id\^="poptions1_"\] li a::before\s*\{[\s\S]*?background-color: var\(--renk1\)/);
assert.match(homeStyles, /list-filter\[id\^="poptions1_"\] li a::before/);
assert.match(homeStyles, /list-filter\[id\^="poptions1_"\] li\.deactive a::after\s*\{[\s\S]*?display: none/);

const publicScripts = fs.readFileSync(
  path.join(__dirname, '../public/tema10/js/scripts.js'),
  'utf8'
);
assert.match(publicScripts, /function preventManagedCourseDurationInteraction\(event\)/);
assert.match(publicScripts, /\['click', 'auxclick', 'contextmenu', 'dragstart'\]/);
assert.match(publicScripts, /li\[data-uv-managed-variant="true"\][\s\S]*?\.off\('click'\)/);
assert.match(publicScripts, /ul\[id\^="poptions1_"\] li/);

console.log('Legacy product variant option synchronization tests passed.');
