const assert = require('assert/strict');
const fs = require('fs');
const http = require('http');
const path = require('path');
const cheerio = require('cheerio');
const express = require('express');
const session = require('express-session');

const createSocialAuthRouter = require('../src/routes/social-auth');
const { FLOW_TTL_MS, consumeFlow, createFlow } = require('../src/services/social-oauth');

function fakePrisma() {
  const members = new Map();
  const identities = new Map();
  let memberId = 0;

  const member = {
    async findUnique({ where }) {
      if (where.email) return [...members.values()].find((item) => item.email === where.email) || null;
      if (where.id) return members.get(where.id) || null;
      return null;
    },
    async create({ data }) {
      const created = { id: ++memberId, status: 'ACTIVE', ...data };
      members.set(created.id, created);
      return created;
    }
  };
  const memberOAuthIdentity = {
    async findUnique({ where }) {
      const key = where.provider_providerSubject;
      const identity = identities.get(`${key.provider}:${key.providerSubject}`) || null;
      return identity ? { ...identity, member: members.get(identity.memberId) } : null;
    },
    async create({ data }) {
      const identity = { id: identities.size + 1, ...data };
      identities.set(`${data.provider}:${data.providerSubject}`, identity);
      return identity;
    }
  };
  const prisma = {
    member,
    memberOAuthIdentity,
    async $transaction(callback) {
      return callback({ member, memberOAuthIdentity });
    }
  };

  return { prisma, members, identities };
}

async function startTestServer({ env, fetchImpl }) {
  const data = fakePrisma();
  const app = express();
  app.use(session({
    secret: 'test-session-secret-that-is-longer-than-sixty-four-characters-123456789',
    resave: false,
    saveUninitialized: false
  }));
  app.use('/auth', createSocialAuthRouter({ prisma: data.prisma, env, fetchImpl }));
  app.get('/session', (req, res) => res.json({ member: req.session.member || null }));

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();

  return {
    ...data,
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  };
}

function cookieFrom(response, fallback = '') {
  const value = response.headers.get('set-cookie');
  return value ? value.split(';')[0] : fallback;
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function htmlFiles(directory, results = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) htmlFiles(entryPath, results);
    else if (entry.isFile() && entry.name.endsWith('.html')) results.push(entryPath);
  }
  return results;
}

async function googleFlowTest() {
  const providerRequests = [];
  const fetchImpl = async (url, options) => {
    providerRequests.push({ url: String(url), options });
    if (String(url).includes('/token')) return jsonResponse({ access_token: 'google-access-token' });
    return jsonResponse({
      sub: 'google-user-1',
      email: 'verified@example.com',
      email_verified: true,
      given_name: 'Ada',
      family_name: 'Lovelace'
    });
  };
  const server = await startTestServer({
    env: {
      GOOGLE_CLIENT_ID: 'google-client-id',
      GOOGLE_CLIENT_SECRET: 'google-client-secret'
    },
    fetchImpl
  });

  try {
    const start = await fetch(`${server.baseUrl}/auth/google?returnTo=%2Fuye%2F`, {
      redirect: 'manual'
    });
    assert.equal(start.status, 302);
    const cookie = cookieFrom(start);
    const authorization = new URL(start.headers.get('location'));
    assert.equal(authorization.origin, 'https://accounts.google.com');
    assert.equal(authorization.searchParams.get('scope'), 'openid email profile');
    assert.equal(authorization.searchParams.get('code_challenge_method'), 'S256');
    assert.ok(authorization.searchParams.get('code_challenge'));

    const callback = new URL(`${server.baseUrl}/auth/google/callback`);
    callback.searchParams.set('code', 'google-code');
    callback.searchParams.set('state', authorization.searchParams.get('state'));
    const completed = await fetch(callback, {
      headers: { Cookie: cookie },
      redirect: 'manual'
    });
    assert.equal(completed.status, 303);
    assert.equal(completed.headers.get('location'), '/uye/');
    assert.equal(providerRequests.length, 2);
    assert.match(String(providerRequests[0].options.body), /code_verifier=/);
    assert.equal(providerRequests[1].options.headers.Authorization, 'Bearer google-access-token');

    const authenticatedCookie = cookieFrom(completed, cookie);
    const currentSession = await fetch(`${server.baseUrl}/session`, {
      headers: { Cookie: authenticatedCookie }
    });
    const sessionPayload = await currentSession.json();
    assert.equal(sessionPayload.member.email, 'verified@example.com');
    assert.equal(server.members.size, 1);
    assert.equal(server.identities.size, 1);
  } finally {
    await server.close();
  }
}

