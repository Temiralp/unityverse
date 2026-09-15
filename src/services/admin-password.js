// Admin sifre degistirme: politika dogrulamasi, mevcut sifre kontrolu (bcrypt),
// yeni hash'in DB'ye yazilmasi ve diger oturumlarin iptali.
// Durum yalnizca DB'de tutulur (AdminUser.passwordHash, user_sessions).

const bcrypt = require('bcryptjs');

const BCRYPT_COST = 12;
const MIN_PASSWORD_LENGTH = 10;
const PASSWORD_POLICY_TEXT = `En az ${MIN_PASSWORD_LENGTH} karakter; büyük harf, küçük harf, rakam ve özel karakter içermeli.`;

function asText(value) {
  return typeof value === 'string' ? value : '';
}

// Unicode farkindalikli: Türkçe harfler de büyük/küçük harf sayilir.
function passwordPolicyError(password) {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Yeni şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalıdır.`;
  }
  if (!/\p{Lu}/u.test(password)) return 'Yeni şifre en az bir büyük harf içermelidir.';
  if (!/\p{Ll}/u.test(password)) return 'Yeni şifre en az bir küçük harf içermelidir.';
  if (!/\p{Nd}/u.test(password)) return 'Yeni şifre en az bir rakam içermelidir.';
  if (!/[^\p{L}\p{Nd}]/u.test(password)) return 'Yeni şifre en az bir özel karakter içermelidir.';
  return null;
}

function validatePasswordChange({ currentPassword, newPassword, newPasswordConfirm } = {}) {
  const current = asText(currentPassword);
  const next = asText(newPassword);
  const confirm = asText(newPasswordConfirm);
  const fail = (error) => ({ error, data: null });

  if (!current) return fail('Mevcut şifre zorunludur.');
  if (!next) return fail('Yeni şifre zorunludur.');
  if (next !== next.trim()) return fail('Yeni şifre başında veya sonunda boşluk içeremez.');

  const policyError = passwordPolicyError(next);
  if (policyError) return fail(policyError);
  if (next !== confirm) return fail('Yeni şifreler eşleşmiyor.');
  if (next === current) return fail('Yeni şifre mevcut şifreden farklı olmalıdır.');

  return { error: null, data: { currentPassword: current, newPassword: next } };
}

async function changeAdminPassword(prismaClient, { adminId, currentPassword, newPassword }) {
  const admin = await prismaClient.adminUser.findUnique({ where: { id: Number(adminId) } });
  if (!admin) return { ok: false, reason: 'not-found' };

  const matches = await bcrypt.compare(asText(currentPassword), admin.passwordHash || '');
  if (!matches) return { ok: false, reason: 'current-password' };

  await prismaClient.adminUser.update({
    where: { id: admin.id },
    data: { passwordHash: await bcrypt.hash(newPassword, BCRYPT_COST) }
  });

  return { ok: true };
}

// connect-pg-simple tablosu: sess JSON icinde adminUser.id tutulur.
// Mevcut oturum (currentSid) korunur, ayni adminin diger oturumlari silinir.
async function revokeOtherAdminSessions(prismaClient, { adminId, currentSid }) {
  return prismaClient.$executeRaw`
    DELETE FROM "user_sessions"
    WHERE "sess"->'adminUser'->>'id' = ${String(adminId)}
      AND "sid" <> ${String(currentSid || '')}
  `;
}

module.exports = {
  BCRYPT_COST,
  MIN_PASSWORD_LENGTH,
  PASSWORD_POLICY_TEXT,
  changeAdminPassword,
  revokeOtherAdminSessions,
  validatePasswordChange
};
