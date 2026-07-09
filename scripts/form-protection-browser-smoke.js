require('dotenv').config();

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE_URL = process.env.FORM_TEST_BASE_URL || 'http://localhost:8000';
const DEBUG_PORT = Number(process.env.FORM_TEST_DEBUG_PORT || 9344);

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

    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (!message.id || !this.pending.has(message.id)) return;

      const pending = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
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

async function main() {
  if (!fs.existsSync(CHROME_PATH)) {
    throw new Error(`Google Chrome not found: ${CHROME_PATH}`);
  }

  const marker = Date.now();
  const testEmail = `b2-browser-${marker}@example.test`;
  const botEmail = `b2-browser-bot-${marker}@example.test`;
  const profileDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'unityverse-form-test-'));
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

    await navigate(client, `${BASE_URL}/sayfa/iletisim-5/`);
    await delay(2800);
    const contactSetup = await evaluate(client, `(async () => {
      const trap = document.querySelector('[data-form-trap="lead"]');
      const input = trap && trap.querySelector('input[name="website"]');
      const protectedData = await window.UnityverseFormProtection.addProtection(new FormData(), 'lead');
      const token = protectedData.get('_formToken');
      const encodedPayload = token.split('.')[0].replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(atob(encodedPayload));
      return {
        module: Boolean(window.UnityverseFormProtection),
        trap: Boolean(trap),
        left: trap ? getComputedStyle(trap).left : null,
        ariaHidden: trap ? trap.getAttribute('aria-hidden') : null,
        tabIndex: input ? input.tabIndex : null,
        autocomplete: input ? input.autocomplete : null,
        visible: trap ? Boolean(trap.offsetWidth || trap.offsetHeight || trap.getClientRects().length) : null,
        tokenAgeMs: Date.now() - payload.issuedAt,
        website: protectedData.get('website')
      };
    })()`);

    const contactSubmit = await evaluate(client, `(async () => {
      const form = document.querySelector('[data-contact-form]');
      form.elements.name.value = 'B2 Browser Test';
      form.elements.email.value = '${testEmail}';
      form.elements.phone.value = '05550000000';
      form.elements.konu.value = 'Eğitim Bilgisi';
      form.elements.message.value = 'B2 normal browser flow';
      form.elements.kvkk.checked = true;
      form.requestSubmit();

      for (let attempt = 0; attempt < 60; attempt += 1) {
        const status = document.querySelector('[data-form-status]').textContent.trim();
        if (status) return status;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      return '';
    })()`);

    const honeypotSubmit = await evaluate(client, `(async () => {
      const form = document.querySelector('[data-contact-form]');
      form.elements.name.value = 'B2 Browser Bot';
      form.elements.email.value = '${botEmail}';
      form.elements.phone.value = '05550000000';
      form.elements.konu.value = 'Eğitim Bilgisi';
      form.elements.message.value = 'B2 honeypot browser flow';
      form.elements.kvkk.checked = true;
      form.elements.website.value = 'https://bot.example';
      form.requestSubmit();

      for (let attempt = 0; attempt < 60; attempt += 1) {
        const status = document.querySelector('[data-form-status]').textContent.trim();
        if (status) return status;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      return '';
    })()`);

    await navigate(client, `${BASE_URL}/uye-girisi/`);
    await delay(1000);
    const memberSetup = await evaluate(client, `(() => {
      const traps = document.querySelectorAll('[data-form-trap="member"]');
      return {
        module: Boolean(window.UnityverseFormProtection),
        traps: traps.length,
        allHidden: Array.from(traps).every((trap) => getComputedStyle(trap).left === '-9999px'),
        scriptVersion: Array.from(document.scripts)
          .map((script) => script.src)
          .find((src) => src.includes('scripts.js')) || ''
      };
    })()`);

    await navigate(client, `${BASE_URL}/form/hemen-bilgi-al-1/`);
    await delay(500);
    const legacyLeadSetup = await evaluate(client, `(() => {
      const trap = document.querySelector('[data-form-trap="lead"]');
      return {
        module: Boolean(window.UnityverseFormProtection),
        trap: Boolean(trap),
        left: trap ? getComputedStyle(trap).left : null
      };
    })()`);

    console.log(JSON.stringify({
      testEmail,
      botEmail,
      contactSetup,
      contactSubmit,
      honeypotSubmit,
      memberSetup,
      legacyLeadSetup
    }, null, 2));
  } finally {
    chrome.kill('SIGTERM');
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
