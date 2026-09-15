# İş metodu (workflow) — hər sessiyada yüklənir

## Dairə (circle) metodu
- Hər iş = bir dairə. Dairənin içi **minimum dəyişikliklə, maksimum dəqiqliklə, kənara sıçratmadan** boyanır.
- Dairə "bitdi" sayılır ⇔ (1) plan təsdiqlənib, (2) testlər əvvəl qırmızı → sonra yaşıl, (3) implementasiya sonrası **bütün** əlaqəli testlər yaşıl, (4) regressiya yoxlaması keçib, (5) təhvil paketi verilib, (6) `PROJECT_STATE.md` yenilənib.
- Dairə bitmədən yenisi açılmır (Arxitekt açıq şəkildə demədikcə). Bir dairənin bağlanması yeni xəta/yeni dairə açmamalıdır — bunun sübutu regressiya testləridir.
- Dairə ortasında yeni problem tapılsa: **düzəltmə**, `PROJECT_STATE.md` → Backlog-a yaz, Arxitektə bildir.

## Böyüklük həddi və təsdiq
| Ölçü | Tələb |
|---|---|
| ≤3 fayl **və** ≤100 sətir | Qısa niyyət bildir (nə, niyə, hansı fayl), test yaz, et. |
| >3 fayl **və ya** >100 sətir | Aşağıdakı plan şablonu → Arxitekt "təsdiq" deyənə qədər kod yazma. |
| Migration / dependency / env / Nginx / infra | Həmişə plan + təsdiq, ölçüdən asılı olmayaraq. |

## Plan şablonu (böyük işlər üçün məcburi bölmələr)
1. **Məqsəd** — bir cümlə; hansı istifadəçi/biznes problemi həll olunur.
2. **Nə ediləcək** — addım-addım, hər addım yoxlanıla bilən.
3. **Toxunulacaq fayllar** — dəyişəcək / yeni yaranacaq / silinəcək, hər biri üçün səbəb.
4. **Həcm təxmini** — sətir sayı (real say, fayl-fayl), tələb olunan tool çağırışı/token bahalılığı (aşağı/orta/yüksək), addım sayı. Token qıtlığı var — israf etmə.
5. **Test planı** — hansı test faylı, hansı halları yoxlayır, **niyə əvvəl qırmızı olacaq** (hansı funksiya/davranış hələ yoxdur) və **hansı dəyişiklik onu yaşıl edəcək**.
6. **Zərər görə biləcək yerlər** — dəyişən funksiyanı çağıran bütün yerlər (`grep` ilə real siyahı, `fayl:sətir`), paylaşılan util/service-lər, EJS view-lar, statik HTML.
7. **Blast radius** — dəyişiklik pozulsa nə itir: səhifə? ödəniş? SEO? admin? Kimə görünür (public/admin/ödəniş)? Geri dönüş (rollback) neçə dəqiqə?
8. **Risklər və üstünlüklər** — cədvəl; risk üçün: ehtimal (aşağı/orta/yüksək), təsir, azaltma tədbiri.
9. **Xarici faktorlar** — 3-cü tərəf API (PayTR, Google OAuth, SMTP, Nginx, GCloud) varsa: rəsmi sənəd linki/oxunmuş məlumat, versiya, limit. Təxmin qadağandır — oxumadınsa "yoxlanmalıdır" yaz.
10. **Qəbul meyarları (Definition of Done)** — yoxlanıla bilən maddələr.
11. **Manual canlı test bələdçisi** — URL, addımlar, gözlənilən nəticə (Arxitekt canlıda təkrarlayacaq).
12. **Rollback planı** — kod (git revert / əvvəlki commit), DB (backup + `pg_restore`), env/Nginx.

## TDD sırası (dəyişməz)
1. Test yaz → işlət → **qırmızı** olduğunu göstər (çıxış ilə). Qırmızı deyilsə test səhvdir, davam etmə.
2. Minimum kod yaz → test **yaşıl**. Səbəbi bir cümlə ilə izah et.
3. Əlaqəli bütün mövcud testləri işlət (regressiya) → hamısı yaşıl.
4. Yalnız bundan sonra "implementasiya tamamlandı" de; çıxışları göstər.
5. Yaşıl olmayana qədər dövr davam edir; 3 cəhddən sonra hələ qırmızıdırsa **dayan, Arxitektə de** (kor-koranə dəyişmə).

## Clean code qaydaları (bu repo üçün konkret)
- Yeni biznes məntiqi `src/services/<ad>.js`-də, saf (pure) funksiya kimi — Prisma/`req` parametr olaraq ötürülür ki, fake ilə test olunsun (mövcud nümunə: `src/services/member-admin.js` + `scripts/test-admin-members.js`).
- Route handler-lər nazik: validasiya → service → render/redirect. `admin.js`-ə yeni uzun funksiya əlavə etmə.
- Bir funksiya bir iş; təkrar 2 dəfədən çoxdursa util-ə çıxar (yalnız toxunduğun kod üçün).
- Mövcud üslub: 2 boşluq, tək dırnaq, nöqtəli vergül, `const`, async/await, erkən return. Türkcə istifadəçi mesajları, ingilis identifikatorlar.
- Sirr, IP, URL kimi dəyərlər koda yazılmır — `process.env` + `.env.example`-a açar adı (dəyərsiz).

## Halüsinasiya və dayanma şərtləri
- Fayl/funksiya/API haqqında əminliyin <100%-dirsə: oxu; oxuya bilmirsənsə "yoxladım, tapmadım/əmin deyiləm" de.
- Eyni xəta üçün 3 fərqli düzəliş cəhdi uğursuzdursa → dayan, vəziyyəti xülasə et, Arxitektdən qərar istə.
- Arxitektin istəyi ilə repo-daki real vəziyyət ziddiyyət təşkil edirsə → əvvəl ziddiyyəti göstər, sonra davam et.
- Kontekst dolmağa yaxındırsa → `PROJECT_STATE.md`-ni dərhal yenilə ki, növbəti sessiya harda qaldığını bilsin.

## Təhvil (handoff) şablonu — hər dairənin sonunda, Azərbaycan dilində
```
### Dəyişən fayllar
- path — nə dəyişdi (1 sətir)
### Test nəticələri
- əmr → PASS/FAIL (çıxış xülasəsi)
### Git addımları (Arxitekt icra edir)
git status
git add <fayllar>            # nöqtə (.) yox — yalnız dəyişən fayllar
git commit -m "<type>(<scope>): <mesaj>"   # type: feat|fix|chore|docs|test|refactor
git push origin main
git log --oneline -3
### Serverdə (Google Cloud VM, Arxitekt icra edir)
cd <app-qovluğu>             # PROJECT_STATE §Server-də təsdiqlənmiş yol
git pull origin main
npm ci --omit=dev            # yalnız package-lock dəyişibsə
npx prisma generate          # yalnız schema dəyişibsə
npx prisma migrate deploy    # yalnız migration varsa (əvvəl pg_dump!)
pm2 restart unityverse && pm2 logs unityverse --lines 50
### Manual canlı test bələdçisi
1. URL → addım → gözlənilən nəticə
### Rollback
git revert <hash> && git push  (və ya) pm2 restart ilə əvvəlki release
### PROJECT_STATE.md yeniləndi: bəli/xeyr
```
Commit mesajı konvensiyası (git log-dan): `feat:`, `fix:`, `fix(admin):`, `chore:` — ingilis, imperativ, ASCII.
