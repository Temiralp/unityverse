const {
  normalizeCurriculumAccordionContent,
  sanitizeProductTabContent
} = require('./product-content');
const { normalizeYoutubeEmbedsForEditor } = require('./youtube-embeds');

const DEFAULT_PRODUCT_TABS = [
  { systemKey: 'OVERVIEW', title: 'Eğitime İlk Bakış', sortOrder: 10 },
  { systemKey: 'CURRICULUM', title: 'Ders İçerikleri', sortOrder: 20 },
  { systemKey: 'WHY', title: 'Neden Bu Eğitim', sortOrder: 30 }
];

function text(value) {
  return String(value || '').trim();
}

function array(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return Object.values(value);
  return [];
}

function sanitizeTabContent(systemKey, content) {
  return systemKey === 'CURRICULUM'
    ? normalizeCurriculumAccordionContent(content)
    : sanitizeProductTabContent(content);
}

function buildProductFormTabs(tabs) {
  const entries = array(tabs);
  const systemTabs = new Map(entries.filter((tab) => tab && tab.systemKey).map((tab) => [tab.systemKey, tab]));
  const customTabs = entries
    .filter((tab) => tab && !tab.systemKey)
    .map((tab, index) => ({
      systemKey: null,
      title: text(tab.title),
      content: sanitizeProductTabContent(tab.content),
      sortOrder: Number(tab.sortOrder) || (40 + index * 10)
    }));

  return [
    ...DEFAULT_PRODUCT_TABS.map((tab) => ({
      ...tab,
      title: text(systemTabs.get(tab.systemKey)?.title) || tab.title,
      content: sanitizeTabContent(tab.systemKey, systemTabs.get(tab.systemKey)?.content)
    })),
    ...customTabs
  ];
}

function buildProductFormOutcomes(outcomes) {
  return array(outcomes)
    .map((outcome, index) => ({
      text: text(typeof outcome === 'string' ? outcome : outcome?.text),
      sortOrder: Number(outcome?.sortOrder) || ((index + 1) * 10)
    }))
    .filter((outcome) => outcome.text);
}

function buildProductEditorTabs(tabs, origin) {
  return buildProductFormTabs(tabs).map((tab) => ({
    ...tab,
    content: normalizeYoutubeEmbedsForEditor(tab.content, origin)
  }));
}

function normalizeProductTabSubmission(tabs) {
  const formTabs = buildProductFormTabs(tabs);
  const customTabs = formTabs.slice(DEFAULT_PRODUCT_TABS.length)
    .filter((tab) => tab.title || text(tab.content))
    .map((tab, index) => ({
      systemKey: null,
      title: tab.title || `Ek Bilgi ${index + 1}`,
      content: tab.content,
      sortOrder: 40 + index * 10
    }));

  return [
    ...formTabs.slice(0, DEFAULT_PRODUCT_TABS.length),
    ...customTabs
  ];
}

async function replaceProductContentStructure(tx, productId, tabs, outcomes) {
  const normalizedTabs = normalizeProductTabSubmission(tabs);
  const normalizedOutcomes = buildProductFormOutcomes(outcomes);

  await tx.productTab.deleteMany({ where: { productId } });
  await tx.productLearningOutcome.deleteMany({ where: { productId } });

  await tx.productTab.createMany({
    data: normalizedTabs.map((tab, index) => ({
      productId,
      systemKey: tab.systemKey,
      title: tab.title,
      content: tab.content,
      sortOrder: tab.sortOrder || ((index + 1) * 10)
    }))
  });

  if (normalizedOutcomes.length) {
    await tx.productLearningOutcome.createMany({
      data: normalizedOutcomes.map((outcome, index) => ({
        productId,
        text: outcome.text,
        sortOrder: outcome.sortOrder || ((index + 1) * 10)
      }))
    });
  }
}

module.exports = {
  DEFAULT_PRODUCT_TABS,
  buildProductEditorTabs,
  buildProductFormOutcomes,
  buildProductFormTabs,
  normalizeProductTabSubmission,
  replaceProductContentStructure
};
