const {
  decimalToKurus,
  kurusToDecimal,
  registrationIdFromMerchantOid
} = require('./paytr');

const CALLBACK_AUTHOR = 'PayTR Callback';

function callbackPaymentNote(merchantOid) {
  return `PayTR merchant_oid: ${merchantOid}`;
}

function positiveInteger(value) {
  const text = String(value || '').trim();
  if (!/^[1-9]\d*$/.test(text)) return null;

  const number = Number(text);
  return Number.isSafeInteger(number) ? number : null;
}

async function processPaytrCallback(prisma, callback) {
  const registrationId = registrationIdFromMerchantOid(callback.merchantOid);

  if (!registrationId) {
    return { outcome: 'registration_not_found' };
  }

  if (callback.status === 'failed') {
    const registration = await prisma.educationRegistration.findUnique({
      where: { id: registrationId },
      select: { id: true }
    });

    if (!registration) {
      return { outcome: 'registration_not_found' };
    }

    return {
      outcome: 'failed',
      registrationId
    };
  }

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      SELECT pg_advisory_xact_lock(${registrationId}::int)
    `;

    const registration = await tx.educationRegistration.findUnique({
      where: { id: registrationId },
      select: {
        id: true,
        status: true,
        paymentStatus: true,
        paymentMethod: true,
        totalAmount: true,
        courseTitle: true,
        name: true,
        surname: true,
        email: true,
        phone: true
      }
    });

    if (!registration) {
      return { outcome: 'registration_not_found' };
    }

    if (registration.paymentMethod === 'BANK_TRANSFER') {
      return {
        outcome: 'payment_method_mismatch',
        registrationId
      };
    }

    const paymentNote = callbackPaymentNote(callback.merchantOid);
    const existingPayment = await tx.educationPayment.findFirst({
      where: {
        registrationId,
        note: paymentNote
      },
      select: { id: true }
    });

    if (existingPayment || registration.paymentStatus === 'PAID') {
      return {
        outcome: 'duplicate',
        registrationId
      };
    }

    if (registration.totalAmount == null) {
      return {
        outcome: 'amount_mismatch',
        registrationId
      };
    }

    const expectedAmount = decimalToKurus(registration.totalAmount);
    if (callback.paymentAmount !== expectedAmount) {
      return {
        outcome: 'amount_mismatch',
        registrationId
      };
    }

    const nextStatus = 'CONFIRMED';
    await tx.educationPayment.create({
      data: {
        registrationId,
        amount: kurusToDecimal(callback.totalAmount),
        method: 'PayTR',
        paidAt: new Date(),
        note: paymentNote,
        authorName: CALLBACK_AUTHOR
      }
    });

    await tx.educationRegistration.update({
      where: { id: registrationId },
      data: {
        status: nextStatus,
        paymentStatus: 'PAID',
        paymentMethod: 'CARD'
      }
    });

    await tx.educationRegistrationStatusHistory.create({
      data: {
        registrationId,
        fromStatus: registration.status,
        toStatus: nextStatus,
        fromPaymentStatus: registration.paymentStatus,
        toPaymentStatus: 'PAID',
        authorName: CALLBACK_AUTHOR,
        note: paymentNote
      }
    });

    return {
      outcome: 'paid',
      registrationId,
      notification: {
        registration,
        payment: {
          amount: kurusToDecimal(callback.totalAmount),
          merchantOid: callback.merchantOid,
          paymentAmount: callback.paymentAmount,
          totalAmount: callback.totalAmount,
          paymentType: callback.paymentType || 'Kart',
          installmentCount: positiveInteger(callback.installmentCount)
        }
      }
    };
  });
}

module.exports = {
  callbackPaymentNote,
  processPaytrCallback
};
