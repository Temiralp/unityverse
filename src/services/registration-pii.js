const crypto = require('crypto');

const CIPHER_PREFIX = 'uv1';
const ALGORITHM = 'aes-256-gcm';

class RegistrationPiiConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RegistrationPiiConfigurationError';
  }
}

class RegistrationPiiDecryptionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RegistrationPiiDecryptionError';
  }
}

function decodeKey(value, keyId) {
  const encoded = String(value || '').trim();
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
    throw new RegistrationPiiConfigurationError(`PII şifrələmə açarı geçersiz: ${keyId}.`);
  }

  const key = Buffer.from(encoded, 'base64');
  if (key.length !== 32) {
    throw new RegistrationPiiConfigurationError(`PII şifrələmə açarı 32 byte olmalıdır: ${keyId}.`);
  }

  return key;
}

function keyring() {
  const activeKeyId = String(process.env.REGISTRATION_PII_ACTIVE_KEY_ID || '').trim();
  const serialized = String(process.env.REGISTRATION_PII_ENCRYPTION_KEYS || '').trim();
  let values;

  if (!activeKeyId || !serialized) {
    throw new RegistrationPiiConfigurationError('Registration PII şifrələmə ayarları tamamlanmamış.');
  }
  if (!/^[A-Za-z0-9_-]{1,32}$/.test(activeKeyId)) {
    throw new RegistrationPiiConfigurationError('REGISTRATION_PII_ACTIVE_KEY_ID geçersiz.');
  }

  try {
    values = JSON.parse(serialized);
  } catch (error) {
    throw new RegistrationPiiConfigurationError('REGISTRATION_PII_ENCRYPTION_KEYS geçerli JSON olmalıdır.');
  }

  if (!values || Array.isArray(values) || typeof values !== 'object' || !values[activeKeyId]) {
    throw new RegistrationPiiConfigurationError('Aktif Registration PII açarı keyring içinde bulunamadı.');
  }

  return {
    activeKeyId,
    keys: new Map(Object.entries(values).map(([keyId, value]) => {
      if (!/^[A-Za-z0-9_-]{1,32}$/.test(keyId)) {
        throw new RegistrationPiiConfigurationError('PII keyring geçersiz bir key ID içeriyor.');
      }
      return [keyId, decodeKey(value, keyId)];
    }))
  };
}

function aad(field) {
  return Buffer.from(`unityverse:education-registration:${field}`, 'utf8');
}

function encryptField(field, value) {
  const plaintext = String(value == null ? '' : value);
  if (!plaintext) return null;

  const { activeKeyId, keys } = keyring();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, keys.get(activeKeyId), iv);
  cipher.setAAD(aad(field));
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    CIPHER_PREFIX,
    activeKeyId,
    iv.toString('base64url'),
    tag.toString('base64url'),
    encrypted.toString('base64url')
  ].join(':');
}

function decryptField(field, value) {
  if (!value) return null;

  const parts = String(value).split(':');
  if (parts.length !== 5 || parts[0] !== CIPHER_PREFIX) {
    throw new RegistrationPiiDecryptionError('Şifrəli Registration PII formatı geçersiz.');
  }

  try {
    const [, keyId, ivValue, tagValue, encryptedValue] = parts;
    const { keys } = keyring();
    const key = keys.get(keyId);
    if (!key) {
      throw new RegistrationPiiConfigurationError(`PII şifrə açarı keyring içinde bulunamadı: ${keyId}.`);
    }

    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivValue, 'base64url'));
    decipher.setAAD(aad(field));
    decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, 'base64url')),
      decipher.final()
    ]).toString('utf8');
  } catch (error) {
    if (error instanceof RegistrationPiiConfigurationError) throw error;
    throw new RegistrationPiiDecryptionError('Registration PII çözülemedi veya bütünlük kontrolü başarısız oldu.');
  }
}

function encryptRegistrationPii(profile) {
  const address = {
    country: profile.country,
    city: profile.city,
    district: profile.district,
    postalCode: profile.postalCode || '',
    addressLine: profile.addressLine
  };

  return {
    identityDocumentType: profile.identityDocumentType,
    identityDocumentNumberEncrypted: encryptField('identityDocumentNumber', profile.identityDocumentNumber),
    identityDocumentCountryCode: profile.documentCountryCode,
    birthDateEncrypted: encryptField('birthDate', profile.birthDate),
    addressEncrypted: encryptField('address', JSON.stringify(address))
  };
}

function decryptRegistrationPii(registration) {
  const empty = {
    identityDocumentType: registration?.identityDocumentType || '',
    identityDocumentNumber: '',
    documentCountryCode: registration?.identityDocumentCountryCode || '',
    birthDate: '',
    country: '',
    city: '',
    district: '',
    postalCode: '',
    addressLine: ''
  };

  const encryptedValues = [
    registration?.identityDocumentNumberEncrypted,
    registration?.birthDateEncrypted,
    registration?.addressEncrypted
  ];
  const encryptedValueCount = encryptedValues.filter(Boolean).length;

  if (encryptedValueCount === 0) {
    return empty;
  }
  if (encryptedValueCount !== encryptedValues.length) {
    throw new RegistrationPiiDecryptionError('Şifrəli Registration PII alanları eksik veya tutarsız.');
  }

  const addressText = decryptField('address', registration.addressEncrypted);
  let address;
  try {
    address = JSON.parse(addressText);
  } catch (error) {
    throw new RegistrationPiiDecryptionError('Şifrəli adres verisi geçersiz.');
  }
  if (!address || Array.isArray(address) || typeof address !== 'object') {
    throw new RegistrationPiiDecryptionError('Şifrəli adres verisi geçersiz.');
  }

  return {
    ...empty,
    identityDocumentNumber: decryptField('identityDocumentNumber', registration.identityDocumentNumberEncrypted) || '',
    birthDate: decryptField('birthDate', registration.birthDateEncrypted) || '',
    country: String(address.country || ''),
    city: String(address.city || ''),
    district: String(address.district || ''),
    postalCode: String(address.postalCode || ''),
    addressLine: String(address.addressLine || '')
  };
}

function hasCompleteEncryptedRegistrationPii(registration) {
  return Boolean(
    registration
    && ['TC_ID', 'PASSPORT'].includes(registration.identityDocumentType)
    && registration.identityDocumentNumberEncrypted
    && registration.birthDateEncrypted
    && registration.addressEncrypted
    && (
      registration.identityDocumentType !== 'PASSPORT'
      || /^[A-Z]{2}$/.test(String(registration.identityDocumentCountryCode || ''))
    )
  );
}

function formattedAddress(profile) {
  return [
    profile.addressLine,
    [profile.district, profile.city].filter(Boolean).join(' / '),
    profile.postalCode,
    profile.country
  ].filter(Boolean).join(', ');
}

module.exports = {
  RegistrationPiiConfigurationError,
  RegistrationPiiDecryptionError,
  decryptField,
  decryptRegistrationPii,
  encryptField,
  encryptRegistrationPii,
  formattedAddress,
  hasCompleteEncryptedRegistrationPii
};