async function unsupportedProviderTest() {
  const server = await startTestServer({ env: {}, fetchImpl: async () => jsonResponse({}) });
  try {
    const start = await fetch(`${server.baseUrl}/auth/facebook?returnTo=%2F`, { redirect: 'manual' });
    assert.equal(start.status, 404);

    const callback = await fetch(`${server.baseUrl}/auth/facebook/callback?code=x&state=y`, {
      redirect: 'manual'
    });
    assert.equal(callback.status, 404);
  } finally {
    await server.close();
  }
}

async function guardTests() {
  const server = await startTestServer({ env: {}, fetchImpl: async () => jsonResponse({}) });
  try {
    const missingConfig = await fetch(`${server.baseUrl}/auth/google`, { redirect: 'manual' });
    assert.equal(missingConfig.status, 303);
    assert.match(missingConfig.headers.get('location'), /provider_not_configured/);

    const invalidState = await fetch(`${server.baseUrl}/auth/google/callback?code=x&state=bad`, {
      redirect: 'manual'
    });
    assert.equal(invalidState.status, 303);
    assert.match(invalidState.headers.get('location'), /invalid_state/);
  } finally {
    await server.close();
  }

  const sessionData = { oauthFlow: createFlow('google', '//evil.example/path') };
  const state = sessionData.oauthFlow.state;
  const expired = consumeFlow(sessionData, 'google', state, Date.now() + FLOW_TTL_MS + 1);
  assert.equal(expired, null);
  assert.equal(sessionData.oauthFlow, undefined);
}

function frontendWiringTest() {
  const root = path.resolve(__dirname, '..');
  const scriptsSource = fs.readFileSync(path.join(root, 'public/tema10/js/scripts.js'), 'utf8');
  const cssSource = fs.readFileSync(path.join(root, 'public/tema10/css/home2.css'), 'utf8');
  const oauthSource = fs.readFileSync(path.join(root, 'src/services/social-oauth.js'), 'utf8');
  const routerSource = fs.readFileSync(path.join(root, 'src/routes/social-auth.js'), 'utf8');
  const loginPage = fs.readFileSync(path.join(root, 'uye-girisi/index.html'), 'utf8');
  const registerPage = fs.readFileSync(path.join(root, 'uye-ol/index.html'), 'utf8');
  const loginDocument = cheerio.load(loginPage);
  const registerGoogleAction = loginDocument('#tabs2 [onclick*="loginwithgoogle"]').attr('onclick');
  const returnPathFunctionSource = scriptsSource.match(
    /function socialLoginReturnPath\(p\)\s*\{[\s\S]*?\n  \}/
  );

  assert.ok(returnPathFunctionSource, 'socialLoginReturnPath function is missing');
  const socialLoginReturnPath = (href, params) => Function(
    'window',
    'URL',
    'URLSearchParams',
    `return (${returnPathFunctionSource[0]});`
  )({ location: new URL(href) }, URL, URLSearchParams)(params);

  assert.doesNotMatch(scriptsSource, /e-eticaret\.net\/social\/(google|facebook)/);
  assert.doesNotMatch(scriptsSource, /loginwithfacebook/);
  assert.doesNotMatch(oauthSource, /facebookProfile|FACEBOOK_APP_/);
  assert.doesNotMatch(routerSource, /facebookProfile|['"]facebook['"]/);
  assert.match(cssSource, /social-login\[onclick\*="loginwithgoogle"\]/);
  assert.match(scriptsSource, /'\/auth\/' \+ provider/);
  assert.match(loginPage, /loginwithgoogle/);
  assert.doesNotMatch(loginPage, /loginwithfacebook|pbl-social-facebook/);
  assert.match(registerGoogleAction, /[?&]r=\.\.\/uye-girisi/);
  assert.equal(socialLoginReturnPath(
    'http://localhost:8000/uye-girisi/?tab=register',
    'r=../uye-girisi'
  ), '/uye/');
  assert.equal(socialLoginReturnPath(
    'http://localhost:8000/uye-girisi/',
    'r=../uye-girisi'
  ), '/uye-girisi');
  assert.equal(socialLoginReturnPath(
    'http://localhost:8000/urun/test-course/',
    'r=../../urun/test-course'
  ), '/urun/test-course');
  assert.match(registerPage, /loginwithgoogle/);
  assert.doesNotMatch(registerPage, /loginwithfacebook|pbl-social-facebook/);

  for (const filePath of htmlFiles(root)) {
    const html = fs.readFileSync(filePath, 'utf8');
    assert.doesNotMatch(html, /loginwithfacebook|pbl-social-facebook/, filePath);
    if (html.includes('home2.css?v=')) assert.match(html, /home2\.css\?v=5\.4\.105/, filePath);
    if (html.includes('scripts.js?v=')) assert.match(html, /scripts\.js\?v=5\.4\.116/, filePath);
  }
}

async function run() {
  await googleFlowTest();
  await unsupportedProviderTest();
  await guardTests();
  frontendWiringTest();
  console.log('Social OAuth tests passed.');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
