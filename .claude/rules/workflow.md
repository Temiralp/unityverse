# Çalışma yöntemi (workflow) — her oturumda yüklenir

## Çember (circle) yöntemi
- Her iş = bir çember. Çemberin içi **minimum değişiklikle, maksimum doğrulukla, dışarı taşırmadan** boyanır.
- Çember "bitti" sayılır ⇔ (1) plan onaylandı, (2) testler önce kırmızı → sonra yeşil, (3) implementasyon sonrası **tüm** ilgili testler yeşil, (4) regresyon kontrolü geçti, (5) teslim paketi verildi, (6) `PROJECT_STATE.md` güncellendi.
- Çember bitmeden yenisi açılmaz (Mimar açıkça söylemedikçe). Bir çemberin kapanması yeni hata/yeni çember açmamalıdır — kanıtı regresyon testleridir.
- Çember ortasında yeni sorun bulunursa: **düzeltme**, `PROJECT_STATE.md` → Backlog'a yaz, Mimar'a bildir.

## Büyüklük eşiği ve onay
| Ölçü | Gereklilik |
|---|---|
| ≤3 dosya **ve** ≤100 satır | Kısa niyet bildir (ne, neden, hangi dosya), test yaz, yap. |
| >3 dosya **veya** >100 satır | Aşağıdaki plan şablonu → Mimar "onay" diyene kadar kod yazma. |
| Migration / bağımlılık / env / Nginx / altyapı | Her zaman plan + onay, ölçüden bağımsız. |

## Plan şablonu (büyük işler için zorunlu bölümler)
1. **Amaç** — tek cümle; hangi kullanıcı/iş sorunu çözülüyor.
2. **Ne yapılacak** — adım adım, her adım doğrulanabilir.
3. **Dokunulacak dosyalar** — değişecek / yeni oluşacak / silinecek, her biri için gerekçe.
4. **Hacim tahmini** — satır sayısı (gerçek sayı, dosya dosya), gereken araç çağrısı/token maliyeti (düşük/orta/yüksek), adım sayısı. Token kısıtı var — israf etme.
5. **Test planı** — hangi test dosyası, hangi durumları doğrular, **neden önce kırmızı olacak** (hangi fonksiyon/davranış henüz yok) ve **hangi değişiklik onu yeşil yapacak**.
6. **Zarar görebilecek yerler** — değişen fonksiyonu çağıran tüm yerler (`grep` ile gerçek liste, `dosya:satır`), paylaşılan util/service'ler, EJS view'lar, statik HTML.
7. **Blast radius** — değişiklik bozulursa ne kaybolur: sayfa? ödeme? SEO? admin? Kime görünür (public/admin/ödeme)? Geri dönüş (rollback) kaç dakika?
8. **Riskler ve avantajlar** — tablo; risk için: olasılık (düşük/orta/yüksek), etki, azaltma önlemi.
9. **Dış etkenler** — 3. taraf API (PayTR, Google OAuth, SMTP, Nginx, GCloud) varsa: resmi doküman linki/okunmuş bilgi, sürüm, limit. Tahmin yasak — okumadıysan "doğrulanmalı" yaz.
10. **Kabul kriterleri (Definition of Done)** — doğrulanabilir maddeler.
11. **Manuel canlı test rehberi** — URL, adımlar, beklenen sonuç (Mimar canlıda tekrarlayacak).
12. **Rollback planı** — kod (git revert / önceki commit), DB (yedek + `pg_restore`), env/Nginx.
13. **Kalıcılık / dayanıklılık** — değişiklik restart sonrası nasıl davranır (süreç belleğine bağımlılık var mı? yeniden üretilebilir mi?), yeni veri/şablon eklenince otomatik kapsanır mı, 1 yıl sonra bakım yükü nedir, sistem tasarımına etkisi (+/−).

## TDD sırası (değişmez)
1. Test yaz → çalıştır → **kırmızı** olduğunu göster (çıktıyla). Kırmızı değilse test hatalıdır, devam etme.
2. Minimum kod yaz → test **yeşil**. Nedenini tek cümleyle açıkla.
3. İlgili tüm mevcut testleri çalıştır (regresyon) → hepsi yeşil.
4. Ancak bundan sonra "implementasyon tamamlandı" de; çıktıları göster.
5. Yeşil olana kadar döngü sürer; 3 denemeden sonra hâlâ kırmızıysa **dur, Mimar'a söyle** (körlemesine değiştirme).

## Clean code kuralları (bu repo için somut)
- Yeni iş mantığı `src/services/<ad>.js`'de, saf (pure) fonksiyon olarak — Prisma/`req` parametre olarak geçirilir ki fake ile test edilebilsin (mevcut örnek: `src/services/member-admin.js` + `scripts/test-admin-members.js`).
- Route handler'lar ince: doğrulama → service → render/redirect. `admin.js`'e yeni uzun fonksiyon ekleme.
- Bir fonksiyon bir iş; tekrar 2'den fazlaysa util'e çıkar (yalnızca dokunduğun kod için).
- Mevcut üslup: 2 boşluk, tek tırnak, noktalı virgül, `const`, async/await, erken return. Türkçe kullanıcı mesajları, İngilizce tanımlayıcılar, Türkçe yorumlar.
- Sır, IP, URL gibi değerler koda yazılmaz — `process.env` + `.env.example`'a anahtar adı (değersiz).

## Halüsinasyon ve durma koşulları
- Dosya/fonksiyon/API hakkında emin değilsen (<%100): oku; okuyamıyorsan "kontrol ettim, bulamadım/emin değilim" de.
- Aynı hata için 3 farklı düzeltme denemesi başarısızsa → dur, durumu özetle, Mimar'dan karar iste.
- Mimar'ın isteği ile repodaki gerçek durum çelişiyorsa → önce çelişkiyi göster, sonra devam et.
- Bağlam dolmaya yakınsa → `PROJECT_STATE.md`'yi hemen güncelle ki sonraki oturum nerede kaldığını bilsin.

## Teslim (handoff) şablonu — her çemberin sonunda, sohbet dilinde (Azerbaycanca)
```
### Değişen dosyalar
- path — ne değişti (1 satır)
### Test sonuçları
- komut → PASS/FAIL (çıktı özeti)
### Git adımları (Mimar yürütür)
git status
git add <dosyalar>           # nokta (.) yok — yalnızca değişen dosyalar
git commit -m "<type>(<scope>): <mesaj>"   # type: feat|fix|chore|docs|test|refactor
git push origin main
git log --oneline -3
### Sunucuda (Google Cloud VM, Mimar yürütür)
cd <uygulama-klasörü>        # PROJECT_STATE §Sunucu'da onaylanmış yol
git pull origin main
npm ci --omit=dev            # yalnızca package-lock değiştiyse
npx prisma generate          # yalnızca schema değiştiyse
npx prisma migrate deploy    # yalnızca migration varsa (önce pg_dump!)
pm2 restart unityverse && pm2 logs unityverse --lines 50
### Manuel canlı test rehberi
1. URL → adım → beklenen sonuç
### Rollback
git revert <hash> && git push  (veya) pm2 restart ile önceki release
### PROJECT_STATE.md güncellendi: evet/hayır
```
Commit mesajı konvansiyonu (git log'dan): `feat:`, `fix:`, `fix(admin):`, `chore:` — İngilizce/Türkçe, emir kipi, ASCII.
