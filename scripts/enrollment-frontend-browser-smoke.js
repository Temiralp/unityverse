require('dotenv').config();

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE_URL = process.env.ENROLL_BROWSER_BASE_URL || 'http://localhost:8000';
const DEBUG_PORT = Number(process.env.ENROLL_BROWSER_DEBUG_PORT || 9347);
const PRODUCT_PATH = process.env.ENROLL_BROWSER_PRODUCT_PATH || '/urun/testkurs/';

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

function responseBody(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64');
}

async function main() {
  if (!fs.existsSync(CHROME_PATH)) {
    throw new Error(`Google Chrome not found: ${CHROME_PATH}`);
  }

  const profileDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'unityverse-enrollment-browser-'));
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
    await Promise.all([
      client.send('Page.enable'),
      client.send('Runtime.enable'),
      client.send('Network.enable')
    ]);
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false
    });

    await navigate(client, `${BASE_URL}${PRODUCT_PATH}`);
    const initial = await evaluate(client, `(() => ({
      triggers: document.querySelectorAll('[data-enroll-trigger]').length,
      modal: Boolean(document.querySelector('[data-enrollment-modal]')),
      modalHidden: document.querySelector('[data-enrollment-modal]').hidden
    }))()`);

    await evaluate(client, `document.querySelector('[data-enroll-trigger]').click()`);
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const pathname = await evaluate(client, 'location.pathname');
      if (pathname === '/uye-girisi/') break;
      await delay(100);
    }

    const unauthenticated = await evaluate(client, `({
      pathname: location.pathname,
      redirect: new URLSearchParams(location.search).get('redirect')
    })`);
    await delay(2800);
    const loginProtection = await evaluate(client, `(async () => {
      const data = await window.UnityverseFormProtection.addProtection({}, 'member');
      return {
        module: Boolean(window.UnityverseFormProtection),
        redirect: data.redirect,
        csrf: Boolean(data._csrf),
        formToken: Boolean(data._formToken)
      };
    })()`);

    await client.send('Fetch.enable', {
      patterns: [
        { urlPattern: `${BASE_URL}/ajax/member/me` },
        { urlPattern: `${BASE_URL}/api/csrf-token` },
        { urlPattern: `${BASE_URL}/api/form-protection-token*` },
        { urlPattern: `${BASE_URL}/ajax/enroll` }
      ]
    });

    client.on('Fetch.requestPaused', async ({ requestId, request }) => {
      const url = new URL(request.url);
      let status = 200;
      let body;

      if (url.pathname === '/ajax/member/me') {
        body = {
          status: 'success',
          authenticated: true,
          member: {
            id: 8,
            name: 'Frontend',
            surname: 'Test',
            email: 'frontend-test@example.com',
            phone: '+905550000000'
          }
        };
      } else if (url.pathname === '/api/csrf-token') {
        body = { status: 'success', token: 'browser-csrf-token' };
      } else if (url.pathname === '/api/form-protection-token') {
        body = { status: 'success', token: 'browser-form-token' };
      } else if (url.pathname === '/ajax/enroll') {
        status = 201;
        body = {
          status: 'success',
          message: 'Eğitim kaydınız başarıyla oluşturuldu.',
          registration: { id: 999, status: 'NEW', paymentStatus: 'PENDING' }
        };
      }

      await client.send('Fetch.fulfillRequest', {
        requestId,
        responseCode: status,
        responseHeaders: [{ name: 'Content-Type', value: 'application/json' }],
        body: responseBody(body)
      });
    });

    await navigate(client, `${BASE_URL}${PRODUCT_PATH}`);
    await evaluate(client, `document.querySelector('[data-enroll-trigger]').click()`);

    for (let attempt = 0; attempt < 40; attempt += 1) {
      const visible = await evaluate(client, '!document.querySelector("[data-enrollment-modal]").hidden');
      if (visible) break;
      await delay(100);
    }

    await delay(2800);
    const modalReady = await evaluate(client, `(() => {
      const modal = document.querySelector('[data-enrollment-modal]');
      const submit = modal.querySelector('[data-enrollment-submit]');
      return {
        visible: !modal.hidden,
        role: modal.querySelector('[role="dialog"]').getAttribute('role'),
        ariaModal: modal.querySelector('[role="dialog"]').getAttribute('aria-modal'),
        activeLabel: document.activeElement.getAttribute('aria-label'),
        name: modal.querySelector('[data-enrollment-member-name]').value,
        email: modal.querySelector('[data-enrollment-member-email]').value,
        phone: modal.querySelector('[data-enrollment-member-phone]').value,
        submitEnabled: !submit.disabled,
        submitLabel: modal.querySelector('[data-enrollment-submit-label]').textContent.trim()
      };
    })()`);

    const desktopScreenshot = await client.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('/tmp/unityverse-enrollment-desktop.png', Buffer.from(desktopScreenshot.data, 'base64'));

    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true
    });
    const mobileScreenshot = await client.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('/tmp/unityverse-enrollment-mobile.png', Buffer.from(mobileScreenshot.data, 'base64'));

    await evaluate(client, `document.querySelector('[data-enrollment-submit]').click()`);
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const status = await evaluate(client, 'document.querySelector("[data-enrollment-status]").textContent.trim()');
      if (status.includes('Kaydınız alındı')) break;
      await delay(100);
    }

    const success = await evaluate(client, `(() => ({
      status: document.querySelector('[data-enrollment-status]').textContent.trim(),
      submitLabel: document.querySelector('[data-enrollment-submit-label]').textContent.trim(),
      submitDisabled: document.querySelector('[data-enrollment-submit]').disabled
    }))()`);

    console.log(JSON.stringify({
      initial,
      unauthenticated,
      loginProtection,
      modalReady,
      success
    }, null, 2));
  } finally {
    chrome.kill('SIGTERM');
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
