#!/usr/bin/env node

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');

const { registrationFinanceAmounts } = require('../src/services/registration-finance');

const root = path.resolve(__dirname, '..');
const adminRoutes = fs.readFileSync(path.join(root, 'src/routes/admin.js'), 'utf8');
const indexView = fs.readFileSync(path.join(root, 'src/views/admin/registrations/index.ejs'), 'utf8');
const detailView = fs.readFileSync(path.join(root, 'src/views/admin/registrations/show.ejs'), 'utf8');

assert.deepEqual(registrationFinanceAmounts({
  totalAmount: '1000.00',
  paymentMethod: 'CARD',
  payments: [{ amount: '1000.00' }]
}), {
  courseAmount: 1000,
  couponDiscount: 0,
  hasCoupon: false,
  couponAdjustedAmount: 1000,
  bankTransferDiscountRate: '0.00',
  bankTransferDiscount: 0,
  hasBankTransferDiscount: false,
  payableAmount: 1000,
  settlementPayableAmount: 1000,
  hasSettlementMismatch: false,
  paidAmount: 1000,
  remainingAmount: 0,
  settlementRemainingAmount: 0
});

assert.deepEqual(registrationFinanceAmounts({
  totalAmount: '800.00',
  paymentMethod: 'CARD',
  couponCode: 'TEST20',
  couponDiscount: '200.00',
  payments: [{ amount: '800.00' }]
}), {
  courseAmount: 1000,
  couponDiscount: 200,
  hasCoupon: true,
  couponAdjustedAmount: 800,
  bankTransferDiscountRate: '0.00',
  bankTransferDiscount: 0,
  hasBankTransferDiscount: false,
  payableAmount: 800,
  settlementPayableAmount: 800,
  hasSettlementMismatch: false,
  paidAmount: 800,
  remainingAmount: 0,
  settlementRemainingAmount: 0
});

assert.deepEqual(registrationFinanceAmounts({
  totalAmount: '1000.00',
  paymentMethod: 'BANK_TRANSFER',
  bankTransferAmount: '900.00',
  bankTransferDiscountRate: '10.00',
  couponCode: 'BANK20',
  couponDiscount: '200.00',
  payments: []
}), {
  courseAmount: 1000,
  couponDiscount: 200,
  hasCoupon: true,
  couponAdjustedAmount: 800,
  bankTransferDiscountRate: '10.00',
  bankTransferDiscount: 80,
  hasBankTransferDiscount: true,
  payableAmount: 720,
  settlementPayableAmount: 900,
  hasSettlementMismatch: true,
  paidAmount: 0,
  remainingAmount: 720,
  settlementRemainingAmount: 900
});

assert.deepEqual(registrationFinanceAmounts({
  totalAmount: '1000.00',
  paymentMethod: 'BANK_TRANSFER',
  bankTransferAmount: '900.00',
  bankTransferDiscountRate: '10.00',
  couponCode: 'BANK20',
  couponDiscount: '200.00',
  payments: [{ amount: '720.00' }]
}), {
  courseAmount: 1000,
  couponDiscount: 200,
  hasCoupon: true,
  couponAdjustedAmount: 800,
  bankTransferDiscountRate: '10.00',
  bankTransferDiscount: 80,
  hasBankTransferDiscount: true,
  payableAmount: 720,
  settlementPayableAmount: 900,
  hasSettlementMismatch: true,
  paidAmount: 720,
  remainingAmount: 0,
  settlementRemainingAmount: 180
});

assert.deepEqual(registrationFinanceAmounts({
  totalAmount: '1000.00',
  paymentMethod: 'CARD',
  payments: [{ amount: '250.00' }, { amount: '150.00' }]
}), {
  courseAmount: 1000,
  couponDiscount: 0,
  hasCoupon: false,
  couponAdjustedAmount: 1000,
  bankTransferDiscountRate: '0.00',
  bankTransferDiscount: 0,
  hasBankTransferDiscount: false,
  payableAmount: 1000,
  settlementPayableAmount: 1000,
  hasSettlementMismatch: false,
  paidAmount: 400,
  remainingAmount: 600,
  settlementRemainingAmount: 600
});

assert.deepEqual(registrationFinanceAmounts({
  totalAmount: '0.80',
  paymentMethod: 'CARD',
  payments: [{ amount: '0.10' }, { amount: '0.70' }]
}), {
  courseAmount: 0.8,
  couponDiscount: 0,
  hasCoupon: false,
  couponAdjustedAmount: 0.8,
  bankTransferDiscountRate: '0.00',
  bankTransferDiscount: 0,
  hasBankTransferDiscount: false,
  payableAmount: 0.8,
  settlementPayableAmount: 0.8,
  hasSettlementMismatch: false,
  paidAmount: 0.8,
  remainingAmount: 0,
  settlementRemainingAmount: 0
});

const registrationsRouteStart = adminRoutes.indexOf("router.get('/registrations', requireAdmin");
const registrationsRouteEnd = adminRoutes.indexOf("router.get('/registrations/new'", registrationsRouteStart);
assert(registrationsRouteStart >= 0 && registrationsRouteEnd > registrationsRouteStart);
const registrationsRoute = adminRoutes.slice(registrationsRouteStart, registrationsRouteEnd);
assert.match(registrationsRoute, /finance:\s*getRegistrationFinance\(registration\)/);
assert.match(adminRoutes, /finance\.settlementRemainingAmount\s*<=\s*0/);
['Yöntem:', 'Kurs Fiyatı', 'Kupon:', 'Kupon Sonrası:', 'Havale İndirimi:', 'İndirimlerle Ödenecek', 'Kayıtlı Havale Tutarı', 'Ödenen:', 'Kayıtlı Kalan'].forEach((label) => {
  assert(indexView.includes(label), `Admin registration list is missing: ${label}`);
});
['Kurs Fiyatı', 'Kupon İndirimi', 'Kupon Sonrası Tutar', 'Havale İndirimi', 'İndirimlerle Ödenecek Tutar', 'Kayıtlı Havale Tutarı', 'Ödenen Tutar', 'Kayıtlı Kalan'].forEach((label) => {
  assert(detailView.includes(label), `Admin registration detail is missing: ${label}`);
});

console.log('Admin registration finance tests passed.');
