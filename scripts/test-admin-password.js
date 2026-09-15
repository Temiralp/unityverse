#!/usr/bin/env node

// Admin sifre degistirme: sifre politikasi, mevcut sifre dogrulama, bcrypt hash guncelleme,
// diger oturumlarin kapatilmasi ve /admin/change-password route + view sozlesmesi.

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const {
  BCRYPT_COST,
  MIN_PASSWORD_LENGTH,
  changeAdminPassword,
  revokeOtherAdminSessions,
  validatePasswordChange
} = require('../src/services/admin-password');

const root = path.resolve(__dirname, '..');
const STRONG = 'Guclu#Sifre2026';
const CURRENT = 'EskiSifre!123';

// 1) Politika matrisi
assert.equal(MIN_PASSWORD_LENGTH, 10);
assert.equal(BCRYPT_COST, 12);
const ok = validatePasswordChange({ currentPassword: CURRENT, newPassword: STRONG, newPasswordConfirm: STRONG });
assert.equal(ok.error, null);
assert.deepEqual(ok.data, { currentPassword: CURRENT, newPassword: STRONG });
const cases = [
  [{ currentPassword: '', newPassword: STRONG, newPasswordConfirm: STRONG }, /Mevcut şifre/],
  [{ currentPassword: CURRENT, newPassword: '', newPasswordConfirm: '' }, /Yeni şifre/],
  [{ currentPassword: CURRENT, newPassword: 'Ab1#short', newPasswordConfirm: 'Ab1#short' }, /en az 10 karakter/],
  [{ currentPassword: CURRENT, newPassword: 'guclu#sifre2026', newPasswordConfirm: 'guclu#sifre2026' }, /büyük harf/],
  [{ currentPassword: CURRENT, newPassword: 'GUCLU#SIFRE2026', newPasswordConfirm: 'GUCLU#SIFRE2026' }, /küçük harf/],
  [{ currentPassword: CURRENT, newPassword: 'Guclu#Sifre', newPasswordConfirm: 'Guclu#Sifre' }, /rakam/],
  [{ currentPassword: CURRENT, newPassword: 'GucluSifre2026', newPasswordConfirm: 'GucluSifre2026' }, /özel karakter/],
  [{ currentPassword: CURRENT, newPassword: STRONG, newPasswordConfirm: 'Guclu#Sifre2027' }, /eşleşmiyor/],
  [{ currentPassword: STRONG, newPassword: STRONG, newPasswordConfirm: STRONG }, /mevcut şifreden farklı/],
  [{ currentPassword: CURRENT, newPassword: ` ${STRONG} `, newPasswordConfirm: ` ${STRONG} ` }, /boşluk/]
];
cases.forEach(([input, expected]) => {
  const result = validatePasswordChange(input);
  assert.match(String(result.error), expected, JSON.stringify(input));
  assert.equal(result.data, null);
});
// Turkce karakterler de buyuk/kucuk harf sayilir
assert.equal(validatePasswordChange({ currentPassword: CURRENT, newPassword: 'Şifrəm#2026ok', newPasswordConfirm: 'Şifrəm#2026ok' }).error, null);

