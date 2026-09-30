# "Eğitime İlk Bakış" düzeni — teknik analiz, denenenler ve ekip tavsiyesi

> Hazırlayan: AI ekibi (Software Eng / QA / PM / BA / DevSecOps bakışı), 2026-09-30.
> Ölçümler bu tarihte `urun/*/index.html` (438 dosya) ve canlı site üzerinde yapılmıştır.
> İstek ve şartlar: `00-GOREV-VE-SARTLAR.md`.

---

## 1. Sayfa nasıl oluşuyor (iki ayrı kod yolu)

Bu ayrım, sorunun kökünü anlamak için **zorunlu** ön bilgidir:

| Durum | Render yolu | Sonuç |
|---|---|---|
| Kursun `urun/<slug>/index.html` **statik dosyası VAR** | `src/middleware/legacy-whatsapp.js` → `enhanceLegacyHtml` zinciri | Statik HTML + DB'den senkron alanlar |
| Statik dosya **YOK** | `src/routes/legacy-product-detail.js` (Python kursu şablonundan üretim) | Şablon + DB içeriği |

- Overview sekmesi her iki yolda da `id="tab-info"` kabındadır (`legacy-product-tabs.js:10`).
- `data-course-overview` işaretini **zincirde** `synchronizeLegacyProductTabs` koyar
  (`src/services/legacy-product-tabs.js:91` ve `:128`) — yani DB tab birleştirme yolu çalıştıysa.
- `public/tema10/js/course-overview.js` (görselleri ortalar, 3+ görseli galeri grid'ine çevirir,
  başlık/paragrafları yeniden boyutlandırır) **yalnızca dinamik sayfaya** eklenir:
  `src/routes/legacy-product-detail.js:316`.

**Sonuç:** iki sayfa tipi farklı görünür. Ama bu, "statik sayfalara da script ekleyelim" demek değildir
— bkz. §4.

---

## 2. Ölçülen gerçek durum (438 statik kurs sayfası)

### 2.1 Overview içeriğinin dağılımı

| Kategori | Kurs sayısı |
|---|---|
| Overview **boş** (`<div id="tab-info"> </div>`) | **124** |
| Yalnız metin, görsel yok | **12** |
| Görselli ve **en az bir bozukluk işareti taşıyan** | **295** |
| Görselli ve tamamen temiz | **0** |

> Yani görseli olan **her** kursta en az bir bozukluk işareti var. Bu, içeriğin Word/WYSIWYG'den
> yapıştırılmış olmasının tipik sonucudur.

### 2.2 Bozukluk işaretlerinin sıklığı (295 kurs içinde)

| İşaret | Kurs sayısı |
|---|---|
| 3 veya daha fazla ardışık `<br>` (yapay boşluk) | **295** |
| 20+ `&nbsp;` dolgusu (yapay girinti) | **295** |
| Görselin **metinle aynı blokta** karışık olması (blokta 60+ karakter metin + görsel) | **177** |
| Kaptan geniş görsel (`width` > ~1076px) | **28** |

### 2.3 Görsel istatistikleri

- Toplam görsel: **3764**
- `width` atributu **olmayan**: **425**
- Genişlik dağılımı: min 150px, medyan **502px**, p90 590px, maks **1200px**
- Aynı blokta 2+ görsel içeren blok: **618**
  - 269 blokta görseller **doğrudan kardeş** (`<p><img>…<img></p>`)
  - 190 blokta biri doğrudan, diğeri `<span>`/`<strong>` içinde
  - 159 blokta hepsi sarmalayıcı içinde

**Tipik bozuk yapı örneği (canlı sayfadan alınmıştır):**

```html
<h2><span><strong><span><br><br><br><br>&nbsp;&nbsp;&nbsp;…<img></span></strong><IMG>
<span>Neden Bu…</span></span></h2>
```

Görsel, başlık metniyle **aynı satır içi kapta**; öncesinde 4 adet `<br>` ve onlarca `&nbsp;` var.

---

## 3. Denenen çözümler ve sonuçları (tekrar edilmemesi için)

### 3.1 Çember 17 — `course-content.css` (kısmen başarılı, canlıda duruyor)

- `public/tema10/css/course-content.css`: kapsam **yalnızca**
  `:is(#tab-info, #tab-additional-content2, #tab-additional-content3, .jodit-wysiwyg)`.
- Yaptığı: görsellere `max-width:100%; height:auto` (taşmayı keser) + 2'den fazla görsel içeren
  blokları flex ile sarmalayıp ortalar. Tek görselli paragraflara **kasten dokunmaz**
  (Mimar kararı: bugün düzgün görünen sayfalar değişmesin).
- Ölçülen etki: bozuk kursta 9 blok hizalandı, taşan görsel 0 oldu; düzgün kursta 18 görselin 16'sı
  **piksel-piksel aynı** kaldı.
