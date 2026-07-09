const crypto = require('crypto');

const MIN_FORM_AGE_MS = 2500;
const MAX_FORM_AGE_MS = 2 * 60 * 60 * 1000;
const ALLOWED_SCOPES = new Set(['lead', 'member', 'enrollment']);

function signature(value) {
  return crypto
    .createHmac('sha256', process.env.SESSION_SECRET)
    .update(value)
    .digest('base64url');
}

function createFormToken(scope) {
  if (!ALLOWED_SCOPES.has(scope)) {
    throw new Error('Unsupported form protection scope.');
  }

  const payload = Buffer.from(JSON.stringify({
    scope,
    issuedAt: Date.now(),
    nonce: crypto.randomBytes(16).toString('hex')
  })).toString('base64url');

  return `${payload}.${signature(payload)}`;
}

function verifyFormToken(token, expectedScope) {
  if (!ALLOWED_SCOPES.has(expectedScope) || typeof token !== 'string') {
    return { valid: false, reason: 'invalid' };
  }

  const [payload, suppliedSignature, extra] = token.split('.');
  if (!payload || !suppliedSignature || extra) {
    return { valid: false, reason: 'invalid' };
  }

  const expectedSignature = signature(payload);
  const suppliedBuffer = Buffer.from(suppliedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    suppliedBuffer.length !== expectedBuffer.length
    || !crypto.timingSafeEqual(suppliedBuffer, expectedBuffer)
  ) {
    return { valid: false, reason: 'invalid' };
  }

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    const age = Date.now() - Number(data.issuedAt);

    if (data.scope !== expectedScope || !Number.isFinite(age) || age < 0 || age > MAX_FORM_AGE_MS) {
      return { valid: false, reason: 'invalid' };
    }

    if (age < MIN_FORM_AGE_MS) {
      return { valid: false, reason: 'too-fast' };
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, reason: 'invalid' };
  }
}

module.exports = {
  createFormToken,
  verifyFormToken
};
