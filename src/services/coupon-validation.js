const { Decimal } = require('@prisma/client/runtime/library');

class CouponValidationError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'CouponValidationError';
    this.code = code;
  }
}

const ERROR_CODES = {
  NOT_FOUND: 'NOT_FOUND',
  INACTIVE: 'INACTIVE',
  NOT_STARTED: 'NOT_STARTED',
  EXPIRED: 'EXPIRED',
  USAGE_LIMIT: 'USAGE_LIMIT',
  ALREADY_USED: 'ALREADY_USED',
  PRODUCT_MISMATCH: 'PRODUCT_MISMATCH',
  ALREADY_APPLIED: 'ALREADY_APPLIED',
  INVALID_REGISTRATION: 'INVALID_REGISTRATION'
};

const ERROR_MESSAGES = {
  NOT_FOUND: 'Girdiğiniz kupon kodu geçersiz.',
  INACTIVE: 'Bu kupon kodu aktif değil.',
  NOT_STARTED: 'Bu kupon kodu henüz geçerli değil.',
  EXPIRED: 'Bu kupon kodunun süresi dolmuş.',
  USAGE_LIMIT: 'Bu kupon kodunun kullanım limiti dolmuş.',
  ALREADY_USED: 'Bu kupon kodunu daha önce kullandınız.',
  PRODUCT_MISMATCH: 'Bu kupon kodu bu eğitim için geçerli değil.',
  ALREADY_APPLIED: 'Bu kayıtta zaten bir kupon uygulanmış.',
  INVALID_REGISTRATION: 'Kayıt durumu kupon uygulamaya uygun değil.'
};

function calculateDiscount(totalAmount, discountType, discountValue) {
  const amount = new Decimal(totalAmount);
  const value = new Decimal(discountValue);

  if (discountType === 'PERCENT') {
    const discount = amount.mul(value).div(100);
    return {
      discount: Decimal.min(discount, amount.sub(1)),
      newTotal: Decimal.max(amount.sub(discount), new Decimal('1.00'))
    };
  }

  // AMOUNT (fixed TL)
  return {
    discount: Decimal.min(value, amount.sub(1)),
    newTotal: Decimal.max(amount.sub(value), new Decimal('1.00'))
  };
}

async function validateCoupon(prisma, couponCode, productId, memberId) {
  const code = String(couponCode || '').trim().toUpperCase();

  if (!code) {
    throw new CouponValidationError(ERROR_MESSAGES.NOT_FOUND, ERROR_CODES.NOT_FOUND);
  }

  const coupon = await prisma.coupon.findUnique({
    where: { code },
    include: {
      products: {
        select: { productId: true }
      }
    }
  });

  if (!coupon) {
    throw new CouponValidationError(ERROR_MESSAGES.NOT_FOUND, ERROR_CODES.NOT_FOUND);
  }

  if (!coupon.isActive) {
    throw new CouponValidationError(ERROR_MESSAGES.INACTIVE, ERROR_CODES.INACTIVE);
  }

  const now = new Date();

  if (coupon.startsAt && coupon.startsAt > now) {
    throw new CouponValidationError(ERROR_MESSAGES.NOT_STARTED, ERROR_CODES.NOT_STARTED);
  }

  if (coupon.expiresAt && coupon.expiresAt < now) {
    throw new CouponValidationError(ERROR_MESSAGES.EXPIRED, ERROR_CODES.EXPIRED);
  }

  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
    throw new CouponValidationError(ERROR_MESSAGES.USAGE_LIMIT, ERROR_CODES.USAGE_LIMIT);
  }

  // Check if member already used this coupon
  if (memberId) {
    const existingUsage = await prisma.educationRegistration.findFirst({
      where: {
        memberId,
        couponId: coupon.id,
        paymentStatus: { not: 'REFUNDED' }
      }
    });

    if (existingUsage) {
      throw new CouponValidationError(ERROR_MESSAGES.ALREADY_USED, ERROR_CODES.ALREADY_USED);
    }
  }

  // Check product restriction
  if (coupon.products.length > 0 && productId) {
    const isProductAllowed = coupon.products.some(
      (cp) => cp.productId === productId
    );

    if (!isProductAllowed) {
      throw new CouponValidationError(ERROR_MESSAGES.PRODUCT_MISMATCH, ERROR_CODES.PRODUCT_MISMATCH);
    }
  }

  return coupon;
}

