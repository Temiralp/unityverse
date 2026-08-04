#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cheerio = require('cheerio');
const { PrismaClient } = require('@prisma/client');
const { cleanContentHtml } = require('./migrate-courses');
const {
  hasMeaningfulProductTabContent,
  normalizeCurriculumAccordionContent
} = require('../src/services/product-content');

const ROOT_DIR = path.resolve(__dirname, '..');
const COURSE_DIR = path.join(ROOT_DIR, 'urun');

function fold(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');
}

function curriculumPriority(label) {
  const normalized = fold(label);
  if (/^(?:ders|egitim)\s*icerikleri?$/.test(normalized)) return 1;
  if (/^detayli\s*mufredat$/.test(normalized)) return 2;
  if (/(?:ders|egitim)\s*icer|mufredat|program\s*(?:ozeti|icer)/.test(normalized)) return 3;
  return null;
}

function extractCurriculumSource(filePath) {
  const html = fs.readFileSync(filePath, 'utf8');
  const $ = cheerio.load(html, { decodeEntities: false });
  const candidates = [];

  $('[data-tab]').each((unusedIndex, tabElement) => {
    const tab = $(tabElement);
    const priority = curriculumPriority(tab.text());
    const tabId = String(tab.attr('data-tab') || '').trim();
    if (priority == null || !tabId) return;

    const pane = $('[id]').filter((unusedPaneIndex, element) => (
      String($(element).attr('id') || '') === tabId
    )).first();
    if (!pane.length) return;
    const content = normalizeCurriculumAccordionContent(cleanContentHtml(pane.html() || ''));
    if (!hasMeaningfulProductTabContent(content)) return;

    const normalizedDocument = cheerio.load(content);
    const accordionGroups = normalizedDocument('.panel-group').length;
    const accordionTriggers = normalizedDocument(
      'a[data-toggle="collapse"][href^="#uv-curriculum-"]'
    ).length;
    candidates.push({
      tabId,
      title: String(tab.text() || '').replace(/\s+/g, ' ').trim(),
      priority,
      content,
      originalLength: String(pane.html() || '').length,
      sanitizedLength: content.length,
      accordionGroups,
      accordionItems: normalizedDocument('.panel-group > .panel').length,
      unsupportedAccordion: accordionGroups > 0 && accordionTriggers === 0
    });
  });

  return candidates;
}

function buildCurriculumBackfillPlan(products, sourcesBySlug) {
  const result = {
    writes: [],
    skippedExisting: [],
    skippedNoSource: [],
    skippedConflict: [],
    skippedUnsupported: []
  };

  products.forEach((product) => {
    if ((product.variantOfProducts || []).length) return;
    const existing = (product.tabs || []).find((tab) => tab.systemKey === 'CURRICULUM') || null;
    if (hasMeaningfulProductTabContent(existing?.content)) {
      result.skippedExisting.push(product.slug);
      return;
    }

    const parentCandidates = (sourcesBySlug.get(product.slug) || []).map((candidate) => ({
      ...candidate,
      sourceSlug: product.slug
    }));
    const childSlugs = (product.productVariants || [])
      .filter((variant) => (
        !variant.isArchived
        && variant.isActive !== false
        && variant.variantProduct?.status === 'PUBLISHED'
      ))
      .map((variant) => variant.variantProduct.slug);
    const childCandidates = childSlugs.flatMap((sourceSlug) => (
      (sourcesBySlug.get(sourceSlug) || []).map((candidate) => ({ ...candidate, sourceSlug }))
    ));
    const candidates = (parentCandidates.length ? parentCandidates : childCandidates)
      .filter((candidate) => !candidate.unsupportedAccordion);
    const hadUnsupportedSource = [...parentCandidates, ...childCandidates]
      .some((candidate) => candidate.unsupportedAccordion);
    if (!candidates.length) {
      if (hadUnsupportedSource) result.skippedUnsupported.push(product.slug);
      else result.skippedNoSource.push(product.slug);
      return;
    }
    const bestPriority = Math.min(...candidates.map((candidate) => candidate.priority));
    const bestCandidates = candidates.filter((candidate) => candidate.priority === bestPriority);
    const uniqueSources = new Map();
    bestCandidates.forEach((candidate) => {
      const hash = crypto.createHash('sha256').update(candidate.content).digest('hex');
      if (!uniqueSources.has(hash)) uniqueSources.set(hash, { ...candidate, hash });
    });
    if (uniqueSources.size !== 1) {
      result.skippedConflict.push(product.slug);
      return;
    }
    const source = [...uniqueSources.values()][0];

    result.writes.push({
      productId: product.id,
      code: product.code || null,
      slug: product.slug,
      tabId: existing?.id || null,
      title: existing?.title || 'Ders İçerikleri',
      content: source.content,
      sortOrder: existing?.sortOrder || 20,
      sourceSlug: source.sourceSlug,
      sourceTab: source.title,
      sha256: source.hash,
      originalLength: source.originalLength,
      sanitizedLength: source.sanitizedLength,
      accordionGroups: source.accordionGroups,
      accordionItems: source.accordionItems
    });
  });

  return result;
}

