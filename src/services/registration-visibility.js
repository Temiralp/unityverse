const WEBSITE_ENROLLMENT_SOURCE = 'website-enrollment';
const SETTLED_PAYMENT_STATUSES = ['PARTIAL', 'PAID', 'REFUNDED'];

function combineWhere(filters, visibility) {
  if (!filters || Object.keys(filters).length === 0) return visibility;

  return {
    AND: [visibility, filters]
  };
}

function adminVisibleRegistrationWhere(filters = {}) {
  return combineWhere(filters, {
    OR: [
      { source: { not: WEBSITE_ENROLLMENT_SOURCE } },
      { paymentMethod: 'BANK_TRANSFER' },
      { paymentStatus: { in: SETTLED_PAYMENT_STATUSES } }
    ]
  });
}

function pendingCheckoutWhere(filters = {}) {
  return combineWhere(filters, {
    source: WEBSITE_ENROLLMENT_SOURCE,
    status: { not: 'CANCELLED' },
    paymentStatus: 'PENDING',
    paymentMethod: null
  });
}

function isPendingCheckout(registration) {
  return Boolean(
    registration
    && registration.source === WEBSITE_ENROLLMENT_SOURCE
    && registration.status !== 'CANCELLED'
    && registration.paymentStatus === 'PENDING'
    && registration.paymentMethod == null
  );
}

function isAdminVisibleRegistration(registration) {
  if (!registration) return false;
  if (registration.source !== WEBSITE_ENROLLMENT_SOURCE) return true;

  return registration.paymentMethod === 'BANK_TRANSFER'
    || SETTLED_PAYMENT_STATUSES.includes(registration.paymentStatus);
}

module.exports = {
  WEBSITE_ENROLLMENT_SOURCE,
  adminVisibleRegistrationWhere,
  isAdminVisibleRegistration,
  isPendingCheckout,
  pendingCheckoutWhere
};
