#!/usr/bin/env node

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const ejs = require('ejs');

const {
  adminVisibleRegistrationWhere,
  isAdminVisibleRegistration,
  isPendingCheckout,
  pendingCheckoutWhere
} = require('../src/services/registration-visibility');

const root = path.resolve(__dirname, '..');
const adminRoutes = fs.readFileSync(path.join(root, 'src/routes/admin.js'), 'utf8');
const memberRoutes = fs.readFileSync(path.join(root, 'src/routes/members.js'), 'utf8');
const paymentRoutes = fs.readFileSync(path.join(root, 'src/routes/payments.js'), 'utf8');
const paytrCallback = fs.readFileSync(path.join(root, 'src/services/paytr-callback.js'), 'utf8');
const header = fs.readFileSync(path.join(root, 'src/views/admin/partials/header.ejs'), 'utf8');
const pendingView = fs.readFileSync(path.join(root, 'src/views/admin/pending-checkouts/index.ejs'), 'utf8');
const pendingDetailView = fs.readFileSync(path.join(root, 'src/views/admin/pending-checkouts/show.ejs'), 'utf8');

const websiteDraft = {
  source: 'website-enrollment',
  status: 'NEW',
  paymentStatus: 'PENDING',
  paymentMethod: null
};

assert.equal(isPendingCheckout(websiteDraft), true);
assert.equal(isAdminVisibleRegistration(websiteDraft), false);

const cardPaid = {
  ...websiteDraft,
  status: 'CONFIRMED',
  paymentStatus: 'PAID',
  paymentMethod: 'CARD'
};
assert.equal(isPendingCheckout(cardPaid), false);
assert.equal(isAdminVisibleRegistration(cardPaid), true);

const incompleteCardState = {
  ...websiteDraft,
  paymentMethod: 'CARD'
};
assert.equal(isPendingCheckout(incompleteCardState), false);
assert.equal(isAdminVisibleRegistration(incompleteCardState), false);

const bankTransferPending = {
  ...websiteDraft,
  paymentMethod: 'BANK_TRANSFER'
};
assert.equal(isPendingCheckout(bankTransferPending), false);
assert.equal(isAdminVisibleRegistration(bankTransferPending), true);

assert.equal(isAdminVisibleRegistration({
  ...websiteDraft,
  source: 'admin'
}), true);
assert.equal(isAdminVisibleRegistration({
  ...websiteDraft,
  paymentStatus: 'PARTIAL'
}), true);
assert.equal(isAdminVisibleRegistration({
  ...websiteDraft,
  paymentStatus: 'REFUNDED'
}), true);
assert.equal(isPendingCheckout({
  ...websiteDraft,
  status: 'CANCELLED'
}), false);

const searchFilter = {
  OR: [
    { name: { contains: 'Test' } },
    { email: { contains: 'test@example.com' } }
  ]
};
const visibleWhere = adminVisibleRegistrationWhere(searchFilter);
const checkoutWhere = pendingCheckoutWhere(searchFilter);
assert.deepEqual(visibleWhere.AND[1], searchFilter);
assert.deepEqual(checkoutWhere.AND[1], searchFilter);
assert.equal(checkoutWhere.AND[0].paymentMethod, null);
assert.equal(checkoutWhere.AND[0].paymentStatus, 'PENDING');

