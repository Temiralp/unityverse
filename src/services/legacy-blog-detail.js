const cheerio = require('cheerio');

const explicitGallerySelector = '.lj-gallery, .gallery, [data-blog-gallery]';

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

function galleryImage($, image, postTitle, index) {
  const $image = $(image);
  const src = $image.attr('src') || $image.attr('data-src') || $image.attr('data-original');
  if (!src) return null;

  return {
    src,
    srcset: $image.attr('srcset') || '',
    sizes: $image.attr('sizes') || '',
    alt: ($image.attr('alt') || `${postTitle} - Görsel ${index + 1}`).trim(),
    caption: $image.closest('figure').find('figcaption').first().text().replace(/\s+/g, ' ').trim()
  };
}

function renderGallery(images, heading, label) {
  const slides = images.map((image) => {
    const responsiveAttributes = [
      image.srcset ? ` srcset="${escapeAttribute(image.srcset)}"` : '',
      image.sizes ? ` sizes="${escapeAttribute(image.sizes)}"` : ''
    ].join('');
    const caption = image.caption
      ? `<figcaption class="uv-blog-gallery__caption">${escapeHtml(image.caption)}</figcaption>`
      : '';

    return `<figure class="swiper-slide uv-blog-gallery__slide">
      <img class="uv-blog-gallery__image" src="${escapeAttribute(image.src)}"${responsiveAttributes} alt="${escapeAttribute(image.alt)}" width="1200" height="900" loading="lazy" decoding="async">
      ${caption}
    </figure>`;
  }).join('\n');
  const title = heading
    ? `<h2 class="uv-blog-gallery__title">${escapeHtml(heading)}</h2>`
    : '';

  return `<section class="uv-blog-gallery" aria-label="${escapeAttribute(label)}">
    ${title}
    <div class="swiper uv-blog-gallery__slider" data-blog-gallery-slider data-slide-count="${images.length}">
      <div class="swiper-wrapper">
        ${slides}
      </div>
      <button type="button" class="swiper-button-prev uv-blog-gallery__nav uv-blog-gallery__nav--prev" aria-label="Önceki görsel"></button>
      <button type="button" class="swiper-button-next uv-blog-gallery__nav uv-blog-gallery__nav--next" aria-label="Sonraki görsel"></button>
      <div class="swiper-pagination uv-blog-gallery__pagination"></div>
    </div>
  </section>`;
}

function isImageOnlyBlock($, element) {
  const $element = $(element);
  const imageCount = $element.is('img') ? 1 : $element.find('img').length;
  if (!imageCount) return false;

  const $content = $element.clone();
  $content.find('img, br').remove();

  return !$content.text().replace(/\u00a0/g, ' ').trim();
}

function galleryImages($, elements, postTitle) {
  const imageElements = elements.flatMap((element) => (
    $(element).is('img') ? [element] : $(element).find('img').toArray()
  ));

  return imageElements
    .map((image, index) => galleryImage($, image, postTitle, index))
    .filter(Boolean);
}

function normalizeExplicitGalleries($, $root, postTitle) {
  $root.find(explicitGallerySelector).toArray()
    .filter((gallery) => !$(gallery).parents(explicitGallerySelector).length)
    .forEach((gallery) => {
      const $gallery = $(gallery);
      const images = galleryImages($, [gallery], postTitle);
      if (images.length < 2) return;

      const heading = $gallery.find('h1, h2, h3, h4, h5, h6')
        .first()
        .text()
        .replace(/\s+/g, ' ')
        .trim();
      $gallery.replaceWith(renderGallery(
        images,
        heading,
        heading || `${postTitle} görsel galerisi`
      ));
    });
}

function normalizeConsecutiveImageBlocks($, $root, postTitle) {
  const parents = [$root[0], ...$root.find('*').toArray()].reverse();

  parents.forEach((parent) => {
    const $parent = $(parent);
    if (!$parent.length || $parent.closest('.uv-blog-gallery').length) return;

    let group = [];
    const flushGroup = () => {
      if (!group.length) return;

      const images = galleryImages($, group, postTitle);
      if (images.length >= 2) {
        $(group[0]).replaceWith(renderGallery(images, '', `${postTitle} görsel galerisi`));
        group.slice(1).forEach((element) => $(element).remove());
      }
      group = [];
    };

    $parent.children().toArray().forEach((child) => {
      if ($(child).closest('.uv-blog-gallery').length || !isImageOnlyBlock($, child)) {
        flushGroup();
        return;
      }
      group.push(child);
    });
    flushGroup();
  });
}

function normalizeStandaloneImages($, $root, postTitle) {
  $root.find('img').not('.uv-blog-gallery__image').each((index, image) => {
    const $image = $(image);
    $image.addClass('uv-blog-content-image');
    if (!$image.attr('alt')) $image.attr('alt', `${postTitle} - Görsel ${index + 1}`);
    if (!$image.attr('loading')) $image.attr('loading', 'lazy');
    if (!$image.attr('decoding')) $image.attr('decoding', 'async');
  });
}

function normalizeLegacyBlogDetailContent(content, postTitle) {
  if (!content) return '';

  const $ = cheerio.load(`<div data-uv-blog-content-root>${content}</div>`, null, false);
  const $root = $('[data-uv-blog-content-root]').first();

  normalizeExplicitGalleries($, $root, postTitle);
  normalizeConsecutiveImageBlocks($, $root, postTitle);
  normalizeStandaloneImages($, $root, postTitle);

  return $root.html() || '';
}

module.exports = { normalizeLegacyBlogDetailContent };
