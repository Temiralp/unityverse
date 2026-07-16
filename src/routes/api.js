const express = require('express');
const fs = require('fs/promises');
const path = require('path');

const prisma = require('../db');
const { createFormToken } = require('../security/form-protection');

const router = express.Router();
const rootDir = path.resolve(__dirname, '../..');
const legacyProductsDir = path.join(rootDir, 'urun');
let legacyPriceCache = null;

router.get('/csrf-token', (req, res) => {
  res.set('Cache-Control', 'no-store');
  return res.json({
    status: 'success',
    token: req.session.csrfToken
  });
});

router.get('/form-protection-token', (req, res) => {
  const scope = String(req.query.scope || '');

  if (!['lead', 'member', 'enrollment'].includes(scope)) {
    return res.status(400).json({ status: 'failure', message: 'Geçersiz form türü.' });
  }

  res.set('Cache-Control', 'no-store');
  return res.json({
    status: 'success',
    token: createFormToken(scope)
  });
});

router.get('/products', async (req, res, next) => {
  try {
    const products = await prisma.product.findMany({
      where: { status: 'PUBLISHED' },
      include: { category: true },
      orderBy: [{ sortOrder: 'asc' }, { id: 'desc' }]
    });
    res.json({ data: products });
  } catch (error) {
    next(error);
  }
});

function legacyProductIdentity(relativePath) {
  const parts = relativePath.split(path.sep);
  const slug = parts[0] || '';
  const numericSegment = parts.find((part) => /^\d+$/.test(part));
  const slugId = slug.match(/-(\d+)$/);
  const id = numericSegment || (slugId && slugId[1]);

  if (!slug || !id) return null;

  return {
    id: Number(id),
    slug
  };
}

async function collectLegacyPriceFiles(directory, prefix = '') {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relativePath = path.join(prefix, entry.name);
    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...await collectLegacyPriceFiles(absolutePath, relativePath));
      continue;
    }

    if (entry.isFile() && entry.name === 'index.html') {
      files.push({ absolutePath, relativePath });
    }
  }

  return files;
}

async function legacyPrices() {
  if (legacyPriceCache) return legacyPriceCache;

  const files = await collectLegacyPriceFiles(legacyProductsDir);
  const prices = [];

  await Promise.all(files.map(async (file) => {
    const identity = legacyProductIdentity(file.relativePath);
    if (!identity) return;

    const source = await fs.readFile(file.absolutePath, 'utf8');
    const match = source.match(/var\s+base_price\s*=\s*([0-9]+(?:\.[0-9]+)?)/);
    if (!match) return;

    prices.push({
      ...identity,
      price: match[1],
      discountPrice: null
    });
  }));

  legacyPriceCache = prices;
  return legacyPriceCache;
}

router.get('/member-prices', async (req, res, next) => {
  try {
    if (!req.session.member) {
      return res.status(401).json({ status: 'failure', message: 'Giriş yapmalısınız.' });
    }

    const [dbProducts, staticProducts] = await Promise.all([
      prisma.product.findMany({
        where: { status: 'PUBLISHED' },
        select: {
          id: true,
          slug: true,
          price: true,
          discountPrice: true
        }
      }),
      legacyPrices()
    ]);

    const productsById = new Map();

    staticProducts.forEach((product) => {
      productsById.set(Number(product.id), product);
    });

    dbProducts.forEach((product) => {
      productsById.set(Number(product.id), {
        id: product.id,
        slug: product.slug,
        price: product.price == null ? null : String(product.price),
        discountPrice: product.discountPrice == null ? null : String(product.discountPrice)
      });
    });

    return res.json({
      status: 'success',
      data: Array.from(productsById.values())
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/categories', async (req, res, next) => {
  try {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]
    });
    res.json({ data: categories });
  } catch (error) {
    next(error);
  }
});

router.get('/blog-posts', async (req, res, next) => {
  try {
    const posts = await prisma.blogPost.findMany({
      where: { status: 'PUBLISHED' },
      include: { blogCategory: true },
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }]
    });
    res.json({ data: posts });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
