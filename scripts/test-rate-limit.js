const assert = require('assert/strict');
const fs = require('fs');
const Module = require('module');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const entries = new Map();

function entryKey(scope, identifierHash) {
  return `${scope}:${identifierHash}`;
}

const fakePrisma = {
  rateLimitEntry: {
    async deleteMany({ where }) {
      let deleted = 0;

      for (const [key, entry] of entries) {
        const expiredBefore = where.expiresAt?.lte;
        const matchesExpiry = expiredBefore && entry.expiresAt <= expiredBefore;
        const matchesIdentifier = where.scope === entry.scope
          && where.identifierHash === entry.identifierHash;

        if (matchesExpiry || matchesIdentifier) {
          entries.delete(key);
          deleted += 1;
        }
      }

      return { count: deleted };
    },
    async findUnique({ where }) {
      const identity = where.scope_identifierHash;
      const entry = entries.get(entryKey(identity.scope, identity.identifierHash));
      return entry
        ? { hits: entry.hits, expiresAt: entry.expiresAt }
        : null;
    }
  },
  async $queryRaw(strings, ...values) {
    const [scope, identifierHash, windowMs] = values;
    const key = entryKey(scope, identifierHash);
    const now = new Date();
    const current = entries.get(key);
    const hits = !current || current.expiresAt <= now
      ? 1
      : current.hits + 1;
    const expiresAt = !current || current.expiresAt <= now
      ? new Date(now.getTime() + Number(windowMs))
      : current.expiresAt;
    const entry = {
      scope,
      identifierHash,
      hits,
      expiresAt
    };

    entries.set(key, entry);
    return [{ hits, expiresAt }];
  }
};

const originalLoad = Module._load;
Module._load = function loadWithFakePrisma(request, parent, isMain) {
  const rateLimitPath = `${path.sep}src${path.sep}middleware${path.sep}rate-limit.js`;

  if (request === '../db' && parent?.filename.endsWith(rateLimitPath)) {
    return fakePrisma;
  }

  return originalLoad.call(this, request, parent, isMain);
};

process.env.SESSION_SECRET = 'rate-limit-test-secret-that-is-long-and-isolated-from-production';
const {
  clearLoginFailures,
  createIpRateLimiter,
  isIpBlocked,
  isLoginBlocked,
  recordIpFailure,
  recordLoginFailure
} = require('../src/middleware/rate-limit');
Module._load = originalLoad;

function request(ip = '203.0.113.10') {
  return {
    ip,
    socket: {
      remoteAddress: ip
    }
  };
}

function response() {
  return {
    body: null,
    headers: {},
    statusCode: 200,
    set(name, value) {
      this.headers[String(name).toLowerCase()] = String(value);
      return this;
    },
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
}

async function recordPairFailures({ req, res, scope, email, limit, windowMs }) {
  const identifier = `${req.ip}:${email}`;

  for (let attempt = 0; attempt < limit; attempt += 1) {
    await recordLoginFailure({
      res,
      scope,
      identifier,
      limit,
      windowMs
    });
  }
}

async function assertIpRequestLimiter(scope) {
  const limiter = createIpRateLimiter({
    scope,
    limit: 5,
    windowMs: 15 * 60 * 1000,
    message: 'Rate limit reached.'
  });
  const req = request('203.0.113.20');
  let nextCalls = 0;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const res = response();
    await limiter(req, res, () => {
      nextCalls += 1;
    });
    assert.equal(res.statusCode, 200);
  }

  const blockedResponse = response();
  await limiter(req, blockedResponse, () => {
    nextCalls += 1;
  });

  assert.equal(nextCalls, 5);
  assert.equal(blockedResponse.statusCode, 429);
  assert.equal(blockedResponse.body.message, 'Rate limit reached.');
  assert.ok(Number(blockedResponse.headers['retry-after']) > 0);
}

