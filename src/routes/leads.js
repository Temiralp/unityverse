const express = require('express');

const prisma = require('../db');
const { isLikelyBot, silentSuccess } = require('../middleware/form-protection');
const { requirePublicCsrf } = require('../middleware/public-csrf');
const { createIpRateLimiter } = require('../middleware/rate-limit');

const router = express.Router();
const leadRateLimiter = createIpRateLimiter({
  scope: 'public-lead',
  limit: 8,
  windowMs: 60 * 1000,
  message: 'Çok kısa sürede çok fazla form gönderdiniz. Lütfen bir dakika bekleyip tekrar deneyin.'
});

function normalizeLeadData(body) {
  const data = body || {};
  const keys = Object.keys(data);

  if (keys.length === 1 && data[keys[0]] === '') {
    try {
      return JSON.parse(keys[0]);
    } catch (error) {
      return data;
    }
  }

  return data;
}

function pickFirst(data, keys) {
  for (const key of keys) {
    if (data[key]) return String(data[key]);
  }
  return null;
}

async function saveLead(req, res, next) {
  try {
    const data = req.leadData || normalizeLeadData(req.body);

    await prisma.lead.create({
      data: {
        source: req.path,
        name: pickFirst(data, ['name', 'ad', 'ad_soyad', 'fullname', 'isim']),
        email: pickFirst(data, ['email', 'mail', 'e_mail', 'eposta', 'e_posta']),
        phone: pickFirst(data, ['phone', 'telefon', 'gsm', 'tel']),
        message: pickFirst(data, ['message', 'mesaj', 'note', 'not', 'egitim']),
        payload: data
      }
    });

    res.json({ status: 'success', message: 'Form başarıyla gönderildi.' });
  } catch (error) {
    next(error);
  }
}

function normalizeLeadRequest(req, res, next) {
  const data = normalizeLeadData(req.body);
  req.leadData = data;
  req.body = data;
  return next();
}

function leadBotGuard(req, res, next) {
  if (isLikelyBot(req.leadData || {}, 'lead')) {
    return silentSuccess('lead', res);
  }

  return next();
}

router.post('/sendCustomForm', normalizeLeadRequest, requirePublicCsrf, leadBotGuard, leadRateLimiter, saveLead);
router.post('/askme', normalizeLeadRequest, requirePublicCsrf, leadBotGuard, leadRateLimiter, saveLead);

module.exports = router;
