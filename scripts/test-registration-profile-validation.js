const assert = require('assert/strict');

const {
  PROFILE_FIELDS,
  hasAnyRegistrationProfileInput,
  isValidTurkishIdentityNumber,
  normalizeIsoDate,
  validateRegistrationProfile
} = require('../src/services/registration-profile');

const NOW = new Date('2026-07-22T12:00:00.000Z');

function validTurkishIdentityNumber(firstNineDigits = '100000001') {
  assert.match(firstNineDigits, /^[1-9]\d{8}$/);
  const digits = firstNineDigits.split('').map(Number);
  const oddSum = digits[0] + digits[2] + digits[4] + digits[6] + digits[8];
  const evenSum = digits[1] + digits[3] + digits[5] + digits[7];
  const tenth = ((((oddSum * 7) - evenSum) % 10) + 10) % 10;
  const eleventh = [...digits, tenth].reduce((sum, digit) => sum + digit, 0) % 10;
  return `${firstNineDigits}${tenth}${eleventh}`;
}

function validPassportProfile(overrides = {}) {
  return {
    name: '  Ada   Maria ',
    surname: ' Lovelace ',
    email: ' ADA@example.COM ',
    phone: '+994 50 123 45 67',
    identityDocumentType: 'passport',
    identityDocumentNumber: ' az 12 34567 ',
    documentCountryCode: 'az',
    birthDate: '1990-02-28',
    country: ' Azerbaijan ',
    city: ' Baku ',
    district: ' Nasimi ',
    postalCode: ' AZ 1000 ',
    addressLine: ' 28   May küçəsi  10 ',
    ...overrides
  };
}

function assertFieldError(input, field) {
  const result = validateRegistrationProfile(input, { now: NOW });
  assert.equal(result.isValid, false, `${field} invalid olduqda profil qəbul edilməməlidir`);
  assert.equal(typeof result.errors[field], 'string', `${field} üçün sahə xətası qaytarılmalıdır`);
  assert.ok(result.errors[field].length > 0, `${field} xətası boş olmamalıdır`);
}

function normalizationAndPassportTests() {
  const result = validateRegistrationProfile(validPassportProfile(), { now: NOW });

  assert.equal(result.isValid, true);
  assert.deepEqual(result.errors, {});
  assert.equal(result.profile.name, 'Ada Maria');
  assert.equal(result.profile.email, 'ada@example.com');
  assert.equal(result.profile.identityDocumentType, 'PASSPORT');
  assert.equal(result.profile.identityDocumentNumber, 'AZ1234567');
  assert.equal(result.profile.documentCountryCode, 'AZ');
  assert.equal(result.profile.postalCode, 'AZ 1000');
  assert.equal(result.profile.addressLine, '28 May küçəsi 10');

  assert.equal(validateRegistrationProfile(validPassportProfile({
    identityDocumentNumber: 'A1234'
  }), { now: NOW }).isValid, true);
  assert.equal(validateRegistrationProfile(validPassportProfile({
    identityDocumentNumber: 'AB123456789012345678'
  }), { now: NOW }).isValid, true);

  assertFieldError(validPassportProfile({ identityDocumentNumber: 'A123' }), 'identityDocumentNumber');
  assertFieldError(validPassportProfile({ identityDocumentNumber: 'AB1234567890123456789' }), 'identityDocumentNumber');
  assertFieldError(validPassportProfile({ documentCountryCode: '' }), 'documentCountryCode');
  assertFieldError(validPassportProfile({ documentCountryCode: 'AZE' }), 'documentCountryCode');
}

function turkishIdentityTests() {
  const identityNumber = validTurkishIdentityNumber();
  const negativeDifferenceIdentityNumber = validTurkishIdentityNumber('190909090');
  assert.equal(isValidTurkishIdentityNumber(identityNumber), true);
  assert.equal(isValidTurkishIdentityNumber(negativeDifferenceIdentityNumber), true);
  assert.equal(isValidTurkishIdentityNumber(`0${identityNumber.slice(1)}`), false);
  assert.equal(isValidTurkishIdentityNumber(`${identityNumber.slice(0, 10)}0`), false);
  assert.equal(isValidTurkishIdentityNumber(identityNumber.slice(0, 10)), false);

  const result = validateRegistrationProfile(validPassportProfile({
    identityDocumentType: 'tc_id',
    identityDocumentNumber: identityNumber,
    documentCountryCode: ''
  }), { now: NOW });

  assert.equal(result.isValid, true);
  assert.equal(result.profile.documentCountryCode, 'TR');
  assertFieldError(validPassportProfile({
    identityDocumentType: 'TC_ID',
    identityDocumentNumber: '10000000140'
  }), 'identityDocumentNumber');
}

function requiredFieldTests() {
  const requiredFields = [
    'name',
    'surname',
    'email',
    'phone',
    'identityDocumentType',
    'identityDocumentNumber',
    'birthDate',
    'country',
    'city',
    'district',
    'addressLine'
  ];

  requiredFields.forEach((field) => {
    assertFieldError(validPassportProfile({ [field]: '   ' }), field);
  });

  assertFieldError(validPassportProfile({ documentCountryCode: '   ' }), 'documentCountryCode');
  assert.equal(validateRegistrationProfile(validPassportProfile({ postalCode: '   ' }), { now: NOW }).isValid, true);
  assert.deepEqual(PROFILE_FIELDS, [
    'name',
    'surname',
    'email',
    'phone',
    'identityDocumentType',
    'identityDocumentNumber',
    'documentCountryCode',
    'birthDate',
    'country',
    'city',
    'district',
    'postalCode',
    'addressLine'
  ]);
  assert.equal(hasAnyRegistrationProfileInput({}), false);
  assert.equal(hasAnyRegistrationProfileInput({ addressLine: 'Test address' }), true);
}

function formatAndBoundaryTests() {
  assertFieldError(validPassportProfile({ email: 'invalid@' }), 'email');
  assertFieldError(validPassportProfile({ phone: '123456789' }), 'phone');
  assertFieldError(validPassportProfile({ phone: '1234567890123456' }), 'phone');
  assertFieldError(validPassportProfile({ identityDocumentType: 'DRIVER_LICENSE' }), 'identityDocumentType');
  assertFieldError(validPassportProfile({ birthDate: '2026-07-22' }), 'birthDate');
  assertFieldError(validPassportProfile({ birthDate: '2026-07-23' }), 'birthDate');
  assertFieldError(validPassportProfile({ birthDate: '2025-02-29' }), 'birthDate');
  assertFieldError(validPassportProfile({ postalCode: 'AZ@1000' }), 'postalCode');
  assertFieldError(validPassportProfile({ postalCode: 'A'.repeat(21) }), 'postalCode');

  assert.equal(normalizeIsoDate('2000-02-29'), '2000-02-29');
  assert.equal(normalizeIsoDate('2001-02-29'), null);
  assert.equal(normalizeIsoDate('22-07-2000'), null);
  assert.equal(validateRegistrationProfile(validPassportProfile({
    birthDate: '2026-07-21',
    phone: '+123456789012345'
  }), { now: NOW }).isValid, true);
}

function run() {
  normalizationAndPassportTests();
  turkishIdentityTests();
  requiredFieldTests();
  formatAndBoundaryTests();
  console.log('Registration profile validation tests passed.');
}

run();
