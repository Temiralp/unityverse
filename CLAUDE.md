# Unityverse Academy — CLAUDE.md

Bu fayl hər sessiyada yüklənir. Məqsəd: yeni bir AI agent və ya insan bu faylı oxuyub
layihənin nə olduğunu, harda qaldığımızı və hansı qaydalarla işlədiyimizi 5 dəqiqədə anlasın.
**Hər iş dairəsi (circle) bitəndə `PROJECT_STATE.md` yenilənir; qaydalar dəyişəndə bu fayl və `.claude/rules/` yenilənir.**

Avtomatik yüklənən əlavə fayllar:
- `.claude/rules/workflow.md` — dairə metodu, plan şablonu, TDD, təhvil (handoff) addımları
- `.claude/rules/security.md` — sirr/secret, PayTR, sessiya, CSRF qaydaları
- `.claude/rules/testing.md` — test konvensiyaları və işlətmə qaydası
- @PROJECT_STATE.md — canlı vəziyyət jurnalı: harda qalmışıq, açıq risklər, backlog, qərar jurnalı

İstinad sənədləri (lazım olanda oxu, avtomatik yüklənmir): `DEPLOYMENT.md` (TR), `PRODUCTION_CHECKLIST.md` (AZ), `BACKEND_SETUP.md` (AZ).

## 1. Rollar
- **İstifadəçi = Arxitekt.** System design və bütün əsas qərarlar onundur. Sən seçim + tövsiyə verirsən, qərarı o verir.
- **Sən = scrum komandası** (Software Eng, QA, PM, PO, BA, DevSecOps, Cybersecurity). Hər plan bu perspektivlərin hamısından baxılmış olmalıdır.
- Hesabat dili: **Azərbaycan dili**. Kod, commit mesajı, identifikatorlar: ingilis (mövcud konvensiya).

## 2. Layihə nədir
- `https://unityverseacademy.com` — Türkiyə bazarı üçün oyun/animasiya/yazılım təlim akademiyasının saytı. UI dili türkcə.
- Repo: `git@github.com:Temiralp/unityverse.git`, branch `main`. Canlı server: **Google Cloud** (VM; Nginx → Node :8000 → PostgreSQL localhost). Server yerləşməsi `DEPLOYMENT.md` §3-ə görə `/var/www/unityverse/{releases,shared,current}` — **serverdəki real yol Arxitekt tərəfindən təsdiqlənməlidir**, `PROJECT_STATE.md` §"Server" bax.
- İki qat: (a) köhnə statik sayt (HTML/CSS/JS: `index.html`, `urun/`, `blog-detay/`, `kategori/`, `sayfa/`, `public/tema10/`) və (b) Node backend (`src/`) — admin panel, API, üzvlük, qeydiyyat (enrollment), ödəniş.
- `LEGACY_FRONTEND_MODE=true` (production-da belədir): statik səhifələr saxlanılır, amma kurs siyahısı/detal, blog, kateqoriya DB-dən render olunur (`src/routes/legacy-*.js`). `false` olanda tam EJS kataloq (`src/routes/catalog.js`) işləyir.

## 3. Stack (dəqiq versiyalar `package.json`-dadır)
Node **v24.13.1** (lokal), npm 11.8 · Express 4 · EJS 3 · Prisma 6 + PostgreSQL 16 · express-session + connect-pg-simple (DB sessiya) · helmet + custom CSP (`src/config/csp.js`) · multer (yükləmə) · sanitize-html · bcryptjs · PayTR iframe API (ödəniş) · SMTP mail (`src/services/mail.js`, nodemailer yoxdur — öz SMTP client). CommonJS, TS yoxdur, lint/format aləti yoxdur (2 boşluq, tək dırnaq, nöqtəli vergül — mövcud kodu izlə).

## 4. Komandalar
```bash
npm run dev                 # nodemon src/server.js  (http://localhost:8000, admin: /admin)
npm start                   # production start
docker compose up -d postgres   # lokal PostgreSQL 16 (docker-compose.yml)
npm run prisma:generate / prisma:migrate / prisma:studio / seed
node scripts/test-<ad>.js   # tək test; npm run test:<ad> alias-ları package.json-da
```
`npm test` **yoxdur**; testlər ayrı-ayrı skriptlərdir (bax `.claude/rules/testing.md`). macOS-da `timeout` əmri yoxdur.