async function applyCoupon(prisma, registrationId, couponCode, memberId) {
  const registration = await prisma.educationRegistration.findUnique({
    where: { id: registrationId },
    include: {
      product: {
        select: {
          id: true,
          slug: true,
          price: true,
          discountPrice: true,
          bankTransferDiscountRate: true
        }
      }
    }
  });

  if (
    !registration
    || registration.paymentStatus !== 'PENDING'
    || registration.status === 'CANCELLED'
    || registration.paymentMethod === 'BANK_TRANSFER'
  ) {
    throw new CouponValidationError(ERROR_MESSAGES.INVALID_REGISTRATION, ERROR_CODES.INVALID_REGISTRATION);
  }

  if (registration.couponId) {
    throw new CouponValidationError(ERROR_MESSAGES.ALREADY_APPLIED, ERROR_CODES.ALREADY_APPLIED);
  }

  const coupon = await validateCoupon(prisma, couponCode, registration.product?.id, memberId);

  // Calculate original amount (without any coupon)
  const baseAmount = registration.product?.discountPrice != null
    ? registration.product.discountPrice
    : registration.product?.price;

  const totalAmount = baseAmount || registration.totalAmount;
  const { discount, newTotal } = calculateDiscount(totalAmount, coupon.discountType, coupon.discountValue);

  // Apply in transaction
  return prisma.$transaction(async (tx) => {
    const updated = await tx.educationRegistration.update({
      where: { id: registrationId },
      data: {
        couponId: coupon.id,
        couponCode: coupon.code,
        couponDiscount: discount,
        totalAmount: newTotal
      },
      include: {
        product: {
          select: {
            slug: true,
            price: true,
            discountPrice: true,
            bankTransferDiscountRate: true
          }
        }
      }
    });

    await tx.coupon.update({
      where: { id: coupon.id },
      data: { usedCount: { increment: 1 } }
    });

    await tx.educationRegistrationNote.create({
      data: {
        registrationId,
        note: `Kupon uygulandı: ${coupon.code} (${coupon.discountType === 'PERCENT' ? '%' + coupon.discountValue : coupon.discountValue + ' TL'} indirim). İndirim: ${discount} TL. Yeni tutar: ${newTotal} TL.`,
        authorName: 'Sistem'
      }
    });

    return {
      registration: updated,
      coupon,
      discount: String(discount),
      newTotal: String(newTotal)
    };
  });
}

async function removeCoupon(prisma, registrationId, memberId) {
  const registration = await prisma.educationRegistration.findUnique({
    where: { id: registrationId },
    include: {
      product: {
        select: {
          id: true,
          slug: true,
          price: true,
          discountPrice: true,
          bankTransferDiscountRate: true
        }
      }
    }
  });

  if (
    !registration
    || !registration.couponId
    || registration.paymentStatus !== 'PENDING'
    || registration.status === 'CANCELLED'
    || registration.paymentMethod === 'BANK_TRANSFER'
  ) {
    return null;
  }

  const baseAmount = registration.product?.discountPrice != null
    ? registration.product.discountPrice
    : registration.product?.price;

  const originalTotal = baseAmount || new Decimal(String(registration.totalAmount)).add(new Decimal(String(registration.couponDiscount)));

  return prisma.$transaction(async (tx) => {
    const updated = await tx.educationRegistration.update({
      where: { id: registrationId },
      data: {
        couponId: null,
        couponCode: null,
        couponDiscount: null,
        totalAmount: originalTotal
      },
      include: {
        product: {
          select: {
            slug: true,
            price: true,
            discountPrice: true,
            bankTransferDiscountRate: true
          }
        }
      }
    });

    await tx.coupon.update({
      where: { id: registration.couponId },
      data: { usedCount: { decrement: 1 } }
    });

    await tx.educationRegistrationNote.create({
      data: {
        registrationId,
        note: `Kupon kaldırıldı: ${registration.couponCode}. Tutar eski haline döndü: ${originalTotal} TL.`,
        authorName: 'Sistem'
      }
    });

    return {
      registration: updated,
      newTotal: String(originalTotal)
    };
  });
}

module.exports = {
  CouponValidationError,
  ERROR_CODES,
  validateCoupon,
  applyCoupon,
  removeCoupon
};