- **Yetersiz kalan yön:** görselin metinle karışık olduğu 177 kurstaki blokları çözmez — çünkü o blokları
  flex'e çevirmek başlık metnini de yeniden akıtır, yani içeriği bozar.
- **Durum: canlıda, geri alınmadı.** (commit `6072a60f`)

### 3.2 Çember 18 — `course-overview.js`'i statik sayfalara enjekte etmek (GERİ ALINDI)

- Yapılan: `legacy-assets.js` içinde, sayfada `data-course-overview` varsa script `</body>` öncesine
  eklendi (commit `94e2d36d`).
- Teknik olarak çalıştı: script yüklendi, `uv-course-overview` sınıfı uygulandı, 24/24 görsel normalize
  edildi, 0 konsol hatası, 360px kapta 0 taşma.
- **Ama Mimar'ın testinde bir kursu düzeltirken başka bir kursu bozdu** → 2026-09-24'te geri alındı
  (commit `37f2655e`).
- **Kök sebep (ders):** script `width:auto!important` uygular, yani HTML'deki `width="199"` yok sayılır
  ve görsel doğal boyutunda (maks 600px) gösterilir. 199px'lik bir rozet 600px olur. Ayrıca başlık,
  paragraf ve liste tipografisini de yeniden yazar. Farklı yazılmış içerikler için bu **tek tip dayatmadır**.
- **Yanlış olan çıkarım da kayda geçti:** "script eksikliği tüm hizalama sorunlarının tek nedenidir"
  ifadesi doğru değildi; bazı örnekleri açıklıyordu, hepsini değil.

### 3.3 Ölçüm yaparken düşülen tuzaklar (zaman kaybettirir)

1. **Lazy-load:** ekrana girmemiş görselin `getBoundingClientRect().width` değeri **0**'dır; "ortada"
   gibi yanlış sonuç verir. Ölçmeden önce `scrollIntoView` + bekleme veya `loading='eager'` gerekir.
2. **Yerel sunucuda `uploads/` görselleri yok** → yerel ekran görüntüsü görsel işlerinde yanıltıcıdır.
   En hızlı doğru yöntem: **canlı sayfaya tarayıcıdan `<style>`/`<script>` enjekte edip** önce/sonra
   koordinat ölçmek (deploy gerektirmez).
3. **Yerel Docker DB production'ın kopyası değildir** (yerelde 46 kurs DRAFT). Kapsam/etki listesi
   yalnızca production'dan alınır.
4. **Chrome eklentisinin `read_console_messages` aracı CSP ihlallerini yakalamaz**; kaynağın gerçekten
   engellenip engellenmediği `performance.getEntriesByType('resource')` içinde
   `encodedBodySize`/`duration` = 0 ile anlaşılır.
5. `img + img` (bitişik kardeş) seçicisi gerçek yapıyı **tutmaz**; `img ~ img` (genel kardeş) gerekir.

---

## 4. Ekip tavsiyesi — önerilen çözüm yolu

> Temel ilke: **Global bir görsel dönüşüm uygulamayın.** Mimar'ın şartı ve Çember 18 deneyimi bunu
> yasaklıyor. Bunun yerine **kurs bazında teşhis → onaylı, geri alınabilir düzeltme**.

### Adım 1 — Denetim (audit) scripti, YALNIZCA rapor üretir (önerilen ilk çember)

