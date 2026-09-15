# Test konvensiyaları — hər sessiyada yüklənir

## Mövcud infrastruktur (framework yoxdur)
- Hər test = müstəqil Node skripti `scripts/test-<mövzu>.js`; `assert/strict` istifadə edir; uğursuzluq = exception → exit 1; uğur = sakit çıxış və ya `console.log('... OK')`.
- `package.json` → `"test:<ad>": "node scripts/test-<ad>.js"` alias əlavə olunur (mövcud siyahını izlə).
- Prisma real DB ilə deyil, **fake obyekt** ilə əvəz olunur (nümunə: `scripts/test-rate-limit.js` `fakePrisma`, `scripts/test-admin-members.js`). Service funksiyaları prisma-nı parametr olaraq alır.
- Bəzi testlər **fayl məzmununu** oxuyub `assert.match` ilə route/view-un tələb olunan hissəni ehtiva etdiyini yoxlayır (EJS/statik HTML üçün qəbul olunmuş üsul).
- Brauzer smoke testləri `scripts/*-browser-smoke.js` — Chrome CDP (`*_DEBUG_PORT`) + işləyən server (`*_BASE_URL`) tələb edir. Yalnız Arxitekt tələb edəndə işlədilir.

## Üç kateqoriya
| Kateqoriya | Tələb | Nümunə | Kim işlədir |
|---|---|---|---|
| Unit (DB-siz) | heç nə | `test-rate-limit`, `test-admin-members`, `test-course-duration`, `test-registration-pii`, `test-member-registration`, `test-legacy-member-import`, `test-product-variants`, `test-blog-categories`, `test-bank-transfer-discount`, `test-registration-visibility`, `test-social-oauth`, `test-profile-completion` | Sən, hər dairədə |
| Server/DB | `npm run dev` + PostgreSQL + `.env` | `test-enrollment`, `test-paytr-token`, `test-paytr-callback`, `catalog-admin-sync-smoke` | Arxitekt lokalda / staging |
| Brauzer | Chrome `--remote-debugging-port` | `csp-browser-smoke`, `enrollment-frontend-browser-smoke`, `paytr-iframe-browser-smoke` | Arxitekt |

Baseline (2026-09-15): yuxarıdakı 12 unit test **12/12 PASS** (`node scripts/<ad>.js`).

## Hər dairədə məcburi
1. Yeni davranış üçün **əvvəlcə** test skripti (və ya mövcuda case) yazılır → qırmızı çıxış göstərilir.
2. Implementasiya → yaşıl çıxış göstərilir.
3. Regressiya: dəyişən service/route-a toxunan bütün `test-*.js` (grep ilə tap: `grep -l "<service-adı>" scripts/test-*.js`) + 12 unit test baseline → hamısı PASS.
4. Nəticələr təhvil paketində əmr + PASS/FAIL ilə yazılır. Uydurma nəticə yazmaq qadağandır — işlətmədinsə "işlədilmədi" yaz.

## Toplu işlətmə (macOS, `timeout` yoxdur)
```bash
for s in test-rate-limit test-admin-members test-course-duration test-registration-pii \
  test-member-registration test-legacy-member-import test-product-variants test-blog-categories \
  test-bank-transfer-discount test-registration-visibility test-social-oauth test-profile-completion; do
  node scripts/$s.js >/dev/null 2>&1 && echo "PASS $s" || echo "FAIL $s"; done
```

## Manual canlı test bələdçisi (hər təhvildə)
Format: `N. URL → hərəkət → gözlənilən nəticə`. Minimum əhatə: dəyişən səhifə(lər) desktop+mobil, admin tərəfi (varsa), 1 mənfi hal (səhv giriş), SEO-kritik dəyişiklikdə `curl -I` ilə status/redirect. `PRODUCTION_CHECKLIST.md` §8-9 tam siyahıdır.
