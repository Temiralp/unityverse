# Unityverse Academy — Deployment Rehberi

Bu belge, projenin production sunucusuna çıkarılması için adım adım süreci, yapılması ve yapılmaması gerekenleri, her birinin nedenini ve sunucu hazırlık detaylarını açıklar.

İlgili belgeler:

- `PRODUCTION_CHECKLIST.md` — canlıya çıkmadan önce işaretlenecek tam kontrol listesi.
- `BACKEND_SETUP.md` — lokal geliştirme kurulumu.

> **Altın kural:** Secret değerler (parolalar, API anahtarları, `SESSION_SECRET`, PayTR anahtarları) asla bu belgeye, git'e veya sohbetlere yazılmaz. Yalnızca sunucudaki `.env` dosyasında saklanır.

---

## 1. Sistem Mimarisi Özeti

Proje iki katmandan oluşur:

| Katman | Teknoloji | Rol |
|---|---|---|
| Frontend | Statik HTML/CSS/JS (eski site yapısı) | `index.html`, `blog/`, `urun/`, `kategori/`, `uye/` vb. — Node uygulaması tarafından servis edilir |
| Backend | Node.js + Express + EJS | Admin panel, API, üyelik, kayıt (enrollment), ödeme akışı |
| Veritabanı | PostgreSQL 16 + Prisma ORM | Kurslar, bloglar, üyeler, kayıtlar, oturumlar, rate-limit |
| Ödeme | PayTR iframe API | `/odeme/*` route'ları, callback: `/odeme/callback` |
| Medya | `uploads/` klasörü | Admin tarafından yüklenen görseller — **kalıcı (persistent) olmalıdır** |
| Proxy | Nginx | HTTPS, yönlendirmeler (`nginx_redirects.conf`), PayTR callback IP allowlist (`nginx_paytr_callback.conf`) |

Trafik akışı:

```
Kullanıcı → Nginx (443, HTTPS) → Node.js app (127.0.0.1:8000) → PostgreSQL (localhost:5432)
```

---

## 2. Sunucu Hazırlığı (Provisioning)

### 2.1. Minimum sunucu gereksinimleri

| Kaynak | Öneri | Neden |
|---|---|---|
| OS | Ubuntu 22.04 / 24.04 LTS | Uzun süreli destek, geniş dokümantasyon |
| CPU / RAM | 2 vCPU / 4 GB RAM | Node + PostgreSQL + Nginx aynı sunucuda rahat çalışsın |
| Disk | 40+ GB SSD | Statik sitenin medya dosyaları + `uploads/` + veritabanı + yedek alanı büyüktür |
| Node.js | 24.x LTS (lokalde `v24.13.1` kullanılıyor) | Prisma 6 ve bağımlılıklarla uyumluluk; lokal ile aynı major sürüm sürprizleri azaltır |
| PostgreSQL | 16.x | `docker-compose.yml` içinde `postgres:16-alpine` kullanılıyor — sürüm uyumluluğu |
| Nginx | stable | Reverse proxy, SSL sonlandırma, IP allowlist |

### 2.2. Sunucu hazırlık adımları

1. **Sistemi güncelle:**

   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

2. **Ayrı bir deploy kullanıcısı oluştur** (uygulamayı root ile çalıştırma):

   ```bash
   sudo adduser deploy
   sudo usermod -aG sudo deploy
   ```

   **Neden:** Uygulama root ile çalışırsa, uygulamadaki herhangi bir açık tüm sunucunun ele geçirilmesi demektir. Least-privilege (en az yetki) ilkesi.

3. **Firewall kur:**

   ```bash
   sudo ufw allow OpenSSH
   sudo ufw allow 'Nginx Full'
   sudo ufw enable
   ```

   **Neden:** Yalnızca 22, 80, 443 portları açık kalır. PostgreSQL (5432) ve Node (8000) internete açık **olmamalıdır** — bunlara yalnızca localhost'tan erişilir.

4. **Node.js LTS kur** (NodeSource veya `nvm` ile):

   ```bash
   curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
   sudo apt install -y nodejs
   node --version   # v24.x beklenir
   ```

