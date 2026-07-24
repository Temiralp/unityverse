const PROFILE_FIELDS = [
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
];

function text(value) {
  return String(value == null ? '' : value).trim();
}

function compactWhitespace(value) {
  return text(value).replace(/\s+/g, ' ');
}

function isValidTurkishIdentityNumber(value) {
  if (!/^[1-9]\d{10}$/.test(value)) return false;

  const digits = value.split('').map(Number);
  const oddSum = digits[0] + digits[2] + digits[4] + digits[6] + digits[8];
  const evenSum = digits[1] + digits[3] + digits[5] + digits[7];

  const tenthDigit = (((oddSum * 7) - evenSum) % 10 + 10) % 10;

  return tenthDigit === digits[9]
    && digits.slice(0, 10).reduce((sum, digit) => sum + digit, 0) % 10 === digits[10];
}

function normalizeIsoDate(value) {
  const raw = text(value);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    return null;
  }

  return `${match[1]}-${match[2]}-${match[3]}`;
}

function todayIso(now = new Date()) {
  return [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, '0'),
    String(now.getUTCDate()).padStart(2, '0')
  ].join('-');
}

function validateLength(errors, field, value, label, min, max) {
  if (!value) {
    errors[field] = `${label} zorunludur.`;
  } else if (value.length < min || value.length > max) {
    errors[field] = `${label} ${min}-${max} karakter arasında olmalıdır.`;
  }
}

function validateRegistrationProfile(input, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const profile = {
    name: compactWhitespace(input?.name),
    surname: compactWhitespace(input?.surname),
    email: text(input?.email).toLowerCase(),
    phone: compactWhitespace(input?.phone),
    identityDocumentType: text(input?.identityDocumentType).toUpperCase(),
    identityDocumentNumber: text(input?.identityDocumentNumber).toUpperCase().replace(/\s+/g, ''),
    documentCountryCode: text(input?.documentCountryCode).toUpperCase(),
    birthDate: normalizeIsoDate(input?.birthDate),
    country: compactWhitespace(input?.country),
    city: compactWhitespace(input?.city),
    district: compactWhitespace(input?.district),
    postalCode: compactWhitespace(input?.postalCode),
    addressLine: compactWhitespace(input?.addressLine)
  };
  const errors = {};

  validateLength(errors, 'name', profile.name, 'Ad', 2, 100);
  validateLength(errors, 'surname', profile.surname, 'Soyad', 2, 100);

  if (!profile.email) {
    errors.email = 'E-posta adresi zorunludur.';
  } else if (profile.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) {
    errors.email = 'Geçerli bir e-posta adresi giriniz.';
  }

  const phoneDigits = profile.phone.replace(/\D/g, '');
  if (!profile.phone) {
    errors.phone = 'Telefon numarası zorunludur.';
  } else if (phoneDigits.length < 10 || phoneDigits.length > 15) {
    errors.phone = 'Telefon numarası ülke kodu dahil 10-15 rakam olmalıdır.';
  }

  if (!['TC_ID', 'PASSPORT'].includes(profile.identityDocumentType)) {
    errors.identityDocumentType = 'Kimlik belgesi türünü seçiniz.';
  } else if (profile.identityDocumentType === 'TC_ID') {
    profile.documentCountryCode = 'TR';
    if (!isValidTurkishIdentityNumber(profile.identityDocumentNumber)) {
      errors.identityDocumentNumber = 'Geçerli bir T.C. kimlik numarası giriniz.';
    }
  } else {
    if (!/^[A-Z0-9]{5,20}$/.test(profile.identityDocumentNumber)) {
      errors.identityDocumentNumber = 'Passport numarası 5-20 harf veya rakamdan oluşmalıdır.';
    }
    if (!/^[A-Z]{2}$/.test(profile.documentCountryCode)) {
      errors.documentCountryCode = 'Passportu veren ülkenin iki harfli kodunu giriniz.';
    }
  }

  if (!profile.birthDate) {
    errors.birthDate = 'Geçerli bir doğum tarihi giriniz.';
  } else if (profile.birthDate >= todayIso(now)) {
    errors.birthDate = 'Doğum tarihi geçmiş bir tarih olmalıdır.';
  }

  validateLength(errors, 'country', profile.country, 'Ülke', 2, 100);
  validateLength(errors, 'city', profile.city, 'Şehir', 2, 100);
  validateLength(errors, 'district', profile.district, 'İlçe / rayon', 2, 100);
  validateLength(errors, 'addressLine', profile.addressLine, 'Açık adres', 5, 500);

  if (profile.postalCode && (profile.postalCode.length > 20 || !/^[\p{L}\p{N}\s-]+$/u.test(profile.postalCode))) {
    errors.postalCode = 'Posta kodu en fazla 20 harf, rakam, boşluk veya tire içerebilir.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    profile
  };
}

function hasAnyRegistrationProfileInput(input) {
  return PROFILE_FIELDS.some((field) => text(input?.[field]));
}

module.exports = {
  PROFILE_FIELDS,
  hasAnyRegistrationProfileInput,
  isValidTurkishIdentityNumber,
  normalizeIsoDate,
  validateRegistrationProfile
};
