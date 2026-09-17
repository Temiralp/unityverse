# B2 Keşif — PayTR + Havale/EFT → admin ve öğrenci paneline otomatik yansıma (2026-09-17)

Kaynaklar: kod (`src/services/paytr.js`, `paytr-callback.js`, `src/routes/payments.js`, `prisma/schema.prisma`), PayTR resmi dokümanları
(dev.paytr.com: iFrame API 1./2. Adım, Havale/EFT iFrame API 1. Adım — 2026-09-17 okundu).

## 1. Bugün ne var (kanıt)
| Akış | Durum | Kanıt |
|---|---|---|
| Kart (PayTR iFrame) | Token: `no_installment`, `max_installment` env'den (`paytr.js:293-294`). Callback: hash + IP allowlist (3 katman), idempotent; `EducationPayment` (tek kayıt, `amount = total_amount`), kayıt `paymentStatus=PAID`, `status=CONFIRMED`, taksit sayısı nota yazılır | `paytr-callback.js:77-151`, `payments.js:306-316, 548-560` |
| Havale/EFT | Öğrenci "Havale" seçer → kayıt `BANK_TRANSFER`/`PENDING` kilitlenir + mail; **banka ile bağlantı yok** → admin `Ödeme Ekle` ile elle işler | `payments.js` `lockBankTransferRegistration`, `admin.js:3892` |
| Taksit planı (admin) | `EducationInstallment` (title, amount, dueDate, status) admin tarafından elle oluşturulur/ödendi işaretlenir; öğrenci panelinde "Taksit Planı" ve "Kalan" bu tablodan | `schema.prisma:453`, `admin.js:3945, 3998`, `member-profile.js:159` |

## 2. Kavram netleştirme — "PayTR taksit" ≠ "admin taksit planı"
- PayTR kart taksidi **bankanın** taksididir: müşteri kartına 3/6/12 ay taksit yapılır; **PayTR mağazaya tutarın tamamını tek seferde** (komisyon düşülerek) öder. Aylık taksitler için PayTR'den **ayrı bildirim gelmez** — bildirim tek: `status=success`, `total_amount` (PayTR iFrame API 2. Adım alan listesi: merchant_oid, status, total_amount, hash, failed_reason_code/msg, test_mode, payment_type, currency, payment_amount; **installment_count callback'te yok**).
- Dolayısıyla "her taksit ödendikçe admin panelde otomatik ödendi olsun" isteği PayTR kart taksidi için **teknik olarak mümkün değildir** (para zaten tamamen tahsil edilmiştir). Doğru model: kart-taksitli ödeme = **tek PAID kayıt** + bilgi amaçlı "N taksit" notu (bugünkü davranış doğru).
- Aylık gerçek tahsilat (öğrenci her ay ayrı öder) yalnızca **havale/EFT ile taksit** senaryosunda vardır; burada admin taksit planı anlamlıdır.

## 3. Otomatikleştirilebilecekler ve nasıl
### 3a. Havale/EFT otomatik eşleşme — Seçenek A: PayTR Havale/EFT iFrame API (önerilen)
- PayTR'nin ayrı ürünü: token isteği `payment_type='eft'`, hash = `merchant_id + user_ip + merchant_oid + email + payment_amount + payment_type + test_mode + merchant_salt` (HMAC-SHA256, merchant_key). Öğrenci iFrame içinde havale bildirimi yapar, transferi **PayTR'nin hesabına** yapar; PayTR operasyon ekibi eşleştirince **aynı bildirim URL'sine** callback gelir (merchant_oid, status, total_amount, hash). `timeout_limit` (varsayılan 30 dk) dikkat: süre dolarsa işlem iptal.
- Kod etkisi: mevcut callback işleyicisi **olduğu gibi** kullanılır (idempotent, hash doğrulama aynı); yalnızca (1) token oluşturmada `payment_type='eft'` + hash formülü, (2) ödeme sayfasında "PayTR ile Havale" seçeneği, (3) `merchant_oid` şemasına eft ayrımı. Tahmini: 1 çember, ~250 satır + testler; `PAYTR_TEST_MODE=1` ile uçtan uca test.
- İş kararı: para PayTR üzerinden gelir (komisyon/valör PayTR sözleşmesine bağlı — **Mimar PayTR ile teyit etmeli**); mevcut "kendi IBAN'ımıza havale" akışı paralel kalabilir.
- Avantaj: sıfır banka API'si, mevcut güvenlik katmanları, otomatik PAID.
### 3b. Seçenek B: Bankanın hesap hareketi API'si (kendi IBAN'a havale)
- Türkiye'de açık bankacılık (BKM/TCMB "Açık Bankacılık" hesap bilgisi servisleri) kurumsal müşteriye banka-özel sözleşme + sertifika + KYC gerektirir; her bankanın API'si farklı. Hangi banka olduğu bilinmiyor (env `BANK_TRANSFER_BANK_NAME`) → **dış etken: bankadan "hesap hareketleri API/webhook" var mı, ücreti ne** sorulmalı.
- Kod etkisi (varsa): günlük/saatlik "hareket çek → açıklamadaki `UV-<id>` referansıyla kayıt eşle → `EducationPayment` yaz → PAID/PARTIAL" cron servisi (~400 satır), eşleşmeyenler admin kuyruğuna. Risk: yanlış eşleşme (açıklama yazılmamış havaleler %30-50 olur), idempotency, güvenlik (banka kimlik bilgileri).
- Öneri: A yoksa/uygun değilse B; ikisi de yoksa mevcut elle süreç + **B-lite**: admin panelde "havale bekleyenler" listesi ve tek tıkla "ödendi" (küçük UX çemberi).
### 3c. Öğrenci paneli "otomatik yansıma"
- Bugün panel DB'den okur; PAID olan her kayıt anında yansır. Havale için sorun yalnızca "kim PAID yapacak" (3a/3b). Ek iş gerekmez.
### 3d. Kart taksit bilgisinin görünürlüğü
- PayTR callback'te taksit sayısı gelmediğinden (doküman), öğrencinin iFrame'de seçtiği taksidi bilmek için PayTR panel raporu ya da PayTR "Ödeme Sorgulama API"si gerekir (ayrı doküman; okunmadı — doğrulanmalı). Bilgi amaçlıdır; tahsilatı etkilemez.

## 4. Riskler / neden riskli
- Ödeme kodu = en yüksek blast radius (para). Her değişiklik `PAYTR_TEST_MODE=1` + gerçek test ödemesi + callback IP allowlist (Nginx) ile doğrulanmalı.
- Havale/EFT iFrame'de `timeout_limit` ve PayTR operasyon onay süresi (dakikalar-saatler) → öğrenciye "onay bekleniyor" durumu gösterilmeli (PENDING → PAID).
- Çift kayıt: aynı kayıt için hem elle hem callback ile ödeme girilmesi → callback zaten `existingPayment` kontrolü yapar; elle giriş tarafına da "PayTR ile ödenmiş" uyarısı eklenmeli.

## 5. Önerilen sıra
1. Mimar → PayTR: Havale/EFT iFrame API sözleşme/komisyon; test mağazasında `eft` açık mı?
2. Çember B2-a: PayTR Havale/EFT (token + ödeme sayfası seçeneği + testler) — mevcut callback yeniden kullanılır.
3. Çember B2-b (opsiyonel): admin "havale bekleyenler" kuyruğu + tek tık ödendi.
4. Banka API'si yalnızca banka resmi yanıtından sonra değerlendirilir.
