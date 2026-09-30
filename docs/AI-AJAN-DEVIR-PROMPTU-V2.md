# Unityverse Academy — AI ajanı devir promptu (Çember 19 + Audit sonrası)

> Bu dosyanın tamamı, projeyi devralacak AI ajanına **ilk mesaj olarak** verilmek üzere yazılmıştır.
> Olduğu gibi kopyalanabilir. Son güncelleme: 2026-09-30.
> **Önceki devir dosyası:** `docs/AI-AJAN-DEVIR-PROMPTU.md` (genel proje girişi — ilk okunan dosya).
> **Bu dosya:** ajanın _tam olarak_ nereden devam edeceğini anlatan **detaylı durum ve görev promptu**.

---

Merhaba. Bu projede benim yerime geçiyorsun. Aşağıdaki her şey **doğrulanmış ve kanıtlanmış**
bilgilerdir; yine de kod hakkında konuşmadan önce ilgili dosyayı açıp okuman beklenir.

## 1. HEMEN OKU — zorunlu dosyalar

Aşağıdaki dosyaları **sırasıyla** oku. Bunlar projenin anayasası, çalışma kuralları ve hafızasıdır:

| Sıra | Dosya | Neden |
|---|---|---|
| 1 | `docs/AI-AJAN-DEVIR-PROMPTU.md` | Genel proje girişi: roller, dil kuralı, çember yöntemi, TDD, test altyapısı, güvenlik, teslim şablonu, 12 pahalı ders |
| 2 | `CLAUDE.md` | Proje anayasası; her oturumda otomatik yüklenir |
| 3 | `.claude/rules/workflow.md` | Çember yöntemi detayları, 13 maddelik plan şablonu |
| 4 | `.claude/rules/security.md` | Sır politikası, oturum, CSRF, CSP, PayTR, PII |
| 5 | `.claude/rules/testing.md` | Test altyapısı ve kuralları |
| 6 | `PROJECT_STATE.md` | **Canlı durum günlüğü** — tüm çemberlerin geçmişi, riskler, backlog, ADR, ders defteri |
| 7 | `docs/egitime-ilk-bakis/00-GOREV-VE-SARTLAR.md` | Ana görev: Mimar'ın istekleri ve kesin şartları |
| 8 | `docs/egitime-ilk-bakis/01-TEKNIK-ANALIZ-VE-TAVSIYELER.md` | 438 sayfanın ölçümleri, 2 render yolu, denenenler, önerilen çözüm yolu |

## 2. KİM KİMDİR (değişmez)

- **Kullanıcı = Mimar (Architect).** Tüm tasarım kararları onundur. Sen seçenek ve öneri sunarsın,
  **kararı o verir**. Onay almadan büyük iş yapılmaz.
- **Sen = tek kişilik scrum ekibisin:** Software Engineer, QA, PM, PO, BA, DevSecOps, Cybersecurity.
- **Dil:** Sohbet/rapor = **Azerbaycanca**, kod yorumları ve `.md` = **Türkçe**, commit = İngilizce/Türkçe.
- **Deploy'u, git'i, production script'lerini Mimar yürütür.** Sen yalnızca adımları yazarsın.

## 3. NEREDE KALDIK — tam durum

### 3.1. Tamamlanan son iki iş

#### Çember 19 — Kurs arama motoru düzeltmesi ✅ (deploy edildi, canlıda doğrulandı)
- **Sorun:** Admin etiketlerle (`Blender online 80 saat`) arama yapınca sonuç bulamıyordu; çünkü
  arama motoru kelime sırasına bağlıydı ve `#`, `+`, `&` gibi semboller siliniyordu.
- **Çözüm:** Token tabanlı (`tokens.every()`) eşleşme — sıra önemsiz; `normalizeSearchText`
  regexine sembol koruması eklendi; asset version `20260930-1` ile bump edildi.
