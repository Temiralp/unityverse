// Ara formattan (bloklar / bolumler / paneller) kurs tab HTML'i uretir.
// Ders Icerikleri: sitedeki akordeon iskeleti (panel-group/panel/panel-heading/panel-collapse).
// ID ve ARIA ozellikleri burada yazilmaz; kayit sirasinda mevcut
// normalizeCurriculumAccordionContent (product-content.js) uretir.
// Tum cikti sanitizeProductTabContent'ten gecer.

const { sanitizeProductTabContent } = require('../product-content');

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderList(block) {
  const tag = block.ordered ? 'ol' : 'ul';
  const items = block.items.map((item) => `<li>${item}</li>`).join('\n');
  return `<${tag}>\n${items}\n</${tag}>`;
}

// Panel govdesi / bolum icindeki tek blok. Alt basliklar (h3+) kalin h4 olarak yazilir.
function renderBlock(block) {
  switch (block.type) {
    case 'paragraph':
      return `<p>${block.html}</p>`;
    case 'list':
      return renderList(block);
    case 'table':
      return block.html;
    case 'heading':
      return `<h4><strong>${escapeHtml(block.text)}</strong></h4>`;
    default:
      return '';
  }
}

function renderBlocks(blocks) {
  return (blocks || []).map(renderBlock).filter(Boolean).join('\n');
}

function renderPanel(panel) {
  return [
    '<div class="panel panel-default">',
    '<div class="panel-heading">',
    `<h4 class="panel-title"><a data-toggle="collapse" href="#"><strong>${escapeHtml(panel.title)}</strong></a></h4>`,
    '</div>',
    '<div class="panel-collapse collapse">',
    '<div class="panel-body">',
    renderBlocks(panel.blocks),
    '</div>',
    '</div>',
    '</div>'
  ].join('\n');
}

function renderCurriculumAccordion(panels, intro = []) {
  if (!panels || panels.length === 0) return '';
  const html = [
    renderBlocks(intro),
    '<div class="panel-group">',
    panels.map(renderPanel).join('\n'),
    '</div>'
  ].filter(Boolean).join('\n');
  return sanitizeProductTabContent(html);
}

// Egitime Ilk Bakis / Neden Bu Egitim: bolum basligi h2, alt bolum h3, sonra bloklar.
function renderSectionsHtml(sections, preamble = []) {
  const html = [
    renderBlocks(preamble),
    ...(sections || []).map((section) => [
      section.title ? `<h2>${escapeHtml(section.title)}</h2>` : '',
      renderBlocks(section.blocks),
      ...(section.children || []).map((child) => [
        `<h3>${escapeHtml(child.title)}</h3>`,
        renderBlocks(child.blocks)
      ].filter(Boolean).join('\n'))
    ].filter(Boolean).join('\n'))
  ].filter(Boolean).join('\n');
  return sanitizeProductTabContent(html);
}

function renderCourseTabs(tabs) {
  return {
    overview: renderSectionsHtml(tabs.overview.sections, tabs.overview.preamble),
    curriculum: renderCurriculumAccordion(tabs.curriculum.panels, tabs.curriculum.intro),
    why: renderSectionsHtml(tabs.why.sections),
    extra: renderSectionsHtml(tabs.extra.sections)
  };
}

module.exports = {
  renderBlocks,
  renderCourseTabs,
  renderCurriculumAccordion,
  renderSectionsHtml
};
