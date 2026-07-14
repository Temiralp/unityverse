const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  WHATSAPP_BUTTON_CLASS,
  ensureLegacyWhatsappButton
} = require('../src/services/legacy-whatsapp');
const {
  htmlFileCandidates,
  isPublicPageRequest
} = require('../src/middleware/legacy-whatsapp');

function occurrences(value, needle) {
  return value.split(needle).length - 1;
}

const basicPage = '<!doctype html><html><head><title>Test</title></head><body><main>Content</main></body></html>';
const injectedPage = ensureLegacyWhatsappButton(basicPage);

assert(injectedPage.includes('Bir uzman ile görüşün'));
assert(injectedPage.includes('phone=905454228887'));
assert(injectedPage.includes('data-legacy-whatsapp-style'));
assert(injectedPage.includes('<svg viewBox="0 0 24 24"'));
assert(injectedPage.includes('@media (max-width:767px)'));
assert.strictEqual(occurrences(injectedPage, `class="${WHATSAPP_BUTTON_CLASS}"`), 1);
assert.strictEqual(ensureLegacyWhatsappButton(injectedPage), injectedPage);
assert.strictEqual(ensureLegacyWhatsappButton('<div>fragment</div>'), '<div>fragment</div>');
assert.strictEqual(ensureLegacyWhatsappButton(null), null);

assert.strictEqual(isPublicPageRequest({ method: 'GET', path: '/urun/test/' }), true);
assert.strictEqual(isPublicPageRequest({ method: 'HEAD', path: '/blog/' }), true);
assert.strictEqual(isPublicPageRequest({ method: 'POST', path: '/urun/test/' }), false);
assert.strictEqual(isPublicPageRequest({ method: 'GET', path: '/admin' }), false);
assert.strictEqual(isPublicPageRequest({ method: 'GET', path: '/admin/products' }), false);
assert.strictEqual(isPublicPageRequest({ method: 'GET', path: '/api/products' }), false);
assert.strictEqual(isPublicPageRequest({ method: 'GET', path: '/odeme/basarili' }), true);

const staticRoot = path.resolve('/tmp/public-pages');
assert.deepStrictEqual(
  htmlFileCandidates(staticRoot, '/course/'),
  [path.join(staticRoot, 'course/index.html')]
);
assert.deepStrictEqual(
  htmlFileCandidates(staticRoot, '/course'),
  [path.join(staticRoot, 'course.html'), path.join(staticRoot, 'course/index.html')]
);
assert.deepStrictEqual(htmlFileCandidates(staticRoot, '/../secret.html'), []);
assert.deepStrictEqual(htmlFileCandidates(staticRoot, '/image.jpg'), []);

const projectRoot = path.resolve(__dirname, '..');
const publicPageRoots = [
  'blog',
  'blog-detay',
  'form',
  'kategori',
  'marka',
  'os',
  'sayfa',
  'sifremi-unuttum',
  'siparis-takip',
  'tum-urunler',
  'urun',
  'uye',
  'uye-girisi',
  'uye-ol'
];
const publicHtmlFiles = [path.join(projectRoot, 'index.html')];

function collectIndexFiles(directory) {
  fs.readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) collectIndexFiles(entryPath);
    if (entry.isFile() && entry.name === 'index.html') publicHtmlFiles.push(entryPath);
  });
}

publicPageRoots.forEach((directory) => collectIndexFiles(path.join(projectRoot, directory)));

publicHtmlFiles.forEach((filePath) => {
  const transformedPage = ensureLegacyWhatsappButton(fs.readFileSync(filePath, 'utf8'));
  assert.strictEqual(
    occurrences(transformedPage, `class="${WHATSAPP_BUTTON_CLASS}"`),
    1,
    `${path.relative(projectRoot, filePath)} should render exactly one WhatsApp button`
  );
  assert(transformedPage.includes('Bir uzman ile görüşün'));
  assert(transformedPage.includes('phone=905454228887'));
});

console.log(`Legacy WhatsApp button tests passed for ${publicHtmlFiles.length} public HTML pages.`);