async function run() {
  entries.clear();

  const adminRequest = request('203.0.113.30');
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await recordIpFailure({
      scope: 'admin-login-ip-test',
      identifier: adminRequest.ip,
      windowMs: 60 * 60 * 1000
    });
  }

  const adminResponse = response();
  const adminIpAttempt = await isIpBlocked({
    req: adminRequest,
    res: adminResponse,
    scope: 'admin-login-ip-test',
    limit: 5
  });
  assert.equal(adminIpAttempt.blocked, true);
  assert.ok(Number(adminResponse.headers['retry-after']) > 0);
  assert.equal(adminResponse.headers['ratelimit-limit'], '5');

  const memberRequest = request('203.0.113.40');
  const memberResponse = response();
  await recordPairFailures({
    req: memberRequest,
    res: memberResponse,
    scope: 'member-login-pair-test',
    email: 'member@example.com',
    limit: 5,
    windowMs: 15 * 60 * 1000
  });

  const blockedPair = await isLoginBlocked({
    req: memberRequest,
    res: response(),
    scope: 'member-login-pair-test',
    email: 'member@example.com',
    limit: 5
  });
  const otherEmail = await isLoginBlocked({
    req: memberRequest,
    res: response(),
    scope: 'member-login-pair-test',
    email: 'other@example.com',
    limit: 5
  });
  assert.equal(blockedPair.blocked, true);
  assert.equal(otherEmail.blocked, false);
  await clearLoginFailures('member-login-pair-test', blockedPair.identifier);
  assert.equal((await isLoginBlocked({
    req: memberRequest,
    res: response(),
    scope: 'member-login-pair-test',
    email: 'member@example.com',
    limit: 5
  })).blocked, false);

  for (let attempt = 0; attempt < 30; attempt += 1) {
    await recordIpFailure({
      scope: 'member-login-ip-test',
      identifier: memberRequest.ip,
      windowMs: 15 * 60 * 1000
    });
  }

  const blockedMemberIp = await isIpBlocked({
    req: memberRequest,
    res: response(),
    scope: 'member-login-ip-test',
    limit: 30
  });
  const independentAdminScope = await isIpBlocked({
    req: memberRequest,
    res: response(),
    scope: 'admin-login-ip-test',
    limit: 5
  });
  assert.equal(blockedMemberIp.blocked, true);
  assert.equal(independentAdminScope.blocked, false);

  const expiringRequest = request('203.0.113.50');
  await recordIpFailure({
    scope: 'expiring-ip-test',
    identifier: expiringRequest.ip,
    windowMs: 5
  });
  assert.equal((await isIpBlocked({
    req: expiringRequest,
    res: response(),
    scope: 'expiring-ip-test',
    limit: 1
  })).blocked, true);
  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.equal((await isIpBlocked({
    req: expiringRequest,
    res: response(),
    scope: 'expiring-ip-test',
    limit: 1
  })).blocked, false);

  await assertIpRequestLimiter('member-register-test');
  await assertIpRequestLimiter('frontend-enrollment-test');

  const memberRoutes = fs.readFileSync(
    path.join(projectRoot, 'src/routes/members.js'),
    'utf8'
  );
  const adminRoutes = fs.readFileSync(
    path.join(projectRoot, 'src/routes/admin.js'),
    'utf8'
  );
  const enrollmentRoutes = fs.readFileSync(
    path.join(projectRoot, 'src/routes/enrollments.js'),
    'utf8'
  );

  assert.match(memberRoutes, /MEMBER_LOGIN_IP_LIMIT = 30/);
  assert.match(memberRoutes, /MEMBER_LOGIN_IP_WINDOW_MS = 15 \* 60 \* 1000/);
  assert.match(memberRoutes, /if \(ipAttempt\.blocked\)[\s\S]*?status\(429\)/);
  assert.match(memberRoutes, /recordIpFailure\(\{[\s\S]*?scope: MEMBER_LOGIN_IP_SCOPE/);
  assert.match(memberRoutes, /scope: 'member-register',[\s\S]*?limit: 5,[\s\S]*?windowMs: 60 \* 60 \* 1000/);
  assert.match(adminRoutes, /ADMIN_LOGIN_IP_LIMIT = 5/);
  assert.match(adminRoutes, /ADMIN_LOGIN_IP_WINDOW_MS = 60 \* 60 \* 1000/);
  assert.match(adminRoutes, /if \(ipAttempt\.blocked\)[\s\S]*?status\(429\)/);
  assert.match(adminRoutes, /recordIpFailure\(\{[\s\S]*?scope: ADMIN_LOGIN_IP_SCOPE/);
  assert.match(enrollmentRoutes, /scope: 'frontend-enrollment',[\s\S]*?limit: 5,[\s\S]*?windowMs: 15 \* 60 \* 1000/);

  console.log('Rate-limit tests passed.');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
