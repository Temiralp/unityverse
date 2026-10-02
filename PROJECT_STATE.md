# PROJECT_STATE.md — canlı durum günlüğü

> Her çember (circle) bittiğinde güncellenir. Yeni oturum/agent buradan başlar. Tarihler mutlak (YYYY-MM-DD).
> Son güncelleme: **2026-10-02** — Çember 30a (bloğun doğrudan sahip olduğu görselin sınıflandırılması) tamamlandı; 71 test betiğinin 68'i PASS, 3 FAIL **HEAD'de de kırık** (R9, R17, PayTR env). Çember 29 **canlıda doğrulandı**.

## Devir belgeleri (2026-09-30)
- `docs/AI-AJAN-DEVIR-PROMPTU.md` — **devralan AI ajanına verilecek ilk mesaj**: roller, dil kuralı,
  çember yöntemi, TDD, test altyapısı, güvenlik kuralları, teslim şablonu, pahalıya mal olmuş dersler,
  nerede kaldığımız ve ilk adım.
- `docs/egitime-ilk-bakis/00-GOREV-VE-SARTLAR.md` — Mimar'ın isteği ve şartları (özellikle:
  **her kursa aynı hizalama dayatılmayacak**).
- `docs/egitime-ilk-bakis/01-TEKNIK-ANALIZ-VE-TAVSIYELER.md` — 438 sayfanın ölçümü, iki render yolu,
  Çember 17/18'in sonucu, ekip tavsiyesi (denetim scripti → onaylı normalizasyon → Çember 9 deseniyle
  dry-run/apply/revert) ve Mimar'ın vereceği 5 açık karar.

### Ölçülen durum (2026-09-30, **DB `ProductTab.OVERVIEW` üzerinden** — yerel DB)
- 435 kursun **412**'sinde OVERVIEW tab'ı var (23'ünde hiç yok → panel boş render edilir).
- 412 tab içinde: görselsiz **21** · görselli ve **bozukluk işareti taşıyan 389** · tamamen temiz **2**.
- İşaretler: 3+ ardışık `<br>` **389** · 20+ `&nbsp;` **378** · görsel metinle aynı blokta **224** ·
  kaptan geniş görsel **40**. Toplam **6879** görsel, **739**'unda `width` atributu yok.
- Bu sayıların üreticisi **`scripts/audit-course-overview.js`** (Çember 19) — elle değil, script ile
  tekrar üretilir. Production sayıları Mimar'ın çalıştırmasıyla alınacaktır.
- **Metodoloji uyarısı:** ilk ölçüm statik `urun/*/index.html` üzerinden yapılmıştı ve yanıltıcıydı —
  ziyaretçinin gördüğü içerik DB'den gelir (`synchronizeLegacyProductTabs` paneli DB içeriğiyle
  değiştirir). Denetim DB'yi okumalıdır.

## Nerede kaldık
- Kod: `main` — Çember #0…#7 Mimar tarafından commit/deploy edildi ve canlıda doğrulandı (2026-09-15/16).
- **Aktif çember:** yok. **Çember 28** (galeri boşluğu + içerik `table`/`iframe` CSS'i) tamamlandı, commit/deploy bekliyor. Çember 14/15/16/17, #8b, 10, 11, 13 canlıda doğrulandı. Çember 18 geri alındı (2026-09-24 Mimar kararı). Çember 20 + 23 + 25b/26/27 ile **yazilim, oyun-gelistirme, grafik-tasarim, 3d-modelleme** kategorilerinin içerik temizliği production'da uygulandı ve canlıda doğrulandı. Çember 24/24b hukuki sayfalar canlıda. Sıradaki aday: kalan kategorilerin (animasyon vb.) içerik temizliği, sonra **B3 HubSpot planı**; ardından Backlog B2/B6/B7, R12.
- Çember #8a ve #8b tamamlandı (2026-09-16).
- Gerçek örnek docx repo dışında: `~/unityverse-private-fixtures/Siber_Guvenlik_Mufredati_AI_Guncellemesi.docx` (WhatsApp tmp klasöründen kopyalandı).
- Yerelde `uploads/products/1789467*.jpg` (3 dosya, 2026-09-15 yerel admin testi) izlenmiyor — commit'e eklenmemeli.
- Sonraki çemberi Mimar seçer (Backlog).

## Sunucu (Google Cloud) — 2026-09-16 terminal çıktısından doğrulandı
- Uygulama klasörü: **`~/unityverse`** (kullanıcı `kutyuksekteknoloji`, host `sosyal-medya-planlayici`); doğrudan `git pull origin main` ile güncelleniyor (release/symlink yapısı **yok**).
- Process manager: PM2, süreç adı **`unityverse-backend`** (`pm2 restart unityverse-backend`). Aynı VM'de ikinci bir uygulama daha var: `sosyal-medya-planlayici` (1.6 GB bellek) — ona dokunulmaz.
- Yedek klasörü: `/var/backups/unityverse` **yazılabilir değil** (Permission denied) → yedekler `~/backups/unityverse/` altına alınır; `pg_dump` bağlantısı `.env`'deki `DATABASE_URL`'den (`?schema=` parametresi atılarak) türetilir.
- Hâlâ doğrulanmadı: PostgreSQL VM'de mi / Cloud SQL mi; `uploads/` yedek cron'u var mı.

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
| R14 | Çerez banner'ı (`uploads/f/uvcookie.js:23,39`) `POST /ajax/cookieselection` yapıyordu, route yoktu → her onay `src/server.js:287` genel 404'üne düşüyordu (kullanıcıya görünmez, access log gürültüsü, onay sunucuda kayıtlı değil) | Çember 14 ile kapatıldı: yan etkisiz 200 JSON uç noktası | Sunucu tarafı KVKK onay kaydı istenirse ayrı çember (tablo + saklama süresi) | Kapatıldı |
| R16 | **1206 numaralı kursta 4 görsel sunucuda YOK (HTTP 404)**: `WhatsApp_Image_2025-02-25_at_12_02_26_(1)3.jpg`, `WhatsApp_Image_2025-02-20_at_17_31_196.jpg`, `WhatsApp_Image_2025-02-20_at_16_28_2712.jpg`, `blobid073.jpg`. Diğer 9 öncelikli kursta kırık görsel **yok** | canlı HTTP taraması 2026-10-01 | İçerik sorunu, kod değil: dosyalar admin üzerinden yeniden yüklenmeli veya içerikten çıkarılmalı. Not: sabit yükseklik kuralı kırık görsele 320px yer ayırdığı için boşluk daha görünür hâle geldi | Backlog (Mimar) |
| R17 | `scripts/test-member-profile-layout.js` HEAD'de kırık: `src/views/payments/result.ejs:67` render edilirken `ga4MeasurementId` tanımsız — test sahte locals'ına Çember 13'te eklenen GA4 değişkenlerini vermiyor. **Ürün hatası değil, test eksiği** (route her zaman gönderiyor) | `node scripts/test-member-profile-layout.js` 2026-10-02; `git stash` ile HEAD'de de FAIL doğrulandı | Teste `ga4MeasurementId: null, ga4Purchase: null` eklenecek — küçük çember | Backlog (küçük) |
| R15 | Kurs sayfalarinda konsola dusen `TypeError: Cannot read properties of null (reading 'style')` — kaynak **GTM konteynerindeki bir custom HTML tag'i** (`gtm.js` stack'i), bizim kodumuz degil. Bu oturumun ilk sayfa yuklemesinde (hicbir degisiklik yapilmadan once) de vardi → **onceden mevcut** | canlı Chrome konsolu 2026-09-23 | GTM'de ilgili tag bulunup duzeltilmeli veya kaldirilmali (Mimar / GTM erisimi gerekir); site islevini bozmuyor | Backlog (düşük) |
| R8 | Ana kurs görseli değiştirilen üründe statik sayfadaki çoklu galeri (9 sayfa) tek görsele iner | Çember #1 tasarım kararı | Admin tek görsel yönetir; kabul edilen davranış | Kabul edildi |

