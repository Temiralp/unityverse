require('dotenv').config();

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const bcrypt = require('bcryptjs');

const prisma = require('../src/db');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE_URL = process.env.CSRF_TEST_BASE_URL || 'http://localhost:8000';
const DEBUG_PORT = Number(process.env.CSRF_TEST_DEBUG_PORT || 9345);
const EXPIRE_SESSION = process.env.CSRF_TEST_EXPIRE_SESSION === 'true';
const CREATE_TEST_RECORDS = process.env.CSRF_TEST_CREATE_RECORDS === 'true';

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForJson(url) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    } catch (error) {
      // Chrome may need a moment to expose the debugging endpoint.
    }
    await delay(200);
  }
  throw new Error('Chrome debugging endpoint could not be opened.');
}

class CdpClient {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();

    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const pending = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result);
        return;
      }

      (this.listeners.get(message.method) || []).forEach((listener) => {
        listener(message.params || {});
      });
    });
  }

  send(method, params = {}) {
    const id = this.nextId;
    this.nextId += 1;
    this.socket.send(JSON.stringify({ id, method, params }));

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  on(method, listener) {
    const listeners = this.listeners.get(method) || [];
    listeners.push(listener);
    this.listeners.set(method, listeners);
  }
}

async function evaluate(client, expression) {
  const result = await client.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true
  });

  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  }

  return result.result?.value;
}

async function navigate(client, url) {
  await client.send('Page.navigate', { url });

  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (await evaluate(client, 'document.readyState') === 'complete') return;
    await delay(150);
  }

  throw new Error(`Page load timed out: ${url}`);
}

function csrfFromPostData(postData) {
  if (!postData) return null;

  try {
    return JSON.parse(postData)._csrf || null;
  } catch (error) {
    return new URLSearchParams(postData).get('_csrf');
  }
}

function requestsFor(requests, path) {
  return requests.filter((request) => new URL(request.url).pathname === path && request.method === 'POST');
}