- **Dosyalar:**
  - `src/routes/legacy-catalog.js` — server-side token eşleşme
  - `src/routes/catalog.js` — fallback route token eşleşme
  - `public/tema10/js/legacy-course-catalog.js` — client-side token eşleşme + sembol regex
  - `src/services/legacy-assets.js` — version bump
  - `scripts/test-legacy-public-catalog.js` — 24 test (10+ yeni)
- **Durum:** ✅ 24/24 test PASS, canlıda Mimar test etti, başarılı.

#### Audit skripti — `scripts/audit-course-overview.js` ✅ (yazıldı, test edildi, commit bekliyor)
- **Amaç:** "Eğitime İlk Bakış" sekmesindeki yapısal bozuklukları raporlamak. **Salt okunur** —
  DB'ye ve dosyaya hiçbir şey yazmaz.
- **Dosyalar:**
  - `scripts/audit-course-overview.js` — ana skript (~300 satır)
  - `scripts/test-audit-course-overview.js` — 26 unit test
- **Durum:** ✅ 26/26 test PASS, lokal DB'de 3 kursla çalıştırıldı, hesabat yapısı doğrulandı.
- **CLI kullanımı:**
  ```bash
  node scripts/audit-course-overview.js              # text summary + kurs tablosu
  node scripts/audit-course-overview.js --json        # JSON to stdout
  node scripts/audit-course-overview.js --summary-only
  node scripts/audit-course-overview.js --limit=10    # ilk N kurs
  ```
- **9 diaqnostik qayda (her kurs için):**
  `bosOverview`, `gorselYok`, `ardisikBr`, `maxArdisikBr`, `nbspDolgusu`, `toplamNbsp`,
  `toplamGorsel`, `metinleKarisikGorselBlogu`, `kaptanGenisGorsel`, `widthAtributuYok`,
  `cokluGorselBlogu`, `satirIciSarmalayiciDerinligi`
- **Kabul kriteri:** rapor, `01-TEKNIK-ANALIZ-VE-TAVSIYELER.md` §2'deki sayılarla tutarlı olmalı.
  Bu henüz production DB'de doğrulanmadı (yerel DB production'ın kopyası değil).

### 3.2. Commit/deploy durumu

| İş | Commit | Deploy | Canlı test |
|---|---|---|---|
| Çember 19 (arama) | Bekliyor | ✅ Yapıldı | ✅ Başarılı |
| Çember 18 geri alma | Bekliyor | Bekliyor | — |
| Audit skripti | Bekliyor | — (script, site etkisi yok) | — |

**Not:** Çember 19 canlıda çalışıyor ama git commit'i henüz atılmadı. Audit skripti de commit
bekliyor. Mimar bunları birlikte commit edebilir.

### 3.3. Teslim paketi (audit skripti için — henüz verilmedi)

Mimar'a aşağıdaki teslim paketini ver:

```
### Dəyişən fayllar
- scripts/audit-course-overview.js — yeni: "Eğitime İlk Bakış" sekme içeriyi analiz skripti (salt oxunur)
- scripts/test-audit-course-overview.js — yeni: 26 unit test

### Test nəticələri
- node scripts/test-audit-course-overview.js → PASS (26/26)
- node scripts/audit-course-overview.js --limit=3 → 3 kurs analiz edildi, hesabat uğurlu

### Git addımları (Mimar yürüdür)
git status
git add scripts/audit-course-overview.js scripts/test-audit-course-overview.js
git commit -m "feat(audit): add course overview content audit script"
git push origin main

### Sunucuda (Mimar yürüdür)
cd ~/unityverse
git pull origin main
# Bu skript salt okunurdur, pm2 restart gerekmez.
# Production'da tam hesabat:
node scripts/audit-course-overview.js --json > /tmp/overview-audit.json

### Manuel canlı test rehberi
1. Sunucuda `node scripts/audit-course-overview.js --limit=5` çalıştır
2. Çıktıda 5 kurs görünmeli, her birinin diaqnostik sütunları dolu olmalı
3. `--json` çıktısı geçerli JSON olmalı (jq ile parse edilebilir)

### Rollback
git revert <hash> && git push  # veya dosyalar silinir (site etkisi yok)

### PROJECT_STATE.md güncellendi: xeyr (aşağıda güncelleme talimatı var)
```

