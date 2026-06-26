const express = require('express');

const prisma = require('../db');
const { createFormToken } = require('../security/form-protection');

const router = express.Router();

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
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }]
    });
    res.json({ data: posts });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
