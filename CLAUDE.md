# Unityverse Academy — CLAUDE.md

Bu dosya her oturumda yüklenir. Amaç: yeni bir AI agent veya insan bu dosyayı okuyup projenin ne olduğunu,
nerede kaldığımızı ve hangi kurallarla çalıştığımızı 5 dakikada anlasın.
**Her iş çemberi (circle) bittiğinde `PROJECT_STATE.md` güncellenir; kurallar değişince bu dosya ve `.claude/rules/` güncellenir.**

Otomatik yüklenen ek dosyalar:
- `.claude/rules/workflow.md` — çember yöntemi, plan şablonu, TDD, teslim (handoff) adımları
- `.claude/rules/security.md` — sır/secret, PayTR, oturum, CSRF kuralları
- `.claude/rules/testing.md` — test kuralları ve çalıştırma yöntemi
- @PROJECT_STATE.md — canlı durum günlüğü: nerede kaldık, açık riskler, backlog, karar günlüğü

Referans belgeler (gerekince oku, otomatik yüklenmez): `DEPLOYMENT.md` (TR), `PRODUCTION_CHECKLIST.md` (AZ), `BACKEND_SETUP.md` (AZ).

## 1. Roller
- **Kullanıcı = Mimar.** Sistem tasarımı ve tüm ana kararlar onundur. Sen seçenek + öneri sunarsın, kararı o verir.
- **Sen = scrum ekibi** (Software Eng, QA, PM, PO, BA, DevSecOps, Cybersecurity). Her plan bu bakış açılarının tümünden geçmiş olmalıdır.
- Dil kuralı: **sohbet/rapor — Azerbaycanca**; **kod yorumları (comment) ve `.md` belgeleri — Türkçe**; **commit mesajı — İngilizce veya Türkçe**; tanımlayıcılar İngilizce (mevcut konvansiyon).

