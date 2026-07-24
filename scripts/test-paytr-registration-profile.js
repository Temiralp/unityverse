const assert = require('assert/strict');

const { buildPaytrPayload, PaytrRequestError } = require('../src/services/paytr');
const { encryptRegistrationPii } = require('../src/services/registration-pii');

const ENV_NAMES = [
  'REGISTRATION_PII_ACTIVE_KEY_ID',
  'REGISTRATION_PII_ENCRYPTION_KEYS',
  'PAYTR_PUBLIC_BASE_URL',
  'PAYTR_MERCHANT_ID',
  'PAYTR_MERCHANT_KEY',
  'PAYTR_MERCHANT_SALT',
  'PAYTR_TEST_MODE',
  'PAYTR_NO_INSTALLMENT',
  'PAYTR_MAX_INSTALLMENT'
];

function snapshotEnvironment() {
  return Object.fromEntries(ENV_NAMES.map((name) => [
    name,
    Object.prototype.hasOwnProperty.call(process.env, name) ? process.env[name] : undefined
  ]));
}

function restoreEnvironment(snapshot) {
  ENV_NAMES.forEach((name) => {
    if (snapshot[name] === undefined) delete process.env[name];
    else process.env[name] = snapshot[name];
  });
}

function installFakeEnvironment() {
  process.env.REGISTRATION_PII_ACTIVE_KEY_ID = 'qa-paytr-key';
  process.env.REGISTRATION_PII_ENCRYPTION_KEYS = JSON.stringify({
    'qa-paytr-key': Buffer.alloc(32, 0x51).toString('base64')
  });
  process.env.PAYTR_PUBLIC_BASE_URL = 'https://checkout.example.test';
  process.env.PAYTR_MERCHANT_ID = 'qa-merchant';
  process.env.PAYTR_MERCHANT_KEY = 'qa-merchant-key';
  process.env.PAYTR_MERCHANT_SALT = 'qa-merchant-salt';
  process.env.PAYTR_TEST_MODE = '1';
  process.env.PAYTR_NO_INSTALLMENT = '0';
  process.env.PAYTR_MAX_INSTALLMENT = '6';
}

function registrationWithProfile(profileOverrides = {}) {
  const profile = {
    identityDocumentType: 'PASSPORT',
    identityDocumentNumber: 'QA1234567',
    documentCountryCode: 'AZ',
    birthDate: '1990-02-28',
    country: 'Azerbaijan',
    city: 'Baku',
    district: 'Nasimi',
    postalCode: 'AZ 1000',
    addressLine: '28 May street 10',
    ...profileOverrides
  };

  return {
    profile,
    registration: {
      id: 42,
      courseTitle: 'QA Checkout Course',
      name: 'Registration',
      surname: 'Snapshot',
      email: 'registration-snapshot@example.test',
      phone: '+994 50 123 45 67',
      totalAmount: '1250.50',
      member: {
        email: 'member-fallback@example.test',
        phone: '+90 500 000 00 00'
      },
      product: {
        price: '1500.00',
        discountPrice: '1250.50'
      },
      ...encryptRegistrationPii(profile)
    }
  };
}

function completePayloadTest() {
  const { profile, registration } = registrationWithProfile();
  const request = buildPaytrPayload({
    registration,
    userIp: '203.0.113.10'
  });
  const payload = request.payload;
  const serializedPayload = payload.toString();

  assert.equal(payload.get('email'), registration.email);
  assert.equal(payload.get('user_name'), `${registration.name} ${registration.surname}`);
  assert.equal(payload.get('user_phone'), registration.phone);
  assert.equal(
    payload.get('user_address'),
    '28 May street 10, Nasimi / Baku, AZ 1000, Azerbaijan'
  );
  assert.equal(payload.get('payment_amount'), '125050');
  assert.equal(payload.get('test_mode'), '1');
  assert.equal(payload.get('max_installment'), '6');
  assert.equal(payload.get('email').includes(registration.member.email), false);

  [
    profile.identityDocumentNumber,
    profile.birthDate,
    registration.identityDocumentNumberEncrypted,
    registration.birthDateEncrypted,
    registration.addressEncrypted
  ].forEach((sensitiveValue) => {
    assert.equal(
      serializedPayload.includes(sensitiveValue),
      false,
      'PayTR payload kimlik plaintext və ya ciphertext məlumatı daşımamalıdır'
    );
  });
}

function incompleteProfileTests() {
  const legacyRegistration = {
    id: 43,
    courseTitle: 'Legacy Course',
    name: 'Legacy',
    surname: 'Student',
    email: 'legacy@example.test',
    phone: '+90 555 000 00 00',
    totalAmount: '100.00'
  };
  assert.throws(
    () => buildPaytrPayload({ registration: legacyRegistration, userIp: '203.0.113.10' }),
    (error) => error instanceof PaytrRequestError && /eksik veya geçersiz/.test(error.message)
  );

  const missingEncryptedField = registrationWithProfile().registration;
  missingEncryptedField.addressEncrypted = null;
  assert.throws(
    () => buildPaytrPayload({ registration: missingEncryptedField, userIp: '203.0.113.10' }),
    (error) => error instanceof PaytrRequestError
  );

  const { profile, registration } = registrationWithProfile({ addressLine: '' });
  assert.throws(
    () => buildPaytrPayload({ registration, userIp: '203.0.113.10' }),
    (error) => {
      assert.ok(error instanceof PaytrRequestError);
      assert.equal(error.message.includes(profile.identityDocumentNumber), false);
      assert.equal(error.message.includes(registration.identityDocumentNumberEncrypted), false);
      return true;
    }
  );
}

function run() {
  const environment = snapshotEnvironment();

  try {
    installFakeEnvironment();
    completePayloadTest();
    incompleteProfileTests();
    console.log('PayTR registration profile payload tests passed.');
  } finally {
    restoreEnvironment(environment);
  }
}

run();
