# Görev: "Eğitime İlk Bakış" içerik düzeni — Mimar'ın istekleri ve şartları

> Kaynak: Mimar'ın 2026-09-30 tarihli talimatı. Bu dosya **isteğin kendisidir**; teknik analiz ve
> çözüm önerisi ayrı dosyadadır: `01-TEKNIK-ANALIZ-VE-TAVSIYELER.md`.
> Devralan AI ajanı için giriş noktası: `docs/AI-AJAN-DEVIR-PROMPTU.md`.

## 1. Ana görev

`https://unityverseacademy.com` üzerindeki kurs detay sayfalarında **"Eğitime İlk Bakış"** sekmesindeki
**yazı ve görsellerin düzensizliği** giderilecek. Somut şikâyetler (Mimar'ın kendi ifadesiyle):

- Yazılar ve görseller **iç içe** geçmiş
- Görseller **hizalı değil**, "her biri bir derede"
- Yazılar **ya çok büyük ya çok küçük**
- **Taşma** (içerik kabından dışarı çıkıyor)
- Genel olarak "seliqesiz" (özensiz) görünüyor

## 2. Mimar'ın kesin şartı — TEK BİR DÜZENE ZORLAMA YOK

> "her egitimin egitime ilk bakis kismindaki hizalama metodu eyni olmamalidir cunki her egitimdeki
> egitime ilk bakis kismindaki yazilar ve gorseller ferqli cur hizalanmis ve ferqli cur yazilmisdir"

- Her kursun overview içeriği **farklı yazılmıştır**; hepsine aynı hizalama yöntemini dayatmak yanlıştır.
- **Kanıtlanmış hata:** `course-overview.js`'i tüm kurslara uygulamak bir kursu düzeltirken başka bir
  kursu bozdu. Bu yüzden **Çember 18 geri alındı** (`37f2655e`, 2026-09-24).
- Doğru yaklaşım: **her kursun "Eğitime İlk Bakış" bölümüne tek tek bakılıp** hangi kursta hangi sorun
  var tespit edilmeli ve sorun **kendi bağlamında** çözülmeli.

## 3. Genel çalışma şartları (her iş için geçerli)

Bu şartlar `CLAUDE.md` ve `.claude/rules/` dosyalarında da yazılıdır; burada özetlenmiştir.

| # | Şart |
|---|---|
| 1 | **Çember (circle) yöntemi:** aynı anda tek iş. Çember %100 yeşil bitmeden yenisi açılmaz. |
| 2 | **Minimum değişiklik, 0 hata.** İşi bir daire gibi gör: içini boya, dışına taşırma. |
| 3 | Bir çemberin kapanması **yeni bir sorun açmamalıdır**. |
| 4 | **Test-first (TDD):** önce test → kırmızı çıktı gösterilir → sonra kod → yeşil çıktı gösterilir. |
| 5 | **>3 dosya veya >100 satır** değişiklik = önce 13 maddelik yazılı plan + Mimar onayı. |
| 6 | **Tahmin yok.** Dosyayı aç, oku, `dosya:satır` göster. Bulamadıysan "kontrol ettim, bulamadım" de. |
| 7 | `git commit` / `push` / `pull` ve **deploy'u yalnızca Mimar yapar**. Ajan sadece adımları yazar. |
| 8 | Her iş sonunda **teslim paketi**: değişen dosyalar, test çıktıları, git adımları, sunucu adımları, **manuel canlı test rehberi**, rollback adımı, `PROJECT_STATE.md` güncellemesi. |
| 9 | **Ders defteri:** her çemberden ve her beklenmedik hatadan çıkan ders **aynı çemberde** `PROJECT_STATE.md`'ye yazılır. "Hata lüksümüz yok." |
| 10 | **Kalıcılık ilkesi:** değişiklik bugün de yarın da çalışmalı; durum yalnızca DB/dosya sisteminde tutulur; sunucu restart'ından sonra site hiç düşmemiş gibi olmalı. |
| 11 | **Dil:** sohbet/rapor **Azerbaycanca**; kod yorumları ve `.md` dosyaları **Türkçe**; commit mesajı İngilizce veya Türkçe. |

## 4. Güvenlik şartları (çiğnenemez)

- `.env`, `.env.*` (yalnız `.env.example` hariç), `*.pem`, `*.key`, `*.dump`, `backup*.sql`,
  `uploads/admin/` içeriği **okunmaz, yazılmaz, grep'lenmez**.
- Sohbete sır/parola/token yapıştırılmaz.
- Yeni env anahtarı gerekiyorsa `.env.example`'a **yalnızca anahtar adı** yazılır; değeri Mimar girer.
- Production'a dokunan scriptler (`migrate-*`, `backfill-*`, `import-*`, `--apply`, `prisma migrate dev`,
  `npm run seed`) **yalnızca Mimar**, **yalnızca `pg_dump` yedeğinden sonra** çalıştırır.
- Tarayıcı testinde admin girişi gerekiyorsa **şifreyi ajan girmez**; Mimar geçici test hesabıyla girer.

## 5. Kabul kriterleri (bu görev için)

1. Sorunlu kursların "Eğitime İlk Bakış" bölümü masaüstünde ve mobilde düzgün görünür: taşma yok,
   görseller kendi bloğunda hizalı, metin okunur boyutta.
2. **Hâlihazırda düzgün görünen kurslarda görünür değişiklik olmaz** — bu, kanıtla (önce/sonra ekran
   görüntüsü veya koordinat ölçümü) gösterilir.
3. Değişiklik **kurs bazında gözden geçirilebilir** olmalı; toplu ve geri alınamaz bir dönüşüm olmamalı.
4. Testler yeşil; regresyon yeşil.
5. Rollback tek adımda mümkün.

## 6. Öncelik notu

Mimar: "Bu görev bir kenara, bizim diğer işlerimiz de var, diğer dairelerimiz de; **ama esas olan
"Eğitime İlk Bakış" kısmındaki görsel ve yazıların düzenlenmesidir**."

Diğer açık işler `PROJECT_STATE.md` → Backlog bölümündedir (B2 ödeme entegrasyonu, B3 HubSpot,
B6 içe aktarma seçeneği, B7 blog editörü video, R12 npm audit, R15 GTM konsol hatası, R1/R2/R4/R5/R9).
