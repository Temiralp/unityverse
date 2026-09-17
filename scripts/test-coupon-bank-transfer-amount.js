#!/usr/bin/env node

// Havale/EFT kilidi kayittaki totalAmount'u (kupon dahil) korumali; odeme maillerinde kupon
// kullanildiysa "Kupon" ve "Kupon İndirimi" satirlari gorunmeli (Cember 11 / B1).

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');

const { bankTransferBaseAmount } = require('../src/services/registration-pricing');
const { bankTransferQuote } = require('../src/services/bank-transfer-pricing');
const { bankTransferMailData, cardPaymentMailData } = require('../src/services/payment-notifications');

const root = path.resolve(__dirname, '..');
const product = { price: '186250.00', discountPrice: null, bankTransferDiscountRate: '10.00' };

// 1) Kuponlu kayit: kursun fiyati artmis olsa da kayittaki tutar korunur (149.000 -> havale 134.100)
const withCoupon = { totalAmount: '149000.00', couponId: 5, couponCode: 'OKUL10', couponDiscount: '37250.00', product };
assert.equal(bankTransferBaseAmount(withCoupon), '149000.00');
assert.equal(bankTransferQuote(product, bankTransferBaseAmount(withCoupon)).amount, '134100.00');

// 2) Kuponsuz ama totalAmount dolu: yine korunur (odeme sayfasi acilirken zaten senkronlanmistir)
assert.equal(bankTransferBaseAmount({ totalAmount: '149000.00', couponId: null, product }), '149000.00');

// 3) totalAmount bos: kursun guncel fiyati (mevcut fallback)
assert.equal(bankTransferBaseAmount({ totalAmount: null, couponId: null, product }), '186250.00');
assert.equal(bankTransferBaseAmount({ totalAmount: null, product: { price: '100.00', discountPrice: '80.00' } }), '80.00');
assert.equal(bankTransferBaseAmount({ totalAmount: null, product: null }), null);

// 4) Havale route'u kilitte bu fonksiyonu kullanir; totalAmount'u cari fiyatla ezmez
const payments = fs.readFileSync(path.join(root, 'src/routes/payments.js'), 'utf8');
const lockBlock = payments.slice(payments.indexOf('async function lockBankTransferRegistration'), payments.indexOf('async function lockBankTransferRegistration') + 2600);
assert.match(lockBlock, /bankTransferBaseAmount\(registration\)/);
assert.doesNotMatch(lockBlock, /const latestAmount = currentProductAmount\(registration\.product\)/);

// 5) Mail: kupon varsa satirlar, yoksa yok (havale + kart, ogrenci + admin)
const registration = {
  id: 77, name: 'Ayşe', surname: 'Test', email: 'a@example.com', phone: '+90 555 000 00 00',
  courseTitle: 'Örnek Kurs', totalAmount: '149000.00', couponCode: 'OKUL10', couponDiscount: '37250.00'
};
const bank = bankTransferMailData({ registration, bankTransfer: { amount: '134.100,00', reference: 'UV-77', discountRate: '10.00' } });
const labels = (mail) => mail.rows.map((row) => row.label);
assert.ok(labels(bank.student).includes('Kupon'));
assert.ok(labels(bank.student).includes('Kupon İndirimi'));
assert.equal(bank.student.rows.find((r) => r.label === 'Kupon').value, 'OKUL10');
assert.match(bank.student.rows.find((r) => r.label === 'Kupon İndirimi').value, /^-37\.250,00 TL$/);
assert.ok(labels(bank.admin).includes('Kupon'));
// Kupon satirlari tutardan once gelir (okunabilirlik)
assert.ok(labels(bank.student).indexOf('Kupon') < labels(bank.student).indexOf('Ödenecek Tutar'));

const noCoupon = bankTransferMailData({ registration: { ...registration, couponCode: null, couponDiscount: null }, bankTransfer: { amount: '134.100,00', reference: 'UV-77' } });
assert.equal(labels(noCoupon.student).includes('Kupon'), false);
assert.equal(labels(noCoupon.admin).includes('Kupon'), false);

const card = cardPaymentMailData({ registration, payment: { amount: '149000.00', totalAmount: '14900000', merchantOid: 'UVR77T1', installmentCount: 1, paymentType: 'card' } });
assert.ok(labels(card.student).includes('Kupon'));
assert.ok(labels(card.admin).includes('Kupon İndirimi'));
const cardNoCoupon = cardPaymentMailData({ registration: { ...registration, couponCode: '', couponDiscount: null }, payment: { amount: '149000.00', totalAmount: '14900000', merchantOid: 'UVR77T1', installmentCount: 1, paymentType: 'card' } });
assert.equal(labels(cardNoCoupon.student).includes('Kupon'), false);

console.log('coupon-aware bank transfer amount + mail rows OK');
