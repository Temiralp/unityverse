const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const {
  detectImageMimeType,
  hasMatchingImageSignature
} = require('../src/services/image-signatures');
const {
  normalizeLocalProductImagePath,
  sanitizeProductTabContent
} = require('../src/services/product-content');
const {
  buildProductEditorTabs,
  buildProductFormTabs,
  normalizeProductTabSubmission
} = require('../src/services/product-tabs');

assert.equal(
  normalizeLocalProductImagePath('../../uploads/fm/course.jpg?v=1'),
  '/uploads/fm/course.jpg?v=1'
);
assert.equal(
  normalizeLocalProductImagePath('./uploads/products/new.webp'),
  '/uploads/products/new.webp'
);
assert.equal(normalizeLocalProductImagePath('/uploads/../private.txt'), '');
assert.equal(
  normalizeLocalProductImagePath('https://cdn.example.com/course.jpg'),
  'https://cdn.example.com/course.jpg'
);

const cleanHtml = sanitizeProductTabContent(`
  <p style="text-align: center; position: fixed" onclick="alert(1)">Ders</p>
  <img src="../../uploads/fm/course.jpg?v=1" onerror="alert(1)" style="width: 80%; behavior: url(x)">
  <a href="javascript:alert(1)" target="_blank">Kötü</a>
  <a href="https://example.com" target="_blank">İyi</a>
  <iframe src="https://evil.example/embed/1"></iframe>
  <script>alert(1)</script>
`);

assert.match(cleanHtml, /src="\/uploads\/fm\/course\.jpg\?v=1"/);
assert.match(cleanHtml, /loading="lazy"/);
assert.match(cleanHtml, /style="text-align:center"/);
assert.match(cleanHtml, /style="width:80%"/);
assert.match(cleanHtml, /rel="noopener noreferrer"/);
assert.doesNotMatch(cleanHtml, /onclick|onerror|javascript:|position:|behavior:|evil\.example|<script/i);

const unsafeDataImage = sanitizeProductTabContent('<img src="data:image/svg+xml;base64,PHN2Zy8+">');
assert.doesNotMatch(unsafeDataImage, /src=/);

const storedVideo = sanitizeProductTabContent(
  '<iframe src="https://www.youtube.com/embed/Pdu7BUdAsk4?origin=http%3A%2F%2Flocalhost%3A8000"></iframe>'
);
assert.match(storedVideo, /youtube-nocookie\.com\/embed\/Pdu7BUdAsk4/);
assert.match(storedVideo, /referrerpolicy="strict-origin-when-cross-origin"/);
assert.doesNotMatch(storedVideo, /origin=/);

const editorVideo = buildProductEditorTabs([{
  systemKey: 'OVERVIEW',
  content: storedVideo
}], 'http://localhost:8000')[0].content;
assert.match(editorVideo, /origin=http%3A%2F%2Flocalhost%3A8000/);
assert.match(editorVideo, /referrerpolicy="strict-origin-when-cross-origin"/);

const tabs = buildProductFormTabs([{ systemKey: 'OVERVIEW', content: '<img src="../../uploads/fm/a.jpg">' }]);
assert.match(tabs[0].content, /src="\/uploads\/fm\/a\.jpg"/);
assert.match(
  normalizeProductTabSubmission([{ systemKey: 'OVERVIEW', content: '<img src="../uploads/fm/b.jpg">' }])[0].content,
  /src="\/uploads\/fm\/b\.jpg"/
);

const png = Buffer.from('89504e470d0a1a0a00000000', 'hex');
const jpeg = Buffer.from('ffd8ffe000104a464946', 'hex');
const gif = Buffer.from('47494638396100000000', 'hex');
const webp = Buffer.from('524946460400000057454250', 'hex');
const avif = Buffer.concat([
  Buffer.from('00000018667479706176696600000000', 'hex'),
  Buffer.from('617669666d696631', 'hex')
]);

assert.equal(detectImageMimeType(png), 'image/png');
assert.equal(detectImageMimeType(jpeg), 'image/jpeg');
assert.equal(detectImageMimeType(gif), 'image/gif');
assert.equal(detectImageMimeType(webp), 'image/webp');
assert.equal(detectImageMimeType(avif), 'image/avif');
assert.equal(hasMatchingImageSignature(png, 'image/png'), true);
assert.equal(hasMatchingImageSignature(png, 'image/jpeg'), false);
assert.equal(hasMatchingImageSignature(Buffer.from('<script>'), 'image/png'), false);

const editorSource = fs.readFileSync(
  path.resolve(__dirname, '../public/tema10/js/admin-product-editor.js'),
  'utf8'
);
const adminRouteSource = fs.readFileSync(
  path.resolve(__dirname, '../src/routes/admin.js'),
  'utf8'
);
assert.match(editorSource, /normalizedSource/);
assert.match(editorSource, /\(\?=uploads\\\/\)/);
assert.match(adminRouteSource, /res\.setHeader\('Referrer-Policy', 'strict-origin-when-cross-origin'\)/);
assert.match(adminRouteSource, /buildProductEditorTabs\(/);
assert.match(adminRouteSource, /const pageOrigin = `\$\{req\.protocol\}:\/\/\$\{req\.get\('host'\)\}`/);

console.log('Product content image tests passed.');