## Backlog (Mimar sıralar)
- [x] **Çember 10 (tamamlandı, commit bekliyor): üye kayıt/giriş hata mesajları.** `uye-girisi/index.html:2551` ve `uye-ol/index.html:2551` `error:` callback'i her 4xx/5xx'te sabit "Sunucu hatası…" gösterir, sunucunun gerçek mesajını (409 "kayıtlı üye var", 429 rate-limit 5/saat/IP, 400 doğrulama) yutar; giriş formunda (`scripts.js:2007`) `error:` callback'i hiç yok (401 sessiz). Düzeltme: `jqXHR.responseJSON.message` göster; `LEGACY_SCRIPTS_VERSION` bump. (2026-09-17 öğrenci şikayeti)
- [x] **B1 (Çember 11, commit bekliyor) — Havale kilidi kayıt tutarını eziyordu.** Kök neden: `lockBankTransferRegistration` totalAmount'u kursun **güncel** fiyatıyla yeniden hesaplıyordu (167.625 = 186.250×0,90; öğrenciye gösterilen 134.100 = 149.000×0,90). Düzeltme: `bankTransferBaseAmount` (kayıttaki totalAmount korunur; PayTR ile aynı kural) + her iki ödeme mailinde Kupon / Kupon İndirimi satırları.
- [ ] **B2 keşfi tamamlandı → `docs/kesif/B2-odeme-entegrasyonu.md`** (2026-09-17). Özet: PayTR kart taksidi bankanındır, PayTR tek callback gönderir → "her taksit otomatik ödendi" kart için mümkün değil; otomatik havale için **PayTR Havale/EFT iFrame API** (mevcut callback yeniden kullanılır) önerilir; banka API'si yalnızca banka teyidiyle. Kararlar Mimar'da.
- [ ] **B3 keşfi tamamlandı → `docs/kesif/B3-hubspot.md`** (2026-09-17). Özet: L1 takip kodu (CSP allowlist + çerez onayı) + L2 lead/üye senkronu (Contacts batch upsert, private app token) önerilir; GTM üzerinden değil doğrudan; KVKK kararı gerekli.
- [x] **R13 (Çember 15, commit bekliyor) — GTM widget'ları CSP allowlist'e eklendi.** Kanıt (canlı Chrome 2026-09-23): `static.elfsight.com/platform/platform.js` ve `d2mpatx37cqexb.cloudfront.net/delightchat-whatsapp-widget/embeds/embed.min.js` `encodedBodySize=0`/`duration=0` ile hiç indirilmiyordu (`window.eapps` undefined); `connect.facebook.net` (110 KB) zaten çalışıyordu. Yerel doğrulamada widget'ın CSS'i (`embed.min.css`) de `style-src-elem` ile engellendi → o host yalnız legacy `styleSrc`'ye eklendi. **Kalan (kapsam dışı):** `gtm.js` kendi içinde `eval` kullanıyor (`blockedUri: 'eval'`) — `'unsafe-eval'` tüm siteyi zayıflatacağı için verilmedi; widget'lar onsuz çalışıyor. Eski madde:** (canlı loglar 2026-09-17: elfsight platform.js, delightchat WhatsApp widget, facebook frame/form-action). Bu widget'lar isteniyorsa `csp.js` allowlist'e eklenmeli; istenmiyorsa GTM'den kaldırılmalı — Mimar kararı.
- [ ] **B2 — Ödeme entegrasyonu (büyük): PayTR + havale/EFT → admin & öğrenci paneli otomatik.** Bugün: PayTR callback tek çekimi işler; havale `PENDING` kalır, admin `Ödeme Ekle` ile elle kaydeder (bug değil, tasarım). İstek: PayTR taksitli ödemelerin (3/6/12…) `EducationInstallment` olarak otomatik düşmesi ve her taksitin ödendi olması; banka hesabına gelen havalelerin otomatik eşleşmesi (banka API/açık bankacılık — dış etken: bankanın API'si var mı? araştırılacak); admin elle düzeltme korunur. Ayrı keşif çemberi: PayTR taksit callback alanları resmi dokümandan okunacak.
- [ ] **B3 — HubSpot CRM entegrasyonu.** İstek: ziyaretçi/üye takibi, admin panele entegre. Keşif: HubSpot ücretsiz CRM + tracking script (CSP allowlist gerekir) + Forms/Contacts API ile lead senkronu (`leads.js`, üye kaydı). KVKK/çerez onayı etkisi değerlendirilecek. Önce kapsam kararı (yalnızca takip scripti mi, iki yönlü senkron mu).
- [x] **B4-a (Çember 17, commit bekliyor) — kurs sekmesi görsel hizalama CSS'i.** `public/tema10/css/course-content.css`, `legacy-assets.js` ile enjekte (`bank-transfer-discount.css` deseni) + admin editör önizlemesi aynı dosyayı yükler. Kapsam kilidi testte: her seçici `:is(#tab-info, #tab-additional-content2, #tab-additional-content3, .jodit-wysiwyg)` ile başlamalı.
- [ ] **B4-b — içerik normalize (Mimar kararı bekliyor).** B4-a'nın CSS ile çözemediği kalan durum: görsellerin **metinle karışık** ve iç içe `<span>`'lar içinde olduğu bloklar (canlı örnek: `<h2><span><strong><span>…IMG…</span></strong><IMG><span>Neden Bu…</span></span></h2>`, `&nbsp;` dolgusu + 4×`<br>`). Bunlar flex'e çevrilirse başlık metni de yeniden akar → CSS ile güvenli değil; çözüm içerik tarafında (dry-run'lı normalize scripti). Ayrıca tek görselli paragrafların ortalanıp ortalanmayacağı kararı da B4-b'de verilecek.
- [ ] **B4 (eski madde) — İçerik hizalama/tutarlılık.** "Eğitime İlk Bakış" ve diğer sekmelerde görsel/metin hizasız (Jodit'te ve sitede). Çözüm yönü: tek içerik CSS'i (admin önizleme + public sekme aynı stil), içe aktarma renderer'ında görsel/paragraf sarmalayıcı sınıflar; mevcut kurslar için audit + toplu normalize (dry-run).
- [x] **B5 (Çember 12, commit bekliyor) — Jodit kaynak/görsel geçişinde video kayboluyordu.** Gerçek Chrome'da yeniden üretildi; kök neden Jodit 4.12 varsayılanı `cleanHTML.denyTags = "script,iframe,object,embed"`. Kurs editöründe `cleanHTML: { denyTags: 'script,object,embed' }`; sunucu sanitize YouTube dışı host'u ve editörün eklediği `sandbox` özniteliğini zaten atıyor. **Blog editörü kapsam dışı**: blog içeriği sunucuda sanitize edilmiyor → iframe'e izin vermek ayrı güvenlik kararı (backlog B7).
- [ ] **B7 — Blog editöründe video (iframe):** aynı Jodit varsayılanı blog editöründe de iframe'i siler; ancak blog içeriği için sunucu tarafı `sanitize-html` yok (`admin.js` blog route'ları). Önce blog içeriğine sanitize (YouTube host allowlist) eklenmeli, sonra editör izni.
- [ ] **B6 — İçe aktarma: "belgenin tamamını Ders İçerikleri yap" seçeneği** (dialogda 1 seçim, serverda `mode=all-curriculum`; mevcut davranış değişmez, ~40 satır).
- [ ] R12 — `npm audit` bulguları: jodit + sanitize-html öncelikli, sonra express/qs, prisma, undici (her biri ayrı küçük çember, testli)
- [x] **Çember #8a** tamamlandı → **Çember #8 — Word (.docx) → kurs içeriği içe aktarma** (Mimar 2026-09-16: yaklaşım A onaylandı, B ileride ehtiyat; `mammoth` bağımlılığına site bütünlüğü şartıyla razı)
  - 8a: `docx → ara format {overview, curriculum[{title,items}], why} → tab HTML` saf servisi; Word şablonu (.docx) + 1 sayfa rehber; fixture = anonimleştirilmiş gerçek docx; `mammoth` lazy require (public site etkilenmez)
  - [x] 8b: Admin UI — "Word'den içe aktar" → önizleme dialogu → editöre yerleştir (Değiştir/Sonuna ekle, tek tek veya üçü birden); otomatik kayıt yok; PDF → 400 mesajı
  - 8c (opsiyonel): AI extractor aynı ara formata; yalnızca A "tanımadım" derse
  - Kanıt: örnek docx `Heading1`×9, `Heading2`×12, `ListBullet`×117, 2 tablo → A ile birebir eşleşir; örnek PDF tasarım belgesi (semantik yok) → A için kırılgan, kaynak docx istenir
