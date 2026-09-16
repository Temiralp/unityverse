# PROJECT_STATE.md — canlı durum günlüğü

> Her çember (circle) bittiğinde güncellenir. Yeni oturum/agent buradan başlar. Tarihler mutlak (YYYY-MM-DD).
> Son güncelleme: **2026-09-16** — Çember #8a (docx → kurs tab içeriği çevirici nüvesi, CLI önizleme, Word şablonu) tamamlandı; 8b (admin UI) sırada.

## Nerede kaldık
- Kod: `main` — Çember #0…#7 Mimar tarafından commit/deploy edildi ve canlıda doğrulandı (2026-09-15/16).
- **Aktif çember:** yok. **Commit bekleyen:** Çember #8a (+ `mammoth` bağımlılığı → sunucuda `npm ci --omit=dev` gerekir). Sıradaki: 8b (admin UI: "Word'den içe aktar" → önizleme → editöre yerleştir).
- Gerçek örnek docx repo dışında: `~/unityverse-private-fixtures/Siber_Guvenlik_Mufredati_AI_Guncellemesi.docx` (WhatsApp tmp klasöründen kopyalandı).
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
| R10 | Dinamik kurs sayfalarında Python şablonundan miras meta'lar ve JSON-LD | Çember #5 ile kapatıldı: tablo güdümlü `pageMetaTags` + `product-structured-data.js` | — | Kapatıldı |
| R11 | `public/tema10/js/filters.js` `legacyFilterFallbackPayload()` içinde sabit kategori sayıları (23, 76…) — yalnızca Vue yokken/ajax düşünce kullanılır ve CSS `#filterPnl`'i zaten gizler → görünmez; `scripts/inject-legacy-filter-fallback.js` de sabit | kod | Dokunulmadı; sunucu tarafı senkron (Çember #4) görünen listeyi düzeltir | Bilgi |
| R12 | `npm audit` (2026-09-16): 11 bulgu (6 high, 5 moderate) — **hepsi önceden mevcut**, `mammoth` zincirinde değil: `prisma/@prisma/config` (deepmerge-ts), `express/body-parser/qs`, `jodit` (admin editör XSS), `sanitize-html` (SVG SMIL bypass), `undici`, `nanoid`, `brace-expansion` | `npm audit` çıktısı | Ayrı çember: sürüm yükseltmeleri tek tek, testlerle (jodit + sanitize-html admin/public içerik güvenliği için öncelikli) | Backlog (orta) |
| R8 | Ana kurs görseli değiştirilen üründe statik sayfadaki çoklu galeri (9 sayfa) tek görsele iner | Çember #1 tasarım kararı | Admin tek görsel yönetir; kabul edilen davranış | Kabul edildi |