5. **PostgreSQL 16 kur ve veritabanı oluştur:**

   ```bash
   sudo apt install -y postgresql-16
   sudo -u postgres psql
   ```

   ```sql
   CREATE USER unityverse_app WITH PASSWORD '<guclu-parola>';
   CREATE DATABASE unityverse OWNER unityverse_app;
   \q
   ```

   **Neden ayrı DB kullanıcısı:** `postgres` superuser'ını uygulama için kullanmak güvenlik riskidir. Uygulamanın yalnızca kendi veritabanına yetkisi olmalıdır.

   **Alternatif:** Docker kullanılacaksa `docker compose up -d postgres` (projedeki `docker-compose.yml`). Bu durumda `docker-compose.yml` içindeki varsayılan `postgres/postgres` kimlik bilgileri production için **mutlaka değiştirilmelidir**.

6. **Nginx kur:**

   ```bash
   sudo apt install -y nginx
   ```

7. **PM2 (process manager) kur:**

   ```bash
   sudo npm install -g pm2
   ```

   **Neden PM2:** Uygulama çöktüğünde otomatik yeniden başlatma, sunucu reboot sonrası otomatik başlatma, log yönetimi. Alternatif: `systemd` unit dosyası — ikisi de kabul edilebilir, ancak yalnızca **biri** seçilmelidir.

---

## 3. Kodun Sunucuya Yerleştirilmesi

### 3.1. Release klasör yapısı

```
/var/www/unityverse/
├── releases/          # her deploy ayrı klasörde (rollback için)
│   ├── 2026-07-08_v1/
│   └── ...
├── shared/
│   ├── .env           # TÜM release'ler arasında paylaşılan secrets
│   └── uploads/       # kalıcı medya — deploy sırasında SİLİNMEZ
└── current -> releases/2026-07-08_v1   # symlink
```

**Neden bu yapı:**

- `uploads/` release klasörünün içinde olursa, her deploy'da admin'in yüklediği görseller kaybolur. Bu yüzden `shared/` altında tutulur ve her release'e symlink edilir.
- `current` symlink'i sayesinde rollback = symlink'i önceki release'e çevirmek + restart (saniyeler sürer).

### 3.2. Kodu getir

```bash
sudo mkdir -p /var/www/unityverse/{releases,shared/uploads}
sudo chown -R deploy:deploy /var/www/unityverse
cd /var/www/unityverse/releases
git clone <repo-url> 2026-07-08_v1
cd 2026-07-08_v1
git checkout <release-tag-veya-commit>
```

**Yapılmalı:** Deploy her zaman belirli bir tag/commit üzerinden gitmelidir.
**Neden:** "`main`'in en son hali"ni deploy etmek, tekrar üretilemeyen (non-reproducible) release demektir. Sorun çıktığında canlıda hangi kodun olduğunu kesin bilmek gerekir.

**Yapılmamalı:** Sunucuda doğrudan kod düzenlemek ("elle hotfix").
**Neden:** Git ile sunucu arasında fark oluşur, bir sonraki deploy o düzeltmeyi siler, kimse canlıda ne olduğunu bilemez.

### 3.3. Mevcut medya dosyalarını taşı

Statik sitenin medya dosyaları (`uploads/fm`, `uploads/f`, `uploads/p`, `uploads/products`, `uploads/blog`) sunucuda `shared/uploads/` altına taşınmalı, sonra release'e bağlanmalıdır:

```bash
# İlk sefer: lokalden sunucuya medya taşıma (lokal makineden çalıştırılır)
rsync -avz --progress uploads/ deploy@<sunucu-ip>:/var/www/unityverse/shared/uploads/

# Her release'de: symlink
cd /var/www/unityverse/releases/2026-07-08_v1
rm -rf uploads
ln -s /var/www/unityverse/shared/uploads uploads
```

**Yapılmamalı:** `shared/uploads/` hedefine karşı `rsync --delete` bayrağı kullanmak.
**Neden:** Admin'in sunucuda yüklediği, lokalde olmayan dosyaları siler.

---

## 4. Ortam Değişkenleri (`.env`)

