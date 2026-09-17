# B3 Keşif — HubSpot CRM entegrasyonu (2026-09-17)

Kaynaklar: HubSpot geliştirici dokümanları (Contacts API, Private Apps — 2026-09-17 okundu), HubSpot topluluk/CSP kaynakları, mevcut kod (`src/config/csp.js`, `src/routes/leads.js`, `members.js`, GTM kurulumu).

## 1. HubSpot nedir, ne yapar
CRM + pazarlama otomasyonu. Sitede **takip kodu** (JS) ziyaretçi davranışını (sayfa görüntüleme, form, IP tabanlı konum) çerezle izler ve **form doldurunca/kimlik belli olunca** kişiye bağlar; CRM'de "Kişiler" (contacts), zaman çizelgesi, e-posta dizileri, görevler sunar. Ücretsiz CRM katmanı vardır; API ve private app ücretsiz katmanda kullanılabilir (limit: 100 istek/10 sn, 250.000/gün).

## 2. Entegrasyon seviyeleri
| Seviye | Ne verir | Kod etkisi | Dış etken |
|---|---|---|---|
| L1 — Takip kodu | Ziyaretçi/sayfa/IP-konum takibi, HubSpot panelinde | `csp.js` allowlist: script-src `https://js.hs-scripts.com https://js.hs-analytics.net https://js.hscollectedforms.net https://js.hsadspixel.net https://js.hs-banner.com https://*.hubspot.com`; connect-src `https://forms.hscollectedforms.net https://forms.hsforms.com https://*.hubspot.com`; img-src zaten `https:` (doğrulama: gerçek CSP raporlarıyla) + statik sayfalara script (legacy zincirine tek noktadan enjeksiyon) | HubSpot hesabı + Hub ID; **KVKK/çerez onayı** (mevcut cookieconsent ile "pazarlama" kategorisine bağlanmalı) |
| L2 — Lead/üye senkronu (sunucu→HubSpot) | Form başvurusu (`leads.js`) ve üye kaydı (`members.js`) olduğunda HubSpot'ta kişi oluştur/güncelle (`POST /crm/v3/objects/contacts/batch/upsert`, `Authorization: Bearer <private app token>`, scope `crm.objects.contacts.write/read`) | Yeni servis `hubspot-sync.js` (kuyruk + yeniden deneme, hata olsa site etkilenmez, lazy/opsiyonel: env yoksa kapalı), `.env.example`'a `HUBSPOT_PRIVATE_APP_TOKEN` (sır → Mimar), testler (fake fetch) | Token rotasyonu 6 ayda bir (HubSpot önerisi) |
| L3 — Admin panele entegre görünüm | Admin lead/üye sayfasında "HubSpot'ta aç" linki + son senkron durumu; kayıt/ödeme olaylarını HubSpot "deal" olarak yazma | Prisma'ya `hubspotContactId` alanı (migration), admin view'lara link | — |

## 3. Öneri
- L1 + L2 birlikte tek çember (~2 çember iş): L1 görünürlük sağlar, L2 CRM'i gerçek veriyle doldurur. L3 sonra.
- Takip kodu **GTM üzerinden değil doğrudan** eklenmeli: canlı loglar GTM'in enjekte ettiği 3. taraf scriptlerin (elfsight, delightchat, facebook frame) CSP tarafından **engellendiğini** gösteriyor — HubSpot'u GTM'e koymak da engellenir. (Not: bu engellenen scriptler ayrı bir karar: R13.)
- KVKK: IP/konum takibi kişisel veridir; aydınlatma metni + çerez onayı olmadan L1 açılmamalı. Onay "reddet" ise takip kodu yüklenmemeli (consent-gated yükleme).

## 4. Riskler
- CSP allowlist genişlemesi (yeni 3. taraf) — kontrollü ve test edilmiş (`csp-browser-smoke`).
- HubSpot API kesintisi/oran sınırı → senkron **asenkron ve hataya dayanıklı** olmalı (site akışını asla bloke etmez).
- Kişisel verinin ABD'li servise aktarımı → KVKK açık rıza/aydınlatma (hukuki; Mimar/şirket kararı).
- Ücretsiz katman sınırları (kişi sayısı, e-posta gönderim) ileride maliyet.

## 5. Mimar'dan gerekenler
1. HubSpot hesabı (Hub ID) + private app token (yalnızca `.env`'e, sohbete değil).
2. Kapsam kararı: L1 / L1+L2 / L3.
3. KVKK/çerez metninin HubSpot'u kapsaması.
