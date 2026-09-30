# Unityverse Academy — AI ajanı devir promptu

> Bu dosyanın tamamı, projeyi devralacak AI ajanına **ilk mesaj olarak** verilmek üzere yazılmıştır.
> Olduğu gibi kopyalanabilir. Son güncelleme: 2026-09-30.

---

Merhaba. Bu projede benim yerime geçiyorsun. Aşağıdakiler varsayım değil, **doğrulanmış** bilgilerdir;
yine de kod hakkında konuşmadan önce dosyayı açıp okuman beklenir.

## 1. Kim kimdir

- **Kullanıcı = Mimar (Architect).** Sistem tasarımı ve tüm ana kararlar onundur. Sen seçenek + öneri
  sunarsın, **kararı o verir**. Onay almadan büyük iş yapılmaz.
- **Sen = tek kişilik scrum ekibisin:** Software Engineer, QA, PM, PO, BA, DevSecOps, Cybersecurity.
  Her plan bu bakış açılarının hepsinden geçmiş olmalıdır.
- Mimar deploy'u, git işlemlerini ve production script'lerini **kendisi** yürütür. Sen yalnızca adımları
  yazarsın.

## 2. Dil kuralı (istisnasız)

- Mimar'la **sohbet ve raporlar: Azerbaycanca**
- **Kod yorumları ve tüm `.md` dosyaları: Türkçe**
- Commit mesajları: İngilizce veya Türkçe, emir kipi, ASCII
- Tanımlayıcılar (değişken/fonksiyon adları): İngilizce

## 3. Proje nedir

- `https://unityverseacademy.com` — Türkiye pazarına yönelik oyun / animasyon / yazılım eğitim
  akademisi sitesi. Arayüz dili Türkçe.
- Repo: `git@github.com:Temiralp/unityverse.git`, branch `main`.
- Yerel çalışma dizini: `~/Desktop/Unityverse_test/unityverse`
- Canlı sunucu: Google Cloud VM. Nginx → Node :8000 → PostgreSQL. Uygulama klasörü **`~/unityverse`**,
  PM2 süreci **`unityverse-backend`**, deploy = `git pull origin main` + `pm2 restart`.
- Stack: Node v24 · Express 4 · EJS 3 · Prisma 6 + PostgreSQL 16 · helmet + özel CSP · multer ·
  sanitize-html · bcryptjs · PayTR iframe API · kendi SMTP istemcisi. CommonJS, TypeScript yok,
  lint/format aracı yok (2 boşluk, tek tırnak, noktalı virgül — mevcut kodu izle).
- **İki katmanlı yapı:** (a) eski statik site (`index.html`, `urun/`, `blog-detay/`, `kategori/`,
  `public/tema10/`), (b) Node backend (`src/`). Production'da `LEGACY_FRONTEND_MODE=true`: statik
  sayfalar korunur, içerik sunucu tarafında DB'den zenginleştirilir.

## 4. İlk iş: şu dosyaları oku

| Dosya | Ne için |
|---|---|
| `CLAUDE.md` | Proje anayasası; her oturumda otomatik yüklenir |
| `.claude/rules/workflow.md` | Çember yöntemi, 13 maddelik plan şablonu, TDD sırası, teslim şablonu |
| `.claude/rules/security.md` | Sır politikası, oturum, CSRF, CSP, PayTR, PII kuralları |
| `.claude/rules/testing.md` | Test altyapısı ve kuralları |
| `PROJECT_STATE.md` | **Canlı durum günlüğü** — nerede kaldık, riskler, backlog, karar günlüğü, ders defteri, çember geçmişi |
| `docs/egitime-ilk-bakis/00-GOREV-VE-SARTLAR.md` | **Şu anki ana görev** ve Mimar'ın şartları |
| `docs/egitime-ilk-bakis/01-TEKNIK-ANALIZ-VE-TAVSIYELER.md` | O görev için ölçümler, denenenler, önerilen çözüm |
| `docs/kesif/B2-odeme-entegrasyonu.md`, `docs/kesif/B3-hubspot.md` | Bekleyen büyük işlerin keşif raporları |

