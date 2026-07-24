const express = require('express');

const prisma = require('../db');
const { requirePublicCsrf } = require('../middleware/public-csrf');
const { createIpRateLimiter } = require('../middleware/rate-limit');
const {
  PaytrConfigurationError,
  PaytrRequestError,
  requestPaytrIframeToken
} = require('../services/paytr');
const { syncPendingRegistrationAmount } = require('../services/registration-pricing');
const { inspectRegistrationCheckoutProfile } = require('../services/registration-checkout');
const {
  RegistrationPiiConfigurationError,
  RegistrationPiiDecryptionError
} = require('../services/registration-pii');

const router = express.Router();
const paytrTokenRateLimiter = createIpRateLimiter({
  scope: 'paytr-iframe-token',
  limit: 5,
  windowMs: 15 * 60 * 1000,
  message: 'Çok kısa sürede çok fazla ödeme denemesi yaptınız. Lütfen daha sonra tekrar deneyin.'
});
const REQUIRED_AGREEMENTS = [
  'distanceSalesAgreement',
  'privacyAgreement',
  'refundAgreement'
];

function positiveId(value) {
  const text = String(value || '');
  if (!/^[1-9]\d*$/.test(text)) return null;

  const id = Number(text);
  return Number.isSafeInteger(id) ? id : null;
}

function accepted(value) {
  return ['1', 'true', 'on', 'yes'].includes(String(value || '').trim().toLowerCase());
}

function hasRequiredAgreements(body) {
  return REQUIRED_AGREEMENTS.every((key) => accepted(body?.[key]));
}

router.post('/token', requirePublicCsrf, paytrTokenRateLimiter, async (req, res, next) => {
  try {
    if (!req.session.member) {
      return res.status(401).json({
        status: 'failure',
        code: 'AUTH_REQUIRED',
        message: 'Ödeme başlatmak için önce giriş yapmalısınız.'
      });
    }

    const registrationId = positiveId(req.body.registrationId);
    const memberId = positiveId(req.session.member.id);

    if (!registrationId || !memberId) {
      return res.status(400).json({
        status: 'failure',
        message: 'Geçerli bir eğitim kaydı seçmelisiniz.'
      });
    }

    if (!hasRequiredAgreements(req.body)) {
      return res.status(422).json({
        status: 'failure',
        code: 'AGREEMENTS_REQUIRED',
        message: 'Ödeme başlatmak için sözleşme onayları zorunludur.'
      });
    }

    let registration = await prisma.educationRegistration.findFirst({
      where: {
        id: registrationId,
        memberId,
        paymentStatus: 'PENDING',
        status: { not: 'CANCELLED' }
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
            price: true,
            discountPrice: true
          }
        }
      }
    });
    registration = await syncPendingRegistrationAmount(prisma, registration);

    if (!registration) {
      return res.status(404).json({
        status: 'failure',
        message: 'Ödeme bekleyen eğitim kaydı bulunamadı.'
      });
    }

    const profileResult = inspectRegistrationCheckoutProfile(registration);
    if (!profileResult.isValid) {
      return res.status(422).json({
        status: 'failure',
        code: 'REGISTRATION_PROFILE_INCOMPLETE',
        message: 'Ödeme başlatmadan önce kayıt bilgilerinizi tamamlayınız.',
        errors: profileResult.errors
      });
    }

    const result = await requestPaytrIframeToken({
      registration,
      userIp: req.ip
    });

    return res.json({
      status: 'success',
      token: result.token,
      merchantOid: result.merchantOid,
      paymentOptions: result.paymentOptions
    });
  } catch (error) {
    if (error instanceof RegistrationPiiConfigurationError || error instanceof RegistrationPiiDecryptionError) {
      console.error('[paytr] Registration PII could not be read:', error.message);
      return res.status(503).json({
        status: 'failure',
        code: 'REGISTRATION_SECURITY_UNAVAILABLE',
        message: 'Kayıt güvenliği yapılandırması nedeniyle ödeme şu anda başlatılamıyor.'
      });
    }

    if (error instanceof PaytrConfigurationError) {
      console.error('[paytr] configuration error:', error.message);
      return res.status(503).json({
        status: 'failure',
        code: 'PAYTR_CONFIGURATION_ERROR',
        message: 'Ödeme sistemi yapılandırması tamamlanmamış.'
      });
    }

    if (error instanceof PaytrRequestError) {
      console.error('[paytr] token request failed:', {
        message: error.message,
        reason: error.reason,
        statusCode: error.statusCode
      });
      return res.status(502).json({
        status: 'failure',
        code: 'PAYTR_TOKEN_FAILED',
        message: 'Ödeme formu şu anda başlatılamıyor. Lütfen daha sonra tekrar deneyin.'
      });
    }

    return next(error);
  }
});

module.exports = router;
