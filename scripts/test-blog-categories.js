#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const { BLOG_CATEGORIES, blogCategoryByLegacyId } = require('../src/config/blog-categories');
const { parseBlogFile } = require('./migrate-blog');

const rootDir = path.resolve(__dirname, '..');
const migrationPath = path.join(
  rootDir,
  'prisma/migrations/20260716120000_add_blog_categories/migration.sql'
);

function compactText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function detailCategory(slug) {
  const filePath = path.join(rootDir, 'blog-detay', slug, 'index.html');
  const $ = cheerio.load(fs.readFileSync(filePath, 'utf8'));
  const link = $('ul.breadcrumb li a[href*="/blog/"]').last();
  const match = String(link.attr('href') || '').match(/\/blog\/(\d+)\/?/);

  assert(match, `Missing blog category breadcrumb for ${slug}`);
  return {
    legacyId: Number.parseInt(match[1], 10),
    name: compactText(link.text())
  };
}

assert.strictEqual(BLOG_CATEGORIES.length, 12);
assert.deepStrictEqual(
  BLOG_CATEGORIES.map((category) => category.legacyId),
  Array.from({ length: 12 }, (_, index) => index + 1)
);
assert.strictEqual(new Set(BLOG_CATEGORIES.map((category) => category.legacyId)).size, 12);
assert.strictEqual(blogCategoryByLegacyId('10').legacyId, 10);
assert.strictEqual(blogCategoryByLegacyId('999'), null);

const detailDirectories = fs.readdirSync(path.join(rootDir, 'blog-detay'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort((a, b) => a.localeCompare(b));
const detailCategories = new Map(detailDirectories.map((slug) => [slug, detailCategory(slug)]));
const detailCounts = new Map(BLOG_CATEGORIES.map((category) => [category.legacyId, 0]));

detailCategories.forEach((category, slug) => {
  const configured = blogCategoryByLegacyId(category.legacyId);
  assert(configured, `Unknown category ${category.legacyId} for ${slug}`);
  assert.strictEqual(category.name, configured.name, `Category name mismatch for ${slug}`);
  detailCounts.set(category.legacyId, detailCounts.get(category.legacyId) + 1);
});

const expectedCounts = new Map([
  [1, 12], [2, 12], [3, 12], [4, 3], [5, 12], [6, 12],
  [7, 12], [8, 0], [9, 2], [10, 21], [11, 12], [12, 12]
]);
assert.deepStrictEqual(detailCounts, expectedCounts);

for (const configured of BLOG_CATEGORIES) {
  const categoryPath = path.join(rootDir, 'blog', String(configured.legacyId), 'index.html');
  const $ = cheerio.load(fs.readFileSync(categoryPath, 'utf8'));
  const canonical = $('link[rel="canonical"]').attr('href');
  const title = compactText($('h1.modtitle').first().text());
  const cardSlugs = new Set();

  $('.products-list.ana_urunler a[href*="/blog-detay/"]').each((index, anchor) => {
    const match = String($(anchor).attr('href') || '').match(/\/blog-detay\/([^/]+)\/?/);
    if (match) cardSlugs.add(match[1]);
  });

  assert.strictEqual(title, configured.name);
  assert.strictEqual(canonical, `https://unityverseacademy.com/blog/${configured.legacyId}/`);
  cardSlugs.forEach((slug) => {
    assert(detailCategories.has(slug), `Missing detail page for ${slug}`);
    assert.strictEqual(
      detailCategories.get(slug).legacyId,
      configured.legacyId,
      `Static category ${configured.legacyId} contains ${slug} from another category`
    );
  });
}

const migrationSql = fs.readFileSync(migrationPath, 'utf8');
detailDirectories.forEach((slug) => {
  assert(migrationSql.includes(`('${slug.replaceAll("'", "''")}',`), `Migration mapping missing ${slug}`);
});
assert(migrationSql.includes('lootjam-gerceklestirdi-314\', 1)'));
const migrationMappings = [...migrationSql.matchAll(/\('((?:''|[^'])+)', (\d+)\)/g)]
  .map((match) => ({ slug: match[1].replaceAll("''", "'"), legacyId: Number.parseInt(match[2], 10) }));
assert.strictEqual(migrationMappings.length, 123);
assert.strictEqual(new Set(migrationMappings.map((mapping) => mapping.slug)).size, 123);
const migrationCounts = new Map(BLOG_CATEGORIES.map((category) => [category.legacyId, 0]));
migrationMappings.forEach((mapping) => {
  assert(blogCategoryByLegacyId(mapping.legacyId), `Unknown migration category ${mapping.legacyId}`);
  migrationCounts.set(mapping.legacyId, migrationCounts.get(mapping.legacyId) + 1);
});
assert.strictEqual(migrationCounts.get(1), 13);
for (const [legacyId, count] of expectedCounts) {
  if (legacyId !== 1) assert.strictEqual(migrationCounts.get(legacyId), count);
}

const parsedSuccessStory = parseBlogFile(path.join(
  rootDir,
  'blog-detay/mezunumuz-burak-yilmazin-basari-hikayesi-265/index.html'
));
assert.strictEqual(parsedSuccessStory.meta.legacyCategoryId, 10);
const parsedCategoryNine = parseBlogFile(path.join(rootDir, 'blog-detay/renk-teorisi-73/index.html'));
assert.strictEqual(parsedCategoryNine.meta.legacyCategoryId, 9);

const legacyRouteSource = fs.readFileSync(path.join(rootDir, 'src/routes/legacy-catalog.js'), 'utf8');
assert(legacyRouteSource.includes("'/blog/:categoryId(\\\\d+)'"));
assert(legacyRouteSource.includes('const requestedPage = legacyPageInteger(req.query.pg, 1);'));
assert(!legacyRouteSource.includes('req.query.pg || req.params.page'));
assert(legacyRouteSource.includes("return res.status(404).send('404 File Not Found')"));

const modernRouteSource = fs.readFileSync(path.join(rootDir, 'src/routes/catalog.js'), 'utf8');
assert(modernRouteSource.includes('if (currentPage > totalPages)'));
assert(!modernRouteSource.includes('if (totalPosts > 0 && currentPage > totalPages)'));
const headerSource = fs.readFileSync(path.join(rootDir, 'src/views/partials/header.ejs'), 'utf8');
assert(headerSource.includes('rel="canonical"'));

console.log('Blog category taxonomy, mapping, canonical, and route contract tests passed.');
