#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const { PrismaClient } = require('@prisma/client');

const ROOT_DIR = path.resolve(__dirname, '..');
const COURSE_DIR = path.join(ROOT_DIR, 'urun');
const MISSING_CURRICULUM_MARKER = '<!-- missingCurriculum: true -->';
const NAVBAR_CATEGORY_ORDER = [
  'oyun-gelistirme',
  'yazilim',
  'grafik-tasarim',
  '3d-modelleme',
  'animasyon'
];

function normalizeWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function foldTurkish(value) {
  return normalizeWhitespace(value)
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');
}

function slugFromFile(filePath) {
  return path.basename(path.dirname(filePath));
}

function normalizeAssetPath(value) {
  return String(value || '').trim() || null;
}

function slugifyCategory(value) {
  return foldTurkish(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeCategoryName(value) {
  return normalizeWhitespace(value)
    .replace(/\s+eğitimleri?\b/ig, '')
    .replace(/\s+eğitimler\b/ig, '')
    .replace(/\s*[-–—]\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parsePrice(html) {
  const match = String(html).match(/\bvar\s+base_price\s*=\s*([0-9]+(?:[.,][0-9]{1,2})?)/i);
  if (!match) return null;

  const normalized = match[1].replace(',', '.');
  return Number.isFinite(Number(normalized)) ? normalized : null;
}

function cleanContentHtml(html) {
  const $ = cheerio.load(`<article id="course-content-root">${html || ''}</article>`, {
    decodeEntities: false
  });
  const root = $('#course-content-root');

  root.find('script, style, link, meta, noscript, form').remove();
  root.find('*').each((_, element) => {
    Object.keys(element.attribs || {}).forEach((name) => {
      const lowerName = name.toLowerCase();
      if (lowerName === 'style' || lowerName.startsWith('on')) {
        $(element).removeAttr(name);
      }
    });
  });

  root.find('a[href^="javascript:"]').removeAttr('href');
  root.find('img').each((_, image) => {
    if (!$(image).attr('loading')) $(image).attr('loading', 'lazy');
  });

  return root.html().trim();
}

function isCurriculumLabel(value) {
  const label = foldTurkish(value);
  return /(ders\s*icer|detayli\s*mufredat|egitim\s*icer|program\s*(ozeti|icer)|ders\s*ozeti)/.test(label);
}

function tabSystemKey(value) {
  const label = foldTurkish(value);
  if (isCurriculumLabel(label)) return 'CURRICULUM';
  if (/neden|avantaj|almalisiniz/.test(label)) return 'WHY';
  if (/ilk\s*bakis|genel|aciklama|bilgi/.test(label)) return 'OVERVIEW';
  return null;
}

function parseCategory($) {
  const link = $('.breadcrumb a[href*="kategori/"]').last();
  const href = String(link.attr('href') || '').trim();
  const name = normalizeWhitespace(link.text()) || null;
  const directory = href.match(/kategori\/([^/?#]+)\/?/i)?.[1] || null;

  return {
    name,
    sourceSlug: directory,
    normalizedSlug: directory ? directory.replace(/-\d+$/, '') : null
  };
}

function parseCourseFile(filePath) {
  const absolutePath = path.resolve(filePath);
  const html = fs.readFileSync(absolutePath, 'utf8');
  const $ = cheerio.load(html, { decodeEntities: false });
  const slug = slugFromFile(absolutePath);
  const title = normalizeWhitespace($('.content-product-right .title-product h1').first().text());
  const code = normalizeWhitespace($('.pbl-stock-code a').first().text()) || null;
  const summary = normalizeWhitespace($('.product_short_desc').first().text()) || null;
  const image = normalizeAssetPath($('.pbl-product-slider img[src]').first().attr('src'));
  const price = parsePrice(html);
  const category = parseCategory($);
  const tabSections = [];
  const tabs = [];
  const seenTabIds = new Set();
  let curriculumTabFound = false;
  let curriculumHasContent = false;

  $('[data-tab]').each((_, tab) => {
    const tabId = String($(tab).attr('data-tab') || '').trim();
    if (!tabId || seenTabIds.has(tabId)) return;
    seenTabIds.add(tabId);

    const pane = $(`#${tabId}`).first();
    if (!pane.length) return;

    const label = normalizeWhitespace($(tab).text()) || 'Eğitim Detayı';
    const cleaned = cleanContentHtml(pane.html() || '');
    const hasSupportedContent = Boolean(
      normalizeWhitespace(cheerio.load(cleaned).text())
      || /<(?:img|iframe|video)\b/i.test(cleaned)
    );

    if (isCurriculumLabel(label)) {
      curriculumTabFound = true;
      if (hasSupportedContent) curriculumHasContent = true;
    }

    if (hasSupportedContent) {
      tabSections.push(`<section data-source-tab="${tabId}"><h2>${label}</h2>${cleaned}</section>`);
      tabs.push({
        systemKey: tabSystemKey(label),
        title: label,
        content: cleaned,
        sortOrder: (tabs.length + 1) * 10
      });
    }
  });

  const missingCurriculum = curriculumTabFound && !curriculumHasContent;
  const content = `${missingCurriculum ? `${MISSING_CURRICULUM_MARKER}\n` : ''}${tabSections.join('\n')}`.trim() || null;

  if (!title) {
    throw new Error('Course title could not be parsed.');
  }

  return {
    sourceFile: path.relative(ROOT_DIR, absolutePath),
    slug,
    title,
    code,
    summary,
    content,
    tabs,
    image,
    price,
    status: missingCurriculum ? 'DRAFT' : 'PUBLISHED',
    meta: {
      category,
      curriculum: missingCurriculum ? 'missing' : curriculumTabFound ? 'present' : 'no-tab',
      missingCurriculum,
      curriculumTabFound,
      contentLength: content ? content.length : 0
    }
  };
}

function collectCourseCategories(courses) {
  const categories = new Map();

  courses.forEach((course) => {
    const rawName = course.meta.category.name;
    if (!rawName) return;

    const name = normalizeCategoryName(rawName);
    const slug = slugifyCategory(name);
    if (!slug) return;

    const category = categories.get(slug) || {
      name,
      slug,
      sourceNames: new Set(),
      sourceSlugs: new Set(),
      courseCount: 0
    };
    category.sourceNames.add(rawName);
    if (course.meta.category.sourceSlug) category.sourceSlugs.add(course.meta.category.sourceSlug);
    category.courseCount += 1;
    categories.set(slug, category);
  });

  return [...categories.values()]
    .sort((left, right) => left.name.localeCompare(right.name, 'tr-TR'))
    .map((category, index) => {
      const navbarIndex = NAVBAR_CATEGORY_ORDER.indexOf(category.slug);
      return {
        name: category.name,
        slug: category.slug,
        isActive: true,
        sortOrder: navbarIndex === -1 ? 60 + (index * 10) : (navbarIndex + 1) * 10,
        courseCount: category.courseCount,
        sourceNames: [...category.sourceNames].sort((a, b) => a.localeCompare(b, 'tr-TR')),
        sourceSlugs: [...category.sourceSlugs].sort()
      };
    });
}

function findCourseFiles() {
  if (!fs.existsSync(COURSE_DIR)) return [];

  return fs.readdirSync(COURSE_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(COURSE_DIR, entry.name, 'index.html'))
    .filter((filePath) => fs.existsSync(filePath))
    .sort((a, b) => a.localeCompare(b));
}

function parseArgs(argv) {
  const args = {
    dryRun: false,
    categoriesDryRun: false,
    syncCategories: false,
    all: false,
    limit: null,
    file: null,
    jsonOut: null,
    help: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--categories-dry-run') args.categoriesDryRun = true;
    else if (arg === '--sync-categories') args.syncCategories = true;
    else if (arg === '--all') args.all = true;
    else if (arg === '--limit') args.limit = Number(argv[++index]);
    else if (arg === '--file') args.file = argv[++index];
    else if (arg === '--json-out') args.jsonOut = argv[++index];
    else if (arg === '--help') args.help = true;
  }

  if (args.limit != null && (!Number.isInteger(args.limit) || args.limit < 1)) {
    throw new Error('--limit must be a positive integer.');
  }

  return args;
}

function courseWarnings(course) {
  const warnings = [];
  if (!course.code) warnings.push('missingCode');
  if (course.price == null) warnings.push('missingPrice');
  if (!course.image) warnings.push('missingImage');
  if (!course.summary) warnings.push('missingSummary');
  if (!course.content) warnings.push('missingContent');
  if (!course.meta.category.name) warnings.push('missingCategory');
  return warnings;
}

function tabsForWrite(tabs) {
  const usedSystemKeys = new Set();

  return tabs.map((tab) => {
    if (!tab.systemKey || usedSystemKeys.has(tab.systemKey)) {
      return { ...tab, systemKey: null };
    }

    usedSystemKeys.add(tab.systemKey);
    return tab;
  });
}

function previewCourse(course) {
  return {
    sourceFile: course.sourceFile,
    slug: course.slug,
    title: course.title,
    code: course.code,
    price: course.price,
    image: course.image,
    summary: course.summary,
    status: course.status,
    curriculum: course.meta.curriculum,
    category: course.meta.category,
    contentLength: course.meta.contentLength,
    contentExcerpt: normalizeWhitespace(course.content).slice(0, 300),
    warnings: courseWarnings(course)
  };
}

function mixedSamples(courses, count = 5) {
  const drafts = courses.filter((course) => course.status === 'DRAFT');
  const published = courses.filter((course) => course.status === 'PUBLISHED');
  const result = [];

  [drafts[0], published[0], drafts[1], published[1], published[2]].forEach((course) => {
    if (course && result.length < count) result.push(course);
  });

  return result.length === count ? result : courses.slice(0, count);
}

function summarize(courses, errors, sourceFileCount) {
  const warnings = courses.flatMap((course) => courseWarnings(course).map((warning) => ({
    sourceFile: course.sourceFile,
    slug: course.slug,
    warning
  })));
  const duplicateCodes = new Map();

  courses.filter((course) => course.code).forEach((course) => {
    const entries = duplicateCodes.get(course.code) || [];
    entries.push(course.slug);
    duplicateCodes.set(course.code, entries);
  });

  return {
    sourceFileCount,
    parsed: courses.length,
    published: courses.filter((course) => course.status === 'PUBLISHED').length,
    draftMissingCurriculum: courses.filter((course) => course.meta.missingCurriculum).length,
    publishedWithoutCurriculumTab: courses.filter((course) => course.meta.curriculum === 'no-tab').length,
    parseErrors: errors.length,
    coursesWithWarnings: new Set(warnings.map((warning) => warning.slug)).size,
    warningCounts: warnings.reduce((counts, warning) => {
      counts[warning.warning] = (counts[warning.warning] || 0) + 1;
      return counts;
    }, {}),
    duplicateCodes: [...duplicateCodes.entries()]
      .filter(([, slugs]) => slugs.length > 1)
      .map(([code, slugs]) => ({ code, slugs }))
      .slice(0, 20),
    sampleCourses: mixedSamples(courses).map(previewCourse),
    errorSamples: errors.slice(0, 10),
    warningSamples: warnings.slice(0, 20)
  };
}

function resolveCategoryId(course, categories) {
  const sourceSlug = course.meta.category.sourceSlug;
  const normalizedSlug = course.meta.category.normalizedSlug;
  const normalizedNameSlug = slugifyCategory(normalizeCategoryName(course.meta.category.name));
  const name = foldTurkish(normalizeCategoryName(course.meta.category.name));

  const match = categories.find((category) => category.slug === sourceSlug)
    || categories.find((category) => category.slug === normalizedSlug)
    || categories.find((category) => category.slug === normalizedNameSlug)
    || categories.find((category) => foldTurkish(category.name) === name);

  return match ? match.id : null;
}

async function writeCourses(courses) {
  const prisma = new PrismaClient();
  const result = {
    created: 0,
    updated: 0,
    skippedDuplicateExports: [],
    duplicateCodeAdjusted: [],
    failed: 0,
    unresolvedCategories: [],
    failures: []
  };

  try {
    const categories = await prisma.category.findMany({ select: { id: true, name: true, slug: true } });
    const seenCodes = new Map();

    for (const course of courses) {
      try {
        const firstSourceFile = course.code ? seenCodes.get(course.code) : null;
        if (firstSourceFile) {
          result.duplicateCodeAdjusted.push({
            code: course.code,
            sourceFile: course.sourceFile,
            keptSourceFile: firstSourceFile
          });
        }

        if (course.code) seenCodes.set(course.code, course.sourceFile);
        const existing = await prisma.product.findUnique({ where: { slug: course.slug }, select: { id: true } });
        const categoryId = resolveCategoryId(course, categories);
        if (course.meta.category.name && !categoryId) {
          result.unresolvedCategories.push({
            sourceFile: course.sourceFile,
            slug: course.slug,
            category: course.meta.category
          });
        }

        const data = {
          code: firstSourceFile ? null : course.code,
          title: course.title,
          summary: course.summary,
          content: course.content,
          image: course.image,
          price: course.price,
          status: course.status,
          categoryId
        };

        await prisma.$transaction(async (tx) => {
          const savedProduct = await tx.product.upsert({
            where: { slug: course.slug },
            create: { slug: course.slug, ...data },
            update: data,
            select: { id: true }
          });

          await tx.productTab.deleteMany({ where: { productId: savedProduct.id } });

          const writableTabs = tabsForWrite(course.tabs);

          if (writableTabs.length) {
            await tx.productTab.createMany({
              data: writableTabs.map((tab, index) => ({
                productId: savedProduct.id,
                systemKey: tab.systemKey,
                title: tab.title,
                content: tab.content,
                sortOrder: tab.sortOrder || ((index + 1) * 10)
              }))
            });
          }
        });

        if (existing) result.updated += 1;
        else result.created += 1;
      } catch (error) {
        result.failed += 1;
        result.failures.push({ sourceFile: course.sourceFile, slug: course.slug, message: error.message });
      }
    }
  } finally {
    await prisma.$disconnect();
  }

  return result;
}

async function syncCategories(courses) {
  const prisma = new PrismaClient();
  const result = {
    created: 0,
    updated: 0,
    linkedProducts: 0,
    unresolvedProducts: [],
    failures: []
  };

  try {
    const definitions = collectCourseCategories(courses);
    for (const category of definitions) {
      const existing = await prisma.category.findUnique({
        where: { slug: category.slug },
        select: { id: true }
      });

      await prisma.category.upsert({
        where: { slug: category.slug },
        create: {
          name: category.name,
          slug: category.slug,
          isActive: true,
          sortOrder: category.sortOrder
        },
        update: {
          name: category.name,
          isActive: true,
          sortOrder: category.sortOrder
        }
      });

      if (existing) result.updated += 1;
      else result.created += 1;
    }

    const categories = await prisma.category.findMany({ select: { id: true, name: true, slug: true } });
    for (const course of courses) {
      const categoryId = resolveCategoryId(course, categories);
      if (!categoryId) {
        result.unresolvedProducts.push({ sourceFile: course.sourceFile, slug: course.slug });
        continue;
      }

      const update = await prisma.product.updateMany({
        where: { slug: course.slug },
        data: { categoryId }
      });
      result.linkedProducts += update.count;
    }
  } catch (error) {
    result.failures.push({ message: error.message });
  } finally {
    await prisma.$disconnect();
  }

  return result;
}

function printHelp() {
  console.log(`
Usage:
  node scripts/migrate-courses.js --dry-run
  node scripts/migrate-courses.js --categories-dry-run
  node scripts/migrate-courses.js --sync-categories
  node scripts/migrate-courses.js --dry-run --limit 5
  node scripts/migrate-courses.js --dry-run --file urun/example/index.html
  node scripts/migrate-courses.js --limit 5
  node scripts/migrate-courses.js --all

Notes:
  --dry-run never opens Prisma or writes to the database.
  Write mode requires --limit, --file, or explicit --all and upserts by slug.
  --sync-categories upserts normalized categories and links courses already present in Product.
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return printHelp();
  if (args.categoriesDryRun) args.dryRun = true;
  if (!args.dryRun && !args.syncCategories && !args.all && !args.file && !args.limit) {
    throw new Error('Safety guard: write mode requires --file, --limit, or explicit --all.');
  }

  const sourceFiles = args.file
    ? [path.resolve(ROOT_DIR, args.file)]
    : findCourseFiles();
  const files = args.limit ? sourceFiles.slice(0, args.limit) : sourceFiles;
  const courses = [];
  const errors = [];

  files.forEach((filePath) => {
    try {
      courses.push(parseCourseFile(filePath));
    } catch (error) {
      errors.push({ sourceFile: path.relative(ROOT_DIR, filePath), message: error.message });
    }
  });

  const output = {
    generatedAt: new Date().toISOString(),
    dryRun: args.dryRun,
    summary: summarize(courses, errors, sourceFiles.length)
  };

  if (args.categoriesDryRun) {
    output.categories = collectCourseCategories(courses);
  }

  if (args.syncCategories) output.categorySync = await syncCategories(courses);
  else if (!args.dryRun) output.write = await writeCourses(courses);

  if (args.jsonOut) {
    fs.writeFileSync(path.resolve(ROOT_DIR, args.jsonOut), `${JSON.stringify({ ...output, courses, errors }, null, 2)}\n`);
  }

  console.log(JSON.stringify(output, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = {
  cleanContentHtml,
  collectCourseCategories,
  normalizeCategoryName,
  parseCourseFile,
  parsePrice,
  resolveCategoryId,
  syncCategories
};
