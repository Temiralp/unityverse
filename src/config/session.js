const MIN_SESSION_SECRET_LENGTH = 64;
const FORBIDDEN_SESSION_SECRETS = new Set([
  'dev-only-change-me',
  'change-this-long-random-secret',
  'replace-with-generated-secret'
]);

function requireSessionSecret(env = process.env) {
  const secret = String(env.SESSION_SECRET || '').trim();

  if (!secret) {
    throw new Error(
      'SESSION_SECRET tanımlı değil. .env dosyasına en az 64 karakterlik güçlü ve rastgele bir SESSION_SECRET ekleyin.'
    );
  }

  if (FORBIDDEN_SESSION_SECRETS.has(secret) || secret.length < MIN_SESSION_SECRET_LENGTH) {
    throw new Error(
      `SESSION_SECRET güvenli değil. En az ${MIN_SESSION_SECRET_LENGTH} karakterlik rastgele bir değer kullanın; örnek veya varsayılan değer kullanmayın.`
    );
  }

  return secret;
}

module.exports = {
  MIN_SESSION_SECRET_LENGTH,
  requireSessionSecret
};
