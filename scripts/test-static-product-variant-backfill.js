const assert = require('assert/strict');
const path = require('path');

const {
  applyVariantGroups,
  discoverStaticVariantGroups,
  optionsFromHtml
} = require('./backfill-static-product-variants');

const parsed = optionsFromHtml(`
  <div class="attr-detail attr-size">
    <ul name="poptions1_1">
      <li data-product-id="2" producturl="../../urun/course-30" data-bs-title="30 SAAT"></li>
      <li data-product-id="3" producturl="../../urun/course-60" data-bs-title="60 SAAT"></li>
    </ul>
  </div>
`);
assert.deepEqual(parsed, [
  { slug: 'course-30', label: '30 SAAT' },
  { slug: 'course-60', label: '60 SAAT' }
]);

const productRoot = path.resolve(__dirname, '../urun');
const discovery = discoverStaticVariantGroups(productRoot);
const illustrator = discovery.groups.find((group) => (
  group.parentSlug === 'adobe-illustrator-onlinecanli-ozel-ders-835'
));

assert.ok(illustrator, 'CS142 Adobe Illustrator parent group must be discoverable.');
assert.deepEqual(
  illustrator.options.map((option) => [option.slug, option.label]),
  [
    ['adobe-illustrator-onlinecanli-ozel-ders-12-saat-1389', '12 SAAT'],
    ['adobe-illustrator-onlinecanli-ozel-ders-24-saat-1390', '24 SAAT'],
    ['adobe-illustrator-onlinecanli-ozel-ders-48-saat-1391', '48 SAAT'],
    ['adobe-illustrator-onlinecanli-ozel-ders-6-saat-1392', '6 SAAT']
  ]
);
assert.ok(discovery.groups.length >= 18, 'Expected the reviewed static catalog to expose multi-duration groups.');
assert.ok(discovery.warnings.some((warning) => warning.type === 'duplicate-label'));

async function idempotencyTest() {
  const products = [
    { id: 1, slug: 'parent', status: 'PUBLISHED' },
    { id: 2, slug: 'child-30', status: 'PUBLISHED' },
    { id: 3, slug: 'child-60', status: 'DRAFT' }
  ];
  const links = [];
  let nextId = 1;
  let updateCalls = 0;
  const tx = {
    product: {
      async findMany({ where }) {
        return products.filter((product) => where.slug.in.includes(product.slug));
      }
    },
    productVariant: {
      async findMany({ where }) {
        if (where.variantProductId) {
          return links.filter((link) => (
            where.variantProductId.in.includes(link.variantProductId)
            && link.parentProductId !== where.parentProductId.not
          ));
        }
        return links.filter((link) => link.parentProductId === where.parentProductId);
      },
      async create({ data }) {
        const link = { id: nextId++, ...data };
        links.push(link);
        return link;
      },
      async update() {
        updateCalls += 1;
      }
    }
  };
  const prisma = { async $transaction(callback) { return callback(tx); } };
  const groups = [{
    parentSlug: 'parent',
    options: [
      { slug: 'child-30', label: '30 SAAT', sortOrder: 0 },
      { slug: 'child-60', label: '60 SAAT', sortOrder: 1 }
    ]
  }];

  const first = await applyVariantGroups(prisma, groups);
  links[0].label = 'Admin label';
  links[0].sortOrder = 99;
  links[0].isActive = false;
  const second = await applyVariantGroups(prisma, groups);

  assert.equal(first.createdLinks, 2);
  assert.equal(second.createdLinks, 0);
  assert.equal(second.preservedLinks, 2);
  assert.equal(updateCalls, 0);
  assert.equal(links[0].label, 'Admin label');
  assert.equal(links[0].sortOrder, 99);
  assert.equal(links[0].isActive, false);
}

idempotencyTest()
  .then(() => console.log('Static product variant backfill discovery tests passed.'))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
