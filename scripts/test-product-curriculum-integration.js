const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const {
  normalizeCurriculumAccordionContent,
  sanitizeProductTabContent
} = require('../src/services/product-content');
const {
  buildCurriculumBackfillPlan,
  curriculumPriority,
  extractCurriculumSource
} = require('./backfill-empty-product-curriculum');

const accordion = `<div class="panel-group" id="accordion" onclick="bad()">
  <div class="panel panel-default">
    <div class="panel-heading"><h4 class="panel-title"><a data-toggle="collapse" data-parent="#accordion" href="#title1" onclick="bad()">Başlık</a></h4></div>
    <div id="title1" class="panel-collapse collapse"><div class="panel-body"><p>İçerik</p></div></div>
  </div>
</div>`;
const normalized = normalizeCurriculumAccordionContent(accordion);
const $ = cheerio.load(normalized, { decodeEntities: false });
const trigger = $('.panel-title a');
const panel = $('.panel-collapse');

assert.equal($('.panel-group').attr('id'), 'uv-curriculum-accordion-1');
assert.equal(trigger.attr('href'), '#uv-curriculum-accordion-1-panel-1');
assert.equal(trigger.attr('data-parent'), '#uv-curriculum-accordion-1');
assert.equal(trigger.attr('data-toggle'), 'collapse');
assert.equal(trigger.attr('aria-controls'), 'uv-curriculum-accordion-1-panel-1');
assert.equal(panel.attr('id'), 'uv-curriculum-accordion-1-panel-1');
assert.equal(panel.attr('aria-labelledby'), 'uv-curriculum-accordion-1-trigger-1');
assert.equal($('[onclick]').length, 0);
assert.equal(normalizeCurriculumAccordionContent(normalized), normalized);

const plain = '<h3>Dersler</h3><p>Accordion olmayan içerik.</p>';
assert.equal(normalizeCurriculumAccordionContent(plain), sanitizeProductTabContent(plain));

const malformed = '<div class="panel-group"><div class="panel"><p>Eksik yapı</p></div></div>';
assert.equal(normalizeCurriculumAccordionContent(malformed), sanitizeProductTabContent(malformed));

assert.equal(curriculumPriority('Ders İçerikleri'), 1);
assert.equal(curriculumPriority('Detaylı Müfredat'), 2);
assert.equal(curriculumPriority('Eğitime İlk Bakış'), null);

const cs51tt = extractCurriculumSource(path.resolve(
  __dirname,
  '../urun/zbrush-ile-kuyumculuk-ve-taki-tasarimi-egitimi-yuz-yuze-1535/index.html'
));
assert.equal(cs51tt.length > 0, true);
assert.match(cs51tt[0].content, /uv-curriculum-accordion-1-panel-1/);

const plan = buildCurriculumBackfillPlan([
  { id: 1, slug: 'empty', tabs: [], productVariants: [], variantOfProducts: [] },
  { id: 2, slug: 'existing', tabs: [{ id: 9, systemKey: 'CURRICULUM', content: '<p>DB</p>' }], productVariants: [], variantOfProducts: [] },
  { id: 3, slug: 'missing', tabs: [], productVariants: [], variantOfProducts: [] },
  { id: 4, slug: 'ambiguous', tabs: [], productVariants: [], variantOfProducts: [] }
], new Map([
  ['empty', [{ content: normalized, priority: 1, title: 'Ders İçerikleri' }]],
  ['ambiguous', [
    { content: '<p>Bir</p>', priority: 1, title: 'Ders İçerikleri' },
    { content: '<p>İki</p>', priority: 1, title: 'Eğitim İçerikleri' }
  ]]
]));
assert.deepEqual(plan.writes.map((write) => write.slug), ['empty']);
assert.deepEqual(plan.skippedExisting, ['existing']);
assert.deepEqual(plan.skippedNoSource, ['missing']);
assert.deepEqual(plan.skippedConflict, ['ambiguous']);

const parentFirstPlan = buildCurriculumBackfillPlan([{
  id: 5,
  slug: 'parent',
  tabs: [],
  variantOfProducts: [],
  productVariants: [{
    isActive: true,
    isArchived: false,
    variantProduct: { slug: 'active-child', status: 'PUBLISHED' }
  }]
}], new Map([
  ['parent', [{ content: '<p>Parent müfredatı</p>', priority: 2, title: 'Detaylı Müfredat' }]],
  ['active-child', [{ content: '<p>Child müfredatı</p>', priority: 1, title: 'Ders İçerikleri' }]]
]));
assert.equal(parentFirstPlan.writes[0].sourceSlug, 'parent');

const legacyScripts = fs.readFileSync(
  path.resolve(__dirname, '../public/tema10/js/scripts.js'),
  'utf8'
);
const productDetailScripts = fs.readFileSync(
  path.resolve(__dirname, '../public/tema10/js/product-detail.js'),
  'utf8'
);
const adminEditor = fs.readFileSync(
  path.resolve(__dirname, '../public/tema10/js/admin-product-editor.js'),
  'utf8'
);
const catalogRoute = fs.readFileSync(
  path.resolve(__dirname, '../src/routes/catalog.js'),
  'utf8'
);
const catalogView = fs.readFileSync(
  path.resolve(__dirname, '../src/views/catalog/product.ejs'),
  'utf8'
);
assert.match(legacyScripts, /event\.preventDefault\(\)/);
assert.match(legacyScripts, /#uv-curriculum-accordion-/);
assert.match(productDetailScripts, /initManagedCurriculumAccordions/);
assert.match(adminEditor, /synchronizeValues/);
assert.match(catalogRoute, /const contentOwner = routeDecision\.group\?\.parent \|\| product/);
assert.match(catalogRoute, /productTabs,/);
assert.match(catalogView, /uv-admin-curriculum/);
assert.doesNotMatch(catalogView, /Modüller uygulamalı ilerler/);

console.log('Product curriculum integration tests passed.');
