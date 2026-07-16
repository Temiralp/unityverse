const crypto = require('crypto');
const express = require('express');

const defaultPrisma = require('../db');
const {
  OAuthRequestError,
  authorizationUrl,
  callbackUrl,
  consumeFlow,
  createFlow,
  findOrCreateMember,
  googleProfile,
  normalizeReturnTo,
  providerConfig
} = require('../services/social-oauth');

const SUPPORTED_PROVIDERS = new Set(['google']);

function sessionMember(member) {
  return {
    id: member.id,
    name: member.name,
    surname: member.surname,
    email: member.email
  };
}

function oauthErrorUrl(provider, code) {
  const query = new URLSearchParams({
    oauth_error: code,
    provider
  });
  return `/uye-girisi/?${query.toString()}`;
}

function saveSession(req) {
  return new Promise((resolve, reject) => {
    req.session.save((error) => error ? reject(error) : resolve());
  });
}

function establishMemberSession(req, member) {
  const adminUser = req.session.adminUser || null;

  return new Promise((resolve, reject) => {
    req.session.regenerate((regenerateError) => {
      if (regenerateError) return reject(regenerateError);

      if (adminUser) req.session.adminUser = adminUser;
      req.session.member = sessionMember(member);
      req.session.csrfToken = crypto.randomBytes(32).toString('hex');
      return req.session.save((saveError) => saveError ? reject(saveError) : resolve());
    });
  });
}

function errorCode(error) {
  if (error && error.code === 'email_required') return 'email_required';
  if (error instanceof OAuthRequestError) return 'provider_unavailable';
  return 'login_failed';
}

function createSocialAuthRouter({
  prisma = defaultPrisma,
  env = process.env,
  fetchImpl = global.fetch
} = {}) {
  const router = express.Router();

  router.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  router.get('/:provider', async (req, res, next) => {
    const provider = String(req.params.provider || '').toLowerCase();
    if (!SUPPORTED_PROVIDERS.has(provider)) return res.sendStatus(404);

    try {
      const config = providerConfig(provider, env);
      if (!config) return res.redirect(303, oauthErrorUrl(provider, 'provider_not_configured'));

      const redirectUri = callbackUrl(req, provider, env);
      const flow = createFlow(provider, normalizeReturnTo(req.query.returnTo));
      req.session.oauthFlow = flow;
      await saveSession(req);

      return res.redirect(302, authorizationUrl(provider, config, redirectUri, flow));
    } catch (error) {
      if (error && /OAUTH_BASE_URL/.test(String(error.message || ''))) {
        return res.redirect(303, oauthErrorUrl(provider, 'provider_not_configured'));
      }
      return next(error);
    }
  });

  router.get('/:provider/callback', async (req, res, next) => {
    const provider = String(req.params.provider || '').toLowerCase();
    if (!SUPPORTED_PROVIDERS.has(provider)) return res.sendStatus(404);

    const flow = consumeFlow(req.session, provider, req.query.state);
    if (!flow) {
      await saveSession(req).catch(() => {});
      return res.redirect(303, oauthErrorUrl(provider, 'invalid_state'));
    }

    if (req.query.error) {
      await saveSession(req).catch(() => {});
      return res.redirect(303, oauthErrorUrl(provider, 'access_denied'));
    }

    const code = String(req.query.code || '').trim();
    if (!code) {
      await saveSession(req).catch(() => {});
      return res.redirect(303, oauthErrorUrl(provider, 'login_failed'));
    }

    try {
      const config = providerConfig(provider, env);
      if (!config) return res.redirect(303, oauthErrorUrl(provider, 'provider_not_configured'));

      const redirectUri = callbackUrl(req, provider, env);
      const profile = await googleProfile(config, redirectUri, code, flow.codeVerifier, fetchImpl);
      const member = await findOrCreateMember(prisma, provider, profile);

      if (!member || member.status !== 'ACTIVE') {
        return res.redirect(303, oauthErrorUrl(provider, 'member_inactive'));
      }

      await establishMemberSession(req, member);
      return res.redirect(303, flow.returnTo);
    } catch (error) {
      if (!error || error.code !== 'email_required') {
        console.error(`[OAuth ${provider}] callback başarısız`, {
          name: error && error.name,
          code: error && error.code,
          status: error && error.status
        });
      }
      return res.redirect(303, oauthErrorUrl(provider, errorCode(error)));
    }
  });

  return router;
}

module.exports = createSocialAuthRouter;
module.exports.establishMemberSession = establishMemberSession;
module.exports.oauthErrorUrl = oauthErrorUrl;
