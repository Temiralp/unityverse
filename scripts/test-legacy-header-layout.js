const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  LEGACY_HEADER_LAYOUT_MARKER,
  LEGACY_HEADER_LAYOUT_VERSION,
  ensureLegacyHeaderLayout
} = require('../src/services/legacy-header-layout');
const { enhanceLegacyHtml } = require('../src/middleware/legacy-whatsapp');

function occurrences(value, needle) {
  return value.split(needle).length - 1;
}

const basicPage = '<!doctype html><html><head><title>Test</title></head><body><main>Content</main></body></html>';
const enhancedPage = enhanceLegacyHtml(basicPage);

assert(enhancedPage.includes(LEGACY_HEADER_LAYOUT_MARKER));
assert(enhancedPage.includes(`legacy-header-layout.css?v=${LEGACY_HEADER_LAYOUT_VERSION}`));
assert(enhancedPage.includes('legacy-whatsapp-appointment'));
assert.strictEqual(occurrences(enhancedPage, LEGACY_HEADER_LAYOUT_MARKER), 1);
assert.strictEqual(enhanceLegacyHtml(enhancedPage), enhancedPage);
assert.strictEqual(ensureLegacyHeaderLayout('<div>fragment</div>'), '<div>fragment</div>');
assert.strictEqual(ensureLegacyHeaderLayout(null), null);

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
  const transformedPage = ensureLegacyHeaderLayout(fs.readFileSync(filePath, 'utf8'));
  assert.strictEqual(
    occurrences(transformedPage, LEGACY_HEADER_LAYOUT_MARKER),
    1,
    `${path.relative(projectRoot, filePath)} should render exactly one header layout stylesheet`
  );
});

const layoutCss = fs.readFileSync(
  path.join(projectRoot, 'public/tema10/css/legacy-header-layout.css'),
  'utf8'
);
assert(layoutCss.includes('@media (min-width: 1200px)'));
assert(layoutCss.includes('#header.type_8 .header-top'));
assert(layoutCss.includes('height: 140px'));
assert(layoutCss.includes('pointer-events: none'));
assert(!layoutCss.includes('@media (max-width:'));

console.log(`Legacy header layout tests passed for ${publicHtmlFiles.length} public HTML pages.`);
