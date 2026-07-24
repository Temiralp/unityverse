require('dotenv').config();

const { createInterface } = require('readline/promises');
const { stdin, stdout } = require('process');

const BASE_URL = process.env.ENROLL_TEST_BASE_URL || 'http://localhost:8000';
const MIN_FORM_AGE_MS = 2700;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function updateCookie(currentCookie, response) {
  const setCookie = response.headers.get('set-cookie');
  if (!setCookie) return currentCookie;

  const sessionCookie = setCookie
    .split(',')
    .map((value) => value.trim().split(';')[0])
    .find((value) => value.startsWith('connect.sid='));

  return sessionCookie || currentCookie;
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

async function getFormToken(scope, cookie) {
  const result = await requestJson(
    `/api/form-protection-token?scope=${encodeURIComponent(scope)}`,
    {},
    cookie
  );

  if (!result.response.ok || !result.body.token) {
    throw new Error(`${scope} form token alınamadı: HTTP ${result.response.status}`);
  }

  return { token: result.body.token, cookie: result.cookie };
}

function formBody(values) {
  return new URLSearchParams(values);
}

async function main() {
  const prompt = createInterface({ input: stdin, output: stdout });

  try {
    console.log(`Test sunucusu: ${BASE_URL}`);
    console.log('Bu test başarılı olursa DB-de gerçek EducationRegistration oluşturulacak.');

    const email = String(
      process.env.ENROLL_TEST_EMAIL || await prompt.question('Test üye e-postası: ')
    ).trim();
    const password = String(
      process.env.ENROLL_TEST_PASSWORD || await prompt.question('Test üye şifresi: ')
    );
    const productAnswer = String(
      process.env.ENROLL_TEST_PRODUCT_ID || await prompt.question('Product ID [2]: ')
    ).trim();
    const productId = productAnswer || '2';

    if (!email || !password || !/^[1-9]\d*$/.test(productId)) {
      throw new Error('E-posta, şifre ve pozitif Product ID zorunludur.');
    }

    let cookie = '';

    console.log('\n1. Login için CSRF ve member form token alınır...');
    const loginCsrf = await getCsrfToken(cookie);
    cookie = loginCsrf.cookie;
    const memberProtection = await getFormToken('member', cookie);
    cookie = memberProtection.cookie;

    console.log(`2. Anti-bot minimum süresi için ${MIN_FORM_AGE_MS} ms beklenir...`);
    await delay(MIN_FORM_AGE_MS);

    const login = await requestJson('/ajax/member/signin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: formBody({
        email,
        password,
        _csrf: loginCsrf.token,
        _formToken: memberProtection.token,
        website: ''
      })
    }, cookie);
    cookie = login.cookie;

    console.log(`3. Login cevabı: HTTP ${login.response.status}`);
    console.log(JSON.stringify(login.body, null, 2));

    if (!login.response.ok || login.body.status !== 'success') {
      throw new Error('Üye girişi başarısız. Enrollment gönderilmedi.');
    }

    const me = await requestJson('/ajax/member/me', {}, cookie);
    cookie = me.cookie;

    if (!me.body.authenticated) {
      throw new Error('Login başarılı olsa da session üye olarak doğrulanmadı.');
    }

    console.log(`4. Session doğrulandı: üye #${me.body.member.id} (${me.body.member.email})`);
    console.log('5. Yenilenmiş session için CSRF ve enrollment token alınır...');

    const enrollCsrf = await getCsrfToken(cookie);
    cookie = enrollCsrf.cookie;
    const enrollmentProtection = await getFormToken('enrollment', cookie);
    cookie = enrollmentProtection.cookie;

    console.log(`6. Anti-bot minimum süresi için ${MIN_FORM_AGE_MS} ms beklenir...`);
    await delay(MIN_FORM_AGE_MS);

    const enrollment = await requestJson('/ajax/enroll', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: formBody({
        productId,
        name: me.body.member.name || 'Enrollment',
        surname: me.body.member.surname || 'Test',
        email: me.body.member.email,
        phone: me.body.member.phone || '+905550000000',
        identityDocumentType: 'PASSPORT',
        identityDocumentNumber: 'TESTP12345',
        documentCountryCode: 'ZZ',
        birthDate: '1990-01-01',
        country: 'Test Country',
        city: 'Test City',
        district: 'Test District',
        postalCode: '00000',
        addressLine: 'Integration test address 1',
        _csrf: enrollCsrf.token,
        _formToken: enrollmentProtection.token,
        website: ''
      })
    }, cookie);

    console.log(`7. Enrollment cevabı: HTTP ${enrollment.response.status}`);
    console.log(JSON.stringify(enrollment.body, null, 2));

    if (enrollment.response.status === 201) {
      console.log('\nSonuç: kayıt başarıyla oluşturuldu ve /admin/registrations listesinde görünür.');
      return;
    }

    if (enrollment.response.status === 409 && enrollment.body.code === 'ALREADY_ENROLLED') {
      console.log('\nSonuç: bu üye ve kurs için aktif kayıt artıq mevcuttur.');
      return;
    }

    throw new Error('Enrollment beklenen 201/409 cevabını vermedi.');
  } finally {
    prompt.close();
  }
}

main().catch((error) => {
  console.error(`\nTest başarısız: ${error.message}`);
  process.exitCode = 1;
});
