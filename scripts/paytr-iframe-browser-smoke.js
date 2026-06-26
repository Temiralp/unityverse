require('dotenv').config();

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const signature = require('cookie-signature');

const prisma = require('../src/db');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE_URL = process.env.PAYTR_BROWSER_BASE_URL || 'http://localhost:8000';
const DEBUG_PORT = Number(process.env.PAYTR_BROWSER_DEBUG_PORT || 9348);

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

async function activePaymentSession() {
  const sessions = await prisma.userSession.findMany({
    where: { expire: { gt: new Date() } },
    orderBy: { expire: 'desc' }
  });
  const session = sessions.find((row) => row.sess?.member);

  if (!session) {
    throw new Error('Aktif member session bulunamadı.');
  }

  const registration = await prisma.educationRegistration.findFirst({
    where: {
      memberId: Number(session.sess.member.id),
      paymentStatus: 'PENDING',
      status: { not: 'CANCELLED' }
    },
    orderBy: { id: 'desc' },
    select: { id: true }
  });

  if (!registration) {
    throw new Error('Ödeme bekleyen registration bulunamadı.');
  }

  return {
    registrationId: registration.id,
    signedSessionId: `s:${signature.sign(session.sid, process.env.SESSION_SECRET)}`
  };
}

async function main() {
  if (!fs.existsSync(CHROME_PATH)) {
    throw new Error(`Google Chrome not found: ${CHROME_PATH}`);
  }

  const paymentSession = await activePaymentSession();
  const profileDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'unityverse-paytr-browser-'));
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
    const consoleErrors = [];
    const loadingFailures = [];
    const responses = [];

    client.on('Runtime.consoleAPICalled', ({ type, args }) => {
      if (type !== 'error' && type !== 'warning') return;
      consoleErrors.push(args.map((item) => item.value || item.description || '').join(' '));
    });
    client.on('Network.loadingFailed', ({ errorText, blockedReason }) => {
      loadingFailures.push({ errorText, blockedReason: blockedReason || null });
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
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false
    });

    const hostname = new URL(BASE_URL).hostname;
    await client.send('Network.setCookie', {
      name: 'connect.sid',
      value: paymentSession.signedSessionId,
      domain: hostname,
      path: '/',
      httpOnly: true,
      sameSite: 'Lax'
    });
    await client.send('Page.navigate', {
      url: `${BASE_URL}/odeme/${paymentSession.registrationId}`
    });

    for (let attempt = 0; attempt < 100; attempt += 1) {
      const ready = await evaluate(client, 'document.readyState === "complete"');
      const iframe = await evaluate(client, 'Boolean(document.getElementById("paytriframe"))');
      if (ready && iframe) break;
      await delay(150);
    }

    await delay(2500);
    const page = await evaluate(client, `(() => {
      const iframe = document.getElementById('paytriframe');
      return {
        title: document.title,
        heading: document.querySelector('h1')?.textContent.trim(),
        iframeSrc: iframe?.src || null,
        iframeHeight: iframe ? iframe.getBoundingClientRect().height : 0,
        iframeVisible: iframe ? Boolean(iframe.offsetWidth && iframe.offsetHeight) : false
      };
    })()`);
    const paytrFrameResponse = responses.find((response) => {
      return response.url.startsWith('https://www.paytr.com/odeme/guvenli/');
    });
    const screenshot = await client.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('/tmp/unityverse-paytr-iframe.png', Buffer.from(screenshot.data, 'base64'));

    console.log(JSON.stringify({
      registrationId: paymentSession.registrationId,
      page,
      paytrFrameResponse: paytrFrameResponse || null,
      cspErrors: consoleErrors.filter((message) => message.includes('Content Security Policy')),
      loadingFailures
    }, null, 2));
  } finally {
    chrome.kill('SIGTERM');
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exitCode = 1;
});
