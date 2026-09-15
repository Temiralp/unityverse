# PROJECT_STATE.md — canlı durum günlüğü

> Her çember (circle) bittiğinde güncellenir. Yeni oturum/agent buradan başlar. Tarihler mutlak (YYYY-MM-DD).
> Son güncelleme: **2026-09-15** — Çember #2 tamamlandı (kategori sayfalarında kurs araması).

## Nerede kaldık
- Kod: `main` @ `37623c38` (2026-09-15, Çember #1 commit'i; #0 = `dd2402d8`) + **commit bekleyen** Çember #1b (belgeler TR) ve #2 (kategori araması) değişiklikleri.
- **Aktif çember:** yok. Çember #2 teslim paketi Mimar'a verildi; commit/push/deploy ve canlı test Mimar'da.
- Yerelde `uploads/products/1789467*.jpg` (3 dosya, 2026-09-15 yerel admin testi) izlenmiyor — commit'e eklenmemeli.
- Sonraki çemberi Mimar seçer (Backlog).

## Sunucu (Google Cloud) — ONAY BEKLİYOR
Repoda "gcloud"/"Compute Engine" izi yok; `DEPLOYMENT.md` genel Ubuntu + Nginx + PM2 + PostgreSQL 16 şemasını anlatır. Mimar'dan onaylanacak:
- [ ] Sunucudaki uygulama klasörü (ör. `/var/www/unityverse/current` mi, doğrudan clone mu?)
- [ ] Process manager: PM2 (`pm2 restart unityverse`) / systemd / docker?
- [ ] Deploy yöntemi: doğrudan `main`'den `git pull` mı? (DEPLOYMENT.md release/symlink önerir, gerçek yöntem bilinmiyor)
- [ ] PostgreSQL: VM'de yerel mi / Cloud SQL mi?
- [ ] `uploads/` kalıcı yeri ve yedek cron'u var mı?
Onaylanana kadar teslim paketlerinde sunucu adımları "DEPLOYMENT.md §12'ye uygun" varsayımıyla yazılır ve bu not düşülür.

## Açık riskler (öncelik sırasıyla)
| # | Risk | Kanıt | Öneri | Durum |
|---|---|---|---|---|
| R1 | SMTP parolası `local_server.js:14`'te açık metin, dosya git'te | Mimar 2026-09-15: **parola döndürüldü, eski değer artık geçersiz** | Kalan iş: dosyayı repodan çıkarmak (`git rm local_server.js`) — R5 temizliğiyle birlikte yapılabilir | Azaltıldı (düşük) |
| R2 | `REGISTRATION_PII_ENCRYPTION_KEYS`, `REGISTRATION_PII_ACTIVE_KEY_ID`, `WHATSAPP_PHONE`, `BLOG_BASE_URL`, `LEGACY_ENROLLMENT_STRICT_PRODUCT_MATCH` kodda kullanılıyor, **`.env.example`'da yok** | `src/services/registration-pii.js:35-36` vb. | `.env.example`'a anahtar+açıklama ekle (değersiz) — küçük çember | Backlog |
| R3 | `src/routes/admin.js` 4122 satır, 72 route — değişiklik riski yüksek | dosya boyutu | Refactor **yapma**; yeni mantık services'e. Büyük refactor yalnızca ayrı planla | Kabul edildi |
| R4 | `npm test` yok, testler elle seçiliyor → regresyon kaçabilir | `package.json` | Küçük çember: `scripts/run-unit-tests.js` + `npm test` (bağımlılık gerekmez) | Backlog |
| R5 | Repoda gereksiz izlenen dosyalar (`2026.07.30.13.50.44/` 433 CSV, `test_output.html`, `ınternal_all.csv`, `Captcha`, `ajax_*.txt`, `analyze_csv.ps1`, `download_missing.py`) | `git ls-files` | Silme/`.gitignore` — Mimar kararı | Backlog |
| R6 | `docker-compose.yml` varsayılan `postgres/postgres` — yalnızca yerel | dosya | Production'da kullanılmıyor (onaylanmalı) | Bilgi |
| R7 | `BACKEND_SETUP.md` varsayılan admin `ChangeMe123!` — production'da değiştirildi mi? | `prisma/seed.js` fallback | Mimar onaylasın | Soru |
| R9 | `scripts/test-price-visibility-language.js` HEAD'de kırık: `unityverse.css`'de "Fiyatı görmek için giriş yapın" metni yok (commit `9cd9d90d`, 2026-08-07'de temizlik sırasında silinmiş olabilir) | test çıktısı 2026-09-15 | Test mi güncellenecek, CSS mi geri gelecek — Mimar kararı; küçük çember | Backlog |
| R8 | Ana kurs görseli değiştirilen üründe statik sayfadaki çoklu galeri (9 sayfa) tek görsele iner | Çember #1 tasarım kararı | Admin tek görsel yönetir; kabul edilen davranış | Kabul edildi |

## Backlog (Mimar sıralar)
- [ ] R1 — `local_server.js` dosyasını repodan çıkar (parola zaten döndürüldü; düşük)
- [ ] R2 — `.env.example` tamamlama (docs, küçük)
- [ ] R4 — `npm test` toplu unit runner (test altyapısı, küçük)
- [ ] R5 — gereksiz dosyaların repodan çıkarılması (chore)
- [ ] R9 — `test-price-visibility-language` kırık test kararı (test vs CSS)
- [ ] Sunucu bilgilerinin bu dosyaya yazılması (§Sunucu)
- [ ] `PRODUCTION_CHECKLIST.md` §1 "kritik yeni dosyalar" maddesi eski (dosyalar zaten commit'te) — güncellenmeli

## Yapılmaması gerekenler (git geçmişinden öğrenilen dersler)
- Dinamik/statik route modunu değiştirmek SEO'yu bozdu (`5287f615`, `85147477`, `202d63de` revert'leri). `LEGACY_FRONTEND_MODE` ve route sırası değişikliği = yüksek risk, ayrı plan.
- `clear-site-data` ile 301 önbellek kırma denemesi revert edildi (`9afe7b57`). Tekrarlama.
- Varyant sayfalarının canonical'ı ana ürüne yönelmeli (`2cb9fa14`) — kurs/varyant işinde koru.
- Cache-busting: CSS/JS değişince HTML'lerdeki `?v=` parametresi güncellenir (`bcc0911a`), aksi halde kullanıcılar eski dosyayı görür.
- Kategori sayfaları (`/kategori/:slug`) statik şablon + DB grid'dir (`legacy-catalog.js:633`); sayfaya yeni UI eklemek için 21 dosyayı değil, route'taki `ensureLegacy*` servis zincirini kullan.
- Statik kurs sayfası (`urun/<slug>/index.html`) varsa dinamik route çalışmaz; DB→sayfa senkronu `enhanceLegacyHtml` zincirine eklenir (`src/middleware/legacy-whatsapp.js`). Yeni bir alan senkronlanacaksa aynı desen: visibility middleware `res.locals` → `enhanceLegacyHtml` parametresi → `src/services/legacy-*.js` saf fonksiyon.

## Karar günlüğü (ADR-mini)
| Tarih | Karar | Gerekçe |
|---|---|---|
| 2026-09-15 | CLAUDE.md bölünmüş yapı: kök CLAUDE.md + `.claude/rules/{workflow,security,testing}.md` + `PROJECT_STATE.md` (@import) | Resmi doküman 200 satır sınırı önerir; kurallar ve durum ayrı güncellenir |
| 2026-09-15 | Çember yöntemi, >3 dosya/>100 satır için plan+onay, TDD zorunlu | Mimar'ın çalışma kuralı |
| 2026-09-15 | Git/deploy işlemlerini yalnızca Mimar yürütür | Mimar'ın çalışma kuralı |
| 2026-09-15 | Dil: sohbet AZ, kod yorumu ve .md TR, commit EN/TR | Mimar'ın kuralı |
| 2026-09-15 | Kurs görseli için DB tek doğruluk kaynağı; statik detay sayfasında görsel DB ile aynıysa HTML'e dokunulmaz, farklıysa slider tek slayt olarak yeniden yazılır; og:image/itemprop/JSON-LD/paylaşım linki de güncellenir | 431/431 statik sayfa bugün DB ile aynı → sıfır görsel regresyon; liste sayfası zaten DB'den |
| 2026-09-15 | Kategori araması statik 21 dosyaya değil, `/kategori/:slug` route'unda sunucu tarafı enjeksiyonla (`ensureLegacyCategorySearch`) eklenir; paginasyon /tum-urunler/ gibi 12/sayfa görünür yapılır; kategori h1'i görünür kalır | Tek doğruluk kaynağı, yeni şablonlar otomatik kapsanır, statik dosyalara dokunulmaz; Mimar paginasyon tutarlılığını seçti |
| 2026-09-15 | "Görseli Kaldır" = DB referansını boşaltır, fiziksel dosya silinmez; kayıt "Güncelle" ile | id 208 ve 209 aynı dosyayı paylaşıyor → fiziksel silme başka kursu bozar; yeni route/migration yok |

## Çember geçmişi
| # | Tarih | Çember | Sonuç |
|---|---|---|---|
| 0 | 2026-09-15 | Proje araştırması + CLAUDE.md sistemi | 5 doküman; 12 unit test baseline PASS; R1 güvenlik bulgusu |
| 1b | 2026-09-15 | Belgeler Türkçeye çevrildi (`CLAUDE.md`, `.claude/rules/*`) | 4 dosya, kod değişikliği yok |
| 2 | 2026-09-15 | Kategori sayfalarında kurs araması (21 sayfa) | 6 dosya (+2 yeni), ~200 satır (95'i test); yeni test + 22 regresyon PASS; 21/21 kategori HTTP e2e; R9 önceden kırık test tespit edildi |
| 1 | 2026-09-15 | Kurs görseli: statik detay senkronu + admin "Görseli Kaldır" + tam boyut linki | 9 dosya (+2 yeni), ~220 satır (119'u test); yeni test + 23 regresyon = 24/24 PASS; yerel HTTP e2e doğrulandı; `test-legacy-product-visibility` (2cb9fa14'ten beri kırık) onarıldı |
