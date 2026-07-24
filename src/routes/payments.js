const express = require('express');

const { requirePaytrCallbackIp } = require('../config/paytr-allowed-ips');
const prisma = require('../db');
const { requirePublicCsrf } = require('../middleware/public-csrf');
const { createIpRateLimiter } = require('../middleware/rate-limit');
const {
  PaytrConfigurationError,
  PaytrRequestError,
  requestPaytrIframeToken,
  verifyPaytrCallbackHash
} = require('../services/paytr');
const { processPaytrCallback } = require('../services/paytr-callback');
const {
  sendBankTransferEmails,
  sendCardPaymentEmails
} = require('../services/payment-notifications');
const { syncPendingRegistrationAmount } = require('../services/registration-pricing');
const { inspectRegistrationCheckoutProfile } = require('../services/registration-checkout');
const {
  RegistrationPiiConfigurationError,
  RegistrationPiiDecryptionError
} = require('../services/registration-pii');

const router = express.Router();
const paymentPageRateLimiter = createIpRateLimiter({
  scope: 'paytr-payment-page',
  limit: 10,
  windowMs: 15 * 60 * 1000,
  message: 'Çok kısa sürede çok fazla ödeme denemesi yaptınız. Lütfen daha sonra tekrar deneyin.'
});
const bankTransferRateLimiter = createIpRateLimiter({
  scope: 'bank-transfer-notice',
  limit: 5,
  windowMs: 15 * 60 * 1000,
  message: 'Çok kısa sürede çok fazla havale bildirimi gönderdiniz. Lütfen daha sonra tekrar deneyin.'
});
const REQUIRED_AGREEMENTS = [
  'distanceSalesAgreement',
  'privacyAgreement',
  'refundAgreement'
];

function paymentOptionsFromEnv() {
  const noInstallment = String(process.env.PAYTR_NO_INSTALLMENT || '0').trim();
  const maxInstallment = String(process.env.PAYTR_MAX_INSTALLMENT || '0').trim();

  return {
    installmentsEnabled: noInstallment !== '1',
    noInstallment,
    maxInstallment
  };
}

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

function accepted(value) {
  return ['1', 'true', 'on', 'yes'].includes(String(value || '').trim().toLowerCase());
}

function hasRequiredAgreements(body) {
  return REQUIRED_AGREEMENTS.every((key) => accepted(body?.[key]));
}

function bankTransferDetails(registration) {
  const amount = registration ? formatMoney(registration.totalAmount) : '';

return {
  accountName: String(process.env.BANK_TRANSFER_ACCOUNT_NAME || 'Unityverse Academy').trim(),
  bankName: String(process.env.BANK_TRANSFER_BANK_NAME || '').trim(),
  accountNo: String(process.env.BANK_TRANSFER_ACCOUNT_NO || '').trim(),
  iban: String(process.env.BANK_TRANSFER_IBAN || '').trim(),
  branch: String(process.env.BANK_TRANSFER_BRANCH || '').trim(),
  reference: registration ? `UV-${registration.id}` : '',
  amount
};

}

