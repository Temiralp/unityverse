const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const {
  resolveLegacyProductTabs,
  synchronizeLegacyProductTabs
} = require('../src/services/legacy-product-tabs');
const { renderLegacyProductDetails } = require('../src/routes/legacy-product-detail');

const completeTabs = [
  {
    systemKey: 'CURRICULUM',
    title: 'DB Ders İçerikleri',
    content: '<p data-test="curriculum">DB curriculum content</p>',
    sortOrder: 20
  },
  {
    systemKey: 'WHY',
    title: 'Neden Bu Eğitim',
    content: '<script>window.bad = true</script><p data-test="why" onclick="alert(1)">DB why content</p>',
    sortOrder: 30
  },
  {
    systemKey: 'OVERVIEW',
    title: 'DB Eğitime İlk Bakış',
    content: '<p data-test="overview">DB overview content</p><iframe src="https://www.youtube.com/embed/kV0emc-Kl58" width="640" height="360"></iframe>',
    sortOrder: 10
  }
];

function productTabRoot(html) {
  const $ = cheerio.load(html, { decodeEntities: false });
  return { $, root: $('.producttab').first() };
}

function assertSynchronizedTabSection(html) {
  const { $, root } = productTabRoot(html);
  const navigationItems = root.find('.nav.nav-tabs > li');
  const panels = root.find('.tab-content > .tab-pane');

  assert.equal(navigationItems.length, 3);
  assert.deepEqual(
    navigationItems.map((_, item) => $(item).text().trim()).get(),
    ['DB Eğitime İlk Bakış', 'DB Ders İçerikleri', 'Neden Bu Eğitim']
  );
  assert.deepEqual(
    navigationItems.map((_, item) => $(item).attr('data-tab')).get(),
    ['tab-info', 'tab-additional-content2', 'tab-additional-content3']
  );
  assert.equal(navigationItems.eq(0).hasClass('active'), true);
  assert.equal(navigationItems.eq(1).hasClass('active'), false);

  assert.equal(panels.length, 3);
  assert.equal(panels.eq(0).attr('id'), 'tab-info');
  assert.equal(panels.eq(0).is('[data-course-overview]'), true);
  assert.match(panels.eq(0).text(), /DB overview content/);
  assert.match(panels.eq(1).text(), /DB curriculum content/);
  assert.match(panels.eq(2).text(), /DB why content/);
  assert.equal(root.find('#tab-suggestions, #tab-additional-content5').length, 0);
  assert.equal(root.text().includes('Eğitim Önerileri'), false);

  const iframe = panels.eq(0).find('iframe');
  assert.equal(iframe.length, 1);
  assert.match(iframe.attr('src'), /^https:\/\/www\.youtube-nocookie\.com\/embed\/kV0emc-Kl58\?origin=http%3A%2F%2Flocalhost%3A8000$/);
  assert.equal(iframe.attr('referrerpolicy'), 'strict-origin-when-cross-origin');
  assert.equal(panels.eq(2).find('script').length, 0);
  assert.equal(panels.eq(2).find('[onclick]').length, 0);
}

