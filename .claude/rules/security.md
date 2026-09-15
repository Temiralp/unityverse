# Güvenlik kuralları — her oturumda yüklenir

## Sır (secret) politikası
- Okunmaz/yazılmaz/aranmaz: `.env`, `.env.*` (`.env.example` hariç), `*.pem`, `*.key`, `*.dump`, `backup*.sql`, `uploads/admin/`.
- `grep -r` yaparken bu dosyaları `--exclude` et; araç çıktısında sır görünürse **tekrar yazma**, "<REDACTED>" de.
- Yeni env anahtarı gerekiyorsa: `.env.example`'a yalnızca anahtar + açıklama yaz, değeri Mimar `.env`'e kendisi ekler (adımları ver).
- Koda hard-coded parola/token/IP yazılmaz. Bilinen ihlal: `local_server.js` (git'te izleniyor, açık SMTP parolası — parola 2026-09-15'te döndürüldü, dosya hâlâ repoda) — bkz. PROJECT_STATE riskler.

## Kimlik doğrulama / oturum
- Admin: `requireAdmin` (`src/middleware/auth.js`), oturum DB'de (`user_sessions`), cookie `httpOnly`, `sameSite=lax`, `secure` yalnızca production. 8 saat.
- `SESSION_SECRET` ≥64 karakter zorunlu, aksi halde app kalkmaz (`src/config/session.js`).
- `TRUST_PROXY` yalnızca açık IP/CIDR (`127.0.0.1`); `true`/`*` app'i çökertir (`src/config/trust-proxy.js`). Rate-limit ve PayTR IP allowlist buna dayanır.
- Üye parolaları bcrypt (cost 12). Google OAuth: `src/services/social-oauth.js`.
- Admin şifre değişikliği: `/admin/change-password` (`src/services/admin-password.js`) — politika ≥10 karakter + büyük/küçük/rakam/özel; hatalı mevcut şifre 5/60 dk, başarılı değişiklik 2/3 saat (DB-backed `RateLimitEntry`); başarıda oturum yenilenir ve aynı adminin diğer `user_sessions` satırları silinir. **Şifre değişince `.env ADMIN_PASSWORD` eskimiştir; `npm run seed` asla çalıştırılmaz** (upsert ile eski şifreyi geri yazar). Şifre unutulursa kurtarma yolu: Mimar sunucuda `.env`'e yeni `ADMIN_PASSWORD` yazıp bir kez `npm run seed` çalıştırır.

## CSRF / form koruması
- Admin formları: `csrfToken` oturumda, multipart için `requireMultipartCsrf`.
- Public formlar: `src/middleware/public-csrf.js` (`PUBLIC_CSRF_ENFORCED`) + `src/security/form-protection.js` imzalı `_formToken` (`PUBLIC_FORM_TOKEN_ENFORCED`). Token endpoint'leri: `GET /api/csrf-token`, `GET /api/form-protection-token`.
- Yeni public POST eklerken bu iki korumayı ve `rate-limit.js`'i uygula; testle kanıtla.

## CSP
- `src/config/csp.js`: legacy sayfalar için allowlist (GTM, FB, tawk.to, YouTube, maps), EJS sayfalar için nonce. PayTR iframe için `frame-src` ek kaynaklar.
- Yeni harici script/iframe eklenirken CSP allowlist güncellenmeli, `scripts/csp-browser-smoke.js` ile doğrulanmalı. `/csp-report` ihlalleri `console.warn` ile loglanır.

## Ödeme (PayTR) — en yüksek blast radius
- Callback `POST /odeme/callback`: (1) Nginx IP allowlist (`nginx_paytr_callback.conf`), (2) uygulama seviyesinde `PAYTR_ALLOWED_IPS`, (3) HMAC hash doğrulaması (`src/services/paytr-callback.js`). Üç katman da kalmalı.
- Callback yanıtı mutlaka `OK` metni olmalı (PayTR tekrar gönderir). Idempotent olmalı (aynı sipariş 2 kez gelirse iki kez ödenmiş sayılmasın).
- Tutar hesabı sunucuda (`registration-pricing.js`, `coupon-validation.js`, `bank-transfer-pricing.js`), istemciden gelen tutara güvenilmez.
- Canlı ödeme değişikliği → önce `PAYTR_TEST_MODE=1` ile test, sonra Mimar `0`'a geçirir.

## PII
- Kayıt PII'si şifreli (`src/services/registration-pii.js`, `REGISTRATION_PII_ENCRYPTION_KEYS` JSON + `REGISTRATION_PII_ACTIVE_KEY_ID`). Anahtar rotasyonu yalnızca Mimar kararıyla.
- Loglara PII (ad, telefon, TC, e-posta) yazılmaz. Test verileri uydurma olmalı.
- Üye sayfaları `noindex` (`X-Robots-Tag` + meta).

## Yükleme (upload)
- multer ile `uploads/blog`, `uploads/products`, `uploads/corporate-references`; MIME/boyut kontrolü mevcut handler'larda (`handleBlogImageUpload`, `handleProductImageUpload`). Yeni upload türü eklerken aynı kontrolleri uygula. Zengin metin için `sanitize-html` zorunlu.

## Deploy güvenliği
- `prisma migrate deploy` (asla `migrate dev`), önce `pg_dump`. Ayrıntı: `DEPLOYMENT.md` §5, §10.
- 5432 ve 8000 portları internete kapalı; yalnızca 22/80/443.