- [ ] R1 — `local_server.js` dosyasını repodan çıkar (parola zaten döndürüldü; düşük)
- [ ] R2 — `.env.example` tamamlama (docs, küçük)
- [ ] R4 — `npm test` toplu unit runner (test altyapısı, küçük)
- [ ] R5 — gereksiz dosyaların repodan çıkarılması (chore)
- [ ] R9 — `test-price-visibility-language` kırık test kararı (test vs CSS)
- [ ] §Sunucu kalan sorular: DB konumu, uploads yedeği; `DEPLOYMENT.md` gerçek kurulumla (~/unityverse, pm2 unityverse-backend) uyumlu hale getirilmeli
- [ ] `PRODUCTION_CHECKLIST.md` §1 "kritik yeni dosyalar" maddesi eski (dosyalar zaten commit'te) — güncellenmeli

## Çift WhatsApp düğmesi (Çember 16, 2026-09-23)
- R13 ile delightchat widget'ı açılınca sayfada **iki** WhatsApp düğmesi oluştu: kendi `a.legacy-whatsapp-appointment` (260×45, bottom 75 / right 24) ile delightchat'in `div#wa-btn-wrapper` (216×45, bottom 80 / right 20) neredeyse üst üste biniyordu; bizimki daha geniş olduğu için soldan taşıp ikinci bir ikon gibi görünüyordu.
- Mimar kararı: **kendi butonumuz kaldırıldı**, GTM'deki delightchat widget'ı kalsın. Buton 3 yerden enjekte ediliyordu (`legacy-whatsapp.js` enhance zinciri + `legacy-catalog.js`'te blog detay ve blog listesi); statik HTML'lerde hiç yoktu, bu yüzden kaldırma anında her sayfaya yansır.
- **Kapsam notu:** delightchat GTM ile geliyor → 630 legacy statik sayfanın hepsinde görünür. EJS sayfalarında (admin, `/odeme/*`, üye profili) GTM yok, dolayısıyla widget da yok — ödeme sayfalarına 3. taraf script eklenmez (bkz. ders defteri). Widget ileride GTM'den kaldırılırsa sitede WhatsApp düğmesi kalmaz; eski buton `git revert` ile geri gelir.

## Çember 18 geri alma — 2026-09-24
- **Karar:** `course-overview.js` farklı kurs içeriklerine genel olarak uygulanmamalı. Çember 18'in `ensureLegacyAssetVersions` içindeki otomatik enjeksiyonu, desenleri ve sürüm sabiti kaldırıldı; servis `94e2d36d^` ile bayt-bayt aynı.
- **Kapsam:** Çember 18 öncesindeki dinamik route scripti ve Çember 17 `course-content.css` korundu. DB, kurs HTML içeriği, görseller ve SEO alanları değiştirilmedi. Eski hizalama sorunları bu geri almayla çözülmez; sonraki iş ayrı seçilecek.
- **Test:** `test-legacy-course-overview-script` yeni beklentiyle önce FAIL, kaldırma sonrası PASS. İşaretli statik sayfaya script eklenmemesi, gövdenin korunması, mevcut dinamik script ve Çember 17 CSS'i doğrulandı. İlgili testler + unit baseline: **25 PASS, 1 önceden mevcut FAIL (R9)**. `test-social-oauth` sandbox port izni yüzünden EPERM verdi; izinli tekrar PASS.
- **R9 doğrulaması:** `test-price-visibility-language` aynı hatayı Çember 18 öncesi asset servisiyle de verdi; test ve okuduğu CSS/route/header dosyaları o commit'ten beri değişmemiş. Kapsam dışı bırakıldı.
- **Kalıcılık:** değişiklik sunucu render zincirinde; restart sonrası aynı davranış sürer. DB/migration/env/bağımlılık değişikliği yok. Tarayıcı/canlı test yapılmadı; commit, deploy ve canlı kontrol Mimar'da.
- **Önceki çıkarımın düzeltmesi:** script eksikliği bazı örnekleri açıklıyordu, tüm hizalama sorunlarının tek nedeni değildi. Overview işareti DB tab birleştirme yoluna bağlıdır; her statik kursun veya her dolu overview'un işaret taşıdığı varsayılamaz.

## Kategori kategori ilerleme kararı (Mimar, 2026-09-30)
- **Hepsi birden ele alınmayacak.** Sıra: **1) yazilim**, sonra oyun-gelistirme, grafik-tasarim,
  3d-modelleme. Bir kategori canlıda başarılı olmadan diğerine geçilmez.
- Değişiklik **yalnızca bozuk olanları** etkilemeli; düzgün görünen kurslara dokunulmamalı.
- Çözüm **admin paneliyle entegre** olmalı: içerik admin editöründen görülebilir/düzenlenebilir kalmalı
  (kodlar, düz metin hâli bozulmamalı).

### Kategori denetim sonuçları (yerel DB, `scripts/audit-course-overview.js`)
| Kategori | Kurs | OVERVIEW tab | Problemli | Temiz | Tab'ı yok |
|---|---|---|---|---|---|
| yazilim | 124 | 118 | **111** | 2 | 6 |
| staj-garantili | 13 | 13 | **13** | 0 | 0 |

### ⚠️ Kapsam tuzağı (2026-09-30 bulgusu)
Mimar'ın öncelikli verdiği 10 linkten **3'ü `yazilim` kategorisinde DEĞİL**, `staj-garantili`
kategorisinde: `...-staj-garantili-668`, `...-staj-garantili-669`, `...-10-ay-staj-garantili-1206`.
Yalnızca `--kategori yazilim` ile ilerlenirse **öncelikli kurslar kapsam dışı kalır**. Bu yüzden
normalizasyon kapsamı kategoriye değil, **Mimar'ın onayladığı slug listesine** göre belirlenmelidir
(kategori yalnızca listeyi üretmek için kullanılır).

### Öncelikli 10 kursun imzası (neredeyse birebir aynı)
21–25 görsel · 1 metinle karışık blok · 7–12 ardışık `<br>` · 293–332 `&nbsp;` · satır içi sarmalayıcı
derinliği 7–8. Aynı kaynaktan kopyalanmış içerikler → birinde doğrulanan düzeltme diğerlerinde aynı
davranır (test yükü düşük, risk öngörülebilir).

## Görsel düzeni: ölçülen referans değerler (2026-10-01)
Kaynak: dinamik kurs sayfasındaki `course-overview.js` galerisi, sekme genişliği 1268px.
Bu sayılar **tahmin değil**, canlı ölçümdür ve `course-content.css` bunları birebir kullanır:
grid **gap 22px** · kart **padding 10px**, **radius 14px**, fon **#f8f9fc** · galeri görseli
**object-fit: contain**, radius 9px · görsel tavanı **max-width: min(100%, 600px)**.
Statik sayfalarda `minmax(420px, 1fr)` ile 2 sütun elde edilir (280px denendi → 4 sütun çıktı).

**Neden sunucu tarafı sınıflandırma:** CSS bir blokta metin olup olmadığını göremez. 2026-10-01'de
saf CSS denemesi 534 karakterlik bir paragrafı flex'e çevirdi (yükseklik 497→321). Sınıflandırma
`legacy-overview-layout.js`'e taşındı; metinli bloklar artık asla dokunulmuyor.

## "Eğitimimizden kareler" ile görseller arasındaki boşluk — ÇÖZÜLDÜ (Çember 28, 2026-10-02)
İlk teşhis (2026-10-01) **eksikti**: boşluğun kaynağı DB'deki `&nbsp;` dolgusu değil, düzen
servisinin kendi davranışıydı. Görseller kaba (`uv-ov-media` / `uv-ov-gallery`) taşınınca
aralarındaki `<br>`'ler blokta öğede kalıyor, yan yana geliyor ve kabın üstünde boşluk yaratıyordu —
canlı ölçüm: **18 `<br>` = 493px**. Bu yüzden içeriği temizlenmiş kurslarda da boşluk duruyordu.
Çözüm: `legacy-overview-layout.js` kap oluşturduğu blokta `blok.find('br').remove()` yapar.
**Kapsam kilidi:** yalnızca kap oluşturulan bloklarda; metinli ve görselsiz bloklarda `<br>` satır
sonudur, dokunulmaz (testle kilitli). Ölçülen sonuç: **493 → 73px**; 412 kursta 10 582 `<br>`
kaldırıldı, görsel sayısı değişen kurs 0, metin kaybı 0.
**Ölçüm tuzağı:** kalıntıyı `kap.parent().find('br')` ile saymak komşu metin paragraflarının
`<br>`'lerini de sayar (142 kurs yanlış pozitif); doğru ölçüm `kap.parent().children('br')`.

## "Üyelik Sözleşmesi ve Gizlilik Politikası" sayfası — ÇÖZÜLDÜ (2026-10-02)
Mimar kararı: ilgili bölüm güncellensin, ilgisizler kalsın. Kesim işareti **"GİZLİLİK POLİTİKASI"**;
ondan önceki kısım (Üyelik Sözleşmesi + Google ile Giriş) korunur. Doğrulama: kesim öncesinde
"Çerez" 0 / "Üyelik" 9, kesim sonrasında "Üyelik" 0 / "Çerez" 10 → sınır temiz.
Ödeme sayfasında İptal ve İade linki **zaten var** (Mimar ekran görüntüsüyle teyit etti) — dokunulmadı.

### Eski not (karar öncesi)
Mimar'ın verdiği PDF yalnızca **Gizlilik Politikası ve KVKK Aydınlatma Metni**'ni içeriyor; ancak
`sayfa/uyelik-sozlesmesi-ve-gizlilik-politikasi-27/` sayfasında **üç ayrı belge** bir arada:
Üyelik Sözleşmesi (ayrı "ÜYELİK" başlığı), Gizlilik Politikası, Çerez politikası (10 geçiş) ve
"Google ile Giriş Hakkında Bilgilendirme" bölümü.
Sayfayı olduğu gibi değiştirmek üyelik sözleşmesini, çerez politikasını ve Google bildirimini
**silerdi** → hukuki içerik kaybı. Bu yüzden bu sayfa **güncellenmedi**, Mimar kararı bekleniyor.
Seçenekler: (A) yeni metin başa, mevcut bölümler altta korunur · (B) tam değiştir (3 bölüm silinir)
· (C) yeni metin ayrı sayfaya (`sayfa/kvkk-aydinlatma-metni/` zaten var), bu sayfa korunur.

Ayrıca: ödeme sayfası (`iframe.ejs:131,137`) **Mesafeli Satış** ve **Üyelik+Gizlilik** sayfalarına
onay kutusuyla bağlı; **İptal ve İade** linki orada YOK — eklenip eklenmeyeceği Mimar kararı.

## Yapılmaması gerekenler (git geçmişinden öğrenilen dersler)
- **"En içteki blok" kuralı tek başına yetmez.** Çember 22b dış metin bloğunu atlama hatasını
  düzeltti, ama tersini açık bıraktı: bir blok hem **doğrudan** görsel taşıyor hem de içinde
  görselli bir alt blok varsa, dış blok aday olmaktan çıkar ve doğrudan duran görsel hiçbir
  gruba girmez. Ölçüm: 157 sınıflandırılmamış görsel; bunların 153'ü uzun metinli bloklarda
  (dokunulmaz), 4'ü gerçek hata. Doğru kriter "en içteki blok" değil **doğrudan sahiplik**tir
  (2026-10-02).
- **Kabı bloğun sonuna eklemek src sırasını bozabilir.** Doğrudan görsel, alt bloktaki görselden
  önce geliyorsa kap sona eklenince sıra değişir ve güvenlik sözü (src sırası birebir) **tüm
  dönüşümü geri alır** — yani kurs hiç düzen almaz. Kap, ilk doğrudan görselin yerine konmalıdır
  (2026-10-02).
- **Aynı fotoğraf iki kez yüklenmiş olabilir.** `blobid043` ve `blobid044` farklı src'lerdir ama
  md5'leri aynıdır (2026-10-02, blender kursu: 3 kez tekrarlanan galeride 57 görsel referansı,
  31 tekrarsız src, görsel olarak yalnızca 22 farklı fotoğraf). "Tekrarı sil" kararı vermeden
  önce src karşılaştırması yetmez, **dosya imzası** karşılaştırılmalıdır.
