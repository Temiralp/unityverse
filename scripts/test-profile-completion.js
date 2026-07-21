const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');

const {
  LEGACY_HOME_CSS_VERSION,
  LEGACY_SCRIPTS_VERSION,
  ensureLegacyAssetVersions
} = require('../src/services/legacy-assets');

const member = {
  id: 42,
  name: 'Ada',
  surname: 'Lovelace',
  email: 'ada@example.com',
  phone: null,
  mailList: true,
  smsList: true,
  status: 'ACTIVE',
  createdAt: new Date('2026-01-01T00:00:00.000Z')
};
let lastProfileUpdate = null;

const fakePrisma = {
  member: {
    async update({ data }) {
      lastProfileUpdate = data;
      return { ...member, ...data };
    }
  }
};

const dbPath = require.resolve('../src/db');
require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: fakePrisma
};

const memberRouter = require('../src/routes/members');
const profileLayer = memberRouter.stack.find((layer) => layer.route && layer.route.path === '/profile');
const profileHandler = profileLayer.route.stack[profileLayer.route.stack.length - 1].handle;

async function invokeProfile(body) {
  const response = {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    }
  };
  let nextError = null;

  await profileHandler({
    body,
    session: {
      member: {
        id: member.id,
        name: member.name,
        surname: member.surname,
        email: member.email
      }
    }
  }, response, (error) => {
    nextError = error;
  });

  assert.equal(nextError, null);
  return response;
}

async function profileRouteTests() {
  lastProfileUpdate = null;
  const updated = await invokeProfile({
    name: 'Ada',
    surname: 'Lovelace',
    phone: '+90 555 111 22 33'
  });

  assert.equal(updated.statusCode, 200);
  assert.equal(updated.payload.status, 'success');
  assert.deepEqual(lastProfileUpdate, {
    name: 'Ada',
    surname: 'Lovelace',
    phone: '+90 555 111 22 33'
  });
  assert.equal(updated.payload.member.mailList, true);
  assert.equal(updated.payload.member.smsList, true);

  lastProfileUpdate = null;
  const invalid = await invokeProfile({
    name: 'Ada',
    surname: 'Lovelace',
    phone: '123'
  });

  assert.equal(invalid.statusCode, 400);
  assert.match(invalid.payload.message, /Geçerli bir telefon/);
  assert.equal(lastProfileUpdate, null);
}

function frontendContractTests() {
  const root = path.resolve(__dirname, '..');
  const scriptsSource = fs.readFileSync(path.join(root, 'public/tema10/js/scripts.js'), 'utf8');
  const cssSource = fs.readFileSync(path.join(root, 'public/tema10/css/home2.css'), 'utf8');

  assert.match(scriptsSource, /isEnrollmentProfileComplete/);
  assert.match(scriptsSource, /ajax\/member\/profile/);
  assert.match(scriptsSource, /startLegacyEnrollment\(productId\)/);
  assert.match(scriptsSource, /uv-legacy-profile-completion/);
  assert.match(cssSource, /\.uv-legacy-profile-completion/);
  assert.match(cssSource, /@media \(max-width:575px\)/);
}

function assetVersionTests() {
  const html = '<link href="../../public/tema10/css/home2.css?v=5.4.96"><script src="../../public/tema10/js/scripts.js?v=5.4.105"></script>';
  const updated = ensureLegacyAssetVersions(html);

  assert.match(updated, new RegExp(`home2\\.css\\?v=${LEGACY_HOME_CSS_VERSION.replace(/\./g, '\\.')}`));
  assert.match(updated, new RegExp(`scripts\\.js\\?v=${LEGACY_SCRIPTS_VERSION.replace(/\./g, '\\.')}`));
  assert.equal(ensureLegacyAssetVersions(updated), updated);
  assert.equal(ensureLegacyAssetVersions(null), null);
}

async function run() {
  await profileRouteTests();
  frontendContractTests();
  assetVersionTests();
  console.log('Profile completion tests passed.');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
