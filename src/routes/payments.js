const express = require('express');

const { requirePaytrCallbackIp } = require('../config/paytr-allowed-ips');
const prisma = require('../db');
const { createIpRateLimiter } = require('../middleware/rate-limit');
const {
  PaytrConfigurationError,
  PaytrRequestError,
  requestPaytrIframeToken,
  verifyPaytrCallbackHash
} = require('../services/paytr');
const { processPaytrCallback } = require('../services/paytr-callback');

const router = express.Router();
const paymentPageRateLimiter = createIpRateLimiter({
  scope: 'paytr-payment-page',
  limit: 10,
  windowMs: 15 * 60 * 1000,
  message: 'Çok kısa sürede çok fazla ödeme denemesi yaptınız. Lütfen daha sonra tekrar deneyin.'
});

function positiveId(value) {
  const text = String(value || '');
  if (!/^[1-9]\d*$/.test(text)) return null;

  const id = Number(text);
  return Number.isSafeInteger(id) ? id : null;
}

function loginUrl(registrationId) {
  return `/uye-girisi/?redirect=${encodeURIComponent(`/odeme/${registrationId}`)}`;
}

function formatMoney(value) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) return '';

  return amount.toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

async function ownRegistration(req, registrationId) {
  const memberId = positiveId(req.session.member?.id);
  if (!memberId) return null;

  return prisma.educationRegistration.findFirst({
    where: {
      id: registrationId,
      memberId
    },
    include: {
      member: {
        select: {
          email: true,
          phone: true
        }
      },
      product: {
        select: {
          slug: true,
          price: true,
          discountPrice: true
        }
      }
    }
  });
}

function renderPaymentResult(res, options) {
  return res.status(options.statusCode || 200).render('payments/result', {
    activeNav: '',
    pageTitle: options.pageTitle,
    extraStyles: ['/public/tema10/css/payment.css'],
    type: options.type,
    eyebrow: options.eyebrow,
    title: options.title,
    message: options.message,
    registration: options.registration || null,
    paymentUrl: options.paymentUrl || null,
    courseUrl: options.courseUrl || '/tum-urunler/'
  });
}

function callbackText(res, statusCode, message) {
  res.type('text/plain');
  return res.status(statusCode).send(message);
}

router.post('/callback', requirePaytrCallbackIp, async (req, res, next) => {
  try {
    const merchantOid = String(req.body.merchant_oid || '').trim();
    const status = String(req.body.status || '').trim();
    const totalAmount = String(req.body.total_amount || '').trim();
    const paymentAmount = String(req.body.payment_amount || '').trim();
    const suppliedHash = String(req.body.hash || '').trim();

    if (
      !merchantOid
      || !['success', 'failed'].includes(status)
      || !/^\d+$/.test(totalAmount)
      || (status === 'success' && !/^[1-9]\d*$/.test(paymentAmount))
      || !suppliedHash
    ) {
      return callbackText(res, 400, 'PAYTR notification failed: invalid payload');
    }

    const hashValues = { merchantOid, status, totalAmount };
    if (!verifyPaytrCallbackHash(hashValues, suppliedHash)) {
      console.warn('[paytr] callback rejected: bad hash', { merchantOid });
      return callbackText(res, 403, 'PAYTR notification failed: bad hash');
    }

    const result = await processPaytrCallback(prisma, {
      merchantOid,
      status,
      totalAmount,
      paymentAmount,
      paymentType: String(req.body.payment_type || '').trim(),
      currency: String(req.body.currency || '').trim(),
      failedReasonCode: String(req.body.failed_reason_code || '').trim(),
      failedReasonMessage: String(req.body.failed_reason_msg || '').trim()
    });

    if (result.outcome === 'registration_not_found') {
      console.error('[paytr] callback registration not found', { merchantOid });
      return callbackText(res, 404, 'PAYTR notification failed: order not found');
    }

    if (result.outcome === 'amount_mismatch') {
      console.error('[paytr] callback amount mismatch', {
        merchantOid,
        paymentAmount
      });
      return callbackText(res, 422, 'PAYTR notification failed: amount mismatch');
    }

    if (result.outcome === 'failed') {
      console.warn('[paytr] payment failed', {
        merchantOid,
        failedReasonCode: req.body.failed_reason_code || null,
        failedReasonMessage: req.body.failed_reason_msg || null
      });
    }

    return callbackText(res, 200, 'OK');
  } catch (error) {
    if (error instanceof PaytrConfigurationError || error instanceof PaytrRequestError) {
      console.error('[paytr] callback processing error:', error.message);
      return callbackText(res, 500, 'PAYTR notification failed');
    }

    return next(error);
  }
});