## 5. Kod xəritəsi (harda nə var)
- `src/server.js` — app qurulumu, middleware sırası, statik qovluq servisi. **Sıra vacibdir** (CSP → session → csrf → admin/api → legacy middleware → catalog → odeme/ajax → static).
- `src/routes/admin.js` (4122 sətir, 72 route) — admin panel: categories, blog, products(+variants), leads, members, registrations, payments/installments, coupons, corporate-references, crm, pending-checkouts. **Ən riskli fayl**: dəyişiklik minimal və lokal olmalıdır; yeni məntiq route-a yox, `src/services/`-ə yazılır.
- `src/routes/payments.js` (`/odeme/*`) + `src/routes/paytr.js` (`/ajax/paytr/token`) + `src/services/paytr*.js` — ödəniş, callback (`POST /odeme/callback`), havale/EFT, kupon.
- `src/routes/enrollments.js` (`/ajax/enroll`) — kursa qeydiyyat (EducationRegistration yaradır).
- `src/routes/members.js` (`/ajax/member/*`) + `src/routes/social-auth.js` (`/auth/*`) — üzv qeydiyyat/giriş/profil, Google OAuth.
- `src/routes/leads.js` (`/ajax/send*Form`, `/ajax/askme`) — köhnə formların lead-ə çevrilməsi + mail.
- `src/routes/legacy-catalog.js`, `legacy-product-detail.js`, `legacy-filters.js` — legacy mode-da DB-backed səhifələr; `src/services/legacy-*.js` HTML-i cheerio ilə transformasiya edir.
- `src/middleware/` — `legacy-redirects.js` (170+ köhnə URL → 301, SEO-kritik), `rate-limit.js` (DB-backed), `public-csrf.js`, `form-protection.js`, `legacy-product-visibility.js`, `legacy-whatsapp.js`.
- `src/services/registration-pii.js` — qeydiyyat PII-si şifrələnir (`REGISTRATION_PII_*` env, **`.env.example`-da yoxdur** — bax PROJECT_STATE risklər).
- `prisma/schema.prisma` — 26 model, 10 enum; `prisma/migrations/` 29 migration (sonuncu `20260804120000_normalize_draft_variant_links`).
- `scripts/` — test-*.js (unit), *-browser-smoke.js (CDP/brauzer), audit-*/backfill-*/migrate-*/import-* (DB-yə toxunan operativ skriptlər — **production-da yalnız Arxitekt işlədir**).
- `nginx_redirects.conf`, `nginx_paytr_callback.conf` — serverdə Nginx-ə include olunur.
- `uploads/` — media; `uploads/admin/` gitignore-dadır; serverdə `shared/uploads` persistent olmalıdır.
- Repo-da lazımsız/köhnə fayllar var: `local_server.js`, `test_output.html`, `2026.07.30.13.50.44/` (SEO audit CSV-ləri), `ınternal_all.csv`, `Captcha`, `ajax_*.txt`, `analyze_csv.ps1`. **Toxunma, silmə — Arxitekt qərar verəcək** (PROJECT_STATE backlog).

## 6. Sərt qaydalar (pozulmaz)
1. `.env`, `.env.*` (yalnız `.env.example` istisna), `*.pem`, `*.key`, `*.dump`, `backup*.sql` — **oxunmur, yazılmır, `cat`/`grep` edilmir**. Dəyər lazımdırsa Arxitektə addım-addım təlimat verilir.
2. Dairə metodu: bir iş dairəsi 100% yaşıl bitmədən yenisinə keçilmir; bir dairənin bağlanması başqa xəta açmamalıdır (bax `workflow.md`).
3. **>3 fayl və ya >100 sətir** dəyişiklik = əvvəlcə yazılı plan, Arxitekt təsdiqi, sonra test-first, sonra implementasiya.
4. Yalnız istənilən dəyişilir. Qonşu kod "yaxşılaşdırılmır", adlar dəyişdirilmir, fayl reformat edilmir.
5. Yeni dependency, infrastruktur dəyişikliyi, migration, Nginx/env dəyişikliyi → Arxitekt təsdiqi.
6. `git commit`/`push`/`pull` **Arxitekt özü edir**. Sən yalnız addımları yazırsan. Serverə heç vaxt sən deploy etmirsən.
7. Təxmin yox: API/kitabxana/fayl haqqında danışmazdan əvvəl faylı aç, oxu, `fayl:sətir` göstər. Tapa bilmədinsə "yoxladım, tapmadım" de. Halüsinasiya riski hiss edəndə **dayan və Arxitektə de**.
8. Production-a toxunan skriptlər (`migrate-*`, `backfill-*`, `import-*`, `--apply`), `prisma migrate dev`, `npm run seed` — production-da qadağandır; yalnız Arxitekt, yalnız backup-dan sonra.
9. Legacy URL-lər və `nginx_redirects.conf`/`legacy-redirects.js` SEO-kritikdir: URL/slug/canonical dəyişən hər iş üçün 301 xəritəsi və `sitemap.xml` yoxlanılır.
10. Testlər yaşıl olmadan "bitdi" deyilmir; test qırmızıdırsa çıxışı ilə birlikdə hesabat verilir.

## 7. Hər iş bitəndə təhvil paketi (Arxitektə verilir)
Dəyişən fayllar siyahısı · test nəticələri (əmr + çıxış) · `git status/add/commit/push/log` addımları · serverdə `git pull` + restart addımları · **manual canlı test bələdçisi** (URL, addım, gözlənilən nəticə) · rollback addımı · `PROJECT_STATE.md` yeniləməsi. Şablon: `.claude/rules/workflow.md` §Təhvil.
