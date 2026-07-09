const express = require('express');

const prisma = require('../db');
const { isLikelyBot } = require('../middleware/form-protection');
const { requirePublicCsrf } = require('../middleware/public-csrf');
const { createIpRateLimiter } = require('../middleware/rate-limit');
const { createEnrollment } = require('../services/enrollment');

const router = express.Router();
const enrollmentRateLimiter = createIpRateLimiter({
  scope: 'frontend-enrollment',
  limit: 5,
  windowMs: 15 * 60 * 1000,
  message: 'Çok kısa sürede çok fazla kayıt denemesi yaptınız. Lütfen daha sonra tekrar deneyin.'
});

function positiveId(value) {
  const text = String(value || '');
  if (!/^[1-9]\d*$/.test(text)) return null;

  const id = Number(text);
  return Number.isSafeInteger(id) ? id : null;
}

function cleanSlug(value) {
  const slug = String(value || '').trim();
  if (!slug || slug.length > 220 || slug.includes('/') || slug.includes('\\')) return null;

  return slug;
}

function strictProductMatchEnabled() {
  return String(process.env.LEGACY_ENROLLMENT_STRICT_PRODUCT_MATCH || 'true').trim().toLowerCase() !== 'false';
}

function loginRequired(res, product) {
  const redirectPath = `/urun/${product.slug}/?enroll=1`;

  return res.status(401).json({
    status: 'failure',
    code: 'AUTH_REQUIRED',
    message: 'Eğitime kaydolmak için önce giriş yapmalısınız.',
    loginUrl: `/uye-girisi/?redirect=${encodeURIComponent(redirectPath)}`
  });
}

function silentEnrollmentSuccess(res) {
  return res.json({
    status: 'success',
    message: 'Eğitim kaydınız başarıyla alındı.'
  });
}

function paymentUrl(registrationId) {
  return `/odeme/${registrationId}`;
}

async function resolveProduct({ productId, productSlug }) {
  const productSelect = {
    id: true,
    title: true,
    slug: true,
    price: true,
    discountPrice: true
  };
  const [idProduct, slugProduct] = await Promise.all([
    productId
      ? prisma.product.findFirst({
        where: {
          id: productId,
          status: 'PUBLISHED'
        },
        select: productSelect
      })
      : null,
    productSlug
      ? prisma.product.findFirst({
        where: {
          slug: productSlug,
          status: 'PUBLISHED'
        },
        select: productSelect
      })
      : null
  ]);

  if (
    strictProductMatchEnabled()
    && productId
    && productSlug
    && idProduct
    && idProduct.slug !== productSlug
  ) {
    return {
      conflict: true,
      product: null
    };
  }

  return {
    conflict: false,
    product: slugProduct || idProduct || null
  };
}

router.post('/', requirePublicCsrf, (req, res, next) => {
  if (isLikelyBot(req.body || {}, 'enrollment')) {
    return silentEnrollmentSuccess(res);
  }

  return next();
}, enrollmentRateLimiter, async (req, res, next) => {
  try {
    const productId = positiveId(req.body.productId);
    const productSlug = cleanSlug(req.body.productSlug);

    if (!productId && !productSlug) {
      return res.status(400).json({
        status: 'failure',
        message: 'Geçerli bir eğitim seçmelisiniz.'
      });
    }

    const productResolution = await resolveProduct({ productId, productSlug });

    if (productResolution.conflict) {
      return res.status(409).json({
        status: 'failure',
        code: 'PRODUCT_MISMATCH',
        message: 'Eğitim bilgisi güncel değil. Lütfen sayfayı yenileyip tekrar deneyin.'
      });
    }

    if (!productResolution.product) {
      return res.status(404).json({
        status: 'failure',
        message: 'Eğitim bulunamadı veya kayıt için aktif değil.'
      });
    }

    const product = productResolution.product;

    if (!req.session.member) {
      return loginRequired(res, product);
    }

    const member = await prisma.member.findFirst({
      where: {
        id: positiveId(req.session.member.id) || 0,
        status: 'ACTIVE'
      },
      select: {
        id: true,
        name: true,
        surname: true,
        email: true,
        phone: true
      }
    });

    if (!member) {
      delete req.session.member;
      return loginRequired(res, product);
    }

    if (!member.name || !member.email || !member.phone) {
      return res.status(422).json({
        status: 'failure',
        code: 'PROFILE_INCOMPLETE',
        message: 'Kaydı tamamlamak için ad, e-posta ve telefon bilgileriniz eksiksiz olmalıdır.'
      });
    }

    const totalAmount = product.discountPrice == null ? product.price : product.discountPrice;
    if (totalAmount == null) {
      return res.status(422).json({
        status: 'failure',
        code: 'PRICE_UNAVAILABLE',
        message: 'Bu eğitimin fiyat bilgisi henüz tanımlanmamış. Lütfen danışmanlarımızla iletişime geçin.'
      });
    }

    const result = await createEnrollment(prisma, {
      member,
      product,
      totalAmount
    });

    if (result.existingRegistration) {
      return res.status(409).json({
        status: 'failure',
        code: 'ALREADY_ENROLLED',
        message: result.existingRegistration.paymentStatus === 'PENDING'
          ? 'Bu eğitim için ödeme bekleyen bir kaydınız bulunuyor.'
          : 'Bu eğitim için zaten aktif bir kaydınız bulunuyor.',
        registrationId: result.existingRegistration.id,
        paymentStatus: result.existingRegistration.paymentStatus,
        paymentUrl: result.existingRegistration.paymentStatus === 'PENDING'
          ? paymentUrl(result.existingRegistration.id)
          : null
      });
    }

    return res.status(201).json({
      status: 'success',
      message: 'Eğitim kaydınız başarıyla oluşturuldu.',
      registration: result.registration,
      paymentUrl: paymentUrl(result.registration.id)
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
