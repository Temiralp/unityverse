// Kategori sayfalarina (kategori/<slug>/index.html sablonu) /tum-urunler/ ile ayni
// kurs arama formunu ve istemci tarafi kontrolcusunu (legacy-course-catalog.js)
// sunucu tarafinda ekler. Statik sablonlara dokunulmaz; yeni kategori sablonu
// eklendiginde arama otomatik olarak gelir.

const { LEGACY_CATALOG_JS_VERSION } = require('./legacy-assets');

const CATEGORY_TITLE_PATTERN = /<div class="category-page-title">(\s*<h1 class="modtitle">[\s\S]*?<\/h1>)/;
const HIDDEN_PAGINATION_PATTERN = /<ul class="pagination"(?:\s+style="display:none !important;")+/g;
const SEARCH_FORM_MARKER = 'class="course-search-form"';
const CATALOG_SCRIPT_MARKER = 'legacy-course-catalog.js';

function escapeAttribute(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// tum-urunler/index.html icindeki formla ayni yapi; name="q" sayesinde JS yokken
// de kategori route'unun sunucu tarafi ?q= filtresi calisir.
function renderSearchForm(actionPath) {
  const action = escapeAttribute(actionPath || '');
  return `
									<div class="category-page-search">
										<form class="course-search-form" action="${action}" method="get" role="search">
											<label class="sr-only" for="course-search-input">Eğitim ara</label>
											<div class="course-search-control">
												<i class="fa fa-search" aria-hidden="true"></i>
												<input id="course-search-input" name="q" type="search" placeholder="Eğitim ara..." autocomplete="off" maxlength="100" aria-describedby="search_result">
												<button type="submit" aria-label="Eğitim ara">Ara</button>
											</div>
										</form>
									</div>`;
}

function ensureLegacyCategorySearch(html, actionPath) {
  const source = String(html || '');
  if (!source || source.includes(SEARCH_FORM_MARKER) || !CATEGORY_TITLE_PATTERN.test(source)) {
    return source;
  }

  let updated = source.replace(
    CATEGORY_TITLE_PATTERN,
    (match, heading) => `<div class="category-page-title category-page-title--with-search">${heading}${renderSearchForm(actionPath)}`
  );

  // Kategori sablonlarinda paginasyon gizlidir; kontrolcu 12/sayfa paginasyonu bu listeye cizer.
  updated = updated.replace(HIDDEN_PAGINATION_PATTERN, '<ul class="pagination"');

  if (!updated.includes(CATALOG_SCRIPT_MARKER) && /<\/body>/i.test(updated)) {
    updated = updated.replace(
      /<\/body>/i,
      `<script type="text/javascript" src="/public/tema10/js/legacy-course-catalog.js?v=${LEGACY_CATALOG_JS_VERSION}"></script>\n</body>`
    );
  }

  return updated;
}

module.exports = { ensureLegacyCategorySearch };
