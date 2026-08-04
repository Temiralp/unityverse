const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const form = fs.readFileSync(path.join(root, 'src/views/admin/products/form.ejs'), 'utf8');
const list = fs.readFileSync(path.join(root, 'src/views/admin/products/index.ejs'), 'utf8');
const editor = fs.readFileSync(path.join(root, 'public/tema10/js/admin-product-editor.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'admin.css'), 'utf8');
const adminRoutes = fs.readFileSync(path.join(root, 'src/routes/admin.js'), 'utf8');
const ejs = require('ejs');

ejs.compile(form, { filename: path.join(root, 'src/views/admin/products/form.ejs') });
ejs.compile(list, { filename: path.join(root, 'src/views/admin/products/index.ejs') });

assert.match(form, /<h2>Eğitim Süreleri<\/h2>/);
assert.match(form, /data-add-duration>Süre Ekle<\/button>/);
assert.match(form, /Array\.isArray\(productVariants\)/);
assert.match(form, /product \? product\.duration \|\| '' : ''/);
assert.match(form, /product && product\.price != null \? product\.price : ''/);
assert.match(form, /name="variants\[<%= index %>\]\[label\]"[\s\S]*?maxlength="80" required/);
assert.match(form, /name="variants\[<%= index %>\]\[price\]"[\s\S]*?min="0\.01"[\s\S]*?required/);
assert.match(form, /name="variants\[<%= index %>\]\[status\]"/);
assert.match(form, /name="status" data-parent-product-status required/);
assert.match(form, /Ana kurs taslaksa hiçbir eğitim süresi katalogda görünmez/);
assert.match(form, /Kurs yayında, fakat yayında eğitim süresi olmadığı için katalogda görünmüyor/);
assert.doesNotMatch(form, /yayın durumu eğitim sürelerinden otomatik hesaplanır/);
assert.match(form, /value="PUBLISHED"[^>]*>Yayında/);
assert.match(form, /value="DRAFT"[^>]*>Taslak/);
assert.match(form, /name="variants\[<%= index %>\]\[isActivePresent\]"/);
assert.match(form, /name="variants\[<%= index %>\]\[isActive\]"/);
assert.match(form, /name="defaultVariantIndex"/);
assert.match(form, /durationRows\.length <= 1 \? 'hidden' : ''/);
assert.match(form, /role="status" aria-live="polite"/);
assert.doesNotMatch(form, /data-variant-search|variant-candidates-url|Bağlı Kurs/);

assert.match(editor, /\['id', 'variantProductId', 'label', 'price', 'status', 'sortOrder', 'isActivePresent', 'isActive'\]/);
assert.match(editor, /durationList\.appendChild\(durationTemplate\.content\.cloneNode\(true\)\)/);
assert.match(editor, /row\.querySelector\('\[data-field="label"\]'\)\.focus\(\)/);
assert.match(editor, /isPublished \? '1' : '0'/);
assert.match(editor, /form\.dataset\.managedVariantGroup === 'true'/);
assert.match(editor, /form\.querySelectorAll\('\[data-duration-row\]'\)\.length > 1/);
assert.match(editor, /data-remove-duration/);
assert.doesNotMatch(editor, /refreshVariantCandidates|candidateMatchesSearch|data-variant-search/);

assert.match(styles, /\.product-duration-row\s*\{/);
assert.match(styles, /@media \(max-width: 760px\)[\s\S]*?\.product-duration-row/);
assert.match(styles, /@media \(min-width: 761px\) and \(max-width: 1180px\)[\s\S]*?\.product-duration-row/);

assert.match(adminRoutes, /where\.variantOfProducts = \{ none: \{\} \};/);
assert.match(adminRoutes, /productVariants:\s*\{\s*some:\s*\{\s*isArchived: false,[\s\S]*?variantProduct:[\s\S]*?duration: \{ contains: q/);
assert.match(adminRoutes, /variantProduct: \{ is: \{ price: priceFilter \} \}/);
assert.match(adminRoutes, /productVariants:\s*\{\s*where: \{ isArchived: false \},\s*include: \{ variantProduct: true \}/);
assert.match(adminRoutes, /where: \{ variantProductId: requestedProductId \}/);
assert.match(adminRoutes, /res\.redirect\(302, `\/admin\/products\/\$\{parentLink\.parentProductId\}\/edit`\)/);
assert.match(adminRoutes, /res\.redirect\(303, `\/admin\/products\/\$\{parentLink\.parentProductId\}\/edit`\)/);
assert.match(adminRoutes, /status: normalizePublishStatus\(body\.status\)/);
assert.match(adminRoutes, /setParentProductStatus\(tx, productId, data\.status/);
assert.match(adminRoutes, /cascadeDraft: currentProduct\.status === 'PUBLISHED' && data\.status === 'DRAFT'/);
assert.doesNotMatch(adminRoutes, /recalculateVariantParentStatus|recalculateParentsForVariantProduct/);
assert.match(list, /const hasDurationVariants = Array\.isArray\(product\.productVariants\)/);
assert.match(list, /variant\.variantProduct\.price %> TL/);
assert.match(list, /hasDurationVariants \? 'Süreleri Yönet' : 'Düzenle'/);
assert.match(list, /action="\/admin\/products\/<%= product\.id %>\/status"/);
assert.match(list, /Yayında süre olmadığı için katalogda görünmüyor/);
assert.match(styles, /\.admin-duration-summary\s*\{/);

console.log('Admin product duration form tests passed.');
