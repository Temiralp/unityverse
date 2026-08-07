const fs = require('fs/promises');
const path = require('path');
const express = require('express');
const prisma = require('../db');
const { publicCatalogProductWhere } = require('../services/public-catalog');

const router = express.Router();
const rootDir = path.resolve(__dirname, '../..');
const categoryDir = path.join(rootDir, 'kategori');
const allProductsFile = path.join(rootDir, 'tum-urunler/index.html');

const preferredCategoryOrder = [
  'oyun-gelistirme-egitimleri-244',
  'yazilim-egitimleri-245',
  'grafik-tasarim-egitimleri-246',
  '3d-modelleme-egitimleri-247',
  'animasyon-egitimleri-248',
  'ses-tasarim-egitimleri-251',
  'senaryo-sinema-ve-yonetmenlik-egitimleri-252',
  'endustriyel-urun-tasarim-egitimleri-253',
  'dil-egitimleri-257',
  'dijital-pazarlama-egitimleri-255',
  'ozel-dersler-256',
  'muhasebe-ve-ofis-egitimleri-258',
  'mimarlik-egitimleri-259'
];

function stripTags(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseCategoryName(html) {
  const match = html.match(/<h1 class="modtitle">([\s\S]*?)<\/h1>/i);
  return match ? stripTags(match[1]) : '';
}

function countMatches(html, expression) {
  return (html.match(expression) || []).length;
}

function priceBucket(price) {
  if (price < 5000) return { val1: 0, val2: 4999 };
  if (price < 10000) return { val1: 5000, val2: 9999 };
  if (price < 20000) return { val1: 10000, val2: 19999 };
  if (price < 40000) return { val1: 20000, val2: 39999 };
  return { val1: 40000, val2: 100000 };
}

async function buildCategories() {
  const entries = await fs.readdir(categoryDir, { withFileTypes: true });
  const categories = [];

  await Promise.all(entries
    .filter((entry) => entry.isDirectory())
    .map(async (entry) => {
      const filePath = path.join(categoryDir, entry.name, 'index.html');
      let html = '';

      try {
        html = await fs.readFile(filePath, 'utf8');
      } catch (error) {
        return;
      }

      const name = parseCategoryName(html);
      const count = countMatches(html, /class="uv-product-card-item"/g);

      if (!name || count <= 0 || !preferredCategoryOrder.includes(entry.name)) return;

      categories.push({
        name,
        count,
        url: `/kategori/${entry.name}/`,
        order: preferredCategoryOrder.indexOf(entry.name)
      });
    }));

  return categories
    .sort((a, b) => a.order - b.order)
    .map(({ order, ...category }) => category);
}

async function buildBrandFilters(totalProductCount) {
  const html = await fs.readFile(allProductsFile, 'utf8');
  const brandCounts = new Map();
  const brandMatches = html.matchAll(/uv-product-card-item-brand[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/g);

  for (const match of brandMatches) {
    const name = stripTags(match[1]);
    if (!name) continue;
    brandCounts.set(name, (brandCounts.get(name) || 0) + 1);
  }

  if (brandCounts.size === 0) {
    return [{ id: 1, name: 'Unityverse Academy', pcount: totalProductCount }];
  }

  return Array.from(brandCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'tr'))
    .map(([name, pcount], index) => ({
      id: index + 1,
      name,
      pcount: Math.max(pcount, name === 'Unityverse Academy' ? totalProductCount : pcount)
    }));
}

async function buildFilterPayload(prismaClient = prisma) {
  const products = await prismaClient.product.findMany({
    where: publicCatalogProductWhere(),
    include: { category: true }
  });

  if (products.length > 0) {
    const categoryCounts = new Map();
    const priceBuckets = new Map();

    products.forEach((product) => {
      if (product.category && product.category.slug && product.category.name) {
        const current = categoryCounts.get(product.category.slug) || {
          name: product.category.name,
          count: 0,
          url: `/tum-urunler/?kategori=${encodeURIComponent(product.category.slug)}`
        };
        current.count += 1;
        categoryCounts.set(product.category.slug, current);
      }

      const effectivePrice = product.discountPrice == null
        ? product.price
        : product.discountPrice;
      const price = Number(effectivePrice || 0);
      if (Number.isFinite(price) && price > 0) {
        const bucket = priceBucket(price);
        const key = `${bucket.val1}-${bucket.val2}`;
        priceBuckets.set(key, { ...bucket, pcount: (priceBuckets.get(key)?.pcount || 0) + 1 });
      }
    });

    return {
      sub_category_list: Array.from(categoryCounts.values()).sort((a, b) => a.name.localeCompare(b.name, 'tr')),
      category_tree: [],
      brand_filters: [{ id: 1, name: 'Unityverse Academy', pcount: products.length }],
      price_filters: Array.from(priceBuckets.values()).sort((a, b) => a.val1 - b.val1),
      special_filters: {
        new_count: Math.min(3, products.length),
        sponsor_count: 0,
        campaign_count: 0,
        bestseller_count: Math.min(7, products.length)
      },
      feature_filter_values: [],
      pagination: '',
      total_product_count: products.length
    };
  }

  const allProductsHtml = await fs.readFile(allProductsFile, 'utf8');
  const totalProductCount = countMatches(allProductsHtml, /class="uv-product-card-item"/g);
  const [subCategoryList, brandFilters] = await Promise.all([
    buildCategories(),
    buildBrandFilters(totalProductCount)
  ]);

  return {
    sub_category_list: subCategoryList,
    category_tree: [],
    brand_filters: brandFilters,
    price_filters: [],
    special_filters: {
      new_count: 3,
      sponsor_count: 0,
      campaign_count: 0,
      bestseller_count: 7
    },
    feature_filter_values: [],
    pagination: '',
    total_product_count: totalProductCount
  };
}

router.get('/productfilters', async (req, res, next) => {
  try {
    const filterPayload = await buildFilterPayload();

    res.json({
      status: 'success',
      param: {
        ...filterPayload,
        price_filters: req.session.member ? filterPayload.price_filters : []
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
module.exports.buildFilterPayload = buildFilterPayload;
