const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

function normalizeLabel(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function labelKey(value) {
  return normalizeLabel(value).toLocaleLowerCase('tr-TR');
}

function optionsFromHtml(html) {
  const $ = cheerio.load(String(html || ''));
  const options = [];

  $('.attr-detail.attr-size ul[name^="poptions1_"] li[data-product-id]').each((_, element) => {
    const item = $(element);
    const productUrl = String(item.attr('producturl') || '');
    const slugMatch = productUrl.match(/\/urun\/([^/?#]+)/);
    const label = normalizeLabel(item.attr('data-bs-title') || item.text());
    if (!slugMatch || !label) return;
    options.push({ slug: slugMatch[1], label });
  });

  return [...new Map(options.map((option) => [option.slug, option])).values()];
}

function discoverStaticVariantGroups(productRoot) {
  const groupedPages = new Map();
  const warnings = [];

  fs.readdirSync(productRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .forEach((entry) => {
      const filePath = path.join(productRoot, entry.name, 'index.html');
      if (!fs.existsSync(filePath)) return;
      const options = optionsFromHtml(fs.readFileSync(filePath, 'utf8'));
      if (options.length < 2) return;
      const key = options.map((option) => option.slug).sort().join('|');
      const pages = groupedPages.get(key) || [];
      pages.push({ slug: entry.name, options });
      groupedPages.set(key, pages);
    });

  const groups = [];
  groupedPages.forEach((pages) => {
    const optionSlugs = new Set(pages[0].options.map((option) => option.slug));
    const parentCandidates = pages.filter((page) => !optionSlugs.has(page.slug));
    if (parentCandidates.length !== 1) {
      warnings.push({
        type: 'ambiguous-parent',
        pages: pages.map((page) => page.slug),
        parentCandidates: parentCandidates.map((page) => page.slug)
      });
      return;
    }

    const parent = parentCandidates[0];
    const normalizedLabels = parent.options.map((option) => labelKey(option.label));
    if (new Set(normalizedLabels).size !== normalizedLabels.length) {
      warnings.push({ type: 'duplicate-label', parentSlug: parent.slug });
      return;
    }

    groups.push({
      parentSlug: parent.slug,
      options: parent.options.map((option, index) => ({ ...option, sortOrder: index }))
    });
  });

  groups.sort((left, right) => left.parentSlug.localeCompare(right.parentSlug, 'tr'));
  return { groups, warnings };
}

async function applyVariantGroups(prisma, groups) {
  const report = { appliedGroups: 0, createdLinks: 0, preservedLinks: 0, skipped: [] };

  for (const group of groups) {
    const result = await prisma.$transaction(async (tx) => {
      const slugs = [group.parentSlug, ...group.options.map((option) => option.slug)];
      const products = await tx.product.findMany({
        where: { slug: { in: slugs } },
        select: { id: true, slug: true, status: true }
      });
      const bySlug = new Map(products.map((product) => [product.slug, product]));
      const parent = bySlug.get(group.parentSlug);
      const children = group.options.map((option) => bySlug.get(option.slug));
      const missingSlugs = slugs.filter((slug) => !bySlug.has(slug));
      if (!parent || missingSlugs.length) {
        return { skipped: { parentSlug: group.parentSlug, reason: 'missing-products', missingSlugs } };
      }

      const childIds = children.map((child) => child.id);
      const conflictingLinks = await tx.productVariant.findMany({
        where: {
          variantProductId: { in: childIds },
          parentProductId: { not: parent.id }
        },
        select: { variantProductId: true, parentProductId: true }
      });
      if (conflictingLinks.length) {
        return { skipped: { parentSlug: group.parentSlug, reason: 'child-already-linked' } };
      }

      const existingLinks = await tx.productVariant.findMany({
        where: { parentProductId: parent.id },
        select: { id: true, variantProductId: true, isDefault: true }
      });
      const existingByProduct = new Map(existingLinks.map((link) => [link.variantProductId, link]));
      const parentAlreadyHasDefault = existingLinks.some((link) => link.isDefault);
      let createdLinks = 0;
      let preservedLinks = 0;

      for (let index = 0; index < group.options.length; index += 1) {
        const option = group.options[index];
        const child = bySlug.get(option.slug);
        const existing = existingByProduct.get(child.id);
        if (existing) {
          // A repeated backfill must not overwrite labels, ordering, publication
          // state or archival choices made later in the admin panel.
          preservedLinks += 1;
          continue;
        }

        await tx.productVariant.create({
          data: {
            parentProductId: parent.id,
            variantProductId: child.id,
            label: option.label,
            sortOrder: option.sortOrder,
            isDefault: !parentAlreadyHasDefault && index === 0,
            isActive: child.status === 'PUBLISHED',
            isArchived: false
          }
        });
        createdLinks += 1;
      }

      return { createdLinks, preservedLinks };
    });

    if (result.skipped) report.skipped.push(result.skipped);
    else {
      report.appliedGroups += 1;
      report.createdLinks += result.createdLinks;
      report.preservedLinks += result.preservedLinks;
    }
  }

  return report;
}

async function main() {
  const productRoot = path.resolve(__dirname, '../urun');
  const discovery = discoverStaticVariantGroups(productRoot);
  const summary = {
    mode: process.argv.includes('--apply') ? 'apply' : 'dry-run',
    groupCount: discovery.groups.length,
    optionCount: discovery.groups.reduce((total, group) => total + group.options.length, 0),
    warnings: discovery.warnings,
    groups: discovery.groups
  };

  if (!process.argv.includes('--apply')) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  const prisma = require('../src/db');
  try {
    summary.result = await applyVariantGroups(prisma, discovery.groups);
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = {
  applyVariantGroups,
  discoverStaticVariantGroups,
  normalizeLabel,
  optionsFromHtml
};
