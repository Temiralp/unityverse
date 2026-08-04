const cheerio = require('cheerio');
const { DEFAULT_PRODUCT_TABS } = require('./product-tabs');
const {
  normalizeCurriculumAccordionContent,
  sanitizeProductTabContent
} = require('./product-content');
const { normalizeYoutubeEmbeds } = require('./youtube-embeds');

const LEGACY_TAB_IDS = {
  OVERVIEW: 'tab-info',
  CURRICULUM: 'tab-additional-content2',
  WHY: 'tab-additional-content3'
};
const LEGACY_PRODUCT_TAB_SECTION_PATTERN = /<div\b[^>]*class=["'][^"']*\bproducttab\b[^"']*["'][^>]*>[\s\S]*?(?=<div\b[^>]*class=["'][^"']*\brelated\b[^"']*\btitleLine\b[^"']*["'][^>]*>)/i;

function foldTurkish(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');
}

function isCurriculumTabLabel(value) {
  return /(?:ders|egitim)\s*icer|detayli\s*mufredat|program\s*(?:ozeti|icer)/.test(
    foldTurkish(value)
  );
}

function systemKeyForLegacyTabLabel(value) {
  const label = foldTurkish(value);
  if (isCurriculumTabLabel(label)) return 'CURRICULUM';
  if (/neden|avantaj|almalisiniz/.test(label)) return 'WHY';
  if (/ilk\s*bakis|genel|aciklama|bilgi/.test(label)) return 'OVERVIEW';
  return null;
}

function array(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function resolveLegacyProductTabs(tabs) {
  const storedTabs = array(tabs);

  return DEFAULT_PRODUCT_TABS.map((defaultTab) => {
    const storedTab = storedTabs.find((tab) => tab.systemKey === defaultTab.systemKey) || null;
    const storedTitle = String(storedTab?.title || '').trim();

    return {
      systemKey: defaultTab.systemKey,
      id: LEGACY_TAB_IDS[defaultTab.systemKey],
      title: storedTitle || defaultTab.title,
      content: defaultTab.systemKey === 'CURRICULUM'
        ? normalizeCurriculumAccordionContent(storedTab?.content)
        : sanitizeProductTabContent(storedTab?.content),
      hasStoredTab: Boolean(storedTab)
    };
  });
}

function renderLegacyTabSection(sectionHtml, tabs, origin) {
  const $ = cheerio.load(sectionHtml, { decodeEntities: false }, false);
  const navigation = $('.nav.nav-tabs').first();
  const tabContent = $('.tab-content').first();

  if (!navigation.length || !tabContent.length) return sectionHtml;

  navigation.empty();
  tabContent.empty();

  tabs.forEach((tab, index) => {
    const active = index === 0;
    const item = $('<li>').attr('data-tab', tab.id);
    if (active) item.addClass('active in');
    item.append(
      $('<a>')
        .attr({ 'data-toggle': 'tab', href: `#${tab.id}` })
        .text(tab.title)
    );
    navigation.append(item);

    const panel = $('<div>')
      .attr('id', tab.id)
      .addClass(`tab-pane fade${active ? ' active in' : ''}`)
      .html(normalizeYoutubeEmbeds(tab.content, origin));
    if (tab.systemKey === 'OVERVIEW') panel.attr('data-course-overview', '');
    tabContent.append(panel);
  });

  return $.html();
}

function mergeStoredLegacyTabs(sectionHtml, tabs, origin) {
  const $ = cheerio.load(sectionHtml, { decodeEntities: false }, false);
  const navigation = $('.nav.nav-tabs').first();
  const tabContent = $('.tab-content').first();
  if (!navigation.length || !tabContent.length) return sectionHtml;

  tabs.filter((tab) => tab.hasStoredTab).forEach((tab) => {
    let item = navigation.children('[data-tab]').filter((unusedIndex, element) => (
      String($(element).attr('data-tab') || '') === tab.id
      || systemKeyForLegacyTabLabel($(element).text()) === tab.systemKey
    )).first();
    const existingTabId = String(item.attr('data-tab') || '').trim();
    let pane = tabContent.children('[id]').filter((unusedIndex, element) => (
      [existingTabId, tab.id].includes(String($(element).attr('id') || ''))
    )).first();

    if (!item.length) {
      item = $('<li>').attr('data-tab', tab.id);
      item.append($('<a>').attr({ 'data-toggle': 'tab', href: `#${tab.id}` }));
      navigation.append(item);
    }
    item.attr('data-tab', tab.id);
    item.find('a').first().attr({ 'data-toggle': 'tab', href: `#${tab.id}` }).text(tab.title);

    if (!pane.length) {
      pane = $('<div>').attr('id', tab.id).addClass('tab-pane fade');
      tabContent.append(pane);
    }
    pane.attr('id', tab.id);
    pane.html(normalizeYoutubeEmbeds(tab.content, origin));
    if (tab.systemKey === 'OVERVIEW') pane.attr('data-course-overview', '');
  });

  return $.html();
}

function normalizeStaticLegacyCurriculumAccordion(sectionHtml) {
  const $ = cheerio.load(sectionHtml, { decodeEntities: false }, false);
  const navigationItems = $('.nav.nav-tabs [data-tab]').filter((unusedIndex, item) => (
    isCurriculumTabLabel($(item).text())
  ));
  let accordionGroupOffset = 0;
  let changed = false;

  navigationItems.each((unusedIndex, navigationItem) => {
    const tabId = String($(navigationItem).attr('data-tab') || '').trim();
    if (!tabId) return;
    const pane = $('.tab-content [id]').filter((unusedPaneIndex, item) => (
      String($(item).attr('id') || '') === tabId
    )).first();
    const groupCount = pane.find('.panel-group').length;
    if (!pane.length || !groupCount) return;

    pane.html(normalizeCurriculumAccordionContent(pane.html() || '', {
      groupOffset: accordionGroupOffset
    }));
    accordionGroupOffset += groupCount;
    changed = true;
  });

  return changed ? $.html() : sectionHtml;
}

function synchronizeLegacyProductTabs(html, productTabs, origin) {
  const source = String(html || '');
  if (!source) return source;

  const tabs = resolveLegacyProductTabs(productTabs);
  if (!tabs.some((tab) => tab.hasStoredTab)) {
    return source.replace(
      LEGACY_PRODUCT_TAB_SECTION_PATTERN,
      normalizeStaticLegacyCurriculumAccordion
    );
  }

  if (!tabs.every((tab) => tab.hasStoredTab)) {
    return source.replace(
      LEGACY_PRODUCT_TAB_SECTION_PATTERN,
      (sectionHtml) => mergeStoredLegacyTabs(
        normalizeStaticLegacyCurriculumAccordion(sectionHtml),
        tabs,
        origin
      )
    );
  }

  return source.replace(
    LEGACY_PRODUCT_TAB_SECTION_PATTERN,
    (sectionHtml) => renderLegacyTabSection(sectionHtml, tabs, origin)
  );
}

module.exports = {
  normalizeStaticLegacyCurriculumAccordion,
  resolveLegacyProductTabs,
  synchronizeLegacyProductTabs
};
