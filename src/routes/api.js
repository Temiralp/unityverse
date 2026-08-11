const express = require('express');

const prisma = require('../db');
const { createFormToken } = require('../security/form-protection');
const { bankTransferQuote } = require('../services/bank-transfer-pricing');
const locationRoutes = require('./locations');

const router = express.Router();

router.use('/locations', locationRoutes);

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

function serializeMemberPrices(products) {
  return products.map((product) => {
    const transferQuote = bankTransferQuote(product);

    return {
      id: product.id,
      slug: product.slug,
      price: product.price == null ? null : String(product.price),
      discountPrice: product.discountPrice == null ? null : String(product.discountPrice),
      bankTransferDiscountRate: transferQuote.discountRate,
      bankTransferAmount: transferQuote.amount
    };
  });
}

router.get('/member-prices', async (req, res, next) => {
  try {
    if (!req.session.member) {
      return res.status(401).json({ status: 'failure', message: 'Giriş yapmalısınız.' });
    }

    const dbProducts = await prisma.product.findMany({
      where: { status: 'PUBLISHED' },
      select: {
        id: true,
        slug: true,
        price: true,
        discountPrice: true,
        bankTransferDiscountRate: true
      }
    });

    return res.json({
      status: 'success',
      data: serializeMemberPrices(dbProducts)
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
module.exports.serializeMemberPrices = serializeMemberPrices;
