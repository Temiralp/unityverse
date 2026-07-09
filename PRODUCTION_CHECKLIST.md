# Unityverse Production Checklist

Bu checklist canlıya çıxışdan əvvəl istifadə olunmalıdır. Secret dəyərlər bu fayla yazılmamalıdır.

## 1. Release Scope

- [ ] Canlıya çıxacaq dəyişikliklər review edildi.
- [ ] Lazımsız/generated dəyişikliklər release-dən ayrıldı.
- [ ] `git status --short` yoxlanıldı.
- [ ] Kritik yeni fayllar commit-ə daxil edildi:
  - [ ] `src/routes/legacy-catalog.js`
  - [ ] `src/routes/legacy-product-detail.js`
  - [ ] `src/routes/legacy-filters.js`
  - [ ] Yeni service/script faylları
- [ ] `.env`, secret, local-only fayllar commit-ə daxil edilmədi.
- [ ] Rollback üçün əvvəlki stabil commit/tag qeyd edildi.

## 2. Server Requirements

- [ ] Production server hazırdır.
- [ ] Node.js LTS versiyası qurulub.
- [ ] PostgreSQL production instance hazırdır.
- [ ] Nginx və HTTPS/SSL aktivdir.
- [ ] App process manager seçilib:
  - [ ] PM2
  - [ ] systemd
  - [ ] Docker
- [ ] Restart policy aktivdir.
- [ ] Logların saxlanacağı yer müəyyən edilib.

## 3. Environment Variables

Bu dəyərlər production serverdə olmalıdır. Dəyərləri bu fayla yazmayın.

- [ ] `NODE_ENV=production`
- [ ] `PORT`
- [ ] `DATABASE_URL`
- [ ] `SESSION_SECRET` ən az 64 simvol, güclü random dəyərdir.
- [ ] `TRUST_PROXY` explicit proxy IP/CIDR ilə set edilib.
- [ ] `LEGACY_FRONTEND_MODE=true` lazımdırsa aktiv edilib.
- [ ] `ADMIN_EMAIL`
- [ ] `ADMIN_PASSWORD` default deyil.
- [ ] `SMTP_HOST`
- [ ] `SMTP_PORT`
- [ ] `SMTP_USER`
- [ ] `SMTP_PASS`
- [ ] `SMTP_FROM`
- [ ] `SMTP_TO`
- [ ] `PAYTR_MERCHANT_ID`
- [ ] `PAYTR_MERCHANT_KEY`
- [ ] `PAYTR_MERCHANT_SALT`
- [ ] `PAYTR_PUBLIC_BASE_URL` HTTPS domain-dir.
- [ ] `PAYTR_TEST_MODE=0` canlı ödəniş üçün set edilib.
- [ ] `PAYTR_ALLOWED_IPS` PayTR callback IP-ləri ilə set edilib.
- [ ] `PAYTR_NO_INSTALLMENT`
- [ ] `PAYTR_MAX_INSTALLMENT`
- [ ] `BANK_TRANSFER_ACCOUNT_NAME`
- [ ] `BANK_TRANSFER_BANK_NAME`
- [ ] `BANK_TRANSFER_IBAN`
- [ ] `WHATSAPP_PHONE`

## 4. Database

- [ ] Production DB backup alındı.
- [ ] Backup restore testi ayrıca mühitdə yoxlanıldı və ya ən azı backup faylı doğrulandı.
- [ ] `prisma/migrations` release ilə uyğundur.
- [ ] Production-da migration üçün `prisma migrate deploy` istifadə olunur.
- [ ] `prisma migrate dev` production-da istifadə olunmur.
- [ ] `npx prisma generate` production build/start prosesində işlədilir.
- [ ] Admin seed yalnız lazım olduqda və production credential-larla işlədilir.

## 5. Persistent Files

- [ ] `uploads` qovluğu persistent storage/volume altındadır.
- [ ] `uploads/blog` persistent-dir.
- [ ] `uploads/products` persistent-dir.
- [ ] `uploads/fm` və mövcud media faylları serverdə mövcuddur.
- [ ] Deploy prosesi `uploads` qovluğunu silmir və overwrite etmir.
- [ ] Media backup strategiyası müəyyən edilib.

## 6. Nginx/Proxy

- [ ] Domain HTTPS ilə app-ə yönlənir.
- [ ] `Host`, `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto` header-ləri ötürülür.
- [ ] HTTP-dən HTTPS-ə redirect aktivdir.
- [ ] Static asset cache qaydaları uyğundur.
- [ ] HTML üçün no-cache davranışı qorunur.
- [ ] `nginx_redirects.conf` lazım olan server block-a daxil edilib.
- [ ] `nginx_paytr_callback.conf` PayTR callback üçün daxil edilib.
- [ ] `/odeme/callback` PayTR IP-lərindən əlçatandır.

