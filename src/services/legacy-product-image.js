// Statik kurs detay sayfalarinda (urun/<slug>/index.html) ana kurs gorselini
// admin panelinde yonetilen DB degeriyle senkronlar. Liste sayfasi zaten DB'den
// render edildigi icin tek dogruluk kaynagi DB'dir.
//
// Kural: DB gorseli statik gorselle ayniysa HTML'e dokunulmaz (galeri korunur).
// Farkliysa ana slider ve thumbnail slider tek slayt olarak yeniden yazilir.

const PLACEHOLDER_IMAGE = '../../uploads/fm/placeholder-social.png';
const MAIN_SLIDER_PATTERN = /(<div class="swiper uv-product-slider"[^>]*>\s*<div class="swiper-wrapper">)([\s\S]*?)(<\/div>\s*<div class="swiper-button-prev">)/;
const THUMB_SLIDER_PATTERN = /(<div thumbsSlider="" class="swiper uv-product-slider-thumb">\s*<div class="swiper-wrapper">)([\s\S]*?)(<\/div>\s*<div class="swiper-button-prev">)/;
const IMAGE_SRC_PATTERN = /<img\b[^>]*\bsrc=(["'])([^"']*)\1/i;
const IMAGE_TITLE_PATTERN = /<img\b[^>]*\btitle=(["'])([^"']*)\1/i;
// Meta/JSON-LD icinde kacis gerektirmeyen, attribute ve JSON'da aynen yazilabilen yol.
const PLAIN_ASSET_PATH_PATTERN = /^[\w\-./:%?=+@~]+$/;
const ABSOLUTE_URL_PATTERN = /^(https?:)?\/\//i;
// og:image / itemprop="image" meta'lari (OG spesifikasyonu mutlak URL ister)
const IMAGE_META_PATTERN = /(<meta (?:property="og:image"|itemprop="image") content=")([^"]*)(")/g;

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// "../../uploads/x.jpg?v=1" ve "/uploads/x.jpg" ayni dosyayi gosterir.
function comparableImagePath(value) {
  const source = String(value || '').trim().split('?')[0];
  if (!source) return '';
  if (/^(https?:)?\/\//i.test(source) || source.startsWith('data:')) return source;
  const withoutRelativePrefix = source.replace(/^(\.\.\/)+/, '');
  return withoutRelativePrefix.startsWith('/') ? withoutRelativePrefix : `/${withoutRelativePrefix}`;
}

// Tarayicinin ve arama motorlarinin kullanacagi nihai yol: harici URL aynen,
// yerel yol ise "../../" on eki atilip kok-gorece ("/uploads/...") yazilir; sorgu korunur.
function publicImagePath(value) {
  const source = String(value || '').trim();
  if (ABSOLUTE_URL_PATTERN.test(source) || source.startsWith('data:')) return source;
  const withoutRelativePrefix = source.replace(/^(\.\.\/)+/, '');
  return withoutRelativePrefix.startsWith('/') ? withoutRelativePrefix : `/${withoutRelativePrefix}`;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Eski ana gorsel sayfada uc formda gecer: "../../uploads/x.jpg", "https://site/uploads/x.jpg",
// "uploads/x.jpg" (paylasim linki). Hepsini yakalar; origin on eki varsa korunur.
function replaceLegacyImageReferences(html, currentSrc, targetImage) {
  const currentPath = comparableImagePath(currentSrc).replace(/^\//, '');
  if (!currentPath || ABSOLUTE_URL_PATTERN.test(currentPath)) return html;

  const target = publicImagePath(targetImage);
  const pattern = new RegExp(
    `(https?:\\/\\/[^"'\\s/]+)?(?:(?:\\.\\./)+|/)?${escapeRegExp(currentPath)}(?:\\?[^"'\\s<&]*)?`,
    'g'
  );

  return html.replace(pattern, (match, origin) => (
    origin && !ABSOLUTE_URL_PATTERN.test(target) ? `${origin}${target}` : target
  ));
}

// Goreli ("../../uploads/x.jpg", "/uploads/x.jpg") gorsel meta'larini origin ile mutlak yazar;
// zaten mutlak olanlara ve data: URL'lere dokunmaz.
function ensureAbsoluteImageMeta(html, origin) {
  const base = String(origin || '').trim().replace(/\/+$/, '');
  if (!base) return html;

  return html.replace(IMAGE_META_PATTERN, (match, open, content, close) => {
    const value = String(content || '').trim();
    if (!value || ABSOLUTE_URL_PATTERN.test(value) || value.startsWith('data:')) return match;
    return `${open}${base}${publicImagePath(value)}${close}`;
  });
}

function renderSlides(image, title) {
  const safeImage = escapeHtml(image);
  const safeTitle = escapeHtml(title);
  return {
    main: `\n\t\t\t\t\t\t<div class="swiper-slide"><a data-fancybox="gallery" data-index="0" title="${safeTitle}" href="${safeImage}"><img class="img_zoom lazy" data-zoom-image="${safeImage}" data-og-src="${safeImage}" src="${safeImage}" title="${safeTitle}" alt="${safeTitle}"/></a></div>\n\t\t\t\t\t`,
    thumb: `\n\t\t\t\t\t<div class="swiper-slide thumbnail-slide"><img src="${safeImage}" data-zoom-image="${safeImage}" title="${safeTitle}" alt="${safeTitle}" /></div>\n\t\t\t\t`
  };
}

function synchronizeLegacyProductDetailImage(html, imageContext) {
  const source = String(html || '');
  if (!source || !imageContext || typeof imageContext !== 'object') return source;

  const mainMatch = source.match(MAIN_SLIDER_PATTERN);
  if (!mainMatch) return source;

  const currentSrc = (mainMatch[2].match(IMAGE_SRC_PATTERN) || [])[2] || '';
  const targetImage = String(imageContext.image || '').trim() || PLACEHOLDER_IMAGE;
  if (comparableImagePath(currentSrc) === comparableImagePath(targetImage)) {
    return ensureAbsoluteImageMeta(source, imageContext.origin);
  }

  const title = (mainMatch[2].match(IMAGE_TITLE_PATTERN) || [])[2] || '';
  const slides = renderSlides(targetImage, title);
  const withSliders = source
    .replace(MAIN_SLIDER_PATTERN, (match, open, slidesHtml, close) => `${open}${slides.main}${close}`)
    .replace(THUMB_SLIDER_PATTERN, (match, open, slidesHtml, close) => `${open}${slides.thumb}${close}`);

  // og:image, itemprop="image", JSON-LD ve paylasim linkleri de eski ana gorseli
  // icerir; yeni yol guvenli karakterlerden olusuyorsa hepsini yeni gorselle degistir.
  const withReferences = PLAIN_ASSET_PATH_PATTERN.test(targetImage)
    ? replaceLegacyImageReferences(withSliders, currentSrc, targetImage)
    : withSliders;
  return ensureAbsoluteImageMeta(withReferences, imageContext.origin);
}

module.exports = {
  comparableImagePath,
  synchronizeLegacyProductDetailImage
};