## 2. Proje nedir
- `https://unityverseacademy.com` — Türkiye pazarı için oyun/animasyon/yazılım eğitim akademisinin sitesi. UI dili Türkçe.
- Repo: `git@github.com:Temiralp/unityverse.git`, branch `main`. Canlı sunucu: **Google Cloud** (VM; Nginx → Node :8000 → PostgreSQL localhost). Sunucu yerleşimi `DEPLOYMENT.md` §3'e göre `/var/www/unityverse/{releases,shared,current}` — **sunucudaki gerçek yol Mimar tarafından onaylanmalı**, bkz. `PROJECT_STATE.md` §"Sunucu".
- İki katman: (a) eski statik site (HTML/CSS/JS: `index.html`, `urun/`, `blog-detay/`, `kategori/`, `sayfa/`, `public/tema10/`) ve (b) Node backend (`src/`) — admin panel, API, üyelik, kayıt (enrollment), ödeme.
- `LEGACY_FRONTEND_MODE=true` (production'da böyle): statik sayfalar korunur, ancak kurs listesi/detayı, blog, kategori DB'den render edilir (`src/routes/legacy-*.js`). `false` iken tam EJS katalog (`src/routes/catalog.js`) çalışır.

## 3. Stack (kesin sürümler `package.json`'da)
Node **v24.13.1** (yerel), npm 11.8 · Express 4 · EJS 3 · Prisma 6 + PostgreSQL 16 · express-session + connect-pg-simple (DB oturumu) · helmet + özel CSP (`src/config/csp.js`) · multer (yükleme) · sanitize-html · bcryptjs · PayTR iframe API (ödeme) · SMTP mail (`src/services/mail.js`, nodemailer yok — kendi SMTP istemcisi). CommonJS, TS yok, lint/format aracı yok (2 boşluk, tek tırnak, noktalı virgül — mevcut kodu izle).

## 4. Komutlar
```bash
npm run dev                 # nodemon src/server.js  (http://localhost:8000, admin: /admin)
npm start                   # production start
docker compose up -d postgres   # yerel PostgreSQL 16 (docker-compose.yml)
npm run prisma:generate / prisma:migrate / prisma:studio / seed
node scripts/test-<ad>.js   # tek test; npm run test:<ad> alias'ları package.json'da
```
`npm test` **yok**; testler ayrı ayrı scriptlerdir (bkz. `.claude/rules/testing.md`). macOS'ta `timeout` komutu yok.

## 5. Kod haritası (nerede ne var)
- `src/server.js` — app kurulumu, middleware sırası, statik klasör servisi. **Sıra önemlidir** (CSP → session → csrf → admin/api → legacy middleware → catalog → odeme/ajax → static).
- `src/routes/admin.js` (4122 satır, 72 route) — admin panel: categories, blog, products(+variants), leads, members, registrations, payments/installments, coupons, corporate-references, crm, pending-checkouts. **En riskli dosya**: değişiklik minimal ve yerel olmalı; yeni mantık route'a değil `src/services/`'e yazılır.
- `src/routes/payments.js` (`/odeme/*`) + `src/routes/paytr.js` (`/ajax/paytr/token`) + `src/services/paytr*.js` — ödeme, callback (`POST /odeme/callback`), havale/EFT, kupon.
- `src/routes/enrollments.js` (`/ajax/enroll`) — kursa kayıt (EducationRegistration oluşturur).
- `src/routes/members.js` (`/ajax/member/*`) + `src/routes/social-auth.js` (`/auth/*`) — üye kayıt/giriş/profil, Google OAuth.
- `src/routes/leads.js` (`/ajax/send*Form`, `/ajax/askme`) — eski formların lead'e dönüşümü + mail.
- `src/routes/legacy-catalog.js`, `legacy-product-detail.js`, `legacy-filters.js` — legacy modda DB destekli sayfalar; `src/services/legacy-*.js` HTML'i cheerio/regex ile dönüştürür.
- `src/middleware/` — `legacy-redirects.js` (170+ eski URL → 301, SEO-kritik), `rate-limit.js` (DB destekli), `public-csrf.js`, `form-protection.js`, `legacy-product-visibility.js`, `legacy-whatsapp.js` (`enhanceLegacyHtml` zinciri: statik HTML'e DB verisi işleme).
- `src/services/registration-pii.js` — kayıt PII'si şifrelenir (`REGISTRATION_PII_*` env, **`.env.example`'da yok** — bkz. PROJECT_STATE riskler).
- `prisma/schema.prisma` — 26 model, 10 enum; `prisma/migrations/` 29 migration (sonuncu `20260804120000_normalize_draft_variant_links`).
- `scripts/` — test-*.js (unit), *-browser-smoke.js (CDP/tarayıcı), audit-*/backfill-*/migrate-*/import-* (DB'ye dokunan operasyonel scriptler — **production'da yalnızca Mimar çalıştırır**).
- `nginx_redirects.conf`, `nginx_paytr_callback.conf` — sunucuda Nginx'e include edilir.
- `uploads/` — medya; `uploads/admin/` gitignore'da; sunucuda `shared/uploads` kalıcı olmalı.
- Repoda gereksiz/eski dosyalar var: `local_server.js`, `test_output.html`, `2026.07.30.13.50.44/` (SEO audit CSV'leri), `ınternal_all.csv`, `Captcha`, `ajax_*.txt`, `analyze_csv.ps1`. **Dokunma, silme — Mimar karar verecek** (PROJECT_STATE backlog).

## 6. Katı kurallar (çiğnenemez)
1. `.env`, `.env.*` (yalnızca `.env.example` hariç), `*.pem`, `*.key`, `*.dump`, `backup*.sql` — **okunmaz, yazılmaz, `cat`/`grep` edilmez**. Değer gerekiyorsa Mimar'a adım adım talimat verilir.
2. Çember yöntemi: bir iş çemberi %100 yeşil bitmeden yenisine geçilmez; bir çemberin kapanması başka hata açmamalıdır (bkz. `workflow.md`).
3. **>3 dosya veya >100 satır** değişiklik = önce yazılı plan, Mimar onayı, sonra test-first, sonra implementasyon.
4. Yalnızca istenen değiştirilir. Komşu kod "iyileştirilmez", adlar değiştirilmez, dosya yeniden biçimlendirilmez.
5. Yeni bağımlılık, altyapı değişikliği, migration, Nginx/env değişikliği → Mimar onayı.
6. `git commit`/`push`/`pull` **Mimar'ın kendisi yapar**. Sen yalnızca adımları yazarsın. Sunucuya asla sen deploy etmezsin.
7. Tahmin yok: API/kütüphane/dosya hakkında konuşmadan önce dosyayı aç, oku, `dosya:satır` göster. Bulamadıysan "kontrol ettim, bulamadım" de. Halüsinasyon riski hissettiğinde **dur ve Mimar'a söyle**.
8. Production'a dokunan scriptler (`migrate-*`, `backfill-*`, `import-*`, `--apply`), `prisma migrate dev`, `npm run seed` — production'da yasaktır; yalnızca Mimar, yalnızca yedekten sonra.
9. Legacy URL'ler ve `nginx_redirects.conf`/`legacy-redirects.js` SEO-kritiktir: URL/slug/canonical değiştiren her işte 301 haritası ve `sitemap.xml` kontrol edilir.
10. Testler yeşil olmadan "bitti" denmez; test kırmızıysa çıktısıyla birlikte raporlanır.

## 7. Her iş bittiğinde teslim paketi (Mimar'a verilir)
Değişen dosya listesi · test sonuçları (komut + çıktı) · `git status/add/commit/push/log` adımları · sunucuda `git pull` + restart adımları · **manuel canlı test rehberi** (URL, adım, beklenen sonuç) · rollback adımı · `PROJECT_STATE.md` güncellemesi. Şablon: `.claude/rules/workflow.md` §Teslim.