## 4. SIRADAKİ GÖREV — ne yapılacak

`01-TEKNIK-ANALIZ-VE-TAVSIYELER.md` §4-§5'teki çözüm yolu:

### Adım 1 — Audit skripti ✅ (tamamlandı)
Yukarıda anlatıldı. Production'da tam çalıştırma Mimar'a bağlı.

### Adım 2 — Raporun Mimar ile gözden geçirilmesi
Audit hesabatı production DB'de çalıştırılacak. Mimar hangi kurslara dokunulacağına karar verecek.
Bu adım **senden değil Mimar'dan** gelecek.

### Adım 3 — Normalizasyon servisi + CLI (DRY-RUN / APPLY / REVERT)
**Henüz yapılmadı.** Bu, senin ilk büyük işin olacak. Detaylar:

- Dosya: `scripts/normalize-course-overview.js` (yeni)
- Desen: **Çember 9 (toplu fiyat güncellemesi) birebir tekrarlanacak** — o dosya referans:
  `scripts/update-course-prices.js`
- Plan dosyası: `scripts/data/overview-normalize-<tarih>.json`
- **4 güvenli normalizasyon kuralı (N1–N4):**

  | # | Kural | Neden güvenli |
  |---|---|---|
  | N1 | 3+ ardışık `<br>` → en fazla 1 | Yapay boşluk; metin/görsel sırası değişmez |
  | N2 | Satır başındaki/sonundaki `&nbsp;` dizileri → tek boşluk | Yapay girinti; içerik kaybı yok |
  | N3 | `width` > kap genişliği (~1076px) olan görselde `width`/`height` kaldır | Yalnız 28 kursu etkiler; taşmayı keser |
  | N4 | Boş satır içi kaplar (`<span></span>`, `<strong></strong>`) temizliği | Görünür etkisi yok, yapıyı sadeleştirir |

- **Bilerek yapılmayacaklar:** görseli bloğundan çıkarmak, blokları yeniden sıralamak, tipografiyi
  yeniden yazmak, tüm görselleri ortalamak, `width:auto!important` dayatmak.
- CLI: `--dry-run` (varsayılan), `--apply` (tek transaction), `--report`, `--revert`
- Production'da yalnızca Mimar, `pg_dump` yedeğinden sonra çalıştırır.
- Uygulamadan önce ve sonra **en az 5 temsili kurs örneğinde** masaüstü + mobil ekran görüntüsü
  alınır ve Mimar'a sunulur.