function staticLegacyPageTests() {
  const source = fs.readFileSync(path.join(
    __dirname,
    '../urun/yapay-zeka-destekli-unity-ile-oyun-gelistirme-egitimi-yuz-yuze-1680/index.html'
  ), 'utf8');
  const synchronized = synchronizeLegacyProductTabs(
    source,
    completeTabs,
    'http://localhost:8000'
  );

  assert.notEqual(synchronized, source);
  assertSynchronizedTabSection(synchronized);
  const sourceDocument = cheerio.load(source, { decodeEntities: false });
  const synchronizedDocument = cheerio.load(synchronized, { decodeEntities: false });
  assert.equal(
    synchronizedDocument('.related.titleLine').first().html(),
    sourceDocument('.related.titleLine').first().html()
  );
  assert.equal(
    synchronizedDocument('.title-product').first().html(),
    sourceDocument('.title-product').first().html()
  );
  assert.equal(
    synchronizeLegacyProductTabs(synchronized, completeTabs, 'http://localhost:8000'),
    synchronized
  );

  const partialTabs = completeTabs.filter((tab) => tab.systemKey !== 'WHY');
  const partial = synchronizeLegacyProductTabs(source, partialTabs, 'http://localhost:8000');
  const partialDocument = cheerio.load(partial, { decodeEntities: false });
  assert.deepEqual(
    partialDocument('.producttab .nav.nav-tabs > li').map((_, item) => partialDocument(item).text().trim()).get(),
    ['DB Eğitime İlk Bakış', 'Eğitim Önerileri', 'DB Ders İçerikleri']
  );
  assert.match(partialDocument('#tab-info').text(), /DB overview content/);
  assert.match(partialDocument('#tab-additional-content2').text(), /DB curriculum content/);
  assert.equal(
    partialDocument('#tab-suggestions').text().trim(),
    sourceDocument('#tab-suggestions').text().trim()
  );
  assert.equal(
    synchronizeLegacyProductTabs(partial, partialTabs, 'http://localhost:8000'),
    partial
  );

  const preservationFixture = `<div class="producttab"><ul class="nav nav-tabs">
    <li data-tab="tab-info"><a href="#tab-info">Eğitime İlk Bakış</a></li>
    <li data-tab="tab-additional-content2"><a href="#tab-additional-content2">Ders İçerikleri</a></li>
    <li data-tab="tab-additional-content3"><a href="#tab-additional-content3">Neden Bu Eğitim</a></li>
  </ul><div class="tab-content">
    <div id="tab-info">STATIC OVERVIEW MUST STAY</div>
    <div id="tab-additional-content2">STATIC CURRICULUM</div>
    <div id="tab-additional-content3">STATIC WHY MUST STAY</div>
  </div></div><div class="related titleLine">Related</div>`;
  const curriculumOnly = synchronizeLegacyProductTabs(
    preservationFixture,
    [completeTabs.find((tab) => tab.systemKey === 'CURRICULUM')],
    'http://localhost:8000'
  );
  const preservationDocument = cheerio.load(curriculumOnly, { decodeEntities: false });
  assert.equal(preservationDocument('#tab-info').text().trim(), 'STATIC OVERVIEW MUST STAY');
  assert.match(preservationDocument('#tab-additional-content2').text(), /DB curriculum content/);
  assert.equal(preservationDocument('#tab-additional-content3').text().trim(), 'STATIC WHY MUST STAY');

  const noStoredTabs = synchronizeLegacyProductTabs(source, [], 'http://localhost:8000');
  assert.equal(
    synchronizeLegacyProductTabs(noStoredTabs, [], 'http://localhost:8000'),
    noStoredTabs
  );

  const accordionSource = fs.readFileSync(path.join(
    __dirname,
    '../urun/zbrush-ile-kuyumculuk-ve-taki-tasarimi-egitimi-yuz-yuze-1535/index.html'
  ), 'utf8');
  const normalizedStaticAccordion = synchronizeLegacyProductTabs(
    accordionSource,
    null,
    'http://localhost:8000'
  );
  assert.match(normalizedStaticAccordion, /id="uv-curriculum-accordion-1"/);
  assert.match(normalizedStaticAccordion, /href="#uv-curriculum-accordion-1-panel-1"/);
  assert.doesNotMatch(normalizedStaticAccordion, /href="#title1"/);
}

function resolverTests() {
  const resolved = resolveLegacyProductTabs([
    { systemKey: 'WHY', title: '   ', content: '<p>Safe</p>' },
    { systemKey: 'OVERVIEW', title: 'Overview', content: '<p>Overview</p>' },
    { systemKey: 'CURRICULUM', title: 'Curriculum', content: '<p>Curriculum</p>' },
    { systemKey: null, title: 'Custom tab', content: '<p>Custom</p>' }
  ]);

  assert.deepEqual(resolved.map((tab) => tab.systemKey), ['OVERVIEW', 'CURRICULUM', 'WHY']);
  assert.equal(resolved[2].title, 'Neden Bu Eğitim');
  assert.equal(resolved.some((tab) => tab.title === 'Custom tab'), false);
}

function dynamicLegacyPageTests() {
  const product = {
    id: 391,
    slug: 'test-course',
    code: 'UV-TEST',
    title: 'Test Course',
    summary: 'Test summary',
    content: '',
    image: '/uploads/fm/test.jpg',
    price: '1000.00',
    discountPrice: null,
    bankTransferDiscountRate: '10.00',
    category: { name: 'Oyun Geliştirme', slug: 'oyun-gelistirme' },
    tabs: completeTabs,
    learningOutcomes: []
  };
  const html = renderLegacyProductDetails(product, 'http://localhost:8000');

  assertSynchronizedTabSection(html);
  assert.equal(html.includes('Neden Bu Eğitimi Almalısınız?'), false);

  const partialHtml = renderLegacyProductDetails({
    ...product,
    tabs: completeTabs.filter((tab) => tab.systemKey !== 'WHY')
  }, 'http://localhost:8000');
  const partialDocument = cheerio.load(partialHtml, { decodeEntities: false });
  assert.deepEqual(
    partialDocument('.producttab .nav.nav-tabs > li').map((_, item) => partialDocument(item).text().trim()).get(),
    ['DB Eğitime İlk Bakış', 'DB Ders İçerikleri', 'Neden Bu Eğitim']
  );
  assert.equal(partialDocument('#tab-additional-content3').text().trim(), '');
}

function run() {
  resolverTests();
  staticLegacyPageTests();
  dynamicLegacyPageTests();
  console.log('Legacy product tab tests passed.');
}

run();
