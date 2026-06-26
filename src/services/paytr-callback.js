const {
  decimalToKurus,
  kurusToDecimal,
  registrationIdFromMerchantOid
} = require('./paytr');

const CALLBACK_AUTHOR = 'PayTR Callback';

function callbackPaymentNote(merchantOid) {
  return `PayTR merchant_oid: ${merchantOid}`;
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
        totalAmount: true
      }
    });

    if (!registration) {
      return { outcome: 'registration_not_found' };
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
        paymentStatus: 'PAID'
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
      registrationId
    };
  });
}

module.exports = {
  callbackPaymentNote,
  processPaytrCallback
};
