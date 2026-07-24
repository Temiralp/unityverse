const crypto = require('crypto');
const { inspectRegistrationCheckoutProfile } = require('./registration-checkout');
const {
  RegistrationPiiConfigurationError,
  RegistrationPiiDecryptionError,
  formattedAddress
} = require('./registration-pii');

const PAYTR_TOKEN_URL = 'https://www.paytr.com/odeme/api/get-token';
const PAYTR_REQUEST_TIMEOUT_MS = 20 * 1000;

class PaytrConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PaytrConfigurationError';
  }
}

class PaytrRequestError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'PaytrRequestError';
    this.reason = options.reason || null;
    this.statusCode = options.statusCode || null;
  }
}

function requiredEnvironment(name) {
  const value = String(process.env[name] || '').trim();

  if (!value) {
    throw new PaytrConfigurationError(`${name} tanımlı değil.`);
  }

  return value;
}

function paytrSecrets() {
  return {
    merchantKey: requiredEnvironment('PAYTR_MERCHANT_KEY'),
    merchantSalt: requiredEnvironment('PAYTR_MERCHANT_SALT')
  };
}

function environmentValue(name, fallback) {
  const value = String(process.env[name] ?? '').trim();
  return value || fallback;
}

function paytrFlag(name, fallback) {
  const value = environmentValue(name, fallback);

  if (!['0', '1'].includes(value)) {
    throw new PaytrConfigurationError(`${name} 0 veya 1 olmalıdır.`);
  }

  return value;
}

