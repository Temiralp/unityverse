const {
  calculateBankTransferAmount,
  normalizeBankTransferDiscountRate
} = require('./bank-transfer-pricing');

function moneyCents(value) {
  const normalized = String(value == null ? '' : value).trim().replace(',', '.');
  const match = normalized.match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) return 0n;

  return (BigInt(match[1]) * 100n) + BigInt(String(match[2] || '').padEnd(2, '0'));
}

function moneyTextFromCents(value) {
  const whole = value / 100n;
  const fraction = String(value % 100n).padStart(2, '0');
  return `${whole}.${fraction}`;
}

function moneyNumberFromCents(value) {
  return Number(value) / 100;
}

function registrationFinanceAmounts(registration) {
  const isBankTransfer = registration?.paymentMethod === 'BANK_TRANSFER';
  const registrationAmountCents = moneyCents(registration?.totalAmount);
  const storedCouponDiscountCents = moneyCents(registration?.couponDiscount);
  const hasCoupon = Boolean(registration?.couponCode && storedCouponDiscountCents > 0n);
  const couponDiscountCents = hasCoupon ? storedCouponDiscountCents : 0n;
  const courseAmountCents = isBankTransfer
    ? registrationAmountCents
    : registrationAmountCents + couponDiscountCents;
  const couponAdjustedAmountCents = courseAmountCents > couponDiscountCents
    ? courseAmountCents - couponDiscountCents
    : 0n;
  const bankTransferDiscountRate = isBankTransfer
    ? (normalizeBankTransferDiscountRate(registration?.bankTransferDiscountRate, '0.00') || '0.00')
    : '0.00';
  const bankTransferAmount = isBankTransfer
    ? calculateBankTransferAmount(
      moneyTextFromCents(couponAdjustedAmountCents),
      bankTransferDiscountRate
    )
    : null;
  const payableAmountCents = isBankTransfer
    ? moneyCents(bankTransferAmount)
    : registrationAmountCents;
  const settlementPayableAmountCents = isBankTransfer && registration?.bankTransferAmount != null
    ? moneyCents(registration.bankTransferAmount)
    : registrationAmountCents;
  const bankTransferDiscountCents = isBankTransfer
    ? couponAdjustedAmountCents - payableAmountCents
    : 0n;
  const paidAmountCents = (registration?.payments || []).reduce((sum, payment) => (
    sum + moneyCents(payment?.amount)
  ), 0n);
  const remainingAmountCents = payableAmountCents > paidAmountCents
    ? payableAmountCents - paidAmountCents
    : 0n;
  const settlementRemainingAmountCents = settlementPayableAmountCents > paidAmountCents
    ? settlementPayableAmountCents - paidAmountCents
    : 0n;

  return {
    courseAmount: moneyNumberFromCents(courseAmountCents),
    couponDiscount: moneyNumberFromCents(couponDiscountCents),
    hasCoupon,
    couponAdjustedAmount: moneyNumberFromCents(couponAdjustedAmountCents),
    bankTransferDiscountRate,
    bankTransferDiscount: moneyNumberFromCents(bankTransferDiscountCents),
    hasBankTransferDiscount: bankTransferDiscountCents > 0n,
    payableAmount: moneyNumberFromCents(payableAmountCents),
    settlementPayableAmount: moneyNumberFromCents(settlementPayableAmountCents),
    hasSettlementMismatch: payableAmountCents !== settlementPayableAmountCents,
    paidAmount: moneyNumberFromCents(paidAmountCents),
    remainingAmount: moneyNumberFromCents(remainingAmountCents),
    settlementRemainingAmount: moneyNumberFromCents(settlementRemainingAmountCents)
  };
}

module.exports = {
  registrationFinanceAmounts
};
