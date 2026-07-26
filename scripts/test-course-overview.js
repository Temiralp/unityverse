const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const overviewScript = fs.readFileSync(
  path.join(root, 'public/tema10/js/course-overview.js'),
  'utf8'
);
const productRoute = fs.readFileSync(
  path.join(root, 'src/routes/legacy-product-detail.js'),
  'utf8'
);

function classList() {
  const values = new Set();

  return {
    add(value) {
      values.add(value);
    },
    contains(value) {
      return values.has(value);
    }
  };
}

const longHeading = {
  classList: classList(),
  textContent: 'Bu metin yanlışlıkla başlık elementi içinde saklanan uzun bir eğitim açıklamasıdır. '.repeat(4)
};
const shortHeading = {
  classList: classList(),
  textContent: 'Eğitime İlk Bakış'
};
const overviewWrapper = {
  classList: classList(),
  tagName: 'DIV',
  textContent: ''
};
const orphanText = {
  classList: classList(),
  parentElement: overviewWrapper,
  querySelector() {
    return null;
  },
  tagName: 'SPAN',
  textContent: 'Bu metin kendi paragraf kapsayıcısı olmadan doğrudan içerik alanında bulunuyor.'
};
const nestedText = {
  classList: classList(),
  parentElement: orphanText,
  querySelector() {
    return null;
  },
  tagName: 'SPAN',
  textContent: orphanText.textContent
};
const paragraph = { tagName: 'P', parentElement: overviewWrapper };
const paragraphText = {
  classList: classList(),
  parentElement: paragraph,
  querySelector() {
    return null;
  },
  tagName: 'SPAN',
  textContent: 'Bu metin zaten bir paragraf içinde bulunduğu için konumu değiştirilmemelidir.'
};
const imageContainer = {
  classList: classList(),
  parentElement: overviewWrapper,
  tagName: 'P',
  textContent: ''
};
const overviewImage = {
  classList: classList(),
  parentElement: imageContainer,
  loading: '',
  decoding: ''
};
const imageLink = {
  classList: classList(),
  parentElement: overviewWrapper,
  tagName: 'A'
};
const linkedOverviewImage = {
  classList: classList(),
  parentElement: imageLink,
  loading: 'eager',
  decoding: 'sync'
};
const overview = {
  classList: classList(),
  dataset: {},
  querySelectorAll(selector) {
    if (selector === 'h1,h2,h3,h4,h5,h6') return [longHeading, shortHeading];
    if (selector === 'span,strong,b,em') return [orphanText, nestedText, paragraphText];
    if (selector === 'img') return [overviewImage, linkedOverviewImage];
    return [];
  }
};
overviewWrapper.parentElement = overview;
let installedStyle = '';
const document = {
  readyState: 'complete',
  head: {
    appendChild(style) {
      installedStyle = style.textContent;
    }
  },
  createElement() {
    return { id: '', textContent: '' };
  },
  getElementById() {
    return null;
  },
  querySelector(selector) {
    return selector === '[data-course-overview]' ? overview : null;
  }
};

vm.runInNewContext(overviewScript, { document });

assert.equal(overview.dataset.courseOverviewReady, 'true');
assert(overview.classList.contains('uv-course-overview'));
assert(longHeading.classList.contains('uv-overview-prose-heading'));
assert(!shortHeading.classList.contains('uv-overview-prose-heading'));
assert(orphanText.classList.contains('uv-overview-orphan-text-block'));
assert(!nestedText.classList.contains('uv-overview-orphan-text-block'));
assert(!paragraphText.classList.contains('uv-overview-orphan-text-block'));
assert(overviewImage.classList.contains('uv-overview-image'));
assert(overviewImage.classList.contains('uv-overview-centered-media'));
assert.equal(overviewImage.loading, 'lazy');
assert.equal(overviewImage.decoding, 'async');
assert(linkedOverviewImage.classList.contains('uv-overview-image'));
assert(!linkedOverviewImage.classList.contains('uv-overview-centered-media'));
assert(imageLink.classList.contains('uv-overview-image-link'));
assert(imageLink.classList.contains('uv-overview-centered-media'));
assert.equal(linkedOverviewImage.loading, 'eager');
assert.equal(linkedOverviewImage.decoding, 'sync');
assert.match(installedStyle, /font-size:clamp\(14\.5px,1\.2vw,16\.5px\)!important/);
assert.match(installedStyle, /\.uv-overview-prose-heading strong/);
assert.match(
  installedStyle,
  /\.uv-overview-orphan-text-block\{display:block;width:min\(100%,860px\);margin-left:0!important;margin-right:auto!important;\}/
);
assert.doesNotMatch(installedStyle, /\.uv-overview-orphan-text-block\{[^}]*text-align/);
assert.match(installedStyle, /\.uv-course-overview\{container-type:inline-size;width:100%;max-width:none;margin:0;/);
assert.match(installedStyle, /h6\{clear:both;max-width:860px;margin:clamp\(26px,4vw,44px\) 0 14px;/);
assert.match(installedStyle, /\.uv-overview-prose-heading\{max-width:860px;margin:0 0 18px!important;/);
assert.match(installedStyle, /p\{max-width:860px;margin:0 0 16px;\}/);
assert.match(installedStyle, /ul,.uv-course-overview ol\{max-width:860px;margin:12px 0 20px;/);
assert.match(installedStyle, /\.uv-overview-centered-media\{position:relative;left:calc\(50cqw - 50%\);\}/);
assert.match(installedStyle, /\.uv-overview-gallery-item \.uv-overview-centered-media\{position:static;left:auto;\}/);
assert.match(installedStyle, /max-width:min\(100%,600px\)!important/);
assert.match(installedStyle, /margin:22px auto;border-radius:12px;object-fit:contain/);
assert.match(installedStyle, /max-height:min\(72vh,720px\)/);
assert.match(productRoute, /course-overview\.js\?v=20260726-2/);
assert.equal(
  (productRoute.match(/course-overview\.js\?v=20260726-2/g) || []).length,
  1
);

console.log('Course overview left-aligned prose and centered media layout tests passed.');