function paytrMaxInstallment(name, fallback) {
  const value = environmentValue(name, fallback);
  const allowedValues = new Set(['0', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']);

  if (!allowedValues.has(value)) {
    throw new PaytrConfigurationError(`${name} 0 veya 2-12 arasında olmalıdır.`);
  }

  return value;
}

function paytrConfig() {
  const publicBaseUrl = requiredEnvironment('PAYTR_PUBLIC_BASE_URL').replace(/\/+$/, '');
  const secrets = paytrSecrets();

  if (!/^https:\/\//i.test(publicBaseUrl)) {
    throw new PaytrConfigurationError('PAYTR_PUBLIC_BASE_URL geçerli bir HTTPS adresi olmalıdır.');
  }

  return {
    merchantId: requiredEnvironment('PAYTR_MERCHANT_ID'),
    ...secrets,
    publicBaseUrl,
    testMode: String(process.env.PAYTR_TEST_MODE || '0').trim() === '1' ? '1' : '0',
    noInstallment: paytrFlag('PAYTR_NO_INSTALLMENT', '0'),
    maxInstallment: paytrMaxInstallment('PAYTR_MAX_INSTALLMENT', '0'),
    currency: 'TL'
  };
}

function paymentOptionsFromConfig(config) {
  return {
    installmentsEnabled: config.noInstallment === '0',
    noInstallment: config.noInstallment,
    maxInstallment: config.maxInstallment
  };
}

function decimalToKurus(value) {
  const text = String(value == null ? '' : value).trim();
  const match = text.match(/^(\d+)(?:\.(\d{1,2}))?$/);

  if (!match) {
    throw new PaytrRequestError('Ödeme tutarı geçersiz.');
  }

  const lira = BigInt(match[1]);
  const fraction = String(match[2] || '').padEnd(2, '0');
  const kurus = lira * 100n + BigInt(fraction || '0');

  if (kurus <= 0n || kurus > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new PaytrRequestError('Ödeme tutarı geçersiz.');
  }

  return kurus.toString();
}

function paymentPrice(value) {
  return (Number(decimalToKurus(value)) / 100).toFixed(2);
}

function createMerchantOid(registrationId, now = Date.now()) {
  const random = crypto.randomBytes(6).toString('hex');
  const merchantOid = `UVR${registrationId}T${now}X${random}`;

  if (merchantOid.length > 64 || !/^[A-Za-z0-9]+$/.test(merchantOid)) {
    throw new PaytrRequestError('Sipariş numarası oluşturulamadı.');
  }

  return merchantOid;
}

function createUserBasket(courseTitle, amount) {
  const basket = [[String(courseTitle), paymentPrice(amount), 1]];
  return Buffer.from(JSON.stringify(basket), 'utf8').toString('base64');
}

function createPaytrToken(values, config) {
  const hashString = [
    config.merchantId,
    values.userIp,
    values.merchantOid,
    values.email,
    values.paymentAmount,
    values.userBasket,
    config.noInstallment,
    config.maxInstallment,
    config.currency,
    config.testMode
  ].join('');

  return crypto
    .createHmac('sha256', config.merchantKey)
    .update(hashString + config.merchantSalt)
    .digest('base64');
}

function createPaytrCallbackHash({ merchantOid, status, totalAmount }) {
  const secrets = paytrSecrets();
  const hashString = `${merchantOid}${secrets.merchantSalt}${status}${totalAmount}`;

  return crypto
    .createHmac('sha256', secrets.merchantKey)
    .update(hashString)
    .digest('base64');
}

function verifyPaytrCallbackHash(values, suppliedHash) {
  if (!suppliedHash) return false;

  const expectedHash = Buffer.from(createPaytrCallbackHash(values), 'utf8');
  const receivedHash = Buffer.from(String(suppliedHash), 'utf8');

  return expectedHash.length === receivedHash.length
    && crypto.timingSafeEqual(expectedHash, receivedHash);
}

function registrationIdFromMerchantOid(merchantOid) {
  const match = String(merchantOid || '').match(/^UVR([1-9]\d*)T\d{13}X[a-f0-9]{12}$/);
  if (!match) return null;

  const registrationId = Number(match[1]);
  return Number.isSafeInteger(registrationId) ? registrationId : null;
}

function kurusToDecimal(value) {
  const text = String(value || '');
  if (!/^[1-9]\d*$/.test(text)) {
    throw new PaytrRequestError('PayTR toplam tutarı geçersiz.');
  }

  const kurus = BigInt(text);
  if (kurus > 9999999999n) {
    throw new PaytrRequestError('PayTR toplam tutarı desteklenen sınırı aşıyor.');
  }

  const lira = kurus / 100n;
  const fraction = String(kurus % 100n).padStart(2, '0');

  return `${lira}.${fraction}`;
}

function normalizeUserIp(value) {
  const requestIp = String(value || '').trim().replace(/^::ffff:/, '');
  const ip = !requestIp || requestIp === '::1' || requestIp === '127.0.0.1'
    ? String(process.env.PAYTR_USER_IP || '').trim()
    : requestIp;

  if (!ip) {
    throw new PaytrConfigurationError(
      'Lokal PayTR testi için PAYTR_USER_IP alanına dış IP adresinizi yazmalısınız.'
    );
  }

  if (ip.length > 39 || !/^[0-9a-f:.]+$/i.test(ip)) {
    throw new PaytrRequestError('Müşteri IP adresi geçersiz.');
  }

  return ip;
}

function buildPaytrPayload({ registration, userIp }) {
  const config = paytrConfig();
  let checkoutProfile;
  try {
    const profileResult = inspectRegistrationCheckoutProfile(registration);
    if (!profileResult.isValid) {
      throw new PaytrRequestError('Ödeme için kayıt bilgileri eksik veya geçersiz.');
    }
    checkoutProfile = profileResult.profile;
  } catch (error) {
    if (error instanceof RegistrationPiiConfigurationError) {
      throw new PaytrConfigurationError('Kayıt PII şifrələmə yapılandırması tamamlanmamış.');
    }
    if (error instanceof RegistrationPiiDecryptionError) {
      throw new PaytrRequestError('Ödeme için kayıt bilgileri güvenli şekilde okunamadı.');
    }
    throw error;
  }
  const amount = registration.totalAmount == null
    ? registration.product?.discountPrice ?? registration.product?.price
    : registration.totalAmount;

  if (amount == null) {
    throw new PaytrRequestError('Kayıt için ödeme tutarı bulunamadı.');
  }

  const merchantOid = createMerchantOid(registration.id);
  const paymentAmount = decimalToKurus(amount);
  const userBasket = createUserBasket(registration.courseTitle, amount);
  const values = {
    userIp: normalizeUserIp(userIp),
    merchantOid,
    email: checkoutProfile.email,
    paymentAmount,
    userBasket
  };
  const userName = [checkoutProfile.name, checkoutProfile.surname].filter(Boolean).join(' ').trim();
  const userPhone = checkoutProfile.phone;
  const userAddress = formattedAddress(checkoutProfile);

  if (!values.email || !userName || !userPhone) {
    throw new PaytrRequestError('Ödeme için üye iletişim bilgileri eksik.');
  }

  if (values.email.length > 100 || userName.length > 60 || userPhone.length > 20) {
    throw new PaytrRequestError('Ödeme için üye iletişim bilgileri PayTR sınırlarını aşıyor.');
  }

  const resultQuery = `?registrationId=${registration.id}`;
  const merchantOkUrl = `${config.publicBaseUrl}/odeme/basarili${resultQuery}`;
  const merchantFailUrl = `${config.publicBaseUrl}/odeme/basarisiz${resultQuery}`;
  if (
    userAddress.length > 400
    || merchantOkUrl.length > 400
    || merchantFailUrl.length > 400
  ) {
    throw new PaytrConfigurationError('PayTR adres veya yönlendirme URL alanı sınırı aşılıyor.');
  }

  const payload = new URLSearchParams({
    merchant_id: config.merchantId,
    user_ip: values.userIp,
    merchant_oid: values.merchantOid,
    email: values.email,
    payment_amount: values.paymentAmount,
    paytr_token: createPaytrToken(values, config),
    user_basket: values.userBasket,
    debug_on: config.testMode === '1' ? '1' : '0',
    no_installment: config.noInstallment,
    max_installment: config.maxInstallment,
    user_name: userName,
    user_address: userAddress,
    user_phone: userPhone,
    merchant_ok_url: merchantOkUrl,
    merchant_fail_url: merchantFailUrl,
    timeout_limit: '30',
    currency: config.currency,
    test_mode: config.testMode,
    lang: 'tr'
  });

  return {
    merchantOid,
    paymentAmount,
    paymentOptions: paymentOptionsFromConfig(config),
    payload
  };
}

async function requestPaytrIframeToken({ registration, userIp, fetchImpl = fetch }) {
  const request = buildPaytrPayload({ registration, userIp });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PAYTR_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetchImpl(PAYTR_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: request.payload,
      signal: controller.signal
    });
    const text = await response.text();
    let result;

    try {
      result = JSON.parse(text);
    } catch (error) {
      throw new PaytrRequestError('PayTR geçersiz bir yanıt döndürdü.', {
        statusCode: response.status
      });
    }

    if (!response.ok || result.status !== 'success' || !result.token) {
      throw new PaytrRequestError('PayTR iframe tokeni alınamadı.', {
        reason: String(result.reason || `HTTP ${response.status}`),
        statusCode: response.status
      });
    }

    return {
      token: result.token,
      merchantOid: request.merchantOid,
      paymentAmount: request.paymentAmount,
      paymentOptions: request.paymentOptions
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new PaytrRequestError('PayTR isteği zaman aşımına uğradı.');
    }

    if (error instanceof PaytrRequestError || error instanceof PaytrConfigurationError) {
      throw error;
    }

    throw new PaytrRequestError('PayTR bağlantısı kurulamadı.', {
      reason: error.message
    });
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  PAYTR_TOKEN_URL,
  PaytrConfigurationError,
  PaytrRequestError,
  buildPaytrPayload,
  createPaytrCallbackHash,
  createMerchantOid,
  createPaytrToken,
  createUserBasket,
  decimalToKurus,
  kurusToDecimal,
  paymentOptionsFromConfig,
  registrationIdFromMerchantOid,
  verifyPaytrCallbackHash,
  requestPaytrIframeToken
};