`scripts/audit-course-overview.js` (yeni, DB'ye ve dosyaya **yazmaz**):

- Her kursun overview HTML'ini okur (kaynak: DB `ProductTab` içeriği — tek doğruluk kaynağı).
- Her kurs için bozukluk imzalarını çıkarır:
  `bosOverview`, `gorselYok`, `ardisikBr`, `nbspDolgusu`, `metinleKarisikGorselBlogu`,
  `kaptanGenisGorsel`, `widthAtributuYok`, `cokluGorselBlogu`, `satirIciSarmalayiciDerinligi`.
- Çıktı: `scripts/data/overview-audit-<tarih>.json` + insan okunur özet tablo.
- **Kabul kriteri:** rapor, §2'deki sayılarla tutarlı çıkmalı (doğrulanabilirlik).

Bu adım tek başına değerlidir: Mimar hangi kursun neden bozuk olduğunu **liste halinde** görür ve
hangilerine dokunulacağına kendisi karar verir.

### Adım 2 — Güvenli ve içerikten bağımsız normalizasyon kümesi

Yalnızca **anlamı değiştirmeyen**, tartışmasız düzeltmeler. Öneri sırası:

| # | Düzeltme | Neden güvenli |
|---|---|---|
| N1 | 3+ ardışık `<br>` → en fazla 1 | Yapay boşluk; metin/görsel sırası değişmez |
| N2 | Satır başındaki/sonundaki `&nbsp;` dizileri → tek boşluk | Yapay girinti; içerik kaybı yok |
| N3 | `width` > kap genişliği olan görselde `width`/`height` atributunu kaldır | Yalnız 28 kursu ilgilendirir; taşmayı keser |
| N4 | Boş satır içi kaplar (`<span></span>`, `<strong></strong>`) temizliği | Görünür etkisi yok, yapıyı sadeleştirir |

**Bilerek yapılmayacaklar:** görseli bloğundan çıkarmak, blokları yeniden sıralamak, tipografiyi
(font-size/weight) yeniden yazmak, tüm görselleri ortalamak, `width:auto!important` dayatmak.
Bunlar "farklı yazılmış içerikleri tek düzene zorlama" kapsamına girer.

### Adım 3 — Uygulama: Çember 9 (toplu fiyat güncellemesi) deseni birebir tekrarlanmalı

Bu desen bu repoda **kanıtlanmıştır** ve Mimar'ın onay akışına uyar:

1. Tarihli plan dosyası: `scripts/data/overview-normalize-<tarih>.json` — hangi kursa hangi
   normalizasyon uygulanacağı, kurs kurs listelenir.
2. `scripts/normalize-course-overview.js`:
   - **varsayılan dry-run** (hiçbir şey yazmaz, önce/sonra HTML farkını gösterir)
   - `--apply` tek transaction
   - yazdıktan sonra DB'den **yeniden okuyup doğrulama**
   - `--report` (audit izi repoda) ve `--revert` (rapor anahtarıyla birebir geri alma)
3. Production'da **yalnızca Mimar**, **`pg_dump` yedeğinden sonra** çalıştırır.
4. Uygulamadan önce ve sonra **temsili kurs örneklerinde** (en az 5: bozuk, düzgün, boş, çok görselli,
   metin ağırlıklı) masaüstü + mobil ekran görüntüsü alınır ve Mimar'a sunulur.

### Adım 4 — Kalıcı çözüm: yeni içerik zaten temiz üretilsin

- Çember 8a/8b ile gelen **Word (.docx) içe aktarma** akışı (`src/services/course-import/*`) HTML'i
  kendi şablon renderer'ı ile üretir → yapıştırma artığı (`<br>` zinciri, `&nbsp;` dolgusu, iç içe
  `<span>`) **üretmez**.
- Tavsiye: yeni/güncellenen kurs içerikleri bu yoldan girilsin; böylece sorun tekrar üremez.
- İsteğe bağlı küçük çember: admin kurs editöründe kaydederken N1–N2 normalizasyonunu uygulamak
  (mevcut `normalizeCurriculumAccordionContent` deseninin yanına). Böylece elle yapıştırılan içerik de
  kayıt anında temizlenir.

### Adım 5 — Admin önizleme ile public görünümün eşitlenmesi

- Çember 17'de `course-content.css` admin header'a da eklendi (`.jodit-wysiwyg` kapsamı) — editörde
  görülen ile sitede görülen yaklaşır.
- Eksik kalan: `course-overview.js`'in **dinamik sayfalarda** uyguladığı stil admin önizlemesinde yok.
  Bu bilinçli bırakılmıştır; global dayatma kararı verilmediği sürece açılmamalıdır.

---

## 5. Önerilen çember sırası (Mimar onayına sunulacak)

| Sıra | Çember | Büyüklük | Risk |
|---|---|---|---|
| 1 | Denetim scripti + rapor (yazma yok) | ~150 satır + test | Yok (salt okunur) |
| 2 | Raporun Mimar ile gözden geçirilmesi, dokunulacak kurs listesinin belirlenmesi | — | Yok |
| 3 | Normalizasyon servisi + CLI (dry-run/apply/revert) + test | ~250 satır | Orta (DB yazar) → yedek + revert zorunlu |
| 4 | Temsili 5+ kursta önce/sonra görsel doğrulama, sonra production apply (Mimar) | — | Kontrollü |
| 5 | (Opsiyonel) Admin kaydında N1–N2 normalizasyonu | ~60 satır | Düşük |

---

## 6. Bu görevle ilgili açık kararlar (Mimar verecek)

1. Normalizasyon **DB içeriğine kalıcı** mı yazılsın (önerilen, kurs kurs onaylanabilir), yoksa
   render anında mı uygulansın (geri alması kolay ama yine "herkese aynı" riski taşır)?
2. N1–N4 listesine eklenecek/çıkarılacak madde var mı?
3. Hangi kurslara dokunulacak: yalnız en bozuk N tanesi mi, yoksa 295'in tamamı mı?
4. Tek görselli paragraflar ortalanacak mı? (Çember 17'de **hayır** denmişti; karar hâlâ açık.)
5. Boş overview'lu 124 kurs ne olacak — içerik girilecek mi, yoksa sekme gizlensin mi?
