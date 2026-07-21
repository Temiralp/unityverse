const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const form = fs.readFileSync(path.join(root, 'src/views/admin/products/form.ejs'), 'utf8');
const editor = fs.readFileSync(path.join(root, 'public/tema10/js/admin-product-editor.js'), 'utf8');
const adminRoutes = fs.readFileSync(path.join(root, 'src/routes/admin.js'), 'utf8');
const { findProductVariantCandidates } = require('../src/routes/admin');

assert.match(form, /Görünen Süre/);
assert.match(form, /Boş bırakılırsa bağlı kursun Süre değeri/);
assert.doesNotMatch(form, /Görünən Müddət|Boşsa bağlı kursun Süre dəyəri/);
assert.match(form, /data-variant-candidates-url="\/admin\/products\/variant-candidates"/);
assert.match(form, /data-variant-search/);
assert.match(form, /Kurs adı veya ID ile ara/);
assert.match(editor, /refreshVariantCandidates/);
assert.match(editor, /candidateMatchesSearch/);
assert.match(editor, /toLocaleLowerCase\('tr-TR'\)/);
assert.match(editor, /event\.target\.matches\('\[data-field="variantProductId"\]'\)/);
assert.match(editor, /data-field="variantProductId"/);
assert.match(adminRoutes, /router\.get\('\/products\/variant-candidates'/);
assert.match(adminRoutes, /findProductVariantCandidates\(prisma, req\.query\.excludeId\)/);

async function candidateQueryTest() {
  let query = null;
  const products = await findProductVariantCandidates({
    product: {
      async findMany(args) {
        query = args;
        return [{ id: 2, title: 'Yeni Kurs', status: 'DRAFT' }];
      }
    }
  }, '1');

  assert.deepEqual(query, {
    where: { id: { not: 1 } },
    select: { id: true, title: true, duration: true, status: true },
    orderBy: [{ title: 'asc' }, { id: 'asc' }]
  });
  assert.equal(products[0].title, 'Yeni Kurs');
}

candidateQueryTest()
  .then(() => console.log('Admin product variant form tests passed.'))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