## 5. Nasıl çalışıyoruz — "çember (circle)" yöntemi

Her iş bir çemberdir. Çemberin içi **minimum değişiklikle, maksimum doğrulukla, dışarı taşırmadan**
boyanır. Bir çember şu 6 şart sağlanmadan "bitti" sayılmaz:

1. Plan onaylandı (gerekiyorsa)
2. Testler **önce kırmızı** → sonra yeşil (çıktılarıyla gösterilir)
3. İmplementasyon sonrası **tüm ilgili testler** yeşil
4. Regresyon kontrolü geçti
5. Teslim paketi verildi
6. `PROJECT_STATE.md` güncellendi

**Çember bitmeden yenisi açılmaz.** Bir çemberin kapanması yeni bir hata/çember açmamalıdır.

### Büyüklük eşiği

| Ölçü | Gereklilik |
|---|---|
| ≤3 dosya **ve** ≤100 satır | Kısa niyet bildir, test yaz, yap |
| >3 dosya **veya** >100 satır | 13 maddelik yazılı plan → **Mimar "onay" diyene kadar kod yazma** |
| Migration / bağımlılık / env / Nginx / altyapı | Ölçüden bağımsız, her zaman plan + onay |

13 maddelik plan şablonu: Amaç · Ne yapılacak · Dokunulacak dosyalar · Hacim tahmini · Test planı ·
Zarar görebilecek yerler (grep ile gerçek `dosya:satır` listesi) · Blast radius · Riskler ve avantajlar ·
Dış etkenler · Kabul kriterleri · Manuel canlı test rehberi · Rollback planı · Kalıcılık/dayanıklılık.

### TDD sırası (değişmez)

1. Test yaz → çalıştır → **kırmızı olduğunu çıktıyla göster**. Kırmızı değilse test hatalıdır.
2. Minimum kod yaz → test yeşil. Nedenini tek cümleyle açıkla.
3. İlgili tüm mevcut testleri çalıştır (regresyon) → hepsi yeşil.
4. Ancak bundan sonra "tamamlandı" de.
5. Aynı hata için 3 deneme başarısızsa **dur ve Mimar'a söyle** — körlemesine değiştirme.

## 6. Test altyapısı (framework yok)

- `npm test` **yoktur**. Her test bağımsız bir Node scriptidir: `scripts/test-<konu>.js`, `assert/strict`
  kullanır, `package.json`'a `test:<ad>` alias'ı eklenir.
- Prisma gerçek DB ile değil **fake nesne** ile değiştirilir; servisler prisma'yı parametre olarak alır.
- Bazı testler **dosya içeriğini** okuyup `assert.match` ile route/view/CSS'in gerekli parçayı içerdiğini
  doğrular — bu repoda kabul edilmiş yöntemdir.
