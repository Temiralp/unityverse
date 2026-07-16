const crypto = require('crypto');

const FLOW_TTL_MS = 10 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 10 * 1000;
const PROVIDERS = Object.freeze({
  google: 'GOOGLE'
});

class OAuthRequestError extends Error {
  constructor(message, status = null) {
    super(message);
    this.name = 'OAuthRequestError';
    this.status = status;
  }
}

function asText(value) {
  return String(value || '').trim();
}

function normalizeReturnTo(value) {
  const returnTo = asText(value);

  if (!returnTo.startsWith('/') || returnTo.startsWith('//') || returnTo.includes('\\')) {
    return '/';
  }

  return returnTo;
}

function normalizeBaseUrl(value) {
  const raw = asText(value).replace(/\/+$/, '');
  if (!raw) return null;

  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('OAUTH_BASE_URL geçerli bir URL olmalıdır.');
  }

  const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (url.protocol !== 'https:' && !(isLocalhost && url.protocol === 'http:')) {
    throw new Error('OAUTH_BASE_URL HTTPS kullanmalıdır; yalnızca localhost için HTTP kabul edilir.');
  }

  if (url.username || url.password || url.search || url.hash) {
    throw new Error('OAUTH_BASE_URL kullanıcı bilgisi, query veya fragment içermemelidir.');
  }

  return url.origin + url.pathname.replace(/\/+$/, '');
}

function requestBaseUrl(req, env = process.env) {
  const configured = normalizeBaseUrl(env.OAUTH_BASE_URL);
  if (configured) return configured;

  if (asText(env.NODE_ENV).toLowerCase() === 'production') {
    throw new Error('Production ortamında OAUTH_BASE_URL tanımlı olmalıdır.');
  }

  return normalizeBaseUrl(`${req.protocol}://${req.get('host')}`);
}

function providerConfig(provider, env = process.env) {
  if (provider === 'google') {
    const clientId = asText(env.GOOGLE_CLIENT_ID);
    const clientSecret = asText(env.GOOGLE_CLIENT_SECRET);
    if (!clientId || !clientSecret) return null;

    return {
      provider: PROVIDERS.google,
      clientId,
      clientSecret,
      authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      userInfoUrl: 'https://openidconnect.googleapis.com/v1/userinfo'
    };
  }

  return null;
}

function callbackUrl(req, provider, env = process.env) {
  return `${requestBaseUrl(req, env)}/auth/${provider}/callback`;
}

function base64Url(buffer) {
  return buffer.toString('base64url');
}

function createFlow(provider, returnTo = '/') {
  const state = base64Url(crypto.randomBytes(32));
  const flow = {
    provider,
    state,
    returnTo: normalizeReturnTo(returnTo),
    createdAt: Date.now()
  };

  if (provider === 'google') {
    flow.codeVerifier = base64Url(crypto.randomBytes(48));
  }

  return flow;
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(asText(left));
  const rightBuffer = Buffer.from(asText(right));
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function consumeFlow(session, provider, receivedState, now = Date.now()) {
  const flow = session && session.oauthFlow;
  if (session) delete session.oauthFlow;

  if (!flow || flow.provider !== provider || !safeEqual(flow.state, receivedState)) {
    return null;
  }

  if (!Number.isFinite(flow.createdAt) || now - flow.createdAt > FLOW_TTL_MS || now < flow.createdAt) {
    return null;
  }

  return {
    ...flow,
    returnTo: normalizeReturnTo(flow.returnTo)
  };
}

function authorizationUrl(provider, config, redirectUri, flow) {
  const url = new URL(config.authorizationUrl);
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', flow.state);

  if (provider === 'google') {
    url.searchParams.set('scope', 'openid email profile');
    url.searchParams.set('prompt', 'select_account');
    url.searchParams.set('code_challenge_method', 'S256');
    url.searchParams.set(
      'code_challenge',
      base64Url(crypto.createHash('sha256').update(flow.codeVerifier).digest())
    );
  }

  return url.toString();
}

async function fetchJson(url, options = {}, fetchImpl = global.fetch) {
  if (typeof fetchImpl !== 'function') {
    throw new OAuthRequestError('Fetch API kullanılamıyor.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetchImpl(url, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(options.headers || {})
      }
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok || !payload || payload.error) {
      throw new OAuthRequestError('OAuth sağlayıcısı isteği reddetti.', response.status);
    }

    return payload;
  } catch (error) {
    if (error instanceof OAuthRequestError) throw error;
    throw new OAuthRequestError(error && error.name === 'AbortError'
      ? 'OAuth sağlayıcısı zaman aşımına uğradı.'
      : 'OAuth sağlayıcısına bağlanılamadı.');
  } finally {
    clearTimeout(timeout);
  }
}

async function googleProfile(config, redirectUri, code, codeVerifier, fetchImpl) {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
    code_verifier: codeVerifier
  });
  const token = await fetchJson(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  }, fetchImpl);

  if (!asText(token.access_token)) {
    throw new OAuthRequestError('Google access token döndürmedi.');
  }

  const profile = await fetchJson(config.userInfoUrl, {
    headers: { Authorization: `Bearer ${token.access_token}` }
  }, fetchImpl);

  if (!profile.email_verified) {
    throw new OAuthRequestError('Google e-posta adresi doğrulanmamış.');
  }

  return normalizeProfile({
    subject: profile.sub,
    email: profile.email,
    name: profile.given_name || profile.name,
    surname: profile.family_name
  });
}

function normalizeProfile(profile) {
  const subject = asText(profile.subject);
  const email = asText(profile.email).toLowerCase();
  if (!subject) throw new OAuthRequestError('OAuth kullanıcı kimliği alınamadı.');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const error = new OAuthRequestError('OAuth sağlayıcısı e-posta adresi döndürmedi.');
    error.code = 'email_required';
    throw error;
  }

  const emailName = email.split('@')[0];
  return {
    subject,
    email,
    name: asText(profile.name) || emailName,
    surname: asText(profile.surname) || null
  };
}

async function findOrCreateMember(prisma, provider, profile) {
  const providerName = PROVIDERS[provider];
  if (!providerName) throw new Error('Desteklenmeyen OAuth sağlayıcısı.');

  const existingIdentity = await prisma.memberOAuthIdentity.findUnique({
    where: {
      provider_providerSubject: {
        provider: providerName,
        providerSubject: profile.subject
      }
    },
    include: { member: true }
  });

  if (existingIdentity) return existingIdentity.member;

  try {
    return await prisma.$transaction(async (tx) => {
      let member = await tx.member.findUnique({ where: { email: profile.email } });
      if (!member) {
        member = await tx.member.create({
          data: {
            name: profile.name,
            surname: profile.surname,
            email: profile.email,
            passwordHash: null
          }
        });
      }

      await tx.memberOAuthIdentity.create({
        data: {
          memberId: member.id,
          provider: providerName,
          providerSubject: profile.subject,
          email: profile.email
        }
      });

      return member;
    });
  } catch (error) {
    if (error && error.code === 'P2002') {
      const identity = await prisma.memberOAuthIdentity.findUnique({
        where: {
          provider_providerSubject: {
            provider: providerName,
            providerSubject: profile.subject
          }
        },
        include: { member: true }
      });
      if (identity) return identity.member;
    }

    throw error;
  }
}

module.exports = {
  FLOW_TTL_MS,
  OAuthRequestError,
  authorizationUrl,
  callbackUrl,
  consumeFlow,
  createFlow,
  findOrCreateMember,
  googleProfile,
  normalizeProfile,
  normalizeReturnTo,
  providerConfig,
  requestBaseUrl
};
