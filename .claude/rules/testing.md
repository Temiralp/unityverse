# Test kuralları — her oturumda yüklenir

## Mevcut altyapı (framework yok)
- Her test = bağımsız Node scripti `scripts/test-<konu>.js`; `assert/strict` kullanır; başarısızlık = exception → exit 1; başarı = sessiz çıkış veya `console.log('... OK')`.
- `package.json` → `"test:<ad>": "node scripts/test-<ad>.js"` alias'ı eklenir (mevcut listeyi izle).
- Prisma gerçek DB ile değil, **fake nesne** ile değiştirilir (örnek: `scripts/test-rate-limit.js` `fakePrisma`, `scripts/test-admin-members.js`). Service fonksiyonları prisma'yı parametre olarak alır.
- Bazı testler **dosya içeriğini** okuyup `assert.match` ile route/view'ın gerekli parçayı içerdiğini doğrular (EJS/statik HTML için kabul edilen yöntem). Statik HTML fixture'ı olarak gerçek `urun/<slug>/index.html` dosyaları kullanılabilir (örnek: `scripts/test-legacy-product-image.js`).
- Tarayıcı smoke testleri `scripts/*-browser-smoke.js` — Chrome CDP (`*_DEBUG_PORT`) + çalışan sunucu (`*_BASE_URL`) gerektirir. Yalnızca Mimar isteyince çalıştırılır.

## Üç kategori
| Kategori | Gereklilik | Örnek | Kim çalıştırır |
|---|---|---|---|
| Unit (DB'siz) | hiçbir şey | `test-rate-limit`, `test-admin-members`, `test-course-duration`, `test-registration-pii`, `test-member-registration`, `test-legacy-member-import`, `test-product-variants`, `test-blog-categories`, `test-bank-transfer-discount`, `test-registration-visibility`, `test-social-oauth`, `test-profile-completion`, `test-legacy-product-image` | Sen, her çemberde |
| Sunucu/DB | `npm run dev` + PostgreSQL + `.env` | `test-enrollment`, `test-paytr-token`, `test-paytr-callback`, `catalog-admin-sync-smoke` | Mimar yerelde / staging |
| Tarayıcı | Chrome `--remote-debugging-port` | `csp-browser-smoke`, `enrollment-frontend-browser-smoke`, `paytr-iframe-browser-smoke` | Mimar |

Baseline (2026-09-15): yukarıdaki unit testler **PASS** (`node scripts/<ad>.js`).

## Her çemberde zorunlu
1. Yeni davranış için **önce** test scripti (veya mevcuda case) yazılır → kırmızı çıktı gösterilir.
2. Implementasyon → yeşil çıktı gösterilir.
3. Regresyon: değişen service/route'a dokunan tüm `test-*.js` (grep ile bul: `grep -l "<service-adı>" scripts/test-*.js`) + unit baseline → hepsi PASS.
4. Sonuçlar teslim paketinde komut + PASS/FAIL ile yazılır. Uydurma sonuç yazmak yasaktır — çalıştırmadıysan "çalıştırılmadı" yaz.
5. Yerel HTTP e2e mümkünse (Docker PostgreSQL ayakta): `PORT=8765 node src/server.js` ile ayrı portta kaldır, `curl` ile doğrula, DB'de geçici değişiklik yaptıysan **aynı değerle geri al** ve sayfanın önceki haliyle bayt-bayt eşleştiğini `cmp` ile göster.

## Toplu çalıştırma (macOS, `timeout` yok)
```bash
for s in test-rate-limit test-admin-members test-course-duration test-registration-pii \
  test-member-registration test-legacy-member-import test-product-variants test-blog-categories \
  test-bank-transfer-discount test-registration-visibility test-social-oauth test-profile-completion \
  test-legacy-product-image; do
  node scripts/$s.js >/dev/null 2>&1 && echo "PASS $s" || echo "FAIL $s"; done
```

## Manuel canlı test rehberi (her teslimde)
Biçim: `N. URL → hareket → beklenen sonuç`. Minimum kapsam: değişen sayfa(lar) masaüstü+mobil, admin tarafı (varsa), 1 olumsuz durum (hatalı giriş), SEO-kritik değişiklikte `curl -I` ile durum/redirect. `PRODUCTION_CHECKLIST.md` §8-9 tam listedir.
