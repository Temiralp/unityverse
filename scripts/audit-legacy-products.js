#!/usr/bin/env node

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const { PrismaClient } = require('@prisma/client');

const ROOT_DIR = path.resolve(__dirname, '..');
const COURSE_DIR = path.join(ROOT_DIR, 'urun');

function normalizeWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function parseArgs(argv) {
  const args = {
    json: false,
    summaryOnly: false,
    limit: null,
    file: null,
    only: 'all'
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--json') args.json = true;
    else if (arg === '--summary-only') args.summaryOnly = true;
    else if (arg === '--limit') args.limit = Number(argv[++index]);
    else if (arg.startsWith('--limit=')) args.limit = Number(arg.slice('--limit='.length));
    else if (arg === '--file') args.file = argv[++index];
    else if (arg.startsWith('--file=')) args.file = arg.slice('--file='.length);
    else if (arg === '--only') args.only = argv[++index] || 'all';
    else if (arg.startsWith('--only=')) args.only = arg.slice('--only='.length);
    else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Bilinmeyen argüman: ${arg}`);
    }
  }

  if (args.limit != null && (!Number.isInteger(args.limit) || args.limit < 1)) {
    throw new Error('--limit pozitif tam sayı olmalıdır.');
  }

  if (!['all', 'matched', 'missing', 'draft', 'id-conflict'].includes(args.only)) {
    throw new Error('--only all, matched, missing, draft veya id-conflict olmalıdır.');
  }

  return args;
}

function printHelp() {
  console.log(`
Kullanım:
  node scripts/audit-legacy-products.js
  node scripts/audit-legacy-products.js --summary-only
  node scripts/audit-legacy-products.js --only missing --limit 20
  node scripts/audit-legacy-products.js --file urun/example-course/index.html --json

Bu script sadece okuma yapar. Static urun HTML dosyalarını backend Product
tablosuyla slug/id üzerinden karşılaştırır, DB'ye yazmaz. --limit sadece
ekranda gösterilen satır sayısını sınırlar; özet her zaman tüm kayıtları kapsar.
`);
}

function findCourseFiles(args) {
  if (args.file) {
    const filePath = path.resolve(ROOT_DIR, args.file);
    if (!fs.existsSync(filePath)) throw new Error(`Dosya bulunamadı: ${args.file}`);
    return [filePath];
  }

  if (!fs.existsSync(COURSE_DIR)) return [];

  const files = fs.readdirSync(COURSE_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(COURSE_DIR, entry.name, 'index.html'))
    .filter((filePath) => fs.existsSync(filePath))
    .sort((left, right) => left.localeCompare(right));

  return files;
}

function parsePrice(html) {
  const match = String(html).match(/\bvar\s+base_price\s*=\s*([0-9]+(?:[.,][0-9]{1,2})?)/i);
  if (!match) return null;

  const value = Number(match[1].replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}

function parseLegacyProductIds(html) {
  const ids = new Set();
  const pattern = /_{0,2}addToBasket\s*\(\s*([1-9]\d*)/g;
  let match = pattern.exec(html);

  while (match) {
    ids.add(Number(match[1]));
    match = pattern.exec(html);
  }

  return [...ids].sort((left, right) => left - right);
}

function parseCourse(filePath) {
  const html = fs.readFileSync(filePath, 'utf8');
  const $ = cheerio.load(html, { decodeEntities: false });
  const slug = path.basename(path.dirname(filePath));
  const title = normalizeWhitespace($('.content-product-right .title-product h1').first().text())
    || normalizeWhitespace($('h1').first().text())
    || slug;

  return {
    sourceFile: path.relative(ROOT_DIR, filePath),
    slug,
    title,
    price: parsePrice(html),
    legacyProductIds: parseLegacyProductIds(html)
  };
}

function classify(course, productBySlug, productById) {
  const slugProduct = productBySlug.get(course.slug) || null;
  const idProducts = course.legacyProductIds
    .map((id) => productById.get(id))
    .filter(Boolean);
  const uniqueIdProducts = [...new Map(idProducts.map((product) => [product.id, product])).values()];
  const primaryLegacyId = course.legacyProductIds[0] || null;
  const primaryIdProduct = primaryLegacyId ? productById.get(primaryLegacyId) || null : null;
  const matchedProduct = slugProduct || primaryIdProduct || null;
  let status = 'missing';

  if (slugProduct) status = slugProduct.status === 'PUBLISHED' ? 'matched' : 'draft';
  else if (primaryIdProduct) status = primaryIdProduct.status === 'PUBLISHED' ? 'matched' : 'draft';

  const idConflict = Boolean(
    (slugProduct && primaryIdProduct && slugProduct.id !== primaryIdProduct.id)
    || (!slugProduct && primaryIdProduct && primaryIdProduct.slug !== course.slug)
  );

  return {
    ...course,
    status: idConflict ? 'id-conflict' : status,
    matchedBy: slugProduct ? 'slug' : primaryIdProduct ? 'legacyProductId' : null,
    matchedProduct: matchedProduct
      ? {
        id: matchedProduct.id,
        slug: matchedProduct.slug,
        title: matchedProduct.title,
        status: matchedProduct.status,
        price: matchedProduct.price == null ? null : Number(matchedProduct.price),
        discountPrice: matchedProduct.discountPrice == null ? null : Number(matchedProduct.discountPrice)
      }
      : null,
    idMatches: uniqueIdProducts.map((product) => ({
      id: product.id,
      slug: product.slug,
      title: product.title,
      status: product.status
    }))
  };
}

function filterRows(rows, only) {
  if (only === 'all') return rows;
  return rows.filter((row) => row.status === only);
}

function summary(rows) {
  return rows.reduce((acc, row) => {
    acc.total += 1;
    acc[row.status] = (acc[row.status] || 0) + 1;
    acc.legacyProductIdCount += row.legacyProductIds.length;
    return acc;
  }, {
    total: 0,
    matched: 0,
    missing: 0,
    draft: 0,
    'id-conflict': 0,
    legacyProductIdCount: 0
  });
}

function printTextReport(rows, filteredRows, args) {
  const totals = summary(rows);

  console.log('Legacy product audit');
  console.log('--------------------');
  console.log(`Static kurs sayısı: ${totals.total}`);
  console.log(`Legacy productId referansı: ${totals.legacyProductIdCount}`);
  console.log(`Backend eşleşen: ${totals.matched}`);
  console.log(`Backend DRAFT eşleşen: ${totals.draft}`);
  console.log(`Backend eksik: ${totals.missing}`);
  console.log(`ID/slug çakışması: ${totals['id-conflict']}`);
  console.log(`Filtre: ${args.only}`);
  console.log('');

  if (args.summaryOnly) return;

  filteredRows.slice(0, args.limit || 40).forEach((row) => {
    const ids = row.legacyProductIds.length ? row.legacyProductIds.join(',') : '-';
    const match = row.matchedProduct
      ? `${row.matchedProduct.id} ${row.matchedProduct.status} ${row.matchedProduct.slug}`
      : '-';

    console.log(`[${row.status}] ${row.sourceFile}`);
    console.log(`  title: ${row.title}`);
    console.log(`  slug: ${row.slug}`);
    console.log(`  legacyProductIds: ${ids}`);
    console.log(`  backend: ${match}`);
  });

  if (filteredRows.length > (args.limit || 40)) {
    console.log(`... ${filteredRows.length - (args.limit || 40)} kayıt daha var. Daha fazlası için --limit kullan.`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const files = findCourseFiles(args);
  const courses = files.map(parseCourse);
  const prisma = new PrismaClient();

  try {
    const products = await prisma.product.findMany({
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        price: true,
        discountPrice: true
      }
    });
    const productBySlug = new Map(products.map((product) => [product.slug, product]));
    const productById = new Map(products.map((product) => [product.id, product]));
    const rows = courses.map((course) => classify(course, productBySlug, productById));
    const filteredRows = filterRows(rows, args.only);
    const report = {
      generatedAt: new Date().toISOString(),
      summary: summary(rows),
      filter: args.only,
      rows: filteredRows
    };

    if (args.json) {
      console.log(JSON.stringify(report, null, 2));
      return;
    }

    printTextReport(rows, filteredRows, args);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
