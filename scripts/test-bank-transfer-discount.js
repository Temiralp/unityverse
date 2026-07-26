const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');

const {
  bankTransferQuote,
  calculateBankTransferAmount,
  isValidBankTransferDiscountRate,
  normalizeBankTransferDiscountRate,
  registrationPayableAmount
} = require('../src/services/bank-transfer-pricing');
const { PaytrRequestError, buildPaytrPayload } = require('../src/services/paytr');
const { processPaytrCallback } = require('../src/services/paytr-callback');
const { syncPendingRegistrationAmount } = require('../src/services/registration-pricing');
const { renderLegacyProductDetails } = require('../src/routes/legacy-product-detail');
const { lockBankTransferRegistration } = require('../src/routes/payments');

const root = path.resolve(__dirname, '..');

function product(overrides = {}) {
  return {
    id: 15,
    code: 'UV-15',
    title: 'Test Eğitimi',
    slug: 'test-egitimi',
    summary: 'Test',
    image: '/uploads/test.png',
    price: '49000.00',
    discountPrice: null,
    bankTransferDiscountRate: '10.00',
    duration: '3 ay',
    category: { name: 'Yazılım', slug: 'yazilim' },
    tabs: [],
    learningOutcomes: [],
    ...overrides
  };
}

function pricingTests() {
  assert.equal(calculateBankTransferAmount('49000.00', '10.00'), '44100.00');
  assert.equal(calculateBankTransferAmount('49000.00', '20.00'), '39200.00');
  assert.equal(calculateBankTransferAmount('1.01', '10.00'), '0.91');
  assert.equal(calculateBankTransferAmount('49000.00', '0'), '49000.00');

  assert.equal(normalizeBankTransferDiscountRate('10'), '10.00');
  assert.equal(normalizeBankTransferDiscountRate('10,5'), '10.50');
  assert.equal(isValidBankTransferDiscountRate('99.99'), true);
  assert.equal(isValidBankTransferDiscountRate('100'), false);
  assert.equal(isValidBankTransferDiscountRate('-1'), false);

  assert.deepEqual(bankTransferQuote(product()), {
    discountRate: '10.00',
    amount: '44100.00',
    hasDiscount: true
  });
  assert.equal(
    bankTransferQuote(product({ discountPrice: '45000.00' })).amount,
    '40500.00'
  );
  assert.equal(
    bankTransferQuote(product({ bankTransferDiscountRate: '20.00' })).amount,
    '39200.00'
  );
  assert.equal(
    bankTransferQuote(product({ bankTransferDiscountRate: undefined })).amount,
    '44100.00'
  );

  assert.equal(
    registrationPayableAmount({
      totalAmount: '49000.00',
      paymentMethod: 'BANK_TRANSFER',
      bankTransferAmount: '44100.00'
    }),
    '44100.00'
  );
  assert.equal(
    registrationPayableAmount({
      totalAmount: '49000.00',
      paymentMethod: 'CARD',
      bankTransferAmount: '44100.00'
    }),
    '49000.00'
  );
}

async function registrationSyncTests() {
  let updateCalls = 0;
  const prisma = {
    educationRegistration: {
      update() {
        updateCalls += 1;
        return Promise.resolve(null);
      }
    }
  };

  const locked = {
    id: 8,
    status: 'NEW',
    paymentStatus: 'PENDING',
    paymentMethod: 'BANK_TRANSFER',
    totalAmount: '49000.00',
    product: {
      slug: 'test-egitimi',
      price: '60000.00',
      discountPrice: null,
      bankTransferDiscountRate: '20.00'
    }
  };

  assert.equal(await syncPendingRegistrationAmount(prisma, locked), locked);
  assert.equal(updateCalls, 0);
}

function paymentSafetyTests() {
  assert.throws(
    () => buildPaytrPayload({
      registration: {
        paymentMethod: 'BANK_TRANSFER'
      },
      userIp: '127.0.0.1'
    }),
    (error) => error instanceof PaytrRequestError
      && /Havale\/EFT seçilmiş/.test(error.message)
  );
}