function whatsappInstallmentUrl(registration) {
  const phone = String(process.env.WHATSAPP_PHONE || '905454228887').replace(/\D/g, '');
  const message = [
    'Merhaba, taksitli ödeme seçenekleri hakkında bilgi almak istiyorum.',
    registration ? `Eğitim: ${registration.courseTitle}` : '',
    registration ? `Kayıt No: ${registration.id}` : ''
  ].filter(Boolean).join('\n');

  return `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`;
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

function enrollmentFormUrl(registration) {
  return registration?.product?.slug
    ? `/urun/${registration.product.slug}/?enroll=1`
    : '/tum-urunler/';
}

function renderIncompleteRegistration(res, registration) {
  return renderPaymentResult(res, {
    statusCode: 422,
    pageTitle: 'Kayıt Bilgileri | Unityverse Academy',
    type: 'failure',
    eyebrow: 'Eksik Bilgi',
    title: 'Ödemeden önce bilgilerinizi tamamlayın',
    message: 'Ödeme başlatmak için kimlik, iletişim, doğum tarihi ve adres bilgilerinizi eksiksiz doldurmalısınız.',
    registration,
    courseUrl: enrollmentFormUrl(registration)
  });
}

function callbackText(res, statusCode, message) {
  res.type('text/plain');
  return res.status(statusCode).send(message);
}

function callbackInstallmentCount(body) {
  const value = String(
    body.installment_count
    || body.installment
    || body.installment_count_selected
    || ''
  ).trim();

  return /^[1-9]\d*$/.test(value) ? value : '';
}

router.post('/:registrationId(\\d+)/havale', requirePublicCsrf, bankTransferRateLimiter, async (req, res, next) => {
  try {
    const registrationId = positiveId(req.params.registrationId);

    if (!registrationId) {
      return res.status(404).send('Eğitim kaydı bulunamadı');
    }

    if (!req.session.member) {
      return res.redirect(loginUrl(registrationId));
    }

    if (!hasRequiredAgreements(req.body)) {
      let registration = await ownRegistration(req, registrationId);
      registration = await syncPendingRegistrationAmount(prisma, registration);

      return renderPaymentResult(res, {
        statusCode: 422,
        pageTitle: 'Havale/EFT Bildirimi | Unityverse Academy',
        type: 'failure',
        eyebrow: 'Sözleşme Onayı',
        title: 'Sözleşme onayı gerekli',
        message: 'Havale/EFT bildirimi göndermek için sözleşme onaylarını işaretlemelisiniz.',
        registration,
        paymentUrl: `/odeme/${registrationId}`,
        courseUrl: registration?.product?.slug
          ? `/urun/${registration.product.slug}/`
          : '/tum-urunler/'
      });
    }

    let registration = await ownRegistration(req, registrationId);
    registration = await syncPendingRegistrationAmount(prisma, registration);

    if (!registration) {
      return res.status(404).send('Eğitim kaydı bulunamadı');
    }

    if (registration.paymentStatus === 'PAID') {
      return renderPaymentResult(res, {
        pageTitle: 'Havale/EFT Bildirimi | Unityverse Academy',
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
        pageTitle: 'Havale/EFT Bildirimi | Unityverse Academy',
        type: 'failure',
        eyebrow: 'Ödeme Durumu',
        title: 'Havale bildirimi şu anda alınamıyor',
        message: 'Bu eğitim kaydının mevcut durumu havale bildirimi almaya uygun değil.',
        registration,
        courseUrl: registration.product?.slug
          ? `/urun/${registration.product.slug}/`
          : '/tum-urunler/'
      });
    }

    if (!inspectRegistrationCheckoutProfile(registration).isValid) {
      return renderIncompleteRegistration(res, registration);
    }

    const details = bankTransferDetails(registration);
    const notice = [
      'Üye Havale/EFT ödeme yöntemini seçti.',
      `Beklenen tutar: ${details.amount} TL`,
      `Açıklama: ${details.reference}`,
      details.iban ? `IBAN: ${details.iban}` : '',
      details.bankName ? `Banka: ${details.bankName}` : ''
    ].filter(Boolean).join('\n');

    await prisma.educationRegistrationNote.create({
      data: {
        registrationId,
        note: notice,
        authorName: 'Üye'
      }
    });

    void sendBankTransferEmails({
      registration,
      bankTransfer: details
    });

    return renderPaymentResult(res, {
      pageTitle: 'Havale/EFT Bildirimi Alındı | Unityverse Academy',
      type: 'success',
      eyebrow: 'Havale/EFT',
      title: 'Havale bildiriminiz alındı',
      message: `Ödeme açıklamasına ${details.reference} yazarak havalenizi gerçekleştirebilirsiniz. Ödemeniz danışman ekibimiz tarafından kontrol edildikten sonra kaydınıza işlenecektir.`,
      registration,
      paymentUrl: `/odeme/${registrationId}`,
      courseUrl: registration.product?.slug
        ? `/urun/${registration.product.slug}/`
        : '/tum-urunler/'
    });
  } catch (error) {
    if (error instanceof RegistrationPiiConfigurationError || error instanceof RegistrationPiiDecryptionError) {
      console.error('[payment] Registration PII could not be read:', error.message);
      return res.status(503).send('Kayıt güvenliği yapılandırması nedeniyle ödeme şu anda başlatılamıyor.');
    }
    return next(error);
  }
});

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
      installmentCount: callbackInstallmentCount(req.body),
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

    if (result.outcome === 'paid' && result.notification) {
      void sendCardPaymentEmails(result.notification);
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

    let registration = await ownRegistration(req, registrationId);
    registration = await syncPendingRegistrationAmount(prisma, registration);

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

    if (!inspectRegistrationCheckoutProfile(registration).isValid) {
      return renderIncompleteRegistration(res, registration);
    }

    let paytr = null;
    let cardPaymentError = null;

    try {
      paytr = await requestPaytrIframeToken({
        registration,
        userIp: req.ip
      });
    } catch (error) {
      if (!(error instanceof PaytrConfigurationError) && !(error instanceof PaytrRequestError)) {
        throw error;
      }

      console.error('[paytr] payment page token failed:', {
        message: error.message,
        reason: error.reason,
        statusCode: error.statusCode
      });
      cardPaymentError = 'Kartla ödeme formu şu anda başlatılamıyor. Havale/EFT ile ödeme yapabilir veya daha sonra tekrar deneyebilirsiniz.';
    }

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
      installmentWhatsappUrl: whatsappInstallmentUrl(registration),
      bankTransfer: bankTransferDetails(registration),
      paymentOptions: paytr ? paytr.paymentOptions : paymentOptionsFromEnv(),
      iframeUrl: paytr ? `https://www.paytr.com/odeme/guvenli/${encodeURIComponent(paytr.token)}` : '',
      cardPaymentError
    });
  } catch (error) {
    if (error instanceof RegistrationPiiConfigurationError || error instanceof RegistrationPiiDecryptionError) {
      console.error('[payment] Registration PII could not be read:', error.message);
      return renderPaymentResult(res, {
        statusCode: 503,
        pageTitle: 'Ödeme Sistemi | Unityverse Academy',
        type: 'failure',
        eyebrow: 'Ödeme Sistemi',
        title: 'Ödeme güvenliği hazırlanıyor',
        message: 'Kayıt güvenliği yapılandırması tamamlanmadan ödeme başlatılamaz.',
        paymentUrl: null
      });
    }

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