- **Düzüm için kullanılan `<table>` görseli yok eder.** Jodit içeriğinde hizalama amaçlı
  1 satır / 2 hücreli tablolar var: bir hücrede görsel, diğerinde metin. Tablonun otomatik
  düzeni geniş metin hücresine yer verip görsel hücresini sıkıştırıyor — 600×326 piksellik bir
  görsel **60×320** render ediliyordu (yani neredeyse görünmez) ve metin hücresinde 741px boşluk
  kalıyordu. CSS ile düzeltilemez: `vertical-align`, `width: %`, `grid-template-columns` ve
  `height: auto` varyantlarının **dördü de** ölçüldü, hiçbiri temiz sonuç vermedi (satır ya daha
  da uzadı ya da görsel küçük kaldı). Çözüm tabloyu **sunucuda kaldırmaktır** (2026-10-02).
- **`vertical-align: top` masum değildir.** Bir hücre komşusundan uzunsa metin tepeye yapışır ve
  altında boşluk kalır; tarayıcı varsayılanı `middle` bunu kendiliğinden dengeler. Tablo hücresine
  hizalama verirken komşu hücrenin yüksekliğini de düşün (2026-10-02, Çember 28'in düzeltmesi).
- **Otomatik tarayıcı sekmesinde `loading="lazy"` görseller hiç yüklenmez.** Sekme ön plana
  gelmediği için istek gönderilmez: `naturalWidth === 0`, `currentSrc` boş, `performance`
  kayıtlarında yalnızca kendi `fetch`'leriniz görünür. Bu durumda "görsel 404" sonucuna varmak
  hatadır — aynı URL `fetch` ile 200 döner. Ölçümden önce `loading='eager'` atayıp `src`'yi
  yeniden set et ve `load` olayını bekle (2026-10-02).
- **Simülasyonu gerçek çıktının yapısıyla kur.** Canlı sayfada dönüşümü denerken uydurma bir
  sarmalayıcı sınıf (`uv-ov-media-item`) kullanıldı; CSS `.uv-ov-media img` seçtiği için sonuç
  tesadüfen aynı çıktı. Önce servisin **gerçek** çıktısını okuyup sınıf yapısını doğrula
  (2026-10-02).
- **Toplam (aggregate) ölçümde `parent()` yanıltır.** Bir kabın `<br>` kalıntısını sayarken
  `kap.parent().find('br')` kullanılırsa, kap `<td>` gibi birkaç blok barındıran bir hücrenin içindeyse
  **komşu metin paragraflarının** `<br>`'leri de sayılır. 2026-10-02'de bu yolla 142 kurs "kalıntılı"
  göründü; doğru ölçüm `kap.parent().children('br')` ile 0 çıktı. Kabın **kendi** bloğuna bakılmalıdır.
- **Görselleri kaba alırken bloktaki `<br>`'leri de kaldır.** Kap oluşturulunca görseller DOM'dan çıkar
  ama aralarındaki `<br>`'ler blokta kalır, yan yana gelir ve kabın üstünde devasa bir boşluk doğar
  (ölçüldü: 18 `<br>` = 493px). Kaldırma **yalnızca kap oluşturulan bloklarda** yapılır — metinli
  bloklarda `<br>` satır sonudur, silinirse metin birbirine girer (2026-10-02).
- **Dar bir `<table>` videoyu yok eder.** Jodit'ten gelen içerikte `<iframe>`'ler 144px genişliğinde bir
  tablonun hücresine konmuştu; iframe 40×23 piksele düşüp pratikte görünmez oluyordu. "Video yok" diye
  bildirilen sorunun kaynağı iframe değil **kabı** idi: önce elemanın `getBoundingClientRect()` ölçüsüne
  bak, sonra kabının genişliğine (2026-10-02, animasyon kategorisi).
- Kendi koruma kuralın işi engelleyebilir: metin **sırası** eşitliği arayan bir güvenlik kontrolü,
  bilerek yapılan bir blok taşımasını "bozulma" sayıp tüm dönüşümü geri aldı (2026-10-01). Taşıma
  içeren dönüşümlerde metin **kaybı** (kelime çoklu kümesi) denetlenir, sıra değil.
- **HTML dönüşümünde yalnız üst seviye çocuklara bakma.** Gerçek içerikte görsel paragrafları uzun
  metinli bir sarmalayıcı `<div>` içinde olabilir; dış blok "metinli" sayılıp atlanınca içindeki saf
  görsel blokları da atlanır (2026-10-01, 1454 numaralı kurs). **En içteki** bloğa inilmelidir.
- Ardışık blokları birleştirirken dizi sırası yetmez, **DOM'da bitişik kardeş** olmaları da
  şarttır; aksi halde aradaki metin paragrafı atlanıp içerik sırası bozulur (2026-10-01).
- Bir sayfada görsel "görünmüyorsa" önce **HTTP durumunu** kontrol et: `naturalWidth === 0` ise dosya
  sunucuda yoktur (404) ve bu bir kod hatası değildir. Sabit yükseklik veren CSS kırık görsele yer
  ayırdığı için sorunu daha görünür yapar (2026-10-01, R16).
- **Tek geçişli metin dönüşümü idempotent olmayabilir.** Boş blok silinince iki yanındaki `<br>`
  yan yana gelir ve YENİ bir zincir doğar; N1 çoktan çalışmıştır. Dönüşümler **değişiklik durana
  kadar birlikte döngüde** çalıştırılmalıdır (2026-09-30, gerçek kurs içeriğinde yakalandı —
  sentetik test kaçırmıştı; hatayı `--apply` sonrası ikinci dry-run gösterdi).
- Türkçe/regex tuzağı: `"metni"` kelimesi `/metin/` desenine **uymaz** (harf sırası m-e-t-n-i).
  Hata mesajını teste dayandırırken kelimenin çekimli hâline güvenme (2026-09-30).
- `sanitizeProductTabContent` içeriği **yeniden yazar** (`../../uploads/...` → `/uploads/...`,
  `<img>` → `<img />`). İçerik üzerinde çalışan bir script onu **çağırmamalıdır**, aksi halde
  istenmeyen bir yol değişikliği de yapılmış olur (2026-09-30).
- **Aynı repoda paralel iki AI ajanı çalıştırma.** 2026-09-30'da iki ajan aynı dosya adını
  (`scripts/audit-course-overview.js`) kullandı; ikincisi birincinin commit'lenmemiş dosyasını üzerine
  yazdı ve git'ten dönülemedi. Bir ajan işe başlarken **önce `git status`**'e bakmalı, tanımadığı
  dosya varsa üzerine yazmadan sormalıdır.
- Bir sayfa tipi "düzgün", diğeri "bozuk" görünüyorsa **önce iki sayfanın hangi kod yolundan geçtiğini karşılaştır**: statik dosyası olan kurs `enhanceLegacyHtml` zincirinden, olmayan kurs `legacy-product-detail.js`'ten render edilir ve bu iki yol farklı asset yükler. CSS yazmadan önce bu farkı ara (2026-09-23: B4-a CSS'i simptomu düzeltti, kök neden eksik script'ti).
- **2026-09-24 dersi:** bir kursun görünümünü düzelten script tüm kurslara otomatik yayılmaz. Scriptin yüklenmesi ve taşma olmaması, farklı içeriklerin görsel düzeninin korunduğunu kanıtlamaz. İçerik çeşitlerini temsil eden masaüstü/mobil önizleme gerekir; Çember 18 bu nedenle geri alındı.
- CSS seçicisi yazmadan önce **gerçek DOM yapısını ölç**: `<p><img><span>…</span><img></p>` yapısında `img + img` (bitişik kardeş) TUTMAZ, `img ~ img` gerekir. Kurs sekmelerinde 618 çoklu-görsel bloğu ölçüldü: 269 doğrudan kardeş, 190 biri doğrudan biri sarmalayıcıda, 159 tamamen sarmalayıcıda → tek desen yetmez (2026-09-23).
- Bir CSS değişikliğini deploy etmeden doğrulamanın en hızlı yolu: **canlı sayfaya tarayıcıdan `<style>` enjekte edip** önce/sonra eleman koordinatlarını ölçmek (`getBoundingClientRect`). Yerel sunucu `uploads/` görsellerini taşımadığı için görsel işlerinde yerel ekran görüntüsü yanıltıcıdır (2026-09-23).
- Test, kendi açıklama yorumuna takılabilir: `assert.doesNotMatch(css, /img \+ img/)` yorumdaki örneği yakaladı → içerik kontrolleri **yorumları çıkarılmış** metin üzerinde yapılmalı (2026-09-23).
- CSP ihlali logunu okurken `grep "CSP violation"` **yetmez**: `console.warn` nesneyi alt satırlara yazar, `blockedUri` başka satırdadır → `grep -A6 "CSP violation"` kullan. (2026-09-23'te boş çıktı bu yüzdendi, log gerçekten boş değildi.)
- Chrome eklentisinin `read_console_messages` aracı **CSP ihlallerini yakalamaz** (bunlar console API çağrısı değil, tarayıcı hatasıdır). Bir kaynağın gerçekten engellenip engellenmediği `performance.getEntriesByType('resource')` içinde `encodedBodySize`/`duration` = 0 ile ve kütüphanenin global değişkeninin (`window.eapps` gibi) yokluğuyla kanıtlanır (2026-09-23).
- 3. taraf script'i CSP'ye eklerken yalnız `script-src` yetmeyebilir: widget kendi CSS'ini ve API uçlarını da çeker. Deploy'dan önce **yerel sunucuda** (`PORT=8765`) gerçek Chrome ile açıp kendi `/csp-report` logunu oku — ikinci bir deploy turunu bu önler (2026-09-23).
- `commonDirectives()` içindeki `styleSrc`/`frameSrc` **ödeme ve EJS sayfalarıyla paylaşılır**; yalnız legacy sayfalara ait bir izin verilecekse direktif `legacyCsp` içinde override edilir, ortak tabloya yazılmaz (aksi halde ödeme sayfası da 3. taraf host'a açılır).
- `uploads/f/*.js` ve `?v=` taşımayan legacy JS dosyaları `src/server.js:99-105` gereği `max-age=31536000, immutable` ile servis edilir → **bu dosyaları düzenlemek mevcut ziyaretçilere ulaşmaz**. Legacy JS kaynaklı bir sorunun kalıcı çözümü sunucu tarafında olmalıdır (R14 böyle çözüldü, 2026-09-23).
- CSP ihlallerinin canlı listesi anonim sayfa yüklemesinden çıkarılamaz: GTM tag'leri çerez onayından sonra tetikleniyor. Allowlist yazmadan önce sunucudaki `[CSP violation]` logundan gerçek `blockedUri` listesi alınır (2026-09-23).
- Dinamik/statik route modunu değiştirmek SEO'yu bozdu (`5287f615`, `85147477`, `202d63de` revert'leri). `LEGACY_FRONTEND_MODE` ve route sırası değişikliği = yüksek risk, ayrı plan.
- `clear-site-data` ile 301 önbellek kırma denemesi revert edildi (`9afe7b57`). Tekrarlama.
- Varyant sayfalarının canonical'ı ana ürüne yönelmeli (`2cb9fa14`) — kurs/varyant işinde koru.
- Cache-busting: CSS/JS değişince HTML'lerdeki `?v=` parametresi güncellenir (`bcc0911a`), aksi halde kullanıcılar eski dosyayı görür.
- GA4 doğrulaması yerel makineden yapılamaz: `127.0.0.1` kaynaklı `g/collect` hit'leri Google tarafından 503 + `tt=spam` ile reddedilir. Gerçek domende gitignore'lu `uploads/admin/*.html` probe sayfası + Gerçek Zamanlı raporu kullan (2026-09-17). GA4 mülkü `purchase` olayını Google Ads dönüşümüne de bağlı (`measurement/conversion` isteği gözlendi).
- Ödeme sayfaları (`/odeme/*`, EJS) analitik script **taşımaz** (header partial'da script yok; gtag/GTM yalnızca legacy statik sayfalarda) ve `paymentCsp` ile korunur: inline JS nonce ister, dış host allowlist'e eklenmeli. Görev dosyalarındaki "zaten yüklü" varsayımlarını her zaman kodla doğrula (GA4 görevi 2026-09-17: 3 varsayım yanlıştı).
- İstemciye veri geçirirken inline JS string'i değil `<script type="application/json" nonce>` + `\u003c` kaçışı + harici JS (repo deseni: `data-courses-json`).
- Jodit 4 varsayılan `cleanHTML.denyTags` iframe içerir; `editor.value` her set edildiğinde (kaynak↔görsel, içe aktarma) iframe silinir. Video içeren editörlerde `denyTags: 'script,object,embed'` ver ve sunucu sanitize'in host allowlist'ini koru. Editör davranışı için tahmin yerine gitignore'lu `uploads/admin/*.html` probe sayfası + Chrome ile yeniden üretim (2026-09-17).
- Ödeme tutarı kuralı: bekleyen kayıt tutarı yalnızca `syncPendingRegistrationAmount` ile (kuponsuz, kilitlenmemiş) senkronlanır; havale kilidi ve PayTR token **kayıttaki totalAmount'u** kullanır. Yeni bir ödeme yolu eklerken tutarı asla `product.price`'tan yeniden hesaplama (kupon/gösterilen tutar kaybolur — B1 hatası).
- PM2 log zaman damgaları **UTC**'dir (Türkiye = +3). `unityverse-backend-error.log` CSP ihlali gürültüsüyle dolu; gerçek hataları `grep -v "CSP violation"` ile süz. Kullanıcıya dönen HTTP kodunu görmenin en kısa yolu Nginx access log (`POST /ajax/member/register` satırındaki status).
- Legacy jQuery formları (`uye-girisi`, `uye-ol`, `scripts.js` signin) sunucu 4xx mesajını göstermez; yeni public endpoint eklerken istemci `error` callback'inin `responseJSON.message` kullandığından emin ol.
- Tarayıcı e2e'de admin girişi gerekiyorsa şifreyi asistan girmez; Mimar geçici test hesabıyla giriş yapar, asistan devam eder (2026-09-16 uygulaması).
- Kurs fiyatları anonim ziyaretçiye gösterilmez (`/api/member-prices` üye oturumu ister; statik sayfa JSON-LD `price` her zaman "0"). Fiyat değişikliğinin canlı doğrulaması anonim `curl` ile **yapılamaz**; script'in DB yeniden-okuma doğrulaması + Mimar'ın üye/admin görsel kontrolü esastır.
- Yerel Docker DB **production'ın güncel kopyası değildir** (2026-09-16: 46 kurs yerelde DRAFT, canlıda yayında; 1 slug yerelde yok). Veri işlerinde yerel DB yalnızca mantık/format testi içindir; gerçek etki listesi production dry-run ile alınır.
- Kurs adında/slug'ında 'online' veya 'yüz yüze' geçmeyen kurslar var ve `lessonType` alanı tüm kurslarda boş → rejim tahmini için güvenilir DB sinyali yok; plan satırında açık `mode` kullan.
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
| 2026-10-02 | Düzüm amaçlı tablolar **sunucuda** (render anında) blok akışına açılır; DB içeriğine ve admin editörüne dokunulmaz. Kapsam dar: 1 satır, 2 hücre, `<th>` yok, iç içe tablo yok, iframe'li hücre yok, bir hücre yalnız görsel / diğeri yalnız metin | Mimar A seçeneğini onayladı. CSS ile 4 varyant ölçüldü, hiçbiri temiz sonuç vermedi; gerçek veri tabloları ve yan yana videolar kapsam dışı bırakılarak risk sıfıra yakın tutuldu |
| 2026-10-02 | **C1:** küçük görseller zorla büyütülmez. Boşluk `<br>` temizliğiyle, videolar `table`/`iframe` CSS'iyle çözülür; `max-width` tavanı korunur, `min-width`/`width:100%` **verilmez** | Mimar kararı: düşük çözünürlüklü logo/sertifika zorla büyütülürse bulanıklaşır. Küçük görsel büyütme kararı ayrıca değerlendirilecek |
| 2026-09-30 | Kurs ve katalog arama motoru (server & client) kelime sırasından bağımsız token tabanlı (`tokens.every`) yapıldı; `normalizeSearchText` içine sembol desteği eklendi (`+`, `#`, `&`, `.`, `/`, `-` vb. korunur, noktalama boşluğa döner); asset version bump (`20260930-1`) | Admin ve kullanıcıların etiketlerle ve programlama sembolleriyle (C#, C++, .NET, UI/UX, 40 Saat + 40 Saat) kurs bulabilmesi sağlandı; sıfır DB/şema etkisi |
| 2026-09-24 | Çember 18 genel overview script enjeksiyonu geri alındı; önceden var olan dinamik davranış ve Çember 17 korundu | Mimar: kursların farklı içerikleri aynı düzene zorlanmamalı; yeni çözüm ayrı iş olarak seçilecek |
| 2026-09-23 | Kurs sekmesi görsel hizalaması **CSS ile** yapılır (DB içeriğine dokunulmaz); kapsam yalnızca üç sekme id'si + `.jodit-wysiwyg`; 2+ görselli bloklar flex ile sarmalanıp ortalanır, **tek görselli paragraflara dokunulmaz** | Mimar kararı: bugün düzgün görünen kurslarda sıfır değişiklik; DB'ye dokunmadan 438 sayfaya anında ulaşır; yeni kurs otomatik kapsanır |
| Tarih | Karar | Gerekçe |
|---|---|---|
| 2026-09-15 | CLAUDE.md bölünmüş yapı: kök CLAUDE.md + `.claude/rules/{workflow,security,testing}.md` + `PROJECT_STATE.md` (@import) | Resmi doküman 200 satır sınırı önerir; kurallar ve durum ayrı güncellenir |
| 2026-09-15 | Çember yöntemi, >3 dosya/>100 satır için plan+onay, TDD zorunlu | Mimar'ın çalışma kuralı |
| 2026-09-15 | Git/deploy işlemlerini yalnızca Mimar yürütür | Mimar'ın çalışma kuralı |
| 2026-09-15 | Dil: sohbet AZ, kod yorumu ve .md TR, commit EN/TR | Mimar'ın kuralı |
| 2026-09-15 | Kurs görseli için DB tek doğruluk kaynağı; statik detay sayfasında görsel DB ile aynıysa HTML'e dokunulmaz, farklıysa slider tek slayt olarak yeniden yazılır; og:image/itemprop/JSON-LD/paylaşım linki de güncellenir | 431/431 statik sayfa bugün DB ile aynı → sıfır görsel regresyon; liste sayfası zaten DB'den |
| 2026-09-23 | GTM widget'ları (elfsight, delightchat) legacy CSP allowlist'ine alındı: `script-src` + `connect-src` + yalnız legacy `style-src`. `'unsafe-eval'` **verilmedi** (gtm.js'in kendi eval'i kapsam dışı bırakıldı) | Mimar kararı "hepsi kalsın"; izin en dar kapsamda: ödeme/EJS CSP'si değişmedi, widget'lar yerel gerçek Chrome testinde çalıştı | 
| 2026-09-23 | `POST /ajax/cookieselection` yan etkisiz kabul edilir (200 `{status:'ok'}`, `Cache-Control: no-store`): DB yok, oturum yazımı yok, log yok → CSRF ve rate-limit **bilerek** eklenmedi (banner token göndermiyor; rate-limit DB'ye yazardı). Onayın tek doğruluk kaynağı tarayıcıdaki `uv_cookie` | Minimum değişiklik: 3 satır + 1 küçük route; legacy JS `immutable` cache'lendiği için istemci tarafı düzeltme ulaşmazdı; KVKK onay kaydı istenirse ayrı çember | 
| 2026-09-17 | GA4 purchase: PayTR ok_url landing anında (callback'ten bağımsız) gönderilir — thank-you page standardı; ölçüm ID env'de (`G-M662SLVT18`, Mimar teyit etti); tekrarı localStorage anahtarı önler; payload sunucuda hesaplanır | Görev dosyası + kod gerçekliği (gtag yok, CSP) uzlaştırıldı; DB/migration yok |
| 2026-09-17 | Havale/EFT kilidinde tutar = kayıttaki `totalAmount` (kupon dahil); yalnızca boşsa kursun güncel fiyatı | Öğrenciye gösterilen tutar bağlayıcıdır; PayTR akışıyla tutarlı; Mimar seçti |
| 2026-09-16 | Toplu fiyat değişikliği: elle SQL/admin değil, tarihli **plan dosyası** (`scripts/data/price-update-*.json`) + `scripts/update-course-prices.js` (dry-run varsayılan, `--apply` tek transaction, DB'den yeniden okuyup doğrulama, `--report` + `--revert`). Yazılan alanlar admin formuyla aynı: `price` + `discountPrice` (default varyant → ana kurs fiyatı). Belirsiz her durum MANUAL: bulunamadı, rejim belirsiz, süre/default varyant uyuşmazlığı, çatışma | Yerel DB production'dan eski (46 satır DRAFT, 1 slug yok) → "ne değişecek" yalnızca production dry-run'dan alınır; audit izi repoda; idempotent ve geri alınabilir |
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
| 30a | 2026-10-02 | **Bloğun DOĞRUDAN sahip olduğu görsel de sınıflandırılır.** Çember 22b'nin "en içteki blok" kuralı, hem doğrudan görsel hem görselli alt blok taşıyan bir bloğu aday olmaktan çıkarıyor, doğrudan duran görsel **hiçbir kaba girmiyordu** → metnin yanında 150×204 kalıp komşusundaki 236×320 ile orantısız görünüyordu (admin bildirimi, 1116). `dogrudanGorseller()` + kabın **ilk görselin yerine** konması (sonuna eklenirse src sırası bozulup güvenlik sözü tüm dönüşümü geri alırdı) | 2 dosya, ~35 satır; 68/71 PASS; **ölçülen kapsam: 4 kurs / 412** (unreal-engine 1116/1336/1411/1028), görsel sayısı ve görünen metin değişmeyen: 412/412; canlı ölçüm (1116): orphan görsel **150×204 → 235×320**, komşusu 236×320 ile **eşit yükseklik**. Uzun metinli bloklardaki 153 görsel **dokunulmadı** (metni yeniden akıtmama kuralı) |
| 29 ✓ | 2026-10-02 | Çember 29 canlıda doğrulandı: 1365 ve 1364'te düzüm tablosu **0**, yalnız video tablosu duruyor, görsel sayısı 18/20 korundu, CSS `20261002-2` servis ediliyor | — |
| 29 | 2026-10-02 | **Düzüm tablolarının açılması (animasyon, 6 kurs).** İçerikte yalnızca hizalama için kullanılan tablolar (1 satır / 2 hücre, biri yalnız görsel, diğeri yalnız metin) `legacy-overview-layout.js` içinde **blok akışına açılır** (`duzumCedvelleriniAc`); görseller normal `uv-ov-media` kabına girer, metin tam genişliğe yayılır. Çember 28'de eklenen `vertical-align: top` **geri alındı** (metni hücrenin tepesine yapıştırıyordu) | 5 dosya, ~95 satır (50'si test); 68/71 PASS (3 FAIL HEAD'de de kırık); **canlı ölçüm:** 1365 görsel **60×320 → 589×320** (doğal boyut 600×326), 1364 görseller **144×320 → 248×320 / 209×320**, metin boşluğu **741 → 28px**; yerel DB: 6/6 kursta düzüm tablosu açıldı, **406 kursta 0 değişiklik**, görsel sırası ve metin farkı 0; video tablosu (iframe) **dokunulmadı** |
| 28 | 2026-10-02 | **Galeri boşluğu + görünmeyen videolar.** (a) `legacy-overview-layout.js`: görseller kaba alındıktan sonra blokta öğede kalan `<br>`'ler kaldırılır — **yalnızca kap oluşturulan bloklarda** (metinli ve görselsiz bloklar dokunulmaz, testle kilitli). (b) `course-content.css`: içerikteki `table` tam genişliğe açılır, `iframe` 16:9 / max 600px / ortalanır | 6 dosya, +63 satır (28'i test); 68/71 PASS (3 FAIL HEAD'de de kırık); **ölçülen sonuç:** boşluk **493 → 73px**, iframe **40×23 → 600×338**; 412 kursta **10 582 `<br>` kaldırıldı**, görsel sayısı değişen kurs **0**, metin kaybı **0**; dinamik sayfalarda **0 değişiklik** (asset sürümü `20261002-1`) |
| 27 | 2026-10-02 | `3d-modelleme` kategorisi içerik temizliği — **production'da Mimar uyguladı** (önce `pg_dump`) | plan: 50 kurs → 46 değişecek / 4 dokunulmayacak / 0 MANUAL; canlı doğrulama başarılı |
| 26 | 2026-10-02 | `grafik-tasarim` kategorisi içerik temizliği — **production'da Mimar uyguladı** | plan: 78 kurs → 74 değişecek / 4 dokunulmayacak / 0 MANUAL; canlı doğrulama başarılı. **Not:** bu kategoride `pg_dump` önce başarısız olmuştu (`role ... does not exist` — kabuktaki eski `DB_URL`), düzeltilmiş komutla alındı |
| 25a | 2026-10-02 | **Ucus oncesi koruma.** `layoutBarmakIzi` (gorsel / galeri / kart / **hizalanan gorsel** sayisi) + `barmakIziRiski`: icerik temizligi duzen sonucunu KOTULESTIRIYORSA kurs **MANUAL** isaretlenir ve yazilmaz. Yalnizca kotulesme risktir; kap birlesmesi gibi iyilesmeler normaldir | 3 dosya (+1 yeni test), ~70 satir; 33/33 test PASS; mevcut planlarda **0 MANUAL** → temizlik hicbir kursta duzeni bozmuyor. oyun-gelistirme olcumu: 52 kursun **52'sinde parmak izi ONCE/SONRA ayni** → degisiklik yalnizca fazla boslugu topluyor |
| 25b | 2026-10-02 | 3 kategori plan dosyasi hazir: **oyun-gelistirme** (52 kurs → 48 degisecek), **grafik-tasarim** (78 → 74), **3d-modelleme** (50 → 46); hepsinde 0 MANUAL / 0 koruma ihlali. Yerel tam dongu (oyun): apply 48/48 dogrulandi → ikinci dry-run 0 degisecek → revert **52/52 bayt bayt orijinal** | Production'da sirayla Mimar uygulayacak (her birinden once `pg_dump`) |
| 24b | 2026-10-02 | **Gizlilik sayfasi kismi guncelleme.** `kismiIcerikDegistir` servisi: "GİZLİLİK POLİTİKASI" isaretinden ONCEKI kisim (sayfa basligi + Google ile Giriş bildirimi + Üyelik Sözleşmesi) **bayt bayt korunur**, sonrasi yeni KVKK/Gizlilik metniyle degistirilir. Isaret bulunamazsa hicbir sey degismez | 3 dosya, +12 senaryo; 32/32 test PASS; metin 33 398 → **29 246** (tam degistirmede 10 404 olurdu); korunanlar: ÜYELİK SÖZLEŞMESİ 1→1, Google ile Giriş 2→4; yenilenenler: Veri Sorumlusu 0→2, Ticari Elektronik İleti 0→1, Çerezler 9→1; icerik kabi disinda fark YOK, `<title>` degismedi |
| 24 | 2026-10-02 | **Hukuki sayfa guncellemesi + footer link temizligi.** `legal-page-content.js` (duz metin → sayfa HTML'i; "N." → h2, "N.N." → p, madde → ul, sarilan satirlar birlestirilir, `< > &` kacisli), `update-legal-pages.js` CLI (dry-run/apply, yalnizca `#content` kabinin ici degisir), `legacy-footer-links.js` (istenmeyen footer linki render aninda tek yerden kaldirilir — **629 statik dosyaya dokunulmaz**) | 6 dosya (+3 yeni), ~320 satir; 32/32 test PASS; **Mesafeli Satis** ve **Iptal/Iade** sayfalari guncellendi (icerik kabi disinda fark YOK, `<title>` degismedi); yerel e2e: silinen link 4 sayfa tipinde 0, kalan 4 footer linki 4/4 duruyor. **Gizlilik sayfasi bilerek ERTELENDI** — bkz. acik karar |
| 23 | 2026-10-01 | **Kalan `yazilim` kurslarinin icerik temizligi.** Plan dosyasi artik **kategori** ile de verilebiliyor: slug listesi **calisma aninda DB'den** cozulur (`planKurslariniCoz`), `haricTutulan` ile Cember 20'de islenen 10 kurs disarida birakilir. Yerel DB production'dan eski oldugu icin elle liste yazilmaz (Cember 9 dersi) | 4 dosya (+2 yeni), ~70 satir; 31/31 test PASS; eski 10'luk plan **geriye uyumlu** calisiyor; yerel tam dongu: dry-run **111 kurs → 104 degisecek / 7 dokunulmayacak / 0 koruma ihlali** → apply 104/104 dogrulandi → ikinci dry-run **0 degisecek** → revert **118/118 bayt-bayt orijinal** |
| 22c | 2026-10-01 | **"Başarı Hikayeleri" CTA kutusu konumu.** Kutu (`div.alert-success`) içeriğin en sonunda, fotoğrafların altında kalıyordu; Mimar isteğiyle **son galeri bölümünün önüne** taşındı (üstteki metin ile "Eğitimimizden kareler" arasına), CSS'te 32px alt/üst nefes payı verildi | 4 dosya, +4 senaryo (21 senaryo); 30/30 test PASS; 6 gerçek kursta doğrulandı: CTA önde, görsel 24→24/21→21, metin kaybı yok. **Koruma kuralı güncellendi:** metin artık sıra değil **kayıp** olarak denetlenir (CTA bilerek taşındığı için sıra değişir); görsel sırası hâlâ birebir denetleniyor |
| 22b | 2026-10-01 | **Çember 22 düzeltmesi.** Canlı kontrolde 1454/1455 kurslarında 7 görsel bloğu sınıfsız kalmıştı: servis yalnız **üst seviye** blokları sınıflandırıyordu, görseller uzun metinli bir `<div>` içinde olduğu için dış blok "metinli" sayılıp atlanıyordu. Çözüm: **en içteki** görsel blokları seçilir; birleştirme için ayrıca **DOM'da bitişik kardeş** şartı eklendi (araya metin paragrafı girerse birleşmez) | 2 dosya, +3 senaryo (17 senaryo); 30/30 test PASS; canlı önizleme: 1454 → 5 medya + 1 galeri, hepsi ortalanmış, 21 görsel korundu; 668 → 2 galeri + 3 medya, sertifikalar **2+2 kart** düzeninde, 24 görsel korundu |
| 22 | 2026-10-01 | **"Eğitime İlk Bakış" görsel düzeni.** `legacy-overview-layout.js` (render anında blok sınıflandırma: metin>60 karakter → DOKUNULMAZ, 1–4 görsel → `uv-ov-media`, 5+ → `uv-ov-gallery`; ardışık **metinsiz** bloklar birleştirilir → sertifikalar 2+2), `legacy-product-tabs.js` hook (yalnız OVERVIEW, yalnız statik yol), `course-content.css` referans ölçülerle yeniden yazıldı | 7 dosya, ~430 satır; 30/30 test PASS; **DB'ye yazılmaz** → admin editöründe içerik ham/düzenlenebilir kalır (testle kilitli); canlı önizleme (668): 2 medya kabı + 1 galeri (10 kart), 24 görsel korundu, taşma 0, galeri 2 sütun (607px), sertifikalar yan yana eşit yükseklikte |
| 20 | 2026-09-30 | **B4 Adım 3 — 10 öncelikli kursun overview normalizasyonu.** `course-overview-normalize.js` (N1: 3+ `<br>`→1, N2: 2+ `&nbsp;`→boşluk, N3: boş blok kaldırma; metin/görsel kaybında **hata fırlatır**), plan JSON, `normalize-course-overview.js` CLI (dry-run/apply/revert, Çember 9 deseni) | 5 yeni + 2 değişen dosya, ~500 satır; 29/29 test PASS; **yerel tam döngü:** dry-run 10/10 DEGISECEK → apply 10/10 doğrulandı → ikinci dry-run **0 değişecek** (idempotent) → revert **10/10 bayt-bayt orijinal**. Uzunluk −%9…−%24; görsel sayısı ve görünen metin **her kursta aynı**. Production'da uygulama Mimar'da (önce `pg_dump`) |
| 19b | 2026-09-30 | **Birleştirme:** paralel çalışan diğer ajanın audit implementasyonu yanlışlıkla üzerine yazıldı (commit'lenmemişti, git'ten dönülemedi); testi sağlamdı → **26 senaryonun tamamı** birleşik teste taşındı, `satirIciSarmalayiciDerinligi` + `countConsecutiveBr`/`countNbsp`/`classifyImageBlocks`/`maxInlineWrapperDepth` servise eklendi, `analyseOverviewHtml` giriş noktası açıldı, CLI'ye `--kategori` filtresi geldi | 28/28 test PASS; `scripts/test-audit-course-overview.js` kaldırıldı (senaryoları korunarak); tek doğruluk kaynağı: `src/services/course-overview-audit.js` |
| 19 | 2026-09-30 | B4 Adım 1 — "Eğitime İlk Bakış" denetim raporu: `course-overview-audit.js` saf servisi (blok tarayıcı ile **en içteki** blok sayımı), `audit-course-overview.js` CLI (`--json`, `--limit`), test | 3 yeni + 2 değişen dosya, ~320 satır; 28/28 test PASS; **DB'ye yazmaz** (sahte prisma ile kanıtlandı); yerel çalıştırma: 435 kurs / 412 OVERVIEW tab / 389 problemli / 2 temiz; mevcut kod zincirine bağlanmadı (grep ile doğrulandı) |
| 19 | 2026-09-30 | Kurs arama motoru: sırasız token/etiket eşleşmesi + sembol desteği (#, +, &, ., /, - vb.), `legacy-course-catalog.js` ve `legacy-catalog.js` senkronu, asset version bump | 5 dosya, ~65 satır (35'i test); 24/24 test PASS; regresyon yeşil |
| 0 | 2026-09-15 | Proje araştırması + CLAUDE.md sistemi | 5 doküman; 12 unit test baseline PASS; R1 güvenlik bulgusu |
| 1b | 2026-09-15 | Belgeler Türkçeye çevrildi (`CLAUDE.md`, `.claude/rules/*`) | 4 dosya, kod değişikliği yok |
| 18 geri alma | 2026-09-24 | Genel overview enjeksiyonu kaldırıldı; regresyon testi ters beklentiye güncellendi | 25 PASS, 1 önceden mevcut FAIL (R9); servis Çember 18 öncesiyle aynı; commit/deploy ve canlı doğrulama bekliyor |
| 18 | 2026-09-23 | Statik kurs sayfalarına `course-overview.js` enjeksiyonu (`legacy-assets.js`, `data-course-overview` koşullu, idempotent, dinamik sayfayla aynı sürüm) | 1 kaynak dosya +19 satır, +1 test; 28/28 test PASS; yerel gerçek Chrome: script yüklendi, `uv-course-overview` sınıfı, 21/21 görsel normalize, 0 konsol hatası; 360px kapta 0 taşma, galeri 2×133px; 60 kurs sayfası tarandı → işaretli olanların %100'ü script aldı, 0 hata |
| 17 | 2026-09-23 | B4-a: `course-content.css` (64 satır, 4 çoklu-görsel deseni), `legacy-assets.js` enjeksiyonu, admin header aynı CSS; seçici kapsamı testle kilitlendi | 6 dosya (+2 yeni), ~150 satır; 26/26 test PASS; canlı sayfaya enjekte edilerek doğrulandı: bozuk kursta 9 blok hizalandı, taşan görsel 0; düzgün kursta 18 görselin 16'sı **hiç değişmedi** |
| 16 ✓ | 2026-09-23 | Çember 16 canlıda doğrulandı: 7 sayfa tipinde `legacy-whatsapp-appointment` = 0, sağ altta tek widget (`#wa-btn-wrapper`) | — |
| 16 | 2026-09-23 | Çift WhatsApp düğmesi: `ensureLegacyWhatsappButton` 3 çağrı yerinden kaldırıldı, `src/services/legacy-whatsapp.js` ve testi silindi, `test-legacy-header-layout` "buton olmamalı" doğrulamasına çevrildi | 5 dosya (2 silme), ~10 satır; 25/25 test PASS (631 public HTML tarandı); yerel e2e: ana sayfa / ürün / blog / blog-detay / kategori / tüm-ürünler → buton 0, GTM 1 |
| 15 ✓ | 2026-09-23 | R13 canlıda doğrulandı: `window.eapps` object (önce undefined), `embed.min.js`+`embed.min.css` yüklendi; `/admin/login` CSP'sinde widget host'u yok | — |
| 15 | 2026-09-23 | R13: `WIDGET_SCRIPT_SOURCES` / `WIDGET_CONNECT_SOURCES` / `WIDGET_STYLE_SOURCES` legacy CSP'ye eklendi (elfsight + delightchat); ödeme/EJS CSP'si değişmedi | 2 dosya (+1 yeni test), 22 satır; 24/24 test PASS; yerel gerçek Chrome: `window.eapps` object (önce undefined), `embed.min.css` 17 ms'de yüklendi, WhatsApp widget'ı göründü, kalan tek ihlal gtm.js `eval` (önceden var) |
| 14 ✓ | 2026-09-23 | R14 canlıda doğrulandı: `POST /ajax/cookieselection` → 200 `{"status":"ok"}` + `no-store`; komşu yollar (productfilters 200, bilinmeyen 404, GET 404) değişmedi | — |
| 14 | 2026-09-23 | R14: `src/routes/cookie-consent.js` (yan etkisiz `POST /ajax/cookieselection`) + `src/server.js` 2 satır bağlama | 2 yeni + 3 satır değişiklik; 23/23 test PASS; yerel e2e: 200 `{"status":"ok"}` + `no-store`, komşu `/ajax` route'ları (productfilters 200, member/register 400, bilinmeyen yol 404, GET 404) değişmedi |
| 13 ✓ | 2026-09-17 | GA4 canlı doğrulama: probe sayfası (gerçek domen) → GA4 Gerçek Zamanlı purchase 3; canlı 10 TL kart ödemesi → sonuç sayfası dataLayer purchase | Not: `127.0.0.1` kaynaklı hit'ler GA4 tarafından 503/`tt=spam` ile reddedilir — GA doğrulaması gerçek domenden yapılmalı |
| 13 | 2026-09-17 | GA4 `purchase` olayı: `analytics-events.js` (saf payload), `result.ejs` JSON data-bloğu + `ga4-purchase.js`, `paymentCsp` GA4 allowlist, `GA4_MEASUREMENT_ID` env | 8 dosya (+3 yeni), ~190 satır; 6/6 regresyon; gerçek Chrome: dataLayer'da purchase (value 149000, coupon), ikinci yüklemede 0 tekrar |
| 12 | 2026-09-17 | B5: kurs editöründe Jodit `cleanHTML.denyTags` iframe'siz | 3 dosya (+1 test), 4 satır kod; gerçek Chrome probe ile kök neden kanıtlandı; 6/6 test |
| 11 | 2026-09-17 | B1: havale kilidi kayıt tutarını korur (`bankTransferBaseAmount`), ödeme maillerinde kupon satırları | 5 dosya (+1 yeni), ~45 satır; yeni test + 7 regresyon PASS (`test-bank-transfer-discount` yeni kurala göre güncellendi) |
| 10 | 2026-09-17 | Üye kayıt/giriş formları sunucunun 4xx mesajını gösterir (409/429/400/401); `scripts.js` `?v=5.4.119` | 5 dosya, ~20 satır; test + 6 regresyon PASS; yerel: 409/400/401 JSON mesajları doğrulandı |
| 8b ✓ | 2026-09-17 | 8b canlıda Mimar tarafından doğrulandı | — |
| 8b | 2026-09-16 | Admin "Word'den içe aktar": `POST /admin/products/import-content` (multer bellek, CSRF), `import-response.js`, form dialogu, `admin-product-editor.js` (fetch → önizleme → Jodit), CSS | 8 dosya (+2 yeni), ~420 satır; 8/8 test; yerel HTTP e2e (302/403/200/400×3); gerçek Chrome: dialog, 12 panel, 3 editör dolduruldu, Sonuna ekle, 0 konsol hatası |
| 9 | 2026-09-16 | Toplu fiyat güncellemesi: plan JSON 91 satır, servis, CLI dry-run/apply/revert; **production'da uygulandı** (69 UPDATE, 18 SKIP, 4 MANUAL) | 5 dosya (+4 yeni) + `discountedVariantPrice` export; 8/8 test; yerel tam döngü: 76 yazım yalnız fiyat alanları, idempotent, revert birebir; 6 MANUAL (4 rejim belirsiz — Mimar: dokunulmaz, 1 süre null, 1 slug yok) |
| 8a | 2026-09-16 | docx → blok → bölüm ağacı → tab haritası → tab HTML (3 saf servis), CLI önizleme, anonim fixture, Word şablonu + rehber, `mammoth@1.12.3` | 12 dosya (+10 yeni), ~470 satır kod/test + 2 docx; 20/20 test; gerçek docx: Pille 1, 12 panel, 0 uyarı; PDF reddi; lazy require kanıtlandı |
| 7 | 2026-09-15 | Kurs listesi returnTo (Güncelle, Geri Dön, Durum, Sil; varyant yönlendirmesi query'yi korur) | 7 dosya (+2 yeni), ~120 satır; 8/8 test; yerel e2e: filtreli listeye 302, evil/`//` → `/admin/products` |
| 6b | 2026-09-15 | Şifre formu UX: `.alert-success` sırası düzeltildi (yeşil), `admin-change-password.js` ile anlık politika/eşleşme uyarıları ve pasif buton | 5 dosya (+1 yeni), ~90 satır; sunucu doğrulaması değişmedi |
| 6 | 2026-09-15 | Admin şifre değiştirme (`/admin/change-password`, politika, 2 rate-limit, oturum iptali) | 7 dosya (+3 yeni), ~330 satır (120'si test); 22/22 test; yerel e2e 14 senaryo (politika, yanlış şifre, 401/429, eski şifre reddi, ikinci oturum düşmesi) |
| 5 | 2026-09-15 | R10: dinamik kurs head meta + JSON-LD; statik og:image mutlak | 7 dosya (+1 yeni), ~200 satır (95'i test); 28/28 test; yerel e2e: dinamik sayfada 0 Python meta, statik nisbi sayfada yalnız 2 meta değişti |
| 4 | 2026-09-15 | Yan panel kategori sayaçları DB'den (22 listeleme sayfası) | 3 dosya (+2 yeni), ~180 satır (95'i test); 27/27 test; yerel e2e sayaç = kategori sayfası sayısı |
| 3 | 2026-09-15 | Dinamik kurs sayfası og:image / itemprop image / og:description | 3 dosya (+1 yeni), ~75 satır (60'ı test); R10 tespit edildi |
| 2 | 2026-09-15 | Kategori sayfalarında kurs araması (21 sayfa) | 6 dosya (+2 yeni), ~200 satır (95'i test); yeni test + 22 regresyon PASS; 21/21 kategori HTTP e2e; R9 önceden kırık test tespit edildi |
| 1 | 2026-09-15 | Kurs görseli: statik detay senkronu + admin "Görseli Kaldır" + tam boyut linki | 9 dosya (+2 yeni), ~220 satır (119'u test); yeni test + 23 regresyon = 24/24 PASS; yerel HTTP e2e doğrulandı; `test-legacy-product-visibility` (2cb9fa14'ten beri kırık) onarıldı |
