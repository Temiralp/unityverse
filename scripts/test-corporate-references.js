const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  corporateReferenceLogoFilePath,
  isSafeCorporateReferenceLogoPath,
  normalizeCorporateReferenceOrder,
  validateCorporateReferenceForm
} = require('../src/services/corporate-references');
const {
  synchronizeLegacyCorporateReferences,
  visibleCorporateReferences
} = require('../src/services/legacy-corporate-references');
const {
  createLegacyCorporateReferences,
  isLegacyHomepageRequest
} = require('../src/middleware/legacy-corporate-references');
const { detectImageMimeType } = require('../src/services/image-signatures');

const root = path.resolve(__dirname, '..');
const migration = fs.readFileSync(
  path.join(root, 'prisma/migrations/20260803150000_add_corporate_references/migration.sql'),
  'utf8'
);
const homepage = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const adminRoute = fs.readFileSync(path.join(root, 'src/routes/admin.js'), 'utf8');
const adminIndex = fs.readFileSync(
  path.join(root, 'src/views/admin/corporate-references/index.ejs'),
  'utf8'
);
const sliderScript = fs.readFileSync(
  path.join(root, 'public/tema10/js/legacy-corporate-references.js'),
  'utf8'
);
const sliderStyles = fs.readFileSync(
  path.join(root, 'public/tema10/css/legacy-corporate-references.css'),
  'utf8'
);
const adminScript = fs.readFileSync(
  path.join(root, 'public/tema10/js/admin-corporate-references.js'),
  'utf8'
);
const adminStyles = fs.readFileSync(path.join(root, 'admin.css'), 'utf8');

const references = [
  {
    id: 1,
    name: 'Türkiye İş Bankası & Güven <script>',
    logoPath: '/uploads/corporate-references/is-bankasi.png'
  },
  {
    id: 2,
    name: 'BTM',
    logoPath: '/uploads/corporate-references/btm.png'
  },
  {
    id: 3,
    name: 'Harici',
    logoPath: 'https://example.com/external.png'
  },
  {
    id: 4,
    name: 'Traversal',
    logoPath: '/uploads/corporate-references/../products/external.png'
  }
];

assert.strictEqual(validateCorporateReferenceForm({ name: '' }, true), 'Kurum adı zorunludur.');
assert.strictEqual(validateCorporateReferenceForm({ name: 'Test' }, false), 'Logo görseli zorunludur.');
assert.strictEqual(validateCorporateReferenceForm({ name: 'Test' }, true), null);
assert.deepStrictEqual(normalizeCorporateReferenceOrder('3,2,2,x,1'), [3, 2, 1]);
assert.ok(corporateReferenceLogoFilePath('/uploads/corporate-references/test.png'));
assert.strictEqual(corporateReferenceLogoFilePath('/uploads/products/test.png'), null);
assert.strictEqual(isSafeCorporateReferenceLogoPath('/uploads/corporate-references/test-name_2.webp'), true);
assert.strictEqual(isSafeCorporateReferenceLogoPath('/uploads/corporate-references/../products/test.png'), false);
assert.strictEqual(isSafeCorporateReferenceLogoPath('/uploads/corporate-references/test.svg'), false);
assert.strictEqual(isSafeCorporateReferenceLogoPath('https://example.com/test.png'), false);
assert.deepStrictEqual(visibleCorporateReferences(references).map((item) => item.id), [1, 2]);

const rendered = synchronizeLegacyCorporateReferences(homepage, references);
assert.strictEqual((rendered.match(/corporate-reference-section--desktop/g) || []).length, 1);
assert.strictEqual((rendered.match(/corporate-reference-section--mobile/g) || []).length, 1);
assert.strictEqual((rendered.match(/legacy-corporate-references\.css/g) || []).length, 1);
assert.strictEqual((rendered.match(/legacy-corporate-references\.js/g) || []).length, 1);
assert.strictEqual((rendered.match(/Türkiye İş Bankası &amp; Güven &lt;script&gt;/g) || []).length, 2);
assert.ok(!rendered.includes('https://example.com/external.png'));
assert.ok(!rendered.includes('./uploads/p/cd/JPNuanLj73k0.webp'));
assert.ok(rendered.includes('corporate-reference-slider__logo--dark'));
assert.strictEqual(synchronizeLegacyCorporateReferences(rendered, references), rendered);