async function main() {
  if (!fs.existsSync(CHROME_PATH)) {
    throw new Error(`Google Chrome not found: ${CHROME_PATH}`);
  }

  const marker = Date.now();
  const signinEmail = CREATE_TEST_RECORDS
    ? `csrf-signin-${marker}@example.com`
    : 'csrf-signin@example.test';
  const registerEmail = CREATE_TEST_RECORDS
    ? `csrf-register-${marker}@example.com`
    : null;
  const signinPassword = 'TestPass123!';
  const existingMember = await prisma.member.findFirst({
    select: { email: true }
  });
  if (CREATE_TEST_RECORDS) {
    await prisma.member.create({
      data: {
        name: 'CSRF',
        surname: 'Signin',
        email: signinEmail,
        phone: '+905550000000',
        passwordHash: await bcrypt.hash(signinPassword, 12)
      }
    });
  }
  const profileDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'unityverse-csrf-test-'));
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    '--disable-gpu',
    '--disable-extensions',
    '--disable-background-networking',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${profileDirectory}`,
    'about:blank'
  ], {
    stdio: ['ignore', 'ignore', 'pipe']
  });

  try {
    const targets = await waitForJson(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
    const pageTarget = targets.find((target) => target.type === 'page');
    const socket = new WebSocket(pageTarget.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true });
      socket.addEventListener('error', reject, { once: true });
    });

    const client = new CdpClient(socket);
    const requests = [];
    const responses = [];
    client.on('Network.requestWillBeSent', ({ request }) => {
      requests.push({
        url: request.url,
        method: request.method,
        postData: request.postData || ''
      });
    });
    client.on('Network.responseReceived', ({ response }) => {
      responses.push({
        url: response.url,
        status: response.status
      });
    });

    await Promise.all([
      client.send('Page.enable'),
      client.send('Runtime.enable'),
      client.send('Network.enable')
    ]);

    await navigate(client, `${BASE_URL}/uye-girisi/`);
    await delay(2800);
    const authForms = await evaluate(client, `(async () => {
      const token = (await fetch('/api/csrf-token')).json().then((result) => result.token);
      const forms = Array.from(document.querySelectorAll('form'));
      return {
        total: forms.length,
        withCsrf: forms.filter((form) => form.querySelector('input[name="_csrf"]')).length,
        dynamicInjected: await new Promise((resolve) => {
          const form = document.createElement('form');
          form.method = 'post';
          document.body.appendChild(form);
          setTimeout(() => {
            resolve(Boolean(form.querySelector('input[name="_csrf"]')));
            form.remove();
          }, 50);
        }),
        sessionToken: await token
      };
    })()`);

    if (EXPIRE_SESSION) {
      const cookies = await client.send('Network.getAllCookies');
      const sessionCookie = cookies.cookies.find((cookie) => cookie.name === 'connect.sid');
      const decoded = decodeURIComponent(sessionCookie.value).replace(/^s:/, '');
      const sid = decoded.slice(0, decoded.lastIndexOf('.'));
      await prisma.userSession.deleteMany({ where: { sid } });
    }

    await evaluate(client, `(() => {
      document.querySelector('.uye-girisi-email').value = ${JSON.stringify(signinEmail)};
      document.querySelector('.uye-girisi-pass').value = ${JSON.stringify(CREATE_TEST_RECORDS ? signinPassword : 'wrong-password')};
      window.signin();
    })()`);
    await delay(500);

    await evaluate(client, `(() => {
      document.getElementById('reg_name').value = 'CSRF';
      document.getElementById('reg_surname').value = 'Test';
      document.getElementById('reg_email').value = ${JSON.stringify(registerEmail || existingMember?.email || 'existing@example.test')};
      document.getElementById('gsm').value = '5550000000';
      document.getElementById('reg_password').value = 'TestPass123!';
      document.getElementById('reg_password_confirm').value = 'TestPass123!';
      document.getElementById('member_security_code').value = 'ABC123';
      document.getElementById('member_contrat').checked = true;
      document.getElementById('kvkk_contrat').checked = true;
      window.register();
    })()`);
    await delay(500);

    await evaluate(client, `(() => {
      document.getElementById('ticket_subject').value = '6';
      document.getElementById('ask_name').value = 'CSRF Bot';
      document.getElementById('ask_email').value = 'csrf-ask@example.com';
      document.getElementById('ask_gsm').value = '05550000000';
      document.getElementById('ask_message').value = 'CSRF distribution test';
      document.getElementById('askus_security_code').value = 'ABC123';
      const trap = document.querySelector('[data-form-trap="lead"] input[name="website"]');
      if (trap) trap.value = ${JSON.stringify(CREATE_TEST_RECORDS ? '' : 'https://bot.example')};
      window.sendask_message();
    })()`);
    await delay(500);

    await navigate(client, `${BASE_URL}/sayfa/iletisim-5/`);
    await delay(2800);
    const contactForms = await evaluate(client, `(() => {
      const forms = Array.from(document.querySelectorAll('form'));
      return {
        total: forms.length,
        withCsrf: forms.filter((form) => form.querySelector('input[name="_csrf"]')).length,
        serverRendered: Boolean(document.querySelector('[data-contact-form] > input[name="_csrf"]'))
      };
    })()`);

    await evaluate(client, `(() => {
      const form = document.querySelector('[data-contact-form]');
      form.elements.name.value = 'CSRF Contact';
      form.elements.email.value = 'csrf-contact@example.test';
      form.elements.phone.value = '05550000000';
      form.elements.konu.value = 'Eğitim Bilgisi';
      form.elements.message.value = 'CSRF distribution test';
      form.elements.kvkk.checked = true;
      form.elements.website.value = ${JSON.stringify(CREATE_TEST_RECORDS ? '' : 'https://bot.example')};
      form.requestSubmit();
    })()`);
    await delay(500);

    await navigate(client, `${BASE_URL}/uye/sepet/`);
    await delay(500);
    const cartSetup = await evaluate(client, `({
      module: Boolean(window.UnityverseFormProtection),
      jquery: Boolean(window.jQuery),
      forms: document.querySelectorAll('form').length,
      formsWithCsrf: document.querySelectorAll('form input[name="_csrf"]').length
    })`);
    await evaluate(client, `void window.jQuery.ajax({
      type: 'POST',
      url: '/ajax/basket/summary',
      contentType: 'application/json; charset=utf-8',
      data: JSON.stringify({ cmd: 'csrf-test' })
    }).fail(function() {});`);
    await delay(500);

    const checks = {
      signin: requestsFor(requests, '/ajax/member/signin'),
      register: requestsFor(requests, '/ajax/member/register'),
      askme: requestsFor(requests, '/ajax/askme'),
      contact: requestsFor(requests, '/ajax/sendCustomForm'),
      basket: requestsFor(requests, '/ajax/basket/summary')
    };

    const results = Object.fromEntries(Object.entries(checks).map(([name, matchingRequests]) => [
      name,
      {
        sent: matchingRequests.length > 0,
        requestCount: matchingRequests.length,
        hasCsrf: matchingRequests.every((request) => Boolean(csrfFromPostData(request.postData))),
        matchesInitialSession: matchingRequests.some((request) => csrfFromPostData(request.postData) === authForms.sessionToken),
        statuses: responses
          .filter((response) => new URL(response.url).pathname === new URL(matchingRequests[0]?.url || BASE_URL).pathname)
          .map((response) => response.status)
      }
    ]));

    console.log(JSON.stringify({
      sessionExpired: EXPIRE_SESSION,
      createTestRecords: CREATE_TEST_RECORDS,
      authForms: {
        total: authForms.total,
        withCsrf: authForms.withCsrf,
        dynamicInjected: authForms.dynamicInjected
      },
      contactForms,
      cartSetup,
      requests: results
    }, null, 2));
  } finally {
    chrome.kill('SIGTERM');
    if (CREATE_TEST_RECORDS) {
      await prisma.lead.deleteMany({
        where: {
          email: {
            in: ['csrf-ask@example.com', 'csrf-contact@example.test']
          }
        }
      });
      await prisma.member.deleteMany({
        where: {
          email: {
            in: [signinEmail, registerEmail].filter(Boolean)
          }
        }
      });
    }
    await prisma.rateLimitEntry.deleteMany();
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exitCode = 1;
});