// 2) changeAdminPassword: fake prisma + gercek bcrypt
(async () => {
  const currentHash = await bcrypt.hash(CURRENT, 4);
  const updates = [];
  const fakePrisma = {
    adminUser: {
      async findUnique({ where }) {
        assert.deepEqual(where, { id: 7 });
        return { id: 7, email: 'admin@example.com', passwordHash: currentHash };
      },
      async update({ where, data }) {
        updates.push({ where, data });
        return { id: 7 };
      }
    }
  };

  const wrong = await changeAdminPassword(fakePrisma, { adminId: 7, currentPassword: 'yanlis', newPassword: STRONG });
  assert.deepEqual(wrong, { ok: false, reason: 'current-password' });
  assert.equal(updates.length, 0);

  const missing = await changeAdminPassword({ adminUser: { async findUnique() { return null; }, async update() { throw new Error('olmamali'); } } }, { adminId: 1, currentPassword: CURRENT, newPassword: STRONG });
  assert.deepEqual(missing, { ok: false, reason: 'not-found' });

  const changed = await changeAdminPassword(fakePrisma, { adminId: 7, currentPassword: CURRENT, newPassword: STRONG });
  assert.deepEqual(changed, { ok: true });
  assert.equal(updates.length, 1);
  assert.deepEqual(updates[0].where, { id: 7 });
  const newHash = updates[0].data.passwordHash;
  assert.equal(Object.keys(updates[0].data).length, 1);
  assert.equal(newHash.length, 60);
  assert.match(newHash, /^\$2[aby]\$12\$/);
  assert.equal(newHash.includes(STRONG), false);
  assert.equal(await bcrypt.compare(STRONG, newHash), true);
  assert.equal(await bcrypt.compare(CURRENT, newHash), false, 'eski sifre artik gecerli olmamali');

  // 3) Diger oturumlar: ayni admin id'li, mevcut sid disindaki user_sessions satirlari silinir
  const raws = [];
  const sessionPrisma = {
    async $executeRaw(strings, ...values) {
      raws.push({ sql: strings.join('?'), values });
      return 2;
    }
  };
  const revoked = await revokeOtherAdminSessions(sessionPrisma, { adminId: 7, currentSid: 'keep-me' });
  assert.equal(revoked, 2);
  assert.equal(raws.length, 1);
  assert.match(raws[0].sql, /DELETE FROM "user_sessions"/);
  assert.match(raws[0].sql, /"sess"->'adminUser'->>'id'/);
  assert.match(raws[0].sql, /"sid" <> /);
  assert.deepEqual(raws[0].values, ['7', 'keep-me']);

  // 4) Route + view + header sozlesmesi
  const routes = fs.readFileSync(path.join(root, 'src/routes/admin.js'), 'utf8');
  assert.match(routes, /require\('\.\.\/services\/admin-password'\)/);
  assert.match(routes, /router\.get\('\/change-password', requireAdmin/);
  assert.match(routes, /router\.post\('\/change-password', requireAdmin/);
  assert.match(routes, /ADMIN_PASSWORD_ATTEMPT_SCOPE = 'admin-password-attempt'/);
  assert.match(routes, /ADMIN_PASSWORD_ATTEMPT_LIMIT = 5/);
  assert.match(routes, /ADMIN_PASSWORD_ATTEMPT_WINDOW_MS = 60 \* 60 \* 1000/);
  assert.match(routes, /ADMIN_PASSWORD_CHANGE_SCOPE = 'admin-password-change'/);
  assert.match(routes, /ADMIN_PASSWORD_CHANGE_LIMIT = 2/);
  assert.match(routes, /ADMIN_PASSWORD_CHANGE_WINDOW_MS = 3 \* 60 \* 60 \* 1000/);
  assert.match(routes, /revokeOtherAdminSessions\(/);
  assert.match(routes, /req\.session\.regenerate\(/);

  const view = fs.readFileSync(path.join(root, 'src/views/admin/change-password.ejs'), 'utf8');
  assert.match(view, /action="\/admin\/change-password" method="post"/);
  assert.match(view, /name="_csrf" value="<%= csrfToken %>"/);
  assert.match(view, /<input type="password" name="currentPassword" autocomplete="current-password" required/);
  assert.match(view, /<input type="password" name="newPassword" autocomplete="new-password" minlength="10" required/);
  assert.match(view, /<input type="password" name="newPasswordConfirm" autocomplete="new-password" minlength="10" required/);
  assert.doesNotMatch(view, /value="<%= [^%]*Password/i, 'sifre alanlari asla onceden doldurulmaz');

  const header = fs.readFileSync(path.join(root, 'src/views/admin/partials/header.ejs'), 'utf8');
  assert.match(header, /href="\/admin\/change-password"/);

  console.log('admin password change OK');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
