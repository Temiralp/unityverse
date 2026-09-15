# Təhlükəsizlik qaydaları — hər sessiyada yüklənir

## Sirr (secret) siyasəti
- Oxunmur/yazılmır/axtarılmır: `.env`, `.env.*` (`.env.example` istisna), `*.pem`, `*.key`, `*.dump`, `backup*.sql`, `uploads/admin/`.
- `grep -r` edərkən bu faylları `--exclude` et; tool çıxışında sirr görünsə **təkrar yazma**, "<REDACTED>" de.
- Yeni env açarı lazımdırsa: `.env.example`-a yalnız açar + şərh yaz, dəyəri Arxitekt `.env`-ə özü əlavə edir (addımları ver).
- Koda hard-coded parol/token/IP yazılmır. Mövcud pozuntu: `local_server.js` (git-də izlənir, açıq SMTP parolu) — bax PROJECT_STATE risklər.

## Autentifikasiya / sessiya
- Admin: `requireAdmin` (`src/middleware/auth.js`), sessiya DB-də (`user_sessions`), cookie `httpOnly`, `sameSite=lax`, `secure` yalnız production. 8 saat.
- `SESSION_SECRET` ≥64 simvol məcburidir, əks halda app qalxmır (`src/config/session.js`).
- `TRUST_PROXY` yalnız açıq IP/CIDR (`127.0.0.1`); `true`/`*` app-i çökdürür (`src/config/trust-proxy.js`). Rate-limit və PayTR IP allowlist buna dayanır.
- Üzv parolları bcrypt (cost 12). Google OAuth: `src/services/social-oauth.js`.

## CSRF / form qoruması
- Admin formları: `csrfToken` sessiyada, multipart üçün `requireMultipartCsrf`.
- Public formlar: `src/middleware/public-csrf.js` (`PUBLIC_CSRF_ENFORCED`) + `src/security/form-protection.js` imzalı `_formToken` (`PUBLIC_FORM_TOKEN_ENFORCED`). Token endpoint-ləri: `GET /api/csrf-token`, `GET /api/form-protection-token`.
- Yeni public POST əlavə edəndə bu iki qorumanı və `rate-limit.js`-i tətbiq et; testlə sübut et.

## CSP
- `src/config/csp.js`: legacy səhifələr üçün allowlist (GTM, FB, tawk.to, YouTube, maps), EJS səhifələr üçün nonce. PayTR iframe üçün `frame-src` əlavə mənbələr.
- Yeni xarici script/iframe əlavə ediləndə CSP allowlist yenilənməli, `scripts/csp-browser-smoke.js` ilə yoxlanmalıdır. `/csp-report` pozuntuları `console.warn` ilə loglanır.

## Ödəniş (PayTR) — ən yüksək blast radius
- Callback `POST /odeme/callback`: (1) Nginx IP allowlist (`nginx_paytr_callback.conf`), (2) app səviyyəsində `PAYTR_ALLOWED_IPS`, (3) HMAC hash yoxlaması (`src/services/paytr-callback.js`). Üç qat da qalmalıdır.
- Callback cavabı mütləq `OK` mətni olmalıdır (PayTR təkrar göndərir). Idempotent olmalıdır (eyni sifariş 2 dəfə gəlsə iki dəfə ödənmiş sayılmasın).
- Məbləğ hesabı serverdə (`registration-pricing.js`, `coupon-validation.js`, `bank-transfer-pricing.js`), client-dən gələn məbləğə etibar edilmir.
- Canlı ödəniş dəyişikliyi → əvvəl `PAYTR_TEST_MODE=1` ilə test, sonra Arxitekt `0`-a keçirir.

## PII
- Qeydiyyat PII-si şifrəli (`src/services/registration-pii.js`, `REGISTRATION_PII_ENCRYPTION_KEYS` JSON + `REGISTRATION_PII_ACTIVE_KEY_ID`). Şifrələmə açarı rotasiyası yalnız Arxitekt qərarı ilə.
- Loglara PII (ad, telefon, TC, e-poçt) yazılmır. Test məlumatları uydurma olmalıdır.
- Üzv səhifələri `noindex` (`X-Robots-Tag` + meta).

## Yükləmə (upload)
- multer ilə `uploads/blog`, `uploads/products`, `uploads/corporate-references`; MIME/ölçü yoxlaması mövcud handler-lərdə (`handleBlogImageUpload`, `handleProductImageUpload`). Yeni upload növü əlavə edəndə eyni yoxlamaları tətbiq et. `sanitize-html` zəngin mətn üçün məcburidir.

## Deploy təhlükəsizliyi
- `prisma migrate deploy` (heç vaxt `migrate dev`), əvvəl `pg_dump`. Detal: `DEPLOYMENT.md` §5, §10.
- 5432 və 8000 portları internetə bağlı; yalnız 22/80/443.