const emptyRendered = synchronizeLegacyCorporateReferences(homepage, []);
assert.ok(!emptyRendered.includes('./uploads/p/cd/JPNuanLj73k0.webp'));
assert.ok(!emptyRendered.includes('corporate-reference-section--desktop'));

assert.strictEqual(isLegacyHomepageRequest({ method: 'GET', path: '/' }), true);
assert.strictEqual(isLegacyHomepageRequest({ method: 'HEAD', path: '/index.html' }), true);
assert.strictEqual(isLegacyHomepageRequest({ method: 'GET', path: '/urun/test/' }), false);

let findManyOptions = null;
const middleware = createLegacyCorporateReferences({
  corporateReference: {
    async findMany(options) {
      findManyOptions = options;
      return references.slice(0, 2);
    }
  }
});
const response = { locals: {} };
middleware({ method: 'GET', path: '/' }, response, (error) => {
  assert.ifError(error);
  assert.strictEqual(response.locals.legacyCorporateReferences.length, 2);
});
assert.deepStrictEqual(findManyOptions.where, { isActive: true });
assert.deepStrictEqual(findManyOptions.orderBy, [{ sortOrder: 'asc' }, { id: 'asc' }]);

const seededLogoPaths = [...migration.matchAll(/'\/uploads\/corporate-references\/([^']+)'/g)]
  .map((match) => match[1]);
assert.strictEqual(seededLogoPaths.length, 16);
assert.strictEqual(new Set(seededLogoPaths).size, 16);
seededLogoPaths.forEach((fileName) => {
  const filePath = path.join(root, 'uploads/corporate-references', fileName);
  assert.ok(fs.existsSync(filePath), `Eksik logo: ${fileName}`);
  assert.strictEqual(detectImageMimeType(fs.readFileSync(filePath)), 'image/png', `Geçersiz PNG: ${fileName}`);
});

assert.ok(adminRoute.includes('CORPORATE_REFERENCE_IMAGE_MAX_SIZE'));
assert.ok(adminRoute.includes('hasMatchingImageSignature(req.file.buffer, req.file.mimetype)'));
assert.ok(adminRoute.includes("'/corporate-references/reorder/save'"));
assert.ok(adminIndex.includes('name="_csrf"'));
assert.ok(adminIndex.includes('data-move="up"'));
assert.ok(adminIndex.includes('draggable="true"'));
assert.ok(adminIndex.includes('data-logo-preview'));
assert.ok(adminIndex.includes('role="dialog"'));
assert.ok(adminIndex.includes('aria-modal="true"'));
assert.ok(adminIndex.includes('aria-haspopup="dialog"'));
assert.ok(sliderScript.includes('window.setInterval'));
assert.ok(sliderScript.includes("'(prefers-reduced-motion: reduce)'"));
assert.ok(sliderScript.includes('document.hidden'));
assert.ok(sliderStyles.includes('.tm-dis section.corporate-reference-section'));
assert.ok(sliderStyles.includes('max-width: 1880px'));
assert.ok(sliderStyles.includes('width: calc(100% - 24px)'));
assert.ok(sliderStyles.includes('var(--renk1, #13005a)'));
assert.ok(sliderStyles.includes('min-width: 0 !important'));
assert.ok(sliderStyles.includes('min-height: 0 !important'));
assert.ok(sliderStyles.includes('object-fit: contain !important'));
assert.ok(sliderStyles.includes('object-position: center !important'));
assert.ok(adminStyles.includes('height: 52px'));
assert.ok(adminStyles.includes('width: 88px'));
assert.ok(adminStyles.includes('.corporate-reference-modal::backdrop'));
assert.ok(adminStyles.includes('max-height: 72vh'));
assert.ok(adminScript.includes("previewDialog.showModal()"));
assert.ok(adminScript.includes("previewDialog.addEventListener('cancel'"));
assert.ok(adminScript.includes('previewTrigger.focus()'));
assert.ok(adminScript.includes("event.target.closest('[data-logo-preview]')"));
assert.ok(!adminScript.includes('innerHTML'));

console.log('Kurumsal referans testleri geçti: 16 logo, tam contain görünümü, modal, güvenlik ve slider doğrulandı.');
