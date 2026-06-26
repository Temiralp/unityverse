require('dotenv').config();

const prisma = require('../src/db');
const {
  createMerchantOid,
  createPaytrCallbackHash,
  decimalToKurus
} = require('../src/services/paytr');

const BASE_URL = process.env.PAYTR_CALLBACK_TEST_BASE_URL || 'http://localhost:8000';
const modeArgument = process.argv.find((value) => value.startsWith('--mode='));
const mode = modeArgument ? modeArgument.split('=')[1] : 'bad-hash';
const shouldCommit = process.argv.includes('--commit');

function positiveId(value) {
  const text = String(value || '').trim();
  if (!/^[1-9]\d*$/.test(text)) return null;

  const id = Number(text);
  return Number.isSafeInteger(id) ? id : null;
}

async function callbackRequest(payload) {
  const response = await fetch(`${BASE_URL}/odeme/callback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams(payload)
  });

  return {
    status: response.status,
    body: await response.text()
  };
}

async function registrationSnapshot(registrationId, merchantOid) {
  const note = `PayTR merchant_oid: ${merchantOid}`;
  const [registration, paymentCount, historyCount] = await Promise.all([
    prisma.educationRegistration.findUnique({
      where: { id: registrationId },
      select: {
        id: true,
        status: true,
        paymentStatus: true,
        totalAmount: true
      }
    }),
    prisma.educationPayment.count({
      where: { registrationId, note }
    }),
    prisma.educationRegistrationStatusHistory.count({
      where: { registrationId, note }
    })
  ]);

  return {
    registration: registration && {
      ...registration,
      totalAmount: registration.totalAmount?.toString() || null
    },
    paymentCount,
    historyCount
  };
}

async function main() {
  if (!['bad-hash', 'failed', 'success', 'duplicate'].includes(mode)) {
    throw new Error('Mode bad-hash, failed, success veya duplicate olmalıdır.');
  }

  const registrationId = positiveId(process.env.PAYTR_CALLBACK_TEST_REGISTRATION_ID);
  if (!registrationId) {
    throw new Error('PAYTR_CALLBACK_TEST_REGISTRATION_ID pozitif bir kayıt ID olmalıdır.');
  }

  if (['success', 'duplicate'].includes(mode) && !shouldCommit) {
    throw new Error('Success testi DB durumunu değiştirir. Bilinçli çalıştırmak için --commit ekleyin.');
  }

  const registration = await prisma.educationRegistration.findUnique({
    where: { id: registrationId },
    select: {
      id: true,
      totalAmount: true
    }
  });

  if (!registration || registration.totalAmount == null) {
    throw new Error('Tutarı tanımlı EducationRegistration bulunamadı.');
  }

  const merchantOid = createMerchantOid(registration.id);
  const paymentAmount = decimalToKurus(registration.totalAmount);
  const status = mode === 'failed' ? 'failed' : 'success';
  const totalAmount = status === 'failed' ? '0' : paymentAmount;
  const hash = mode === 'bad-hash'
    ? 'invalid-hash'
    : createPaytrCallbackHash({ merchantOid, status, totalAmount });
  const payload = {
    merchant_oid: merchantOid,
    status,
    total_amount: totalAmount,
    payment_type: 'card',
    currency: 'TL',
    test_mode: '1',
    hash
  };

  if (status === 'failed') {
    payload.failed_reason_code = '0';
    payload.failed_reason_msg = 'Simülasyon testi';
  } else {
    payload.payment_amount = paymentAmount;
  }

  const before = await registrationSnapshot(registrationId, merchantOid);
  const first = await callbackRequest(payload);
  const second = mode === 'duplicate' ? await callbackRequest(payload) : null;
  const after = await registrationSnapshot(registrationId, merchantOid);

  console.log(JSON.stringify({
    mode,
    registrationId,
    merchantOid,
    request: {
      status,
      totalAmount,
      paymentAmount,
      hash: mode === 'bad-hash' ? hash : '[valid HMAC]'
    },
    first,
    second,
    before,
    after
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(`Callback testi başarısız: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
