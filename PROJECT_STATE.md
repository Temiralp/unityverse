# PROJECT_STATE.md — canlı vəziyyət jurnalı

> Hər dairə bitəndə yenilənir. Yeni sessiya/agent buradan başlayır. Tarixlər mütləq (YYYY-MM-DD).
> Son yeniləmə: **2026-09-15** — CLAUDE.md sistemi quruldu (dairə #0).

## Harda qalmışıq
- Kod: `main` @ `e85d36fa` (2026-08-26, "fix: show full blog images and open dynamic details"). Working tree təmiz.
- Son işlənən sahələr (git log 2026-08-10…26): legacy üzv importu (`import-legacy-members`), admin üzv idarəsi, qeydiyyat/kurs qiymət axını, blog şəkilləri, responsive navbar, Google OAuth yönləndirməsi.
- **Aktiv dairə:** yoxdur. Növbəti dairəni Arxitekt seçir (Backlog-a bax).

## Server (Google Cloud) — TƏSDİQ GÖZLƏYİR
Repo-da "gcloud"/"Compute Engine" izi yoxdur; `DEPLOYMENT.md` ümumi Ubuntu + Nginx + PM2 + PostgreSQL 16 sxemini təsvir edir. Arxitektdən təsdiqlənməli:
- [ ] App qovluğu serverdə (məs. `/var/www/unityverse/current` və ya birbaşa clone?)
- [ ] Process manager: PM2 (`pm2 restart unityverse`) / systemd / docker?
- [ ] Deploy üsulu: `git pull` birbaşa `main`-dən? (DEPLOYMENT.md release/symlink təklif edir, real üsul bilinmir)
- [ ] PostgreSQL: VM-də lokal / Cloud SQL?
- [ ] `uploads/` persistent yeri və backup cron mövcuddurmu?
Təsdiqlənənə qədər təhvil paketlərində server addımları "DEPLOYMENT.md §12-yə uyğun" fərziyyəsi ilə yazılır və bu qeyd olunur.

## Açıq risklər (prioritetlə)
| # | Risk | Sübut | Təklif | Status |
|---|---|---|---|---|
| R1 | **Açıq SMTP parolu git-də** | `local_server.js:14` `pass:` sahəsi, fayl git-də izlənir, heç yerdən `require` olunmur | Yandex-də parolu dəyiş → `git rm local_server.js` → `.gitignore`-a əlavə. Tarixçədən silmək istənirsə `git filter-repo` (ayrı qərar) | Arxitekt qərarı gözləyir |
| R2 | `REGISTRATION_PII_ENCRYPTION_KEYS`, `REGISTRATION_PII_ACTIVE_KEY_ID`, `WHATSAPP_PHONE`, `BLOG_BASE_URL`, `LEGACY_ENROLLMENT_STRICT_PRODUCT_MATCH` kodda istifadə olunur, **`.env.example`-da yoxdur** | `src/services/registration-pii.js:35-36` və s. | `.env.example`-a açar+şərh əlavə et (dəyərsiz) — kiçik dairə | Backlog |
| R3 | `src/routes/admin.js` 4122 sətir, 72 route — dəyişiklik riski yüksək | fayl ölçüsü | Refactor **etmə**; yeni məntiq services-ə. Böyük refactor yalnız ayrıca plan ilə | Qəbul edilmiş |
| R4 | `npm test` yoxdur, testlər əl ilə seçilir → regressiya qaçırıla bilər | `package.json` | Kiçik dairə: `scripts/run-unit-tests.js` + `npm test` alias (12 unit test). Dependency tələb etmir | Backlog |
| R5 | Repo-da lazımsız izlənən fayllar (`2026.07.30.13.50.44/` 433 CSV, `test_output.html` 241KB, `ınternal_all.csv` 383KB, `Captcha`, `ajax_*.txt`, `analyze_csv.ps1`, `download_missing.py`) | `git ls-files` | Silmə/`.gitignore` — Arxitekt qərarı | Backlog |
| R6 | `docker-compose.yml` default `postgres/postgres` — yalnız lokal üçün | fayl | Production-da istifadə edilmir (təsdiqlənməli) | Məlumat |
| R7 | `BACKEND_SETUP.md` default admin `ChangeMe123!` sənəddə — production-da dəyişdirilib? | `prisma/seed.js` fallback | Arxitekt təsdiq etsin | Sual |

## Backlog (Arxitekt sıralayır)
- [ ] R1 — `local_server.js` sirr təmizliyi (təhlükəsizlik, yüksək)
- [ ] R2 — `.env.example` tamamlanması (docs, kiçik)
- [ ] R4 — `npm test` toplu unit runner (test infrastrukturu, kiçik)
- [ ] R5 — lazımsız faylların repo-dan çıxarılması (chore)
- [ ] Server məlumatlarının bu fayla yazılması (§Server)
- [ ] `PRODUCTION_CHECKLIST.md` §1 "kritik yeni fayllar" bəndi köhnəlib (fayllar artıq commit-dədir) — yenilənməli

## Etməməli (öyrənilmiş dərslər — git tarixçəsindən)
- Dinamik/statik route rejimini dəyişmək SEO-nu pozub (commit `5287f615`, `85147477`, `202d63de` revert-lər). `LEGACY_FRONTEND_MODE` və route sırası dəyişikliyi = yüksək risk, ayrıca plan.
- `clear-site-data` ilə 301 keş sındırma cəhdi revert olunub (`9afe7b57`). Təkrar etmə.
- Varyant səhifələrinin canonical-ı ana məhsula yönəlməlidir (`2cb9fa14`) — kurs/varyant işində qoru.
- Cache-busting: CSS/JS dəyişəndə HTML-lərdəki `?v=` parametri yenilənir (`bcc0911a`), əks halda istifadəçilər köhnə faylı görür.

## Qərar jurnalı (ADR-mini)
| Tarix | Qərar | Səbəb |
|---|---|---|
| 2026-09-15 | CLAUDE.md bölünmüş struktur: kök CLAUDE.md + `.claude/rules/{workflow,security,testing}.md` + `PROJECT_STATE.md` (@import) | Rəsmi sənəd 200 sətir limitini tövsiyə edir; qaydalar və vəziyyət ayrı yenilənir |
| 2026-09-15 | Dairə metodu, >3 fayl/>100 sətir üçün plan+təsdiq, TDD məcburi | Arxitektin iş qaydası |
| 2026-09-15 | Git/deploy əməliyyatlarını yalnız Arxitekt icra edir | Arxitektin iş qaydası |

## Dairə tarixçəsi
| # | Tarix | Dairə | Nəticə |
|---|---|---|---|
| 0 | 2026-09-15 | Layihə araşdırması + CLAUDE.md sistemi | 5 sənəd faylı yazıldı; 12 unit test baseline PASS; R1 təhlükəsizlik tapıntısı |
