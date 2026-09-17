function currentProductAmount(product) {
  if (!product) return null;

  return product.discountPrice == null ? product.price : product.discountPrice;
}

function decimalCents(value) {
  const text = String(value == null ? '' : value).trim();
  const match = text.match(/^(\d+)(?:\.(\d{1,2}))?$/);

  if (!match) return null;

  return `${match[1]}.${String(match[2] || '').padEnd(2, '0')}`;
}

async function syncPendingRegistrationAmount(prisma, registration) {
  const currentAmount = currentProductAmount(registration?.product);

  if (
    !registration
    || registration.paymentStatus !== 'PENDING'
    || registration.status === 'CANCELLED'
    || registration.paymentMethod === 'BANK_TRANSFER'
    || registration.couponId != null
    || currentAmount == null
    || decimalCents(registration.totalAmount) === decimalCents(currentAmount)
  ) {
    return registration;
  }

  return prisma.educationRegistration.update({
    where: { id: registration.id },
    data: { totalAmount: currentAmount },
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
          discountPrice: true,
          bankTransferDiscountRate: true
        }
      }
    }
  });
}

// Havale/EFT kilidinde esas alinacak tutar: kayitta saklanan totalAmount (kupon uygulanmis /
// odeme sayfasinda senkronlanmis, ogrenciye gosterilen tutar) korunur; yalnizca bossa kursun
// guncel fiyati kullanilir. Kart (PayTR) akisiyla ayni kural.
function bankTransferBaseAmount(registration) {
  if (registration && registration.totalAmount != null) return String(registration.totalAmount);
  return currentProductAmount(registration && registration.product);
}

module.exports = {
  bankTransferBaseAmount,
  currentProductAmount,
  syncPendingRegistrationAmount
};