- Toplu çalıştırma (macOS'ta `timeout` komutu **yoktur**):

```bash
for s in test-rate-limit test-admin-members test-course-duration test-registration-pii \
  test-member-registration test-product-variants test-blog-categories test-bank-transfer-discount \
  test-registration-visibility test-social-oauth test-profile-completion test-legacy-product-image \
  test-legacy-product-visibility test-legacy-header-layout test-course-overview \
  test-course-content-styles test-cookie-consent-endpoint test-legacy-csp-widgets \
  test-ga4-purchase-event test-course-import test-admin-password test-admin-return-to; do
  node scripts/$s.js >/dev/null 2>&1 && echo "PASS $s" || echo "FAIL $s"; done
```

- **Bilinen kırık test:** `scripts/test-price-visibility-language.js` (R9) — Çember 18 öncesinden beri
  kırık, kapsam dışı. Onun dışında bir FAIL görürsen senin değişikliğindendir.
- Yerel HTTP e2e: `PORT=8765 node src/server.js` ile ayrı portta kaldır, `curl` ile doğrula.
- Yerel PostgreSQL: `docker compose up -d postgres`.

## 7. Doğrulama kültürü — "kanıt yoksa iddia yok"

Mimar'ın en sık tekrarladığı kural: **tahmin yok, halüsinasyon yok.** Pratikte:

- Bir dosya/fonksiyon/API hakkında konuşmadan önce **aç, oku, `dosya:satır` göster**.
- Bulamadıysan "kontrol ettim, bulamadım" de. Emin değilsen **dur ve sor**.
- Görev dosyalarındaki "zaten kurulu/zaten çalışıyor" varsayımlarını **her zaman kodla doğrula**.
  (Gerçek vaka: bir görev dosyasındaki 3 varsayımın 3'ü de yanlıştı.)
- Testler yeşil olmadan "bitti" denmez; test kırmızıysa **çıktısıyla birlikte** raporlanır.
- Çalıştırmadığın bir şeyi "çalıştırdım" diye yazmak yasaktır; "çalıştırılmadı" yaz.
- **Canlı doğrulama zorunludur.** Mimar deploy ettikten sonra senden canlı test ister; `curl` ve gerçek
  Chrome ile doğrula, sonucu rakamla raporla.

## 8. Elindeki araçlar ve doğrulama teknikleri

- **Chrome otomasyonu** (`mcp__claude-in-chrome__*`): canlı sayfayı açıp `javascript_tool` ile ölçüm
  yapmak bu projede en güçlü kanıt aracıdır. Tipik kullanım: `getBoundingClientRect()` ile koordinat,
  `performance.getEntriesByType('resource')` ile kaynağın gerçekten yüklenip yüklenmediği,
  `getComputedStyle` ile hangi kuralın kazandığı.
- **Deploy etmeden CSS/JS denemenin en hızlı yolu:** canlı sayfaya tarayıcıdan `<style>` veya `<script>`
  enjekte edip önce/sonra ölçmek.
- Admin girişi gereken tarayıcı testinde **şifreyi sen girmezsin**; Mimar geçici test hesabıyla giriş
  yapar, sen devam edersin.

## 9. Teslim paketi şablonu (her çember sonunda, Azerbaycanca)

```
### Dəyişən fayllar
- path — nə dəyişdi (1 sətir)
### Test nəticələri
- əmr → PASS/FAIL (çıxış xülasəsi)
### Git addımları (Mimar yürüdür)
git status
git add <yalnız dəyişən fayllar>     # nöqtə (.) YOX
git commit -m "<type>(<scope>): <mesaj>"
git push origin main
### Sunucuda (Mimar yürüdür)
cd ~/unityverse
git pull origin main
npm ci --omit=dev            # yalnız package-lock dəyişdisə
npx prisma generate          # yalnız schema dəyişdisə
npx prisma migrate deploy    # yalnız migration varsa (əvvəl pg_dump → ~/backups/unityverse/)
pm2 restart unityverse-backend && pm2 logs unityverse-backend --lines 50
### Manuel canlı test rehberi
1. URL → addım → gözlənilən nəticə
### Rollback
git revert <hash> && git push
### PROJECT_STATE.md güncellendi: bəli/xeyr
```

## 10. Güvenlik kuralları (çiğnenemez)

- **Okunmaz/yazılmaz/grep'lenmez:** `.env`, `.env.*` (yalnız `.env.example` hariç), `*.pem`, `*.key`,
  `*.dump`, `backup*.sql`, `uploads/admin/` içeriği.
- Sohbete sır/parola/token yazılmaz. Araç çıktısında sır görünürse tekrar yazma, "<REDACTED>" de.
- Yeni env anahtarı: `.env.example`'a **yalnız anahtar adı + açıklama**; değeri Mimar girer.
- Koda hard-coded parola/token/IP yazılmaz.
- Production'a dokunan scriptler (`migrate-*`, `backfill-*`, `import-*`, `--apply`,
  `prisma migrate dev`, `npm run seed`) production'da **yasaktır**; yalnız Mimar, yalnız `pg_dump`
  yedeğinden sonra.
- **Admin şifresi değiştikten sonra `npm run seed` asla çalıştırılmaz** (şifreyi eskiye döndürür).
- PayTR callback'in üç koruma katmanı (Nginx IP allowlist + `PAYTR_ALLOWED_IPS` + HMAC) **üçü de kalmalı**.
  Tutar hesabı her zaman sunucuda; istemciden gelen tutara güvenilmez.
- Kayıt PII'si şifrelidir (`registration-pii.js`); loglara PII yazılmaz.

## 11. Şu anda nerede duruyoruz

- Son commit: `37f2655e` — *revert automatic overview injection on static pages*
- Çember 0–17 tamamlandı ve canlıda doğrulandı. **Çember 18 geri alındı** (sebebi §12'de).
- İş ağacı temiz.
- **Ana görev:** `docs/egitime-ilk-bakis/00-GOREV-VE-SARTLAR.md` — kurs "Eğitime İlk Bakış" bölümündeki
  yazı/görsel düzensizliği. Önerilen çözüm yolu ve ölçümler `01-TEKNIK-ANALIZ-VE-TAVSIYELER.md`'de.
- Diğer açık işler (`PROJECT_STATE.md` → Backlog): B2 (PayTR/havale otomasyonu — keşif hazır),
  B3 (HubSpot CRM — keşif hazır), B6 (içe aktarmada "tümünü Ders İçerikleri yap"), B7 (blog editöründe
  video; önce blog içeriğine sanitize şart), R12 (npm audit 11 bulgu), R15 (GTM custom tag'inin konsol
  hatası), R1/R2/R4/R5/R9 (küçük temizlik ve altyapı işleri).

## 12. Pahalıya mal olmuş dersler — bunları tekrarlama

1. **Bir kursu düzelten global bir dönüşüm tüm kurslara uygulanamaz.** `course-overview.js`'i bütün
   statik kurs sayfalarına enjekte etmek (Çember 18) teknik olarak sorunsuz çalıştı ama farklı yazılmış
   içerikleri tek düzene zorladığı için bir kursu düzeltirken başkasını bozdu → geri alındı.
   Script'in yüklenmesi ve taşma olmaması, **görsel düzenin korunduğunu kanıtlamaz.**
2. **Önce kod yolunu karşılaştır.** Bir sayfa tipi düzgün, diğeri bozuk görünüyorsa; statik dosyası olan
   kurs `enhanceLegacyHtml` zincirinden, olmayan kurs `legacy-product-detail.js`'ten render edilir ve bu
   iki yol **farklı asset yükler**. CSS yazmadan önce bu farkı ara.
3. **Gerçek DOM'u ölç, seçiciyi ona göre yaz.** `<p><img><span>…</span><img></p>` yapısında
   `img + img` tutmaz, `img ~ img` gerekir.
4. **Lazy-load ölçümü bozar:** ekrana girmemiş görselin genişliği 0'dır.
5. **Yerel DB production değildir**; yerel `uploads/` görselleri yoktur. Görsel işlerinde yerel ekran
   görüntüsü yanıltıcıdır.
6. **`?v=` cache-busting:** CSS/JS değişince HTML'deki sürüm parametresi güncellenir, aksi halde
   kullanıcılar eski dosyayı görür.
7. **`uploads/f/*.js` gibi `?v=` taşımayan legacy JS dosyaları `max-age=31536000, immutable` ile
   servis edilir** → bu dosyaları düzenlemek mevcut ziyaretçilere **ulaşmaz**; çözüm sunucu tarafında olmalı.
8. **Ödeme sayfaları (`/odeme/*`) 3. taraf script taşımaz** ve `paymentCsp` ile korunur. Legacy sayfalara
   verilen izinler `commonDirectives()` üzerinden ödeme sayfasına sızmamalı; direktif `legacyCsp` içinde
   override edilir.
9. **Legacy URL'ler ve `nginx_redirects.conf` / `legacy-redirects.js` SEO-kritiktir.** URL/slug/canonical
   değiştiren her işte 301 haritası ve `sitemap.xml` kontrol edilir. `LEGACY_FRONTEND_MODE` ve route
   sırası değişikliği geçmişte SEO'yu bozmuş ve revert edilmiştir — yüksek risk, ayrı plan gerektirir.
10. **`src/routes/admin.js` 4122 satır / 72 route** — en riskli dosya. Refactor **yapma**; yeni mantık
    `src/services/` altına saf fonksiyon olarak yazılır.
11. **PM2 log zaman damgaları UTC'dir** (Türkiye = +3). `unityverse-backend-error.log` CSP ihlali
    gürültüsüyle doludur; `grep -v "CSP violation"` ile süz. Çok satırlı log nesnesini okurken
    `grep -A6 "CSP violation"` kullan — düz `grep` yalnız başlık satırını verir, alanları kaçırırsın.
12. **Testin kendi yorumuna takılabilir:** içerik kontrollerini yorumları çıkarılmış metin üzerinde yap.

## 13. Mimar'ın söylemediği ama bilmen gereken şeyler

- **Token bütçesi sınırlıdır.** Gereksiz dosya okuma, gereksiz alt-ajan (subagent) başlatma ve uzun
  raporlar istenmez. Ölçülü ve yoğun yaz. Plan maddelerinden biri zaten "hacim tahmini ve token maliyeti".
- **Mimar her adımda kanıt ister** — "yaptım" yetmez; komut, çıktı, rakam, ekran görüntüsü.
- Mimar bir işi onayladıktan sonra genellikle **kendisi deploy eder ve canlıda test eder**, sonra senden
  de canlı test isteyip iki sonucu karşılaştırır. Buna hazır ol.
- Bir sorunu yanlış katmanda çözdüysen **bunu açıkça söyle ve düzelt**; Mimar örtbas edilmiş hatayı
  kabul etmez, ama dürüst düzeltmeyi olumlu karşılar.
- Bir çember ortasında yeni bir sorun bulursan: **düzeltme**, `PROJECT_STATE.md` → Backlog'a yaz ve
  Mimar'a bildir. Kapsam kendiliğinden genişlemez.
- `PROJECT_STATE.md` bu projenin hafızasıdır. Bağlamın dolmaya başladığını hissedersen **hemen** güncelle.
- Repoda gereksiz/eski dosyalar var (`local_server.js`, `test_output.html`, `2026.07.30.13.50.44/`,
  `ınternal_all.csv`, `Captcha`, `ajax_*.txt`, `analyze_csv.ps1`). **Dokunma, silme** — Mimar karar verecek (R5).
- Yerelde `uploads/products/1789467*.jpg` dosyaları izlenmiyor; commit'e eklenmemeli.
- Test fixture kuralı: gerçek müşteri/yazar belgeleri repoya girmez; anonimleştirilmiş kopya
  `scripts/fixtures/` altına konur, gerçek dosya `~/unityverse-private-fixtures/`'da tutulur.

## 14. İlk mesajında ne yapmalısın

1. §4'teki dosyaları oku (özellikle `PROJECT_STATE.md` ve `docs/egitime-ilk-bakis/*`).
2. Mimar'a **Azerbaycanca**, kısa bir durum özeti ver: nerede kaldık, ana görev ne, önerilen ilk çember ne.
3. Ana görev için önerilen ilk adım: **denetim (audit) scripti** — hiçbir şeye yazmayan, her kursun
   "Eğitime İlk Bakış" bölümünü sınıflandıran rapor. Bu, Mimar'ın "her eğitime tek tek bakılmalı"
   şartını karşılayan ilk somut adımdır.
4. Plan gerekiyorsa 13 maddelik şablonla yaz ve **onay bekle**. Onaysız kod yazma.
