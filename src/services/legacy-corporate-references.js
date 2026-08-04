const LEGACY_REFERENCE_STYLE = '/public/tema10/css/legacy-corporate-references.css?v=20260803-3';
const LEGACY_REFERENCE_SCRIPT = '/public/tema10/js/legacy-corporate-references.js?v=20260803-3';
const { isSafeCorporateReferenceLogoPath } = require('./corporate-references');

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function visibleCorporateReferences(references) {
  if (!Array.isArray(references)) return [];
  return references.filter((reference) => (
    reference
    && String(reference.name || '').trim()
    && isSafeCorporateReferenceLogoPath(reference.logoPath)
  ));
}

function referenceSliderHtml(references, layout) {
  const items = references.map((reference) => {
    const darkLogoClass = String(reference.logoPath).endsWith('/btm.png')
      ? ' corporate-reference-slider__logo--dark'
      : '';
    return `
        <li class="corporate-reference-slider__item" data-corporate-reference-item>
          <div class="corporate-reference-slider__logo${darkLogoClass}">
            <img src="${escapeHtml(reference.logoPath)}" alt="${escapeHtml(reference.name)} logosu" loading="lazy" decoding="async">
          </div>
        </li>`;
  }).join('');

  return `<section class="corporate-reference-section corporate-reference-section--${layout}" aria-labelledby="corporate-reference-title-${layout}" data-corporate-reference-slider data-autoplay="3000">
  <h2 id="corporate-reference-title-${layout}" class="corporate-reference-section__title">Kurumsal Referanslarımız</h2>
  <div class="corporate-reference-slider">
    <button class="corporate-reference-slider__button corporate-reference-slider__button--previous" type="button" aria-label="Önceki referanslar" data-corporate-reference-previous>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>
    </button>
    <div class="corporate-reference-slider__viewport">
      <ul class="corporate-reference-slider__track" data-corporate-reference-track>${items}
      </ul>
    </div>
    <button class="corporate-reference-slider__button corporate-reference-slider__button--next" type="button" aria-label="Sonraki referanslar" data-corporate-reference-next>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
    </button>
  </div>
</section>`;
}

function injectReferenceAssets(html) {
  let result = html;
  if (!result.includes(LEGACY_REFERENCE_STYLE)) {
    result = result.replace('</head>', `  <link rel="stylesheet" href="${LEGACY_REFERENCE_STYLE}">\n</head>`);
  }
  if (!result.includes(LEGACY_REFERENCE_SCRIPT)) {
    result = result.replace('</body>', `<script src="${LEGACY_REFERENCE_SCRIPT}" defer></script>\n</body>`);
  }
  return result;
}

function synchronizeLegacyCorporateReferences(html, references) {
  if (typeof html !== 'string') return html;
  if (!html.includes('module1_3235') && !html.includes('module11_3690')) return html;

  const visibleReferences = visibleCorporateReferences(references);
  const desktopSection = /<section\b[^>]*\bid="module1_3235"[^>]*>[\s\S]*?<\/section>/i;
  const mobileSections = /<section\b[^>]*\bid="module11_3690"[^>]*>[\s\S]*?<\/section><section\b[^>]*\bid="module1_8545"[^>]*>[\s\S]*?<\/section><section\b[^>]*\bid="module1_5228"[^>]*>[\s\S]*?<\/section>/i;

  let result = html.replace(
    desktopSection,
    visibleReferences.length ? referenceSliderHtml(visibleReferences, 'desktop') : ''
  );
  result = result.replace(
    mobileSections,
    visibleReferences.length ? referenceSliderHtml(visibleReferences, 'mobile') : ''
  );

  return visibleReferences.length ? injectReferenceAssets(result) : result;
}

module.exports = {
  LEGACY_REFERENCE_SCRIPT,
  LEGACY_REFERENCE_STYLE,
  escapeHtml,
  referenceSliderHtml,
  synchronizeLegacyCorporateReferences,
  visibleCorporateReferences
};
