require('dotenv').config();

const { createInterface } = require('readline/promises');
const { stdin, stdout } = require('process');

const BASE_URL = process.env.PAYTR_TEST_BASE_URL || 'http://localhost:8000';
const MIN_FORM_AGE_MS = 2700;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function updateCookie(currentCookie, response) {
  const setCookie = response.headers.get('set-cookie');
  if (!setCookie) return currentCookie;

  return setCookie
    .split(',')
    .map((value) => value.trim().split(';')[0])
    .find((value) => value.startsWith('connect.sid=')) || currentCookie;
}

async function requestJson(path, options = {}, currentCookie = '') {
  const headers = new Headers(options.headers || {});
  if (currentCookie) headers.set('Cookie', currentCookie);

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
    redirect: 'manual'
  });
  const cookie = updateCookie(currentCookie, response);
  const text = await response.text();
  let body;

  try {
    body = JSON.parse(text);
  } catch (error) {
    body = { raw: text };
  }

  return { response, body, cookie };
}

async function getCsrfToken(cookie) {
  const result = await requestJson('/api/csrf-token', {}, cookie);

  if (!result.response.ok || !result.body.token) {
    throw new Error(`CSRF token alınamadı: HTTP ${result.response.status}`);
  }

  return { token: result.body.token, cookie: result.cookie };
}

async function getMemberFormToken(cookie) {
  const result = await requestJson('/api/form-protection-token?scope=member', {}, cookie);

  if (!result.response.ok || !result.body.token) {
    throw new Error(`Member form token alınamadı: HTTP ${result.response.status}`);
  }

  return { token: result.body.token, cookie: result.cookie };
}

async function main() {
  const prompt = createInterface({ input: stdin, output: stdout });

  try {
    console.log(`Test serveri: ${BASE_URL}`);
    console.log('Bu test PayTR token servisini çağırır; DB ödeme/status kaydı yazmaz.');

    const email = String(
      process.env.PAYTR_TEST_EMAIL || await prompt.question('Test üye e-postası: ')
    ).trim();
    const password = String(
      process.env.PAYTR_TEST_PASSWORD || await prompt.question('Test üye şifresi: ')
    );
    const registrationId = String(
      process.env.PAYTR_TEST_REGISTRATION_ID || await prompt.question('EducationRegistration ID: ')
    ).trim();

    if (!email || !password || !/^[1-9]\d*$/.test(registrationId)) {
      throw new Error('E-posta, şifre ve pozitif registration ID zorunludur.');
    }

    let cookie = '';
    const loginCsrf = await getCsrfToken(cookie);
    cookie = loginCsrf.cookie;
    const memberToken = await getMemberFormToken(cookie);
    cookie = memberToken.cookie;

    console.log(`Anti-bot minimum süresi için ${MIN_FORM_AGE_MS} ms beklenir...`);
    await delay(MIN_FORM_AGE_MS);

    const login = await requestJson('/ajax/member/signin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: new URLSearchParams({
        email,
        password,
        _csrf: loginCsrf.token,
        _formToken: memberToken.token,
        website: ''
      })
    }, cookie);
    cookie = login.cookie;

    console.log(`Login: HTTP ${login.response.status}`);
    if (!login.response.ok || login.body.status !== 'success') {
      console.log(JSON.stringify(login.body, null, 2));
      throw new Error('Üye girişi başarısız.');
    }

    const me = await requestJson('/ajax/member/me', {}, cookie);
    cookie = me.cookie;
    if (!me.body.authenticated) {
      throw new Error('Üye session doğrulanamadı.');
    }

    console.log(`Session: üye #${me.body.member.id} (${me.body.member.email})`);
    const tokenCsrf = await getCsrfToken(cookie);
    cookie = tokenCsrf.cookie;

    const paytr = await requestJson('/ajax/paytr/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: new URLSearchParams({
        registrationId,
        _csrf: tokenCsrf.token,
        distanceSalesAgreement: '1',
        privacyAgreement: '1',
        refundAgreement: '1'
      })
    }, cookie);

    console.log(`PayTR token: HTTP ${paytr.response.status}`);
    console.log(JSON.stringify(paytr.body, null, 2));

    if (!paytr.response.ok || paytr.body.status !== 'success' || !paytr.body.token) {
      throw new Error('PayTR iframe tokenu alınamadı.');
    }

    console.log('\nSonuç: PayTR success + iframe token alındı; DB statusu değiştirilmedi.');
  } finally {
    prompt.close();
  }
}

main().catch((error) => {
  console.error(`\nTest başarısız: ${error.message}`);
  process.exitCode = 1;
});