function courseFiles() {
  return fs.readdirSync(COURSE_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      slug: entry.name,
      filePath: path.join(COURSE_DIR, entry.name, 'index.html')
    }))
    .filter(({ filePath }) => fs.existsSync(filePath));
}

async function main() {
  const apply = process.argv.includes('--apply');
  const sourcesBySlug = new Map(courseFiles().map(({ slug, filePath }) => [
    slug,
    extractCurriculumSource(filePath)
  ]));
  const prisma = new PrismaClient();

  try {
    const products = await prisma.product.findMany({
      select: {
        id: true,
        code: true,
        slug: true,
        tabs: {
          where: { systemKey: 'CURRICULUM' },
          select: { id: true, systemKey: true, title: true, content: true, sortOrder: true }
        },
        productVariants: {
          select: {
            isActive: true,
            isArchived: true,
            variantProduct: { select: { slug: true, status: true } }
          }
        },
        variantOfProducts: { select: { parentProductId: true } }
      },
      orderBy: { id: 'asc' }
    });
    const plan = buildCurriculumBackfillPlan(products, sourcesBySlug);

    const applyResult = { created: 0, updated: 0, changedSinceDryRun: [], failed: [] };
    if (apply) {
      for (const write of plan.writes) {
        try {
          await prisma.$transaction(async (tx) => {
            const current = await tx.productTab.findFirst({
              where: { productId: write.productId, systemKey: 'CURRICULUM' },
              select: { id: true, content: true }
            });
            if (hasMeaningfulProductTabContent(current?.content)) {
              applyResult.changedSinceDryRun.push(write.slug);
              return;
            }

            if (current) {
              await tx.productTab.update({
                where: { id: current.id },
                data: { content: write.content }
              });
              applyResult.updated += 1;
            } else {
              await tx.productTab.create({
                data: {
                  productId: write.productId,
                  systemKey: 'CURRICULUM',
                  title: 'Ders İçerikleri',
                  content: write.content,
                  sortOrder: 20
                }
              });
              applyResult.created += 1;
            }
          });
        } catch (error) {
          applyResult.failed.push({ slug: write.slug, message: error.message });
        }
      }
    }

    console.log(JSON.stringify({
      mode: apply ? 'apply' : 'dry-run',
      sourceFiles: sourcesBySlug.size,
      wouldCreate: plan.writes.filter((write) => !write.tabId).length,
      wouldUpdate: plan.writes.filter((write) => write.tabId).length,
      skippedExisting: plan.skippedExisting.length,
      sourceMissing: plan.skippedNoSource.length,
      sourceConflict: plan.skippedConflict.length,
      unsupportedAccordion: plan.skippedUnsupported.length,
      productRowsTouched: 0,
      writes: plan.writes.map(({
        code,
        slug,
        sourceSlug,
        sourceTab,
        sha256,
        originalLength,
        sanitizedLength,
        accordionGroups,
        accordionItems
      }) => ({
        code,
        slug,
        sourceSlug,
        sourceTab,
        sha256,
        originalLength,
        sanitizedLength,
        accordionGroups,
        accordionItems
      })),
      conflicts: plan.skippedConflict,
      unsupported: plan.skippedUnsupported,
      ...(apply ? { applied: applyResult } : {})
    }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  buildCurriculumBackfillPlan,
  curriculumPriority,
  extractCurriculumSource
};