router.get('/basarili', async (req, res, next) => {
  try {
    const registrationId = positiveId(req.query.registrationId);
    const registration = registrationId && req.session.member
      ? await ownRegistration(req, registrationId)
      : null;

    return renderPaymentResult(res, {
      pageTitle: 'Ödeme Alındı | Unityverse Academy',
      type: 'success',
      eyebrow: 'İşlem Tamamlandı',
      title: 'Ödemeniz alındı',
      message: 'Ödeme sonucunuz güvenli şekilde kontrol ediliyor. Kesin ödeme durumu kısa süre içinde kaydınıza yansıyacaktır.',
      registration,
      courseUrl: registration?.product?.slug
        ? `/urun/${registration.product.slug}/`
        : '/tum-urunler/'
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/basarisiz', async (req, res, next) => {
  try {
    const registrationId = positiveId(req.query.registrationId);
    const registration = registrationId && req.session.member
      ? await ownRegistration(req, registrationId)
      : null;

    return renderPaymentResult(res, {
      pageTitle: 'Ödeme Tamamlanamadı | Unityverse Academy',
      type: 'failure',
      eyebrow: 'İşlem Tamamlanamadı',
      title: 'Ödeme tamamlanamadı',
      message: 'Kart bilgilerinizi kontrol ederek tekrar deneyebilir veya eğitim danışmanlarımızla iletişime geçebilirsiniz.',
      registration,
      paymentUrl: registrationId ? `/odeme/${registrationId}` : null,
      courseUrl: registration?.product?.slug
        ? `/urun/${registration.product.slug}/`
        : '/tum-urunler/'
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/:registrationId(\\d+)', paymentPageRateLimiter, async (req, res, next) => {
  try {
    const registrationId = positiveId(req.params.registrationId);

    if (!registrationId) {
      return res.status(404).send('Eğitim kaydı bulunamadı');
    }

    if (!req.session.member) {
      return res.redirect(loginUrl(registrationId));
    }

    const registration = await ownRegistration(req, registrationId);

    if (!registration) {
      return res.status(404).send('Eğitim kaydı bulunamadı');
    }

    if (registration.paymentStatus === 'PAID') {
      return renderPaymentResult(res, {
        pageTitle: 'Ödeme Durumu | Unityverse Academy',
        type: 'success',
        eyebrow: 'Ödeme Durumu',
        title: 'Bu eğitim zaten ödendi',
        message: 'Bu eğitim kaydının ödemesi daha önce tamamlanmış görünüyor.',
        registration,
        courseUrl: registration.product?.slug
          ? `/urun/${registration.product.slug}/`
          : '/tum-urunler/'
      });
    }

    if (registration.paymentStatus !== 'PENDING' || registration.status === 'CANCELLED') {
      return renderPaymentResult(res, {
        statusCode: 409,
        pageTitle: 'Ödeme Durumu | Unityverse Academy',
        type: 'failure',
        eyebrow: 'Ödeme Durumu',
        title: 'Ödeme şu anda başlatılamıyor',
        message: 'Bu eğitim kaydının mevcut durumu yeni bir ödeme başlatmaya uygun değil.',
        registration,
        courseUrl: registration.product?.slug
          ? `/urun/${registration.product.slug}/`
          : '/tum-urunler/'
      });
    }

    const paytr = await requestPaytrIframeToken({
      registration,
      userIp: req.ip
    });

    return res.render('payments/iframe', {
      activeNav: '',
      pageTitle: `Güvenli Ödeme | ${registration.courseTitle}`,
      extraStyles: ['/public/tema10/css/payment.css'],
      extraScripts: [
        'https://www.paytr.com/js/iframeResizer.min.js',
        '/public/tema10/js/payment.js'
      ],
      registration,
      formattedAmount: formatMoney(registration.totalAmount),
      iframeUrl: `https://www.paytr.com/odeme/guvenli/${encodeURIComponent(paytr.token)}`
    });
  } catch (error) {
    if (error instanceof PaytrConfigurationError) {
      console.error('[paytr] payment page configuration error:', error.message);
      return renderPaymentResult(res, {
        statusCode: 503,
        pageTitle: 'Ödeme Sistemi | Unityverse Academy',
        type: 'failure',
        eyebrow: 'Ödeme Sistemi',
        title: 'Ödeme sistemi hazırlanıyor',
        message: 'Ödeme sistemi yapılandırması henüz tamamlanmamış. Lütfen daha sonra tekrar deneyin.',
        paymentUrl: req.params.registrationId
          ? `/odeme/${req.params.registrationId}`
          : null
      });
    }

    if (error instanceof PaytrRequestError) {
      console.error('[paytr] payment page token failed:', {
        message: error.message,
        reason: error.reason,
        statusCode: error.statusCode
      });
      return renderPaymentResult(res, {
        statusCode: 502,
        pageTitle: 'Ödeme Sistemi | Unityverse Academy',
        type: 'failure',
        eyebrow: 'Ödeme Sistemi',
        title: 'Ödeme formu açılamadı',
        message: 'Güvenli ödeme formu şu anda başlatılamıyor. Lütfen kısa süre sonra tekrar deneyin.',
        paymentUrl: req.params.registrationId
          ? `/odeme/${req.params.registrationId}`
          : null
      });
    }

    return next(error);
  }
});

module.exports = router;
