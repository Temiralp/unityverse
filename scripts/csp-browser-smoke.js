require('dotenv').config();

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE_URL = process.env.CSP_TEST_BASE_URL || 'http://localhost:8010';
const DEBUG_PORT = Number(process.env.CSP_TEST_DEBUG_PORT || 9333);
const WAIT_AFTER_LOAD_MS = 4500;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForJson(url, attempts = 50) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    } catch (error) {
      // Chrome may need a moment to expose the debugging endpoint.
    }
    await delay(200);
  }
  throw new Error(`Chrome debugging endpoint açılamadı: ${url}`);
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

      const listeners = this.listeners.get(message.method) || [];
      listeners.forEach((listener) => listener(message.params || {}));
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

async function waitForPageReady(client) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const result = await client.send('Runtime.evaluate', {
      expression: 'document.readyState',
      returnByValue: true
    });
    if (result.result && result.result.value === 'complete') return;
    await delay(200);
  }
  throw new Error('Sayfa yükleme zaman aşımına uğradı.');
}

async function evaluate(client, expression) {
  const result = await client.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true
  });

  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || 'Browser expression failed');
  }

  return result.result ? result.result.value : undefined;
}

async function createAdminCookie() {
  const loginResponse = await fetch(`${BASE_URL}/admin/login`, { redirect: 'manual' });
  const initialCookie = loginResponse.headers.get('set-cookie');
  const loginHtml = await loginResponse.text();
  const csrfMatch = loginHtml.match(/name="_csrf" value="([^"]+)"/);

  if (!initialCookie || !csrfMatch) {
    throw new Error('Admin login session veya CSRF token alınamadı.');
  }

  const cookie = initialCookie.split(';')[0];
  const response = await fetch(`${BASE_URL}/admin/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      cookie
    },
    body: new URLSearchParams({
      _csrf: csrfMatch[1],
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD
    }),
    redirect: 'manual'
  });

  if (response.status !== 302) {
    throw new Error(`Admin login başarısız: HTTP ${response.status}`);
  }

  const authenticatedCookie = (response.headers.get('set-cookie') || cookie).split(';')[0];
  const separator = authenticatedCookie.indexOf('=');
  return {
    name: authenticatedCookie.slice(0, separator),
    value: authenticatedCookie.slice(separator + 1)
  };
}

async function main() {
  if (!fs.existsSync(CHROME_PATH)) {
    throw new Error(`Google Chrome bulunamadı: ${CHROME_PATH}`);
  }

  const profileDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'unityverse-csp-'));
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
  let chromeErrors = '';
  chrome.stderr.on('data', (chunk) => {
    chromeErrors += chunk.toString();
  });

  try {
    const targets = await waitForJson(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
    const pageTarget = targets.find((target) => target.type === 'page');
    if (!pageTarget) throw new Error('Chrome page target bulunamadı.');

    const socket = new WebSocket(pageTarget.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true });
      socket.addEventListener('error', reject, { once: true });
    });

    const client = new CdpClient(socket);
    const state = {
      console: [],
      failed: [],
      issues: [],
      requests: [],
      responses: []
    };

    client.on('Log.entryAdded', ({ entry }) => {
      state.console.push({
        level: entry.level,
        text: entry.text,
        url: entry.url || ''
      });
    });
    client.on('Runtime.exceptionThrown', ({ exceptionDetails }) => {
      state.console.push({
        level: 'error',
        text: exceptionDetails.text || 'Uncaught exception',
        url: exceptionDetails.url || ''
      });
    });
    client.on('Network.loadingFailed', (event) => {
      state.failed.push({
        url: event.url || '',
        errorText: event.errorText || '',
        blockedReason: event.blockedReason || ''
      });
    });
    client.on('Network.requestWillBeSent', ({ request }) => {
      state.requests.push(request.url);
    });
    client.on('Network.responseReceived', ({ response }) => {
      state.responses.push({
        url: response.url,
        status: response.status
      });
    });
    client.on('Audits.issueAdded', ({ issue }) => {
      if (issue && issue.code === 'ContentSecurityPolicyIssue') {
        state.issues.push(issue);
      }
    });

    await Promise.all([
      client.send('Page.enable'),
      client.send('Runtime.enable'),
      client.send('Log.enable'),
      client.send('Network.enable'),
      client.send('Audits.enable').catch(() => null)
    ]);

    const adminCookie = await createAdminCookie();
    await client.send('Network.setCookie', {
      name: adminCookie.name,
      value: adminCookie.value,
      url: BASE_URL,
      httpOnly: true,
      sameSite: 'Lax'
    });

    const paths = JSON.parse(process.env.CSP_TEST_PATHS_JSON || '{}');
    const pages = [
      {
        name: 'Ana Sayfa',
        path: '/',
        check: `({
          jquery: typeof window.jQuery === 'function',
          askme: typeof window.sendask_message === 'function',
          dataLayer: Array.isArray(window.dataLayer),
          fbq: typeof window.fbq === 'function',
          tawk: typeof window.Tawk_API === 'object',
          inlineHandlers: document.querySelectorAll('[onclick],[onsubmit]').length
        })`
      },
      {
        name: 'Blog',
        path: '/blog/',
        check: `({ cards: document.querySelectorAll('.uv-blog-card').length })`
      },
      {
        name: 'Blog Detay',
        path: paths.blog,
        check: `({
          content: Boolean(document.querySelector('.uv-blog-content')),
          styledContent: document.querySelectorAll('.uv-blog-content [style]').length,
          contentScripts: document.querySelectorAll('.uv-blog-content script').length
        })`
      },
      {
        name: 'İletişim',
        path: '/sayfa/iletisim-5/',
        check: `(async () => {
          const form = document.querySelector('[data-contact-form]');
          form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
          await new Promise(resolve => setTimeout(resolve, 100));
          return {
            csrf: Boolean(form.querySelector('[name="_csrf"]')),
            honeypot: Boolean(form.querySelector('[name="website"]')),
            validationMessage: document.querySelector('[data-form-status]').textContent.trim()
          };
        })()`
      },
      {
        name: 'Tüm Ürünler',
        path: '/tum-urunler/',
        check: `({
          nonce: Boolean(document.querySelector('[data-courses-json][nonce]')),
          cards: document.querySelectorAll('[data-course-card]').length
        })`
      },
      {
        name: 'Kurs Detay',
        path: paths.product,
        check: `({
          title: Boolean(document.querySelector('h1')),
          relatedNonce: !document.querySelector('[data-related-json]') || Boolean(document.querySelector('[data-related-json][nonce]'))
        })`
      },
      {
        name: 'Üye Girişi',
        path: '/uye-girisi/',
        check: `({
          signin: typeof window.signin === 'function',
          register: typeof window.register === 'function',
          inlineSubmitCompiled: typeof document.querySelector('form[onsubmit*="signin"]')?.onsubmit === 'function',
          inlineClickCompiled: typeof document.querySelector('[onclick]')?.onclick === 'function',
          inlineHandlers: document.querySelectorAll('[onclick],[onsubmit]').length
        })`
      },
      {
        name: 'Üye Ol',
        path: '/uye-ol/',
        check: `({
          signin: typeof window.signin === 'function',
          register: typeof window.register === 'function',
          registerPanel: Boolean(document.querySelector('#tabs2.active')),
          inlineSubmitCompiled: typeof document.querySelector('form[onsubmit]')?.onsubmit === 'function',
          inlineClickCompiled: typeof document.querySelector('[onclick]')?.onclick === 'function',
          inlineHandlers: document.querySelectorAll('[onclick],[onsubmit]').length
        })`
      },
      {
        name: 'Legacy Askme',
        path: '/sayfa/sss-3/',
        check: `({
          askme: typeof window.sendask_message === 'function',
          inlineClickCompiled: typeof document.querySelector('[onclick]')?.onclick === 'function',
          inlineSubmitCompiled: typeof document.querySelector('form[onsubmit]')?.onsubmit === 'function',
          inlineHandlers: document.querySelectorAll('[onclick],[onsubmit]').length
        })`
      },
      {
        name: 'Eğitmenler',
        path: '/sayfa/egitmenler-10/',
        check: `(() => {
          const trigger = document.querySelector('[data-instructor-index]');
          if (trigger) trigger.click();
          const modal = document.querySelector('[data-instructor-modal]');
          return {
            nonce: Boolean(document.querySelector('[data-instructors-json][nonce]')),
            modalOpened: Boolean(modal && !modal.hidden),
            modalContent: Boolean(document.querySelector('[data-modal-content] h2'))
          };
        })()`
      },
      {
        name: 'Admin Login',
        path: '/admin/login',
        check: `({ form: Boolean(document.querySelector('form[action="/admin/login"]')) })`
      },
      {
        name: 'Admin Dashboard',
        path: '/admin',
        check: `({
          dashboard: Boolean(document.querySelector('.metric-grid')),
          chartBars: document.querySelectorAll('.bar-track span[style]').length
        })`
      },
      {
        name: 'Admin Products',
        path: '/admin/products',
        check: `({
          table: Boolean(document.querySelector('table')),
          deleteHandlers: document.querySelectorAll('form[onsubmit*="confirm"]').length
        })`
      },
      {
        name: 'Admin Blog',
        path: '/admin/blog',
        check: `({
          table: Boolean(document.querySelector('table')),
          deleteHandlers: document.querySelectorAll('form[onsubmit*="confirm"]').length
        })`
      },
      {
        name: 'Admin Blog Form',
        path: '/admin/blog/new',
        check: `({
          jodit: typeof window.Jodit === 'function',
          editor: Boolean(document.querySelector('.jodit-container')),
          csrf: Boolean(document.querySelector('input[name="_csrf"]'))
        })`
      }
    ];

    const results = [];
    for (const page of pages) {
      if (!page.path) continue;
      state.console.length = 0;
      state.failed.length = 0;
      state.issues.length = 0;
      state.requests.length = 0;
      state.responses.length = 0;

      await client.send('Page.navigate', { url: `${BASE_URL}${page.path}` });
      await waitForPageReady(client);
      await delay(WAIT_AFTER_LOAD_MS);

      const check = await evaluate(client, page.check);
      const url = await evaluate(client, 'location.href');
      const cspErrors = state.console.filter((entry) => /content security policy|refused to|violates the following/i.test(entry.text));
      const cspFailures = state.failed.filter((entry) => entry.blockedReason === 'csp');
      const thirdParty = state.responses.filter((entry) => {
        return /googletagmanager\.com|connect\.facebook\.net|tawk\.to|doubleclick\.net|analytics\.google\.com|www\.google\.com|restcountries\.com/.test(entry.url);
      });

      results.push({
        name: page.name,
        requestedPath: page.path,
        finalUrl: url,
        check,
        cspErrors,
        cspFailures,
        cspIssueCount: state.issues.length,
        thirdParty
      });
    }

    const summary = results.map((result) => {
      const blockedHosts = Array.from(new Set(result.cspErrors.map((entry) => {
        const match = entry.text.match(/https?:\/\/([^/'"]+)/);
        if (match) return match[1];
        if (/blocked-uri[:=]?\s*['"]?eval/i.test(entry.text) || /script-src[^.]*eval/i.test(entry.text)) return 'eval';
        return 'inline-or-other';
      })));
      const thirdParty = result.thirdParty.map((entry) => {
        let host = entry.url;
        try {
          host = new URL(entry.url).hostname;
        } catch (error) {
          // Keep the original URL when parsing fails.
        }
        return `${host}:${entry.status}`;
      });

      return {
        name: result.name,
        requestedPath: result.requestedPath,
        finalUrl: result.finalUrl,
        check: result.check,
        cspErrorCount: result.cspErrors.length,
        cspFailureCount: result.cspFailures.length,
        cspIssueCount: result.cspIssueCount,
        blockedHosts,
        thirdParty
      };
    });

    console.log(JSON.stringify({
      summary,
      chromeErrors: chromeErrors.split('\n').filter((line) => /ERROR|WARNING/.test(line)).slice(0, 10)
    }, null, 2));
    socket.close();
  } finally {
    chrome.kill('SIGTERM');
    await delay(300);
    fs.rmSync(profileDirectory, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