> Bu bölümdeki işlemleri **siz kendiniz** yapmalısınız — secret değerler üçüncü taraflara (bu belgenin hazırlanma sürecine dahil) verilmemelidir.

### 4.1. Dosyayı oluştur

```bash
cd /var/www/unityverse/shared
cp /var/www/unityverse/current/.env.example .env
chmod 600 .env
nano .env
```

`chmod 600` — dosyayı yalnızca sahibi okuyabilir. **Neden:** Sunucudaki diğer kullanıcılar secret'ları okuyamasın.

Her release'de `.env` symlink edilir:

```bash
ln -sf /var/www/unityverse/shared/.env /var/www/unityverse/releases/<release>/.env
```

### 4.2. Production değerleri — ne yapmalısınız

`.env.example` içindeki her değişken için:

| Değişken | Production değeri | Neden |
|---|---|---|
| `NODE_ENV` | `production` ekleyin | Express performans optimizasyonları, secure cookie davranışı |
| `DATABASE_URL` | `postgresql://unityverse_app:<parola>@localhost:5432/unityverse?schema=public` | Ayrı uygulama kullanıcısı, localhost bağlantısı |
| `PORT` | `8000` | Nginx `127.0.0.1:8000` adresine proxy yapar (`nginx_paytr_callback.conf` ile uyumlu) |
| `TRUST_PROXY` | `127.0.0.1` | Nginx aynı sunucudaysa yalnızca onun IP'si. **Asla `true` veya `*` yazmayın** — rate-limit ve IP allowlist bypass edilebilir |
| `LEGACY_FRONTEND_MODE` | Statik site servis edilecekse `true` | Eski frontend uyumluluk modu |
| `PUBLIC_CSRF_ENFORCED` | `true` | Public formlarda CSRF koruması |
| `PUBLIC_FORM_TOKEN_ENFORCED` | Legacy uyumluluk dönemi bittiyse `true` | `.env.example` içindeki nota uygun |
| `SESSION_SECRET` | Yeniden üretin (aşağıda) | Varsayılan/zayıf secret = session hijacking riski |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Güçlü, benzersiz değerler | `ChangeMe123!` varsayılanı canlıda kalırsa admin panel açık kapıdır |
| `SMTP_*` | Gerçek SMTP kimlik bilgileri | Mail bildirimleri çalışsın |
| `PAYTR_MERCHANT_ID/KEY/SALT` | PayTR panelinden gerçek değerler | Ödeme entegrasyonu |
| `PAYTR_TEST_MODE` | `0` | Canlı ödeme için. Testler bitmeden `1` bırakın |
| `PAYTR_PUBLIC_BASE_URL` | `https://unityverseacademy.com` (sondaki `/` olmadan) | Callback URL'leri doğru oluşsun |
| `PAYTR_USER_IP` | Boş bırakın | `.env.example` içindeki not: production'da boş olmalıdır |
| `PAYTR_ALLOWED_IPS` | `185.187.184.84,212.252.97.250,213.74.97.150` | Uygulama seviyesinde callback IP allowlist (Nginx allowlist'ine ek ikinci katman) |
| `BANK_TRANSFER_*` | Gerçek banka bilgileri | `/odeme/:id` sayfasında gösterilir |

`SESSION_SECRET` üretimi (sunucuda çalıştırın, sonucu `.env` dosyasına yapıştırın):

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

**Yapılmamalı:** `.env` dosyasını git'e commit etmek, yedeklerini public bir yere koymak, değerleri sohbete/ticket'a yapıştırmak.
**Neden:** Secret sızıntısı tüm sistemin (DB, ödeme, admin) ele geçirilmesi demektir. `.gitignore` içinde `.env` zaten mevcut — bu korunmalıdır.

---

## 5. Kurulum ve Veritabanı Migration

Release klasöründe, sırayla:

```bash
cd /var/www/unityverse/releases/<release>

# 1. Bağımlılıklar — yalnızca production
npm ci --omit=dev

# 2. Prisma client üretimi
npx prisma generate

# 3. Migration'ların uygulanması
npx prisma migrate deploy
```

**Neden `npm ci` (npm install değil):** `npm ci`, `package-lock.json` dosyasına tam sadık kalır — lokalde test edilen sürümlerin aynısı kurulur. `npm install` lock dosyasını değiştirebilir.

**Neden `--omit=dev`:** `nodemon`, `terser` gibi geliştirme araçları production'da gerekmez — daha küçük kurulum, daha az saldırı yüzeyi.

**Neden `prisma migrate deploy` (migrate dev değil):** `migrate dev` yeni migration oluşturmaya, veritabanını sıfırlamaya çalışabilir — **production'da yasaktır**. `migrate deploy` yalnızca mevcut, commit edilmiş migration'ları uygular.

**Migration'dan önce mutlaka:**

```bash
pg_dump -U unityverse_app -d unityverse -F c -f /var/backups/unityverse/pre-deploy-$(date +%Y%m%d_%H%M).dump
```

**Neden:** Migration geri döndürülemez olabilir. Yedek olmadan migration = rollback planı olmayan deploy.

### Admin seed — yalnızca ilk kurulumda

```bash
npm run seed
```

**Yapılmalı:** Yalnızca veritabanı boşsa, `.env` içinde gerçek `ADMIN_EMAIL`/`ADMIN_PASSWORD` ayarlandıktan **sonra** çalıştırın.
**Yapılmamalı:** Her deploy'da seed çalıştırmak.
**Neden:** Mevcut production verisinin üzerine yazma/çoğaltma riski.

---

## 6. Uygulamanın Başlatılması (PM2)

```bash
cd /var/www/unityverse/current
pm2 start src/server.js --name unityverse --env production
pm2 save
pm2 startup   # çıkan komutu sudo ile çalıştırın — reboot'ta otomatik başlar
```

Kontrol:

```bash
pm2 status
pm2 logs unityverse --lines 50
curl -I http://127.0.0.1:8000/
```

**Yapılmalı:** `pm2 save` + `pm2 startup` mutlaka çalıştırılmalıdır.
**Neden:** Sunucu reboot olduğunda uygulama otomatik kalkmazsa, site reboot sonrası ölü kalır.

**Yapılmamalı:** Uygulamayı `node src/server.js &` veya `nohup` ile çalıştırmak.
**Neden:** Çökme sonrası restart yok, log yönetimi yok, SSH kapandığında süreç kaybolabilir.

---

## 7. Nginx ve HTTPS

### 7.1. Server block

`/etc/nginx/sites-available/unityverseacademy.com` (örnek iskelet):

```nginx
server {
    listen 80;
    server_name unityverseacademy.com www.unityverseacademy.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name unityverseacademy.com www.unityverseacademy.com;

    # SSL sertifika yolları certbot tarafından eklenecek

    client_max_body_size 20m;   # admin yüklemeleri için

    # Projedeki hazır config'ler:
    include /var/www/unityverse/current/nginx_redirects.conf;
    include /var/www/unityverse/current/nginx_paytr_callback.conf;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/unityverseacademy.com /etc/nginx/sites-enabled/
sudo nginx -t          # yapılandırma sözdizimini kontrol et
sudo systemctl reload nginx
```

**Neden `include` edilen iki dosya önemlidir:**

- `nginx_redirects.conf` — eski veritabanı ID'li URL'lerin yeni URL'lere 301 yönlendirmesi. Bu olmadan eski sitenin Google'da indekslenmiş linkleri 404 verir → SEO kaybı.
- `nginx_paytr_callback.conf` — `/odeme/callback` endpoint'ine yalnızca PayTR'nin 3 resmi IP'sinden izin verir. Bu olmadan herhangi biri sahte "ödeme başarılı" callback'i göndermeyi deneyebilir (uygulamadaki hash doğrulaması ikinci katman olarak kalır).

**Yapılmalı:** `proxy_set_header` başlıklarının tümü iletilmelidir.
**Neden:** Uygulama `TRUST_PROXY` ile gerçek istemci IP'sini bu başlıklardan okur — rate-limit ve PayTR IP allowlist bunlara dayanır.

### 7.2. SSL sertifikası (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d unityverseacademy.com -d www.unityverseacademy.com
sudo certbot renew --dry-run   # otomatik yenilemeyi test et
```

**Neden HTTPS zorunludur:** Admin girişi, üye parolaları, ödeme akışı — hepsi bu kanaldan geçer. PayTR, `PAYTR_PUBLIC_BASE_URL` için HTTPS ister. Session cookie'lerin `secure` çalışması için gereklidir.

---

## 8. Yapılmalı / Yapılmamalı — Genel Tablo

| ✅ Yapılmalı | Neden |
|---|---|
| Deploy'dan önce DB + `uploads/` yedeği | Geri dönüş yolu olmadan değişiklik yapılmaz |
| `npm ci --omit=dev` | Tekrar üretilebilir, minimal kurulum |
| `npx prisma migrate deploy` | Production için güvenli migration modu |
| Belirli bir tag/commit deploy etmek | Canlıda ne olduğu her zaman bilinir |
| `TRUST_PROXY=127.0.0.1` (açık IP) | IP tabanlı korumalar doğru çalışsın |
| `PAYTR_TEST_MODE=1` ile tam test, sonra `0` | Canlı para akışı test edilmemiş kodla açılmaz |
| `pm2 save` + `pm2 startup` | Reboot'a dayanıklılık |
| Deploy sonrası smoke testler (bölüm 9) | "Ayağa kalktı" ≠ "çalışıyor" |
| `PRODUCTION_CHECKLIST.md` işaretlemek | İnsan hafızasına güvenilmez |

| ❌ Yapılmamalı | Neden |
|---|---|
| `.env` dosyasını git'e commit etmek / paylaşmak | Secret sızıntısı = tam ele geçirme |
| Production'da `prisma migrate dev` | DB sıfırlama/veri kaybı riski |
| Deploy sırasında `uploads/` silmek/üzerine yazmak | Admin'in yüklediği medya geri getirilemez |
| Sunucuda doğrudan kod düzenlemek | Git ile sunucu arasında drift oluşur |
| `TRUST_PROXY=true` veya `*` | X-Forwarded-For sahteciliğiyle rate-limit/allowlist bypass |
| Varsayılan `ADMIN_PASSWORD` / `SESSION_SECRET` ile canlıya çıkmak | Admin panel ve oturumlar açık kapı |
| PostgreSQL (5432) ve Node (8000) portlarını internete açmak | Doğrudan saldırı yüzeyi |
| Yedek olmadan migration | Rollback imkânsız hale gelir |
| Cuma akşamı / mesai bitiminde deploy | Sorun çıkarsa müdahale edecek kimse yok |
| Her deploy'da `npm run seed` | Veri çoğaltma/üzerine yazma riski |

---

## 9. Deploy Sonrası Kontrol (Smoke Testler)

Deploy biter bitmez, sırayla:

### 9.1. Teknik sağlık

```bash
pm2 status                      # uygulama "online"
pm2 logs unityverse --lines 100 # hata yok
curl -I https://unityverseacademy.com/            # 200
curl -I http://unityverseacademy.com/             # 301 → https
```

### 9.2. Fonksiyonel kontrol (tarayıcıda)

1. `/` — ana sayfa, header/footer, mobil görünüm.
2. `/tum-urunler/` — kurs listesi açılıyor.
3. Bir kurs detay sayfası açılıyor.
4. `/blog/` — liste, sayfalama, arama.
5. `/admin` — giriş çalışıyor (yeni parolayla), kurs/blog oluşturma-güncelleme.
6. Üye kaydı → giriş → profil.
7. Lead/form gönderimi → admin panelde görünüyor → SMTP maili geliyor.
8. Enrollment akışı → ödeme sayfası → PayTR iframe token alınıyor.
9. PayTR callback testi (`PAYTR_TEST_MODE=1` iken test ödemesi) → `OK` yanıtı, sipariş durumu güncelleniyor.

### 9.3. Projedeki hazır test scriptleri

```bash
npm run test:enrollment        # enrollment akışı
npm run test:paytr-token       # PayTR token alımı
npm run test:paytr-callback    # callback hash/IP doğrulaması
npm run test:payment-mails     # ödeme mail bildirimleri
```

**Not:** Bu scriptler `.env` içindeki değerlerle çalışır — production'da çalıştırmadan önce scriptin ne yaptığını kontrol edin (bazıları test verisi oluşturur). En güvenli yol: staging ortamında çalıştırmak.

Tam liste için: `PRODUCTION_CHECKLIST.md` → bölüm 8 (Smoke Tests) ve 9 (Security Checks).

---

## 10. Rollback Prosedürü

Sorun çıkarsa:

```bash
# 1. Symlink'i önceki release'e döndür
ln -sfn /var/www/unityverse/releases/<onceki-release> /var/www/unityverse/current

# 2. Uygulamayı yeniden başlat
pm2 restart unityverse

# 3. Kontrol et
curl -I https://unityverseacademy.com/
pm2 logs unityverse --lines 50
```

**Sorun migration'daysa** (kod rollback'i yeterli değilse):

```bash
pg_restore -U unityverse_app -d unityverse --clean --if-exists /var/backups/unityverse/pre-deploy-<tarih>.dump
```

**Dikkat:** DB restore, migration'dan **sonra** yazılan veriyi de siler. Bu karar yalnızca veri kaybı kabul edilebilirse ve sorumlu kişinin onayıyla verilir.

Rollback sonrasında bölüm 9'daki smoke testler tekrar çalıştırılır.

---

## 11. İzleme ve Yedekleme (sürekli operasyon)

1. **DB yedeği — günlük cron:**

   ```bash
   # crontab -e (deploy kullanıcısı)
   0 3 * * * pg_dump -U unityverse_app -d unityverse -F c -f /var/backups/unityverse/daily-$(date +\%u).dump
   ```

   Haftanın gününe göre isim → 7 günlük rotasyon, disk dolmaz.

2. **Uploads yedeği:** `rsync` ile sunucu dışı bir yere (object storage / ikinci sunucu) haftalık.

3. **Yedekleri sunucu dışında saklayın.** **Neden:** Sunucu kaybedilirse (disk arızası, ele geçirilme), sunucudaki yedek de kaybolur.

4. **Log izleme:**
   - `pm2 logs unityverse` — uygulama logları (CSP ihlali, PayTR callback hatası, mail hatası burada görünür).
   - `/var/log/nginx/access.log`, `error.log` — proxy seviyesi.

5. **Disk izleme:** `df -h` — `uploads/` ve loglar büyür; disk dolarsa DB yazmaları da durur.

6. **Ayda bir restore testi:** Yedek dosyasını ayrı bir ortamda restore edin. **Neden:** Test edilmemiş yedek, yedek değildir — umuttur.

---

## 12. Deploy Akışının Kısa Özeti (Cheat Sheet)

```bash
# 0. Yedek
pg_dump -U unityverse_app -d unityverse -F c -f /var/backups/unityverse/pre-deploy-$(date +%Y%m%d_%H%M).dump

# 1. Yeni release
cd /var/www/unityverse/releases
git clone <repo-url> <yeni-release> && cd <yeni-release>
git checkout <tag>

# 2. Paylaşılan kaynaklara bağla
ln -sf /var/www/unityverse/shared/.env .env
rm -rf uploads && ln -s /var/www/unityverse/shared/uploads uploads

# 3. Build
npm ci --omit=dev
npx prisma generate
npx prisma migrate deploy

# 4. Canlıya geçiş
ln -sfn /var/www/unityverse/releases/<yeni-release> /var/www/unityverse/current
pm2 restart unityverse

# 5. Kontrol
pm2 logs unityverse --lines 50
curl -I https://unityverseacademy.com/
# + bölüm 9 smoke testleri
```

---

## Go/No-Go Kararı

Canlıya çıkış yalnızca şu koşullarla onaylanır:

- [ ] Bölüm 9'daki tüm smoke testler geçti.
- [ ] PayTR test ödemesi ve callback `OK` döndü.
- [ ] Yedek alındı ve yeri biliniyor.
- [ ] Rollback adımları (bölüm 10) ekipçe biliniyor.
- [ ] `PRODUCTION_CHECKLIST.md` tamamen işaretlendi.
- [ ] Product Owner onayı var.
