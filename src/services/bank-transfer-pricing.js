const DEFAULT_BANK_TRANSFER_DISCOUNT_RATE = '10.00';
const RATE_SCALE = 2;
const RATE_FACTOR = 10000n;
const MONEY_SCALE = 2;

function normalizedDecimal(value) {
  return String(value == null ? '' : value).trim().replace(',', '.');
}

function parseScaledDecimal(value, scale) {
  const normalized = normalizedDecimal(value);
  const match = normalized.match(/^(\d+)(?:\.(\d+))?$/);
  if (!match || String(match[2] || '').length > scale) return null;

  const factor = 10n ** BigInt(scale);
  const fraction = String(match[2] || '').padEnd(scale, '0');
  return (BigInt(match[1]) * factor) + BigInt(fraction || '0');
}

function scaledDecimal(value, scale) {
  const factor = 10n ** BigInt(scale);
  const whole = value / factor;
  const fraction = String(value % factor).padStart(scale, '0');
  return `${whole}.${fraction}`;
}

function normalizeBankTransferDiscountRate(value, fallback = null) {
  const rate = parseScaledDecimal(value, RATE_SCALE);
  if (rate == null) return fallback;
  if (rate < 0n || rate >= RATE_FACTOR) return null;
  return scaledDecimal(rate, RATE_SCALE);
}

function isValidBankTransferDiscountRate(value) {
  return normalizeBankTransferDiscountRate(value) !== null;
}

function effectiveProductAmount(product) {
  if (!product) return null;
  return product.discountPrice == null ? product.price : product.discountPrice;
}

function calculateBankTransferAmount(amount, discountRate) {
  const amountInCents = parseScaledDecimal(amount, MONEY_SCALE);
  const rateInBasisPoints = parseScaledDecimal(discountRate, RATE_SCALE);

  if (
    amountInCents == null
    || rateInBasisPoints == null
    || rateInBasisPoints < 0n
    || rateInBasisPoints >= RATE_FACTOR
  ) {
    return null;
  }

  const discountedNumerator = amountInCents * (RATE_FACTOR - rateInBasisPoints);
  const discountedCents = (discountedNumerator + (RATE_FACTOR / 2n)) / RATE_FACTOR;
  return scaledDecimal(discountedCents, MONEY_SCALE);
}

function bankTransferQuote(product, amount = effectiveProductAmount(product)) {
  const discountRate = normalizeBankTransferDiscountRate(
    product?.bankTransferDiscountRate,
    DEFAULT_BANK_TRANSFER_DISCOUNT_RATE
  );
  const discountedAmount = amount == null
    ? null
    : calculateBankTransferAmount(amount, discountRate);

  return {
    discountRate,
    amount: discountedAmount,
    hasDiscount: Boolean(
      amount != null
      && discountedAmount != null
      && discountRate !== '0.00'
    )
  };
}

function registrationPayableAmount(registration) {
  if (
    registration?.paymentMethod === 'BANK_TRANSFER'
    && registration.bankTransferAmount != null
  ) {
    return registration.bankTransferAmount;
  }

  return registration?.totalAmount ?? null;
}

module.exports = {
  DEFAULT_BANK_TRANSFER_DISCOUNT_RATE,
  bankTransferQuote,
  calculateBankTransferAmount,
  effectiveProductAmount,
  isValidBankTransferDiscountRate,
  normalizeBankTransferDiscountRate,
  registrationPayableAmount
};
