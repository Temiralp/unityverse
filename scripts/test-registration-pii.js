const assert = require('assert/strict');

const {
  RegistrationPiiConfigurationError,
  RegistrationPiiDecryptionError,
  decryptField,
  decryptRegistrationPii,
  encryptField,
  encryptRegistrationPii,
  hasCompleteEncryptedRegistrationPii
} = require('../src/services/registration-pii');

const ACTIVE_KEY_ID = 'qa-key-v1';
const FAKE_KEY = Buffer.alloc(32, 0x41).toString('base64');
const WRONG_KEY = Buffer.alloc(32, 0x42).toString('base64');
const SENSITIVE_VALUE = 'QA-PASSPORT-12345';

function installKeyring(key = FAKE_KEY, keyId = ACTIVE_KEY_ID) {
  process.env.REGISTRATION_PII_ACTIVE_KEY_ID = keyId;
  process.env.REGISTRATION_PII_ENCRYPTION_KEYS = JSON.stringify({ [keyId]: key });
}

function assertErrorDoesNotLeak(error, sensitiveValues) {
  sensitiveValues.filter(Boolean).forEach((value) => {
    assert.equal(String(error.message).includes(value), false, 'Xəta mesajı PII məlumatını sızdırmamalıdır');
  });
}

function expectSafeFailure(fn, ErrorClass, sensitiveValues = [SENSITIVE_VALUE]) {
  assert.throws(fn, (error) => {
    assert.ok(error instanceof ErrorClass, `Gözlənilən xəta: ${ErrorClass.name}`);
    assertErrorDoesNotLeak(error, sensitiveValues);
    return true;
  });
}

function tamper(ciphertext) {
  const parts = ciphertext.split(':');
  const encrypted = parts[4];
  const last = encrypted.slice(-1);
  parts[4] = `${encrypted.slice(0, -1)}${last === 'A' ? 'B' : 'A'}`;
  return parts.join(':');
}

function fieldEncryptionTests() {
  installKeyring();
  const first = encryptField('identityDocumentNumber', SENSITIVE_VALUE);
  const second = encryptField('identityDocumentNumber', SENSITIVE_VALUE);

  assert.match(first, /^uv1:qa-key-v1:/);
  assert.equal(first.includes(SENSITIVE_VALUE), false);
  assert.notEqual(first, second, 'Təsadüfi IV eyni plaintext üçün fərqli ciphertext yaratmalıdır');
  assert.equal(decryptField('identityDocumentNumber', first), SENSITIVE_VALUE);
  assert.equal(encryptField('identityDocumentNumber', ''), null);
  assert.equal(decryptField('identityDocumentNumber', null), null);

  expectSafeFailure(
    () => decryptField('identityDocumentNumber', tamper(first)),
    RegistrationPiiDecryptionError
  );
  expectSafeFailure(
    () => decryptField('birthDate', first),
    RegistrationPiiDecryptionError
  );
  expectSafeFailure(
    () => decryptField('identityDocumentNumber', `broken:${SENSITIVE_VALUE}`),
    RegistrationPiiDecryptionError
  );
}

function aggregateRoundTripTests() {
  installKeyring();
  const profile = {
    identityDocumentType: 'PASSPORT',
    identityDocumentNumber: SENSITIVE_VALUE,
    documentCountryCode: 'AZ',
    birthDate: '1990-02-28',
    country: 'Azerbaijan',
    city: 'Baku',
    district: 'Nasimi',
    postalCode: 'AZ 1000',
    addressLine: '28 May street 10'
  };
  const encrypted = encryptRegistrationPii(profile);
  const serialized = JSON.stringify(encrypted);

  [
    profile.identityDocumentNumber,
    profile.birthDate,
    profile.country,
    profile.city,
    profile.district,
    profile.postalCode,
    profile.addressLine
  ].forEach((plaintext) => assert.equal(serialized.includes(plaintext), false));

  assert.equal(hasCompleteEncryptedRegistrationPii(encrypted), true);
  assert.deepEqual(decryptRegistrationPii(encrypted), profile);
  assert.equal(hasCompleteEncryptedRegistrationPii({ ...encrypted, identityDocumentCountryCode: '' }), false);
  assert.equal(hasCompleteEncryptedRegistrationPii({ ...encrypted, birthDateEncrypted: null }), false);
}

function keyFailureTests() {
  installKeyring();
  const ciphertext = encryptField('identityDocumentNumber', SENSITIVE_VALUE);

  delete process.env.REGISTRATION_PII_ACTIVE_KEY_ID;
  delete process.env.REGISTRATION_PII_ENCRYPTION_KEYS;
  expectSafeFailure(
    () => encryptField('identityDocumentNumber', SENSITIVE_VALUE),
    RegistrationPiiConfigurationError
  );
  expectSafeFailure(
    () => decryptField('identityDocumentNumber', ciphertext),
    RegistrationPiiConfigurationError
  );

  installKeyring(WRONG_KEY);
  expectSafeFailure(
    () => decryptField('identityDocumentNumber', ciphertext),
    RegistrationPiiDecryptionError
  );

  process.env.REGISTRATION_PII_ACTIVE_KEY_ID = 'qa-key-v2';
  process.env.REGISTRATION_PII_ENCRYPTION_KEYS = JSON.stringify({
    'qa-key-v2': WRONG_KEY
  });
  expectSafeFailure(
    () => decryptField('identityDocumentNumber', ciphertext),
    RegistrationPiiConfigurationError
  );
}

function run() {
  try {
    fieldEncryptionTests();
    aggregateRoundTripTests();
    keyFailureTests();
    console.log('Registration PII encryption tests passed.');
  } finally {
    delete process.env.REGISTRATION_PII_ACTIVE_KEY_ID;
    delete process.env.REGISTRATION_PII_ENCRYPTION_KEYS;
  }
}

run();
