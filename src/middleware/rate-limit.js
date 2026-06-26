const crypto = require('crypto');

const prisma = require('../db');
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
let lastCleanupAt = 0;

function identifierHash(identifier) {
  return crypto
    .createHmac('sha256', process.env.SESSION_SECRET)
    .update(String(identifier || 'unknown'))
    .digest('hex');
}

function requestIp(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function loginIdentifier(req, email) {
  return `${requestIp(req)}:${String(email || '').trim().toLowerCase() || 'unknown'}`;
}

function setRateLimitHeaders(res, limit, hits, expiresAt) {
  const remaining = Math.max(0, limit - hits);
  const resetSeconds = Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 1000));

  res.set('RateLimit-Limit', String(limit));
  res.set('RateLimit-Remaining', String(remaining));
  res.set('RateLimit-Reset', String(resetSeconds));

  return resetSeconds;
}

async function pruneExpiredEntries() {
  const now = Date.now();

  if (now - lastCleanupAt < CLEANUP_INTERVAL_MS) {
    return;
  }

  lastCleanupAt = now;
  await prisma.rateLimitEntry.deleteMany({
    where: {
      expiresAt: {
        lte: new Date(now)
      }
    }
  });
}

async function increment(scope, identifier, windowMs) {
  await pruneExpiredEntries();
  const hash = identifierHash(identifier);
  const rows = await prisma.$queryRaw`
    INSERT INTO "RateLimitEntry" (
      "scope",
      "identifierHash",
      "hits",
      "windowStartedAt",
      "expiresAt",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${scope},
      ${hash},
      1,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP + (${windowMs} * INTERVAL '1 millisecond'),
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT ("scope", "identifierHash")
    DO UPDATE SET
      "hits" = CASE
        WHEN "RateLimitEntry"."expiresAt" <= CURRENT_TIMESTAMP THEN 1
        ELSE "RateLimitEntry"."hits" + 1
      END,
      "windowStartedAt" = CASE
        WHEN "RateLimitEntry"."expiresAt" <= CURRENT_TIMESTAMP THEN CURRENT_TIMESTAMP
        ELSE "RateLimitEntry"."windowStartedAt"
      END,
      "expiresAt" = CASE
        WHEN "RateLimitEntry"."expiresAt" <= CURRENT_TIMESTAMP
          THEN CURRENT_TIMESTAMP + (${windowMs} * INTERVAL '1 millisecond')
        ELSE "RateLimitEntry"."expiresAt"
      END,
      "updatedAt" = CURRENT_TIMESTAMP
    RETURNING "hits", "expiresAt"
  `;

  return rows[0];
}

async function getAttempt(scope, identifier) {
  const entry = await prisma.rateLimitEntry.findUnique({
    where: {
      scope_identifierHash: {
        scope,
        identifierHash: identifierHash(identifier)
      }
    },
    select: {
      hits: true,
      expiresAt: true
    }
  });

  if (!entry || entry.expiresAt <= new Date()) {
    return null;
  }

  return entry;
}

async function clearAttempts(scope, identifier) {
  await prisma.rateLimitEntry.deleteMany({
    where: {
      scope,
      identifierHash: identifierHash(identifier)
    }
  });
}

function jsonLimitResponse(res, retryAfter, message) {
  res.set('Retry-After', String(retryAfter));
  return res.status(429).json({
    status: 'failure',
    message
  });
}

function createIpRateLimiter({ scope, limit, windowMs, message }) {
  return async function ipRateLimiter(req, res, next) {
    try {
      const attempt = await increment(scope, requestIp(req), windowMs);
      const retryAfter = setRateLimitHeaders(res, limit, attempt.hits, attempt.expiresAt);

      if (attempt.hits > limit) {
        return jsonLimitResponse(res, retryAfter, message);
      }

      return next();
    } catch (error) {
      console.warn(`[rate-limit] ${scope} counter unavailable:`, error.message);
      return next();
    }
  };
}

async function isLoginBlocked({ req, res, scope, email, limit }) {
  try {
    const identifier = loginIdentifier(req, email);
    const attempt = await getAttempt(scope, identifier);

    if (!attempt) {
      return { blocked: false, identifier };
    }

    const retryAfter = setRateLimitHeaders(res, limit, attempt.hits, attempt.expiresAt);
    if (attempt.hits < limit) {
      return { blocked: false, identifier };
    }

    res.set('Retry-After', String(retryAfter));
    return { blocked: true, identifier, retryAfter };
  } catch (error) {
    console.warn(`[rate-limit] ${scope} check unavailable:`, error.message);
    return {
      blocked: false,
      identifier: loginIdentifier(req, email)
    };
  }
}

async function recordLoginFailure({ res, scope, identifier, limit, windowMs }) {
  try {
    const attempt = await increment(scope, identifier, windowMs);
    setRateLimitHeaders(res, limit, attempt.hits, attempt.expiresAt);
  } catch (error) {
    console.warn(`[rate-limit] ${scope} counter unavailable:`, error.message);
  }
}

async function clearLoginFailures(scope, identifier) {
  try {
    await clearAttempts(scope, identifier);
  } catch (error) {
    console.warn(`[rate-limit] ${scope} reset unavailable:`, error.message);
  }
}

module.exports = {
  clearLoginFailures,
  createIpRateLimiter,
  isLoginBlocked,
  recordLoginFailure
};