## 7. Install And Start

- [ ] Serverdə release folder hazırlanıb.
- [ ] `npm ci --omit=dev` və ya seçilmiş deployment strategiyasına uyğun install edildi.
- [ ] `npx prisma generate` işlədi.
- [ ] `npx prisma migrate deploy` işlədi.
- [ ] App `npm start` ilə production mode-da qalxır.
- [ ] Process manager app-i restartdan sonra avtomatik qaldırır.
- [ ] Health check URL və loglar yoxlanıldı.

## 8. Smoke Tests

- [ ] `/` homepage açılır.
- [ ] Header/footer düzgün görünür.
- [ ] Mobile header profil icon görünüşü yoxlanıldı.
- [ ] Floating `Bilgi / Randevu Al` və WhatsApp button-ları düzgün görünür.
- [ ] `/tum-urunler/` açılır.
- [ ] Yeni admin kursu public listdə görünür.
- [ ] Kurs detail səhifəsi açılır.
- [ ] Yeni əlavə olunan kurs detail footer kəsilmir.
- [ ] `/blog/` açılır.
- [ ] Blog pagination işləyir.
- [ ] Blog search işləyir.
- [ ] Admin əlavə etdiyi blog public blog listdə görünür.
- [ ] Admin əlavə etdiyi blog detail köhnə frontend arayüzündə açılır.
- [ ] `/admin` login işləyir.
- [ ] Admin blog create/update işləyir.
- [ ] Admin kurs create/update işləyir.
- [ ] Lead/form submit işləyir.
- [ ] Üzv qeydiyyatı/login işləyir.
- [ ] Enrollment axını işləyir.
- [ ] Payment page açılır.
- [ ] PayTR iframe token alınır.
- [ ] PayTR callback test response `OK` qaytarır.
- [ ] SMTP mail bildirişləri gedir.

## 9. Security Checks

- [ ] Default admin password istifadə olunmur.
- [ ] `SESSION_SECRET` default deyil.
- [ ] `.env` public web root altında servis olunmur.
- [ ] Admin panel HTTPS üzərindən işləyir.
- [ ] Session cookie production-da `secure` olur.
- [ ] CSP violation logları yoxlanıldı.
- [ ] Public form CSRF aktivdir.
- [ ] Rate limit migration-ları tətbiq edilib.
- [ ] PayTR callback hash verification aktivdir.
- [ ] PayTR callback IP allowlist aktivdir.

## 10. SEO And Static Checks

- [ ] `robots.txt` production domain üçün uyğundur.
- [ ] `sitemap.xml` production domain üçün uyğundur.
- [ ] Canonical URL-lər production domain ilə uyğundur.
- [ ] Köhnə URL redirect-ləri yoxlanıldı.
- [ ] 404 səhifə davranışı yoxlanıldı.
- [ ] Asset path-lərdə ngrok/local URL qalmayıb.

## 11. Monitoring And Backup

- [ ] App logları izlənir.
- [ ] Nginx access/error logları izlənir.
- [ ] DB backup schedule aktivdir.
- [ ] Upload backup schedule aktivdir.
- [ ] Disk usage monitorinqi aktivdir.
- [ ] Error alerting üçün məsul şəxs müəyyən edilib.
- [ ] PayTR callback failure logları izlənir.
- [ ] Mail failure logları izlənir.

## 12. Rollback Plan

- [ ] Əvvəlki stabil release artifact/commit məlumdur.
- [ ] DB backup yeri məlumdur.
- [ ] Upload backup yeri məlumdur.
- [ ] Rollback komandaları sənədləşdirilib.
- [ ] Rollback qərarını verəcək məsul şəxs məlumdur.
- [ ] Rollback sonrası smoke test siyahısı hazırdır.

## Recommended Production Commands

```bash
npm ci --omit=dev
npx prisma generate
npx prisma migrate deploy
NODE_ENV=production npm start
```

Process manager istifadə olunursa, son komanda seçilmiş manager ilə əvəz edilməlidir.

## Go/No-Go

- [ ] Bütün critical smoke testlər keçdi.
- [ ] Payment və callback testləri keçdi.
- [ ] Admin create/update axınları keçdi.
- [ ] Backup alındı.
- [ ] Rollback plan təsdiqləndi.
- [ ] Product owner canlıya çıxış üçün təsdiq verdi.