## Backlog (Mimar sıralar)
- [ ] R12 — `npm audit` bulguları: jodit + sanitize-html öncelikli, sonra express/qs, prisma, undici (her biri ayrı küçük çember, testli)
- [x] **Çember #8a** tamamlandı → **Çember #8 — Word (.docx) → kurs içeriği içe aktarma** (Mimar 2026-09-16: yaklaşım A onaylandı, B ileride ehtiyat; `mammoth` bağımlılığına site bütünlüğü şartıyla razı)
  - 8a: `docx → ara format {overview, curriculum[{title,items}], why} → tab HTML` saf servisi; Word şablonu (.docx) + 1 sayfa rehber; fixture = anonimleştirilmiş gerçek docx; `mammoth` lazy require (public site etkilenmez)
  - 8b: Admin UI — her tabda "Word'den içe aktar" → önizleme → editöre yerleştir; otomatik kayıt yok; PDF yüklenirse "Lütfen .docx kaynağını yükleyin"
  - 8c (opsiyonel): AI extractor aynı ara formata; yalnızca A "tanımadım" derse
  - Kanıt: örnek docx `Heading1`×9, `Heading2`×12, `ListBullet`×117, 2 tablo → A ile birebir eşleşir; örnek PDF tasarım belgesi (semantik yok) → A için kırılgan, kaynak docx istenir
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
- `sanitizeProductTabContent` `data-*` özniteliklerini siler; akordeon `data-toggle`/ID/ARIA'yı kayıt anında `normalizeCurriculumAccordionContent` üretir. İçerik üreten kod (içe aktarma, AI, script) yalnızca **iskelet** yazmalı, bu öznitelikleri elle eklememelidir.
- Pille 2 (stilsiz belge) tahmininde "1. Başlık" ile "1) madde" ayırt edilemez → numaralı kısa satır başlık sayılmaz; yalnızca anahtar kelimeli desenler ("Modül 1", "3. Hafta") ve kısa kalın satırlar başlıktır. Test bu hatayı yakaladı (2026-09-16).
- Test fixture'ları: gerçek belge repoya girmez; yapı korunarak anonimleştirilmiş kopya `scripts/fixtures/` altına konur, gerçek dosya `~/unityverse-private-fixtures/`'da tutulur ve teslimde onunla da CLI doğrulaması yapılır.
- Yeni bağımlılık ekleyince `npm audit` çalıştır ve bulguların yeni zincire ait olup olmadığını ayır (R12 böyle bulundu).
- Admin liste → düzenle → geri dönüş: sabit `res.redirect('/admin/products')` yerine `productListReturnTo(req)`; yeni bölümlere eklerken aynı deseni (link `?returnTo=`, hidden input, `safeReturnTo` prefiks) kullan.
- `admin.css` içinde aynı özgüllükteki kural sırası önemlidir: `.alert-success` gibi varyantlar `.alert`'ten sonra tanımlanmalı (aksi halde temel kural kazanır).
- Admin şifresi değiştirildikten sonra `npm run seed` çalıştırmak şifreyi `.env ADMIN_PASSWORD` değerine geri döndürür — kurtarma dışında asla.
- Statik dosyası olmayan kurslar `legacy-product-detail.js` ile Python kursu şablonundan render edilir; şablondan gelen her meta/JSON-LD alanı `renderPage`'de açıkça değiştirilmelidir, aksi halde Python verisi sızar.
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
| 2026-09-16 | Kurs içeriği içe aktarma: qayda-esaslı (A) önce; A ve ileride AI (B) **aynı ara formatı** üretir, HTML'i her zaman bizim şablon renderer yazar; Word stil konvansiyonu (Başlık 1/2, madde işareti) + .docx zorunlu, PDF kabul edilmez (v1) | Deterministik, halüsinasyon yok, tek renderer; B eklenince yalnızca extractor değişir (maintainable/scalable) |
| 2026-09-15 | Admin listelerinde "olduğum sayfada kal": `returnTo` URL/form ile taşınır, `safeReturnTo` (`src/services/admin-return-to.js`) yalnızca `/admin/products` altındaki göreli yolu kabul eder (open-redirect koruması); diğer bölümler için aynı servis yeniden kullanılır | Durumsuz, sunucu belleği yok, prefiks-kapalı |
| 2026-09-15 | Admin şifre hash'i JSON dosyada değil DB'de kalır (`AdminUser.passwordHash`, bcrypt cost 12 = 60 karakter); rate-limit sayaçları `RateLimitEntry` (DB); başarılı değişiklikte diğer oturumlar iptal | Tek doğruluk kaynağı DB, deploy/restart'ta dosya kaybı riski yok, kalıcılık ilkesi; Mimar seçti |
| 2026-09-15 | Dinamik kurs head meta'ları tek tablodan (`pageMetaTags`) yönetilir; JSON-LD `Product` DB'den yeniden üretilir (`priceValidUntil` yıl sonu hesaplanır, `<` kaçışı); statik sayfalarda og:image/itemprop image her zaman mutlak URL (origin `res.locals`'tan) | Kalıcılık ilkesi: durumsuz, tek doğruluk kaynağı DB, yeni meta = 1 satır; OG spesifikasyonu mutlak URL ister |
| 2026-09-15 | Yan panel kategori sayaçları: statik 22 dosya/inject scripti değil, listeleme route'larında `withLegacyCategoryCounts` (tek `findMany`, `legacyCategoryCandidateSlugs` ile sayım = kategori sayfasının gösterdiği sayı) | Görünen liste `.legacy-static-filter-fallback`'tır (CSS `#filterPnl`'i gizler); tek doğruluk kaynağı DB |
| 2026-09-15 | Dinamik kurs og:image/itemprop image/og:description `renderPage`'de kursun verisiyle yazılır; kalan miras meta'lar R10 | WhatsApp/FB önizlemesi bu 3 etiketi kullanır; minimum kapsam Mimar onayı |
| 2026-09-15 | Kategori araması statik 21 dosyaya değil, `/kategori/:slug` route'unda sunucu tarafı enjeksiyonla (`ensureLegacyCategorySearch`) eklenir; paginasyon /tum-urunler/ gibi 12/sayfa görünür yapılır; kategori h1'i görünür kalır | Tek doğruluk kaynağı, yeni şablonlar otomatik kapsanır, statik dosyalara dokunulmaz; Mimar paginasyon tutarlılığını seçti |
| 2026-09-15 | "Görseli Kaldır" = DB referansını boşaltır, fiziksel dosya silinmez; kayıt "Güncelle" ile | id 208 ve 209 aynı dosyayı paylaşıyor → fiziksel silme başka kursu bozar; yeni route/migration yok |

## Çember geçmişi
| # | Tarih | Çember | Sonuç |
|---|---|---|---|
| 0 | 2026-09-15 | Proje araştırması + CLAUDE.md sistemi | 5 doküman; 12 unit test baseline PASS; R1 güvenlik bulgusu |
| 1b | 2026-09-15 | Belgeler Türkçeye çevrildi (`CLAUDE.md`, `.claude/rules/*`) | 4 dosya, kod değişikliği yok |
| 8a | 2026-09-16 | docx → blok → bölüm ağacı → tab haritası → tab HTML (3 saf servis), CLI önizleme, anonim fixture, Word şablonu + rehber, `mammoth@1.12.3` | 12 dosya (+10 yeni), ~470 satır kod/test + 2 docx; 20/20 test; gerçek docx: Pille 1, 12 panel, 0 uyarı; PDF reddi; lazy require kanıtlandı |
| 7 | 2026-09-15 | Kurs listesi returnTo (Güncelle, Geri Dön, Durum, Sil; varyant yönlendirmesi query'yi korur) | 7 dosya (+2 yeni), ~120 satır; 8/8 test; yerel e2e: filtreli listeye 302, evil/`//` → `/admin/products` |
| 6b | 2026-09-15 | Şifre formu UX: `.alert-success` sırası düzeltildi (yeşil), `admin-change-password.js` ile anlık politika/eşleşme uyarıları ve pasif buton | 5 dosya (+1 yeni), ~90 satır; sunucu doğrulaması değişmedi |
| 6 | 2026-09-15 | Admin şifre değiştirme (`/admin/change-password`, politika, 2 rate-limit, oturum iptali) | 7 dosya (+3 yeni), ~330 satır (120'si test); 22/22 test; yerel e2e 14 senaryo (politika, yanlış şifre, 401/429, eski şifre reddi, ikinci oturum düşmesi) |
| 5 | 2026-09-15 | R10: dinamik kurs head meta + JSON-LD; statik og:image mutlak | 7 dosya (+1 yeni), ~200 satır (95'i test); 28/28 test; yerel e2e: dinamik sayfada 0 Python meta, statik nisbi sayfada yalnız 2 meta değişti |
| 4 | 2026-09-15 | Yan panel kategori sayaçları DB'den (22 listeleme sayfası) | 3 dosya (+2 yeni), ~180 satır (95'i test); 27/27 test; yerel e2e sayaç = kategori sayfası sayısı |
| 3 | 2026-09-15 | Dinamik kurs sayfası og:image / itemprop image / og:description | 3 dosya (+1 yeni), ~75 satır (60'ı test); R10 tespit edildi |
| 2 | 2026-09-15 | Kategori sayfalarında kurs araması (21 sayfa) | 6 dosya (+2 yeni), ~200 satır (95'i test); yeni test + 22 regresyon PASS; 21/21 kategori HTTP e2e; R9 önceden kırık test tespit edildi |
| 1 | 2026-09-15 | Kurs görseli: statik detay senkronu + admin "Görseli Kaldır" + tam boyut linki | 9 dosya (+2 yeni), ~220 satır (119'u test); yeni test + 23 regresyon = 24/24 PASS; yerel HTTP e2e doğrulandı; `test-legacy-product-visibility` (2cb9fa14'ten beri kırık) onarıldı |