async function callbackSafetyTests() {
  let paymentCreateCalls = 0;
  const tx = {
    async $executeRaw() {},
    educationRegistration: {
      async findUnique() {
        return {
          id: 8,
          status: 'NEW',
          paymentStatus: 'PENDING',
          paymentMethod: 'BANK_TRANSFER',
          totalAmount: '49000.00',
          courseTitle: 'Test Eğitimi',
          name: 'Test',
          surname: 'Üye',
          email: 'test@example.com',
          phone: '5550000000'
        };
      }
    },
    educationPayment: {
      async findFirst() {
        return null;
      },
      async create() {
        paymentCreateCalls += 1;
      }
    }
  };
  const prisma = {
    async $transaction(callback) {
      return callback(tx);
    }
  };

  const result = await processPaytrCallback(prisma, {
    merchantOid: 'UVR8T1753459200000Xabcdef123456',
    status: 'success',
    totalAmount: '4900000',
    paymentAmount: '4900000'
  });

  assert.equal(result.outcome, 'payment_method_mismatch');
  assert.equal(paymentCreateCalls, 0);
}

async function bankTransferLockTests() {
  let updatedData = null;
  let createdNote = null;
  const registration = {
    id: 8,
    memberId: 4,
    status: 'NEW',
    paymentStatus: 'PENDING',
    paymentMethod: null,
    totalAmount: '50000.00',
    product: {
      slug: 'test-egitimi',
      price: '49000.00',
      discountPrice: null,
      bankTransferDiscountRate: '20.00'
    },
    member: {
      email: 'test@example.com',
      phone: '5550000000'
    }
  };
  const tx = {
    async $executeRaw() {},
    educationRegistration: {
      async findFirst() {
        return registration;
      },
      async update({ data }) {
        updatedData = data;
        return { ...registration, ...data };
      }
    },
    educationRegistrationNote: {
      async create({ data }) {
        createdNote = data;
      }
    }
  };
  const prisma = {
    async $transaction(callback) {
      return callback(tx);
    }
  };

  const result = await lockBankTransferRegistration(
    prisma,
    { session: { member: { id: 4 } } },
    8
  );

  assert.equal(result.newlyLocked, true);
  assert.equal(updatedData.totalAmount, '49000.00');
  assert.equal(updatedData.paymentMethod, 'BANK_TRANSFER');
  assert.equal(updatedData.bankTransferDiscountRate, '20.00');
  assert.equal(updatedData.bankTransferAmount, '39200.00');
  assert.equal(createdNote.registrationId, 8);
  assert.match(createdNote.note, /Havale indirimi: %20\.00/);
  assert.match(createdNote.note, /Beklenen tutar: 39\.200,00 TL/);
}

function viewIntegrationTests() {
  const legacyHtml = renderLegacyProductDetails(product(), 'http://localhost:8000');
  assert.match(legacyHtml, /Havale ile %10 indirim: <strong>44\.100,00 TL<\/strong>/);
  assert.match(legacyHtml, /uv-product-price-row/);

  const adminForm = fs.readFileSync(
    path.join(root, 'src/views/admin/products/form.ejs'),
    'utf8'
  );
  const paymentView = fs.readFileSync(
    path.join(root, 'src/views/payments/iframe.ejs'),
    'utf8'
  );
  const productView = fs.readFileSync(
    path.join(root, 'src/views/catalog/product.ejs'),
    'utf8'
  );
  const migration = fs.readFileSync(
    path.join(root, 'prisma/migrations/20260725100000_add_bank_transfer_discount/migration.sql'),
    'utf8'
  );

  assert.match(adminForm, /name="bankTransferDiscountRate"/);
  assert.match(adminForm, /Havale İndirimi \(%\)/);
  assert.match(paymentView, /data-card-amount/);
  assert.match(paymentView, /data-bank-amount/);
  assert.match(paymentView, /Havale ile %<%= bankTransfer\.discountRate %> indirim/);
  assert.match(productView, /product\.displayPrice\.bankTransfer\.amount/);
  assert.match(migration, /DEFAULT 10\.00/);
  assert.match(migration, /"bankTransferAmount" DECIMAL\(10,2\)/);
}

async function main() {
  pricingTests();
  await registrationSyncTests();
  paymentSafetyTests();
  await callbackSafetyTests();
  await bankTransferLockTests();
  viewIntegrationTests();
  console.log('Bank transfer discount tests passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