assert.match(adminRoutes, /router\.get\('\/pending-checkouts', requireAdmin/);
assert.match(adminRoutes, /router\.get\('\/pending-checkouts\/:id\(\\\\d\+\)', requireAdmin/);
assert.match(adminRoutes, /safeEducationRegistrationsList\([\s\S]*pendingCheckoutWhere/);
assert.match(adminRoutes, /safeEducationRegistrationCount\([\s\S]*adminVisibleRegistrationWhere/);
assert((adminRoutes.match(/adminVisibleRegistrationWhere\(/g) || []).length >= 12);
assert((adminRoutes.match(/educationRegistrations:\s*\{\s*where: adminVisibleRegistrationWhere\(\)/g) || []).length >= 2);
assert.match(adminRoutes, /async function getRegistrationDetail\(id\)[\s\S]*where: adminVisibleRegistrationWhere\(\{ id: Number\(id\) \}\)/);
assert.match(adminRoutes, /async function adminVisibleRegistrationExists\(prismaClient, id\)/);
assert((adminRoutes.match(/adminVisibleRegistrationExists\(/g) || []).length >= 5);
assert((adminRoutes.match(/isAdminVisibleRegistration\(currentRegistration\)/g) || []).length >= 2);
assert.doesNotMatch(memberRoutes, /registration-visibility/);

assert.match(header, /href: '\/admin\/pending-checkouts', label: 'Yarım Kalan Ödemeler'/);
assert.match(pendingView, /<h1>Yarım Kalan Ödemeler<\/h1>/);
assert.match(pendingView, /Ödeme Tamamlanmadı/);
assert.match(pendingView, /\/admin\/pending-checkouts\/<%= registration\.id %>/);
assert.doesNotMatch(pendingView, /\/admin\/registrations\/<%= registration\.id %>/);
assert.doesNotMatch(pendingView, /identityDocumentNumberEncrypted|birthDateEncrypted|addressEncrypted/);
assert.match(pendingDetailView, /Yarım Kalan Ödeme #<%= registration\.id %>/);
assert.match(pendingDetailView, /Ödeme tamamlandığında bu kayıt otomatik olarak Eğitim Kayıtlarına geçecek/);
assert.doesNotMatch(pendingDetailView, /identityDocumentNumber|birthDate|address|payments|installments|<form/i);
const pendingViewFilename = path.join(root, 'src/views/admin/pending-checkouts/index.ejs');
const renderedPendingView = ejs.render(pendingView, {
  adminUser: { name: 'Test Admin', email: 'admin@example.com' },
  currentPath: '/admin/pending-checkouts',
  csrfToken: 'test-csrf-token',
  registrations: [],
  totalCount: 0,
  pagination: null,
  q: '',
  productId: '',
  createdFrom: '',
  createdTo: '',
  products: [],
  warning: null
}, { filename: pendingViewFilename });
assert.match(renderedPendingView, /Yarım kalan ödeme bulunmuyor/);
assert.match(renderedPendingView, /class="is-active"[\s\S]*aria-current="page"[\s\S]*Yarım Kalan Ödemeler/);

const pendingDetailFilename = path.join(root, 'src/views/admin/pending-checkouts/show.ejs');
const renderedPendingDetail = ejs.render(pendingDetailView, {
  adminUser: { name: 'Test Admin', email: 'admin@example.com' },
  currentPath: '/admin/pending-checkouts/42',
  csrfToken: 'test-csrf-token',
  registration: {
    id: 42,
    courseTitle: 'Test Eğitimi',
    name: 'Test',
    surname: 'Üye',
    email: 'test@example.com',
    phone: '05550000000',
    totalAmount: 12500,
    createdAt: new Date('2026-08-10T08:00:00Z'),
    updatedAt: new Date('2026-08-10T08:05:00Z'),
    member: { id: 7, status: 'ACTIVE' },
    product: { id: 9, code: 'TEST-9', title: 'Test Eğitimi' }
  }
}, { filename: pendingDetailFilename });
assert.match(renderedPendingDetail, /Yarım Kalan Ödeme #42/);
assert.match(renderedPendingDetail, /test@example\.com/);
assert.match(renderedPendingDetail, /12\.500,00 TL/);
assert.doesNotMatch(renderedPendingDetail, />\s*(?:Güncelle|Ödeme Ekle|Taksit Ekle)\s*</);

assert.match(paytrCallback, /paymentStatus: 'PAID',[\s\S]*paymentMethod: 'CARD'/);
assert.match(paymentRoutes, /paymentMethod: 'BANK_TRANSFER',[\s\S]*bankTransferAmount: quote\.amount/);
assert(paymentRoutes.includes(
  "router.post('/:registrationId(\\\\d+)/havale', requirePublicCsrf, bankTransferRateLimiter"
));

console.log('Registration visibility and pending checkout contract tests passed.');