### Açık kararlar (Mimar verecek — §6)
1. Normalizasyon DB'ye kalıcı mı yazılsın, render anında mı uygulansın?
2. N1–N4 listesine ekleme/çıkarma var mı?
3. Hangi kurslara dokunulacak: en bozuk N mi, yoksa 295'in tamamı mı?
4. Tek görselli paragraflar ortalanacak mı? (Çember 17'de **hayır** denmişti)
5. Boş overview'lu 124 kurs ne olacak?

## 5. İŞ AKIŞI — audit skriptinden normalizasyona geçiş

```
[Şu an buradayız]
       │
       ▼
1. Mimar'a audit teslim paketini ver (§3.3)
       │
       ▼
2. Mimar audit'i commit edip production'da çalıştırır
       │
       ▼
3. Production hesabatı gelir → §2 sayılarıyla karşılaştır
       │
       ▼
4. Mimar §4 açık kararlarını verir
       │
       ▼
5. Normalizasyon servisi için 13 maddelik plan yaz → Mimar onayı bekle
       │
       ▼
6. TDD ile implement et (test → kırmızı → kod → yeşil)
       │
       ▼
7. Mimar dry-run → temsili 5+ kurs önce/sonra → apply
```

## 6. TEKNİK BAĞLAM — bildiklerin

### 6.1. Audit skripti mimarisi

```
scripts/audit-course-overview.js
├── countConsecutiveBr(html)        → max ardışık <br> sayısı
├── countNbsp(html)                 → toplam &nbsp; sayısı
├── maxInlineWrapperDepth(html)     → max iç içe inline element derinliği
├── classifyImageBlocks(html)       → { imageOnly, mixed, multiImage, oversized, noWidth }
├── analyseOverviewHtml(html)       → 12 alanlı tam diagnostik objesi
├── parseArgs(argv)                 → CLI argümanları
├── summarise(results)              → toplu istatistik
├── printTextReport / printPerCourseTable → insan okunur çıktı
└── main()                          → DB'den ProductTab okur, analiz eder, raporlar
```

- **Pure fonksiyonlar** (`countConsecutiveBr`, `countNbsp`, `maxInlineWrapperDepth`,
  `classifyImageBlocks`, `analyseOverviewHtml`) `module.exports` ile export edilir → test dosyası
  bunları doğrudan `require` eder, DB'ye ihtiyaç duymaz.
- Cheerio (`cheerio.load(html, null, false)`) ile HTML parse edilir — repo'da zaten mevcut bağımlılık.
- DB sorgusu: `prisma.productTab.findMany` ile `systemKey='overview'` veya
  `title='Eğitime İlk Bakış'` olan, ürünü `PUBLISHED` olan tabları çeker.

### 6.2. ProductTab modeli (prisma/schema.prisma:170–183)

```prisma
model ProductTab {
  id        Int      @id @default(autoincrement())
  productId Int
  product   Product  @relation(...)
  systemKey String?  @db.VarChar(32)
  title     String
  content   String   @default("")
  sortOrder Int      @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([productId, systemKey])
  @@index([productId, sortOrder])
}
```

### 6.3. Çember 9 deseni (normalize için referans)

`scripts/update-course-prices.js` incelenecek. Temel prensipler:
- Tarihli plan JSON: hangi kursa hangi değişiklik uygulanacağı, önceden belirlenmiş
- `--dry-run` varsayılan (hiçbir şey yazmaz, fark gösterir)
- `--apply` tek transaction
- Yazdıktan sonra DB'den **yeniden okuyup doğrulama**
- `--report` (audit izi) + `--revert` (birebir geri alma)
- Production'da yalnızca Mimar, `pg_dump` sonrası

### 6.4. İki render yolu (bilinmesi şart)

| Durum | Render yolu | Asset yolu |
|---|---|---|
| `urun/<slug>/index.html` **VAR** | `enhanceLegacyHtml` zinciri | Statik HTML + DB senkron alanları |
| Statik dosya **YOK** | `legacy-product-detail.js` | Python şablonu + DB + `course-overview.js` |

- Overview sekmesi her iki yolda da `id="tab-info"` kabındadır.
- `course-overview.js` yalnızca dinamik sayfaya eklenir — statik sayfalara **eklenmez** (Çember 18
  denedi, geri alındı).
- Normalizasyon bu farktan **bağımsız** çalışır çünkü DB'deki `ProductTab.content`'i temizler;
  her iki render yolu da aynı DB kaynağını kullanır.

## 7. YAPMAMAN GEREKENLER (tekrar tekrar kanıtlanmış)

1. **Global görsel dönüşüm uygulamak yasaktır.** Bir kursu düzelten script başkasını bozar.
2. **`course-overview.js`'i statik sayfalara enjekte etme.** Çember 18 denedi, geri alındı.
3. **Tüm görselleri `width:auto!important` ile normalize etme.** 199px rozet 600px olur.
4. **Görseli bloğundan çıkarma, blokları yeniden sıralama, tipografiyi yeniden yazma.**
5. **Yerel DB'deki sonuçları production gerçeği olarak sunma.** Yerel DB'de 46 kurs DRAFT,
   production'da yayında.
6. **Yerel `uploads/` görselleri yok** — görsel işlerinde yerel ekran görüntüsü yanıltıcıdır.
7. **Onay almadan >3 dosya veya >100 satır değişiklik yapma.**
8. **Test yazmadan kod yazma** — TDD: test → kırmızı → kod → yeşil → regresyon.

## 8. TEST ÇALIŞTIRMA

Toplu regresyon:
```bash
for s in test-rate-limit test-admin-members test-course-duration test-registration-pii \
  test-member-registration test-product-variants test-blog-categories test-bank-transfer-discount \
  test-registration-visibility test-social-oauth test-profile-completion test-legacy-product-image \
  test-legacy-product-visibility test-legacy-header-layout test-course-overview \
  test-course-content-styles test-cookie-consent-endpoint test-legacy-csp-widgets \
  test-ga4-purchase-event test-course-import test-admin-password test-admin-return-to \
  test-audit-course-overview test-legacy-public-catalog; do
  node scripts/$s.js >/dev/null 2>&1 && echo "PASS $s" || echo "FAIL $s"; done
```

**Bilinen kırık test:** `test-price-visibility-language.js` (R9) — Çember 18 öncesinden beri kırık,
kapsam dışı. Onun dışında bir FAIL görürsen senin değişikliğindendir.

## 9. İLK MESAJINDA NE YAPMALISIN

1. §1'deki dosyaları oku (özellikle `PROJECT_STATE.md` ve `docs/egitime-ilk-bakis/*`).
2. Mimar'a **Azerbaycanca**, kısa bir durum özeti ver:
   - Çember 19 (arama motoru) tamamdır, canlıda doğrulandı.
   - Audit skripti yazıldı, 26 test keçdi, commit/deploy bekləyir.
   - Sıradaki: audit hesabatının production'da çalıştırılması + Mimar'ın açık kararları.
3. §3.3'teki teslim paketini Mimar'a ver.
4. Mimar'ın qərarını gözlə:
   - Audit'i commit edib production'da çalıştırmaq istəyirsə → addımları yaz.
   - Normalizasiyaya keçmək istəyirsə → 13 maddelik plan yaz, **onay gözlə**.
   - Başqa bir iş gəlirsə → `PROJECT_STATE.md` → Backlog'a bax, çember aç.
5. **Onaysız kod yazma.**

## 10. PROJECT_STATE.md GÜNCELLEMESİ (sənin ilk işin)

`PROJECT_STATE.md`'nin aşağıdaki bölümləri güncəllənməlidir:

- **Çember geçmişi** cədvəlinə əlavə et:
  ```
  | 20 | 2026-09-30 | Audit: course overview content diagnostik skripti (salt okunur) | 2 yeni dosya, ~330 satır; 26/26 test PASS; lokal DB doğrulandı |
  ```
- **Backlog** bölümünə əlavə et:
  ```
  - [ ] **B4-c (audit hazır, normalizasyon bekliyor) — overview normalizasyon servisi.** Audit skripti
    (`scripts/audit-course-overview.js`) tamamlandı; sıradaki: Çember 9 deseniyle
    `normalize-course-overview.js` (dry-run/apply/revert) + plan JSON.
    Mimar'ın 5 açık kararı bekliyor (`01-TEKNIK-ANALIZ-VE-TAVSIYELER.md` §6).
  ```

---

> **Son söz:** Bu dosya 2026-09-30 itibarıyla tamdır. `PROJECT_STATE.md` projenin **canlı hafızası**,
> bu dosya ise **bir kerelik devir belgesidir**. Bağlamın dolmaya başladığını hissedersen
> `PROJECT_STATE.md`'yi güncelle, yeni bir devir dosyası yaz.
