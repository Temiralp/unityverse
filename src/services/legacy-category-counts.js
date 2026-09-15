// Listeleme sayfalarindaki (tum-urunler ve kategori/*) statik yan panel
// "<!-- legacy-static-filter-fallback -->" blogundaki kategori sayaclarini
// DB'deki yayinlanmis kurs sayisiyla degistirir. Sayim, kategori sayfasinin
// kendisiyle ayni tanimi kullanir: legacyCategoryCandidateSlugs alias haritasi.

const { publicCatalogProductWhere } = require('./public-catalog');

const FALLBACK_START = '<!-- legacy-static-filter-fallback:start -->';
const FALLBACK_END = '<!-- legacy-static-filter-fallback:end -->';
// <a href="/kategori/<slug>/" ...>Ad (N)</a>
const CATEGORY_LINK_PATTERN = /(<a href="\/kategori\/([a-z0-9-]+)\/"[^>]*>[^<]*?)\((\d+)\)(<\/a>)/g;

function fallbackRange(html) {
  const start = html.indexOf(FALLBACK_START);
  const end = html.indexOf(FALLBACK_END, start);
  return start !== -1 && end !== -1 ? { start, end } : null;
}

function extractLegacyCategorySlugs(html) {
  const source = String(html || '');
  const range = fallbackRange(source);
  if (!range) return [];

  const slugs = new Set();
  for (const match of source.slice(range.start, range.end).matchAll(CATEGORY_LINK_PATTERN)) {
    slugs.add(match[2]);
  }
  return [...slugs];
}

function countProductsByLegacyCategory(products, legacySlugs, candidateSlugsFor) {
  const counts = new Map();
  const categorySlugs = (Array.isArray(products) ? products : [])
    .map((product) => product && product.category && product.category.slug)
    .filter(Boolean);

  legacySlugs.forEach((legacySlug) => {
    const candidates = new Set(candidateSlugsFor(legacySlug));
    counts.set(legacySlug, categorySlugs.filter((slug) => candidates.has(slug)).length);
  });

  return counts;
}

async function loadLegacyCategoryCounts(prismaClient, legacySlugs, candidateSlugsFor) {
  if (!legacySlugs.length) return new Map();

  const products = await prismaClient.product.findMany({
    where: publicCatalogProductWhere(),
    select: { category: { select: { slug: true } } }
  });

  return countProductsByLegacyCategory(products, legacySlugs, candidateSlugsFor);
}

function synchronizeLegacyCategoryCounts(html, countsBySlug) {
  const source = String(html || '');
  const range = fallbackRange(source);
  if (!range || !countsBySlug || countsBySlug.size === 0) return source;

  const block = source.slice(range.start, range.end).replace(
    CATEGORY_LINK_PATTERN,
    (match, prefix, slug, currentCount, suffix) => (
      countsBySlug.has(slug) ? `${prefix}(${countsBySlug.get(slug)})${suffix}` : match
    )
  );

  return source.slice(0, range.start) + block + source.slice(range.end);
}

module.exports = {
  countProductsByLegacyCategory,
  extractLegacyCategorySlugs,
  loadLegacyCategoryCounts,
  synchronizeLegacyCategoryCounts
};
