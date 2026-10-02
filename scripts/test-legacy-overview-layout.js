// Cember 22: "Egitime Ilk Bakis" gorsel duzeni — RENDER aninda uygulanir, DB'ye yazilmaz.
// Admin editorunde icerik ham haliyle (temiz HTML, duz metin) kalir; bu testle kilitlenir.
//
// Siniflandirma kurali (blok basina):
//   metin > 60 karakter + gorsel  -> DOKUNULMAZ (metin paragraflari asla yeniden akmaz)
//   gorsel yok                    -> dokunulmaz
//   gorsel >= 5                   -> uv-ov-gallery (kartli grid)
//   gorsel 1..4                   -> uv-ov-media   (esit yukseklikte, ortalanmis sira)
// Ardisik ve METINSIZ gorsel bloklari tek kapta birlestirilir (4 sertifika -> 2+2 dizilir).

const assert = require('assert/strict');
const {
  applyOverviewLayout,
  gorselKaynaklari,
  gorunenMetin
} = require('../src/services/legacy-overview-layout');

const say = (html, desen) => (html.match(desen) || []).length;

// --- 1) Metinli blok DOKUNULMAZ (en kritik kural).
const metinli = `<p>${'A'.repeat(80)}<img src="a.jpg"></p>`;
assert.equal(applyOverviewLayout(metinli), metinli, 'metinli blok hic degismemeli');

// --- 2) Gorselsiz blok dokunulmaz.
const yalnizMetin = '<p>Sadece metin</p><h2>Baslik</h2>';
assert.equal(applyOverviewLayout(yalnizMetin), yalnizMetin);

// --- 3) Tek gorsel -> uv-ov-media.
const tek = applyOverviewLayout('<p><img src="a.jpg"></p>');
assert.match(tek, /class="uv-ov-media"/);
assert.equal(say(tek, /<img/g), 1);

// --- 4) 3 gorsel (rozetler) -> uv-ov-media, hepsi ayni kapta.
const uc = applyOverviewLayout('<p><img src="a.jpg"><img src="b.jpg"><img src="c.jpg"></p>');
assert.equal(say(uc, /class="uv-ov-media"/g), 1);
assert.equal(say(uc, /<img/g), 3);

// --- 5) 5+ gorsel -> uv-ov-gallery, her gorsel kendi kartinda.
const qalereya = applyOverviewLayout(`<p>${'<img src="x.jpg">'.repeat(6)}</p>`);
assert.match(qalereya, /class="uv-ov-gallery"/);
assert.equal(say(qalereya, /class="uv-ov-gallery-item"/g), 6);

// --- 6) Kisa etiket metni KORUNUR (ornek: "Egitimimizden kareler:").
const etiketli = applyOverviewLayout(`<h2>Egitimimizden kareler:${'<img src="x.jpg">'.repeat(6)}</h2>`);
assert.match(etiketli, /Egitimimizden kareler:/, 'kisa baslik metni kaybolmamali');
assert.match(etiketli, /class="uv-ov-gallery"/);

// --- 7) Ardisik METINSIZ bloklar birlesir (4 sertifika -> tek kap -> 2+2 dizilir).
const sertifikalar = applyOverviewLayout(
  '<p><img src="1.jpg"></p><p><img src="2.jpg"><img src="3.jpg"></p><p><img src="4.jpg"></p>'
);
assert.equal(say(sertifikalar, /class="uv-ov-media"/g), 1, 'ardisik metinsiz bloklar tek kapta birlesmeli');
assert.equal(say(sertifikalar, /<img/g), 4);

// --- 8) Metinli blok birlestirmeyi BOLER (metin kaybolmaz, sirasi bozulmaz).
const bolunmus = applyOverviewLayout(
  `<p><img src="1.jpg"></p><p>${'B'.repeat(80)}</p><p><img src="2.jpg"></p>`
);
assert.equal(say(bolunmus, /class="uv-ov-media"/g), 2, 'metinli blok iki kabi ayirmali');
assert.match(bolunmus, /B{80}/);

// --- 8b) IC ICE YAPI (2026-10-01 canli hatasi): bloklar bir sarmalayici <div> icindeyse de
// siniflandirilmali. Yalnizca ust seviyeye bakan surum, 1454 numarali kursta 7 gorsel blogunu
// atlamis ve hepsi sola yapisik kalmisti.
const icIce = applyOverviewLayout('<div><p><img src="1.jpg"></p><p><img src="2.jpg"></p></div>');
assert.match(icIce, /class="uv-ov-media"/, 'sarmalayici icindeki bloklar da siniflandirilmali');
assert.equal(say(icIce, /<img/g), 2);

const derin = applyOverviewLayout('<div><section><p><img src="a.jpg"></p></section></div>');
assert.match(derin, /class="uv-ov-media"/, 'derin ic ice yapi da siniflandirilmali');

// Ic ice yapida da metinli blok korunur.
const icIceMetinli = `<div><p>${'A'.repeat(80)}<img src="a.jpg"></p></div>`;
assert.equal(applyOverviewLayout(icIceMetinli), icIceMetinli, 'ic ice metinli blok dokunulmamali');

// --- 8c) METINLI SARMALAYICI icindeki gorsel bloklari (1454'teki gercek yapi):
// dis <div> hem uzun metin hem gorsel tasiyor. Dis blok "metinli" sayilip atlanirsa, icindeki
// SAF GORSEL paragraflari da atlanir ve sola yapisik kalir. En ICTEKI bloga inilmelidir.
const metinliSarmalayici = `<div><p>${'A'.repeat(120)}</p><p><img src="1.jpg"></p><p><img src="2.jpg"></p></div>`;
const sarmalayiciSonuc = applyOverviewLayout(metinliSarmalayici);
assert.match(sarmalayiciSonuc, /class="uv-ov-media"/, 'metinli sarmalayici icindeki gorsel bloklari siniflandirilmali');
assert.match(sarmalayiciSonuc, /A{120}/, 'sarmalayicidaki metin korunmali');
assert.equal(say(sarmalayiciSonuc, /<img/g), 2);

// --- 8d) "Basari Hikayeleri" CTA kutusu (div.alert-success) icerigin EN SONUNDA kaliyordu;
// Mimar istegi (2026-10-01): galeri bolumunun ONUNE alinsin, ustteki metne de alttaki
// "Egitimimizden kareler" basligina da yapismasin (bosluk CSS'te verilir).
const ctaHtml = '<p>Etiketler: a b c</p>'
  + `<h2>Egitimimizden kareler:${'<img src="g.jpg">'.repeat(6)}</h2>`
  + '<div class="alert alert-success"><span>Ogrencilerimizin Basari Hikayeleri</span>'
  + '<a href="/blog/10/" class="btn btn-success">Oku</a></div>';
const ctaSonuc = applyOverviewLayout(ctaHtml);
const ctaIndeks = ctaSonuc.indexOf('alert-success');
const galeriIndeks = ctaSonuc.indexOf('uv-ov-gallery');
assert.ok(ctaIndeks > -1, 'CTA kutusu kaybolmamali');
assert.ok(ctaIndeks < galeriIndeks, 'CTA galeri bolumunun ONUNDE olmali');
assert.match(ctaSonuc, /Etiketler: a b c/, 'ustteki metin korunmali');
assert.ok(ctaSonuc.indexOf('Etiketler') < ctaIndeks, 'CTA ustteki metnin ALTINDA kalmali');

// Birden fazla galeri varsa CTA SONUNCU galerinin onune alinir (sertifika galerisi degil).
const ikiGaleri = applyOverviewLayout(
  `<p>${'<img src="s.jpg">'.repeat(6)}</p>`
  + `<h2>Egitimimizden kareler:${'<img src="f.jpg">'.repeat(6)}</h2>`
  + '<div class="alert alert-success">CTA</div>'
);
const sonGaleri = ikiGaleri.lastIndexOf('uv-ov-gallery"');
assert.ok(ikiGaleri.indexOf('alert-success') < sonGaleri, 'CTA son galerinin onune alinmali');
assert.ok(ikiGaleri.indexOf('alert-success') > ikiGaleri.indexOf('uv-ov-gallery"'), 'ilk galeri (sertifikalar) CTA\'dan once kalmali');

// Galeri yoksa CTA yerinde kalir (davranis degismez).
const galerisiz = '<p>Metin</p><div class="alert alert-success">CTA</div>';
assert.equal(applyOverviewLayout(galerisiz), galerisiz, 'galeri yoksa CTA tasinmamali');

// --- 8e) ARTIK <br> TEMIZLIGI (2026-10-02 canli olcumu):
// Gorseller kaba alininca aralarindaki <br>'ler blokta kalir, yan yana gelir ve devasa bir
// bosluk yaratir — olculdu: 18 <br> = 493px. Blok zaten "yalnizca gorsel" blogu oldugundan
// bu <br>'ler bosluk dolgusudur ve kaldirilir. METINLI bloklara DOKUNULMAZ.
const brliMedya = applyOverviewLayout('<p><img src="1.jpg"><br><br><img src="2.jpg"><br></p>');
assert.equal(say(brliMedya, /<br/g), 0, 'konteyner alan blokta <br> kalmamali');
assert.equal(say(brliMedya, /<img/g), 2, 'gorseller korunmali');

// Derinde, <span> icinde duran <br>'ler de temizlenmeli (gercek yapi boyle).
const derinBr = applyOverviewLayout('<h2>Egitimimizden kareler:<span><br><br>' + '<img src="x.jpg">'.repeat(6) + '<br></span></h2>');
assert.equal(say(derinBr, /<br/g), 0, 'span icindeki <br> de temizlenmeli');
assert.match(derinBr, /Egitimimizden kareler:/, 'etiket metni korunmali');
assert.equal(say(derinBr, /<img/g), 6);

// METINLI blokta <br> KORUNUR (satir sonu anlamli olabilir).
const metinliBr = `<p>${'A'.repeat(80)}<br>${'B'.repeat(80)}<img src="a.jpg"></p>`;
assert.equal(applyOverviewLayout(metinliBr), metinliBr, 'metinli blok hic degismemeli');

// Gorselsiz blokta <br> KORUNUR.
const gorselsizBr = '<p>Kisa metin<br>ikinci satir</p>';
assert.equal(applyOverviewLayout(gorselsizBr), gorselsizBr);

// --- 9) KORUMA: gorsel kaynaklari ve sirasi birebir korunur.
const karisik = '<p><img src="1.jpg"></p><p><a href="/x"><img src="2.jpg"></a><img src="3.jpg"></p>';
const sonuc = applyOverviewLayout(karisik);
assert.deepEqual(gorselKaynaklari(sonuc), ['1.jpg', '2.jpg', '3.jpg']);
assert.match(sonuc, /href="\/x"/, 'gorseli saran baglanti korunmali');

// --- 10) KORUMA: gorunen metin degismez.
const metinliKarisik = '<h2>Sertifikalar</h2><p><img src="1.jpg"></p><p>Uzun bir aciklama metni burada yer aliyor ve korunmalidir.</p>';
assert.equal(gorunenMetin(applyOverviewLayout(metinliKarisik)), gorunenMetin(metinliKarisik));

// --- 11) Idempotent: ikinci gecis degistirmez.
const birinci = applyOverviewLayout('<p><img src="a.jpg"></p><p><img src="b.jpg"></p>');
assert.equal(applyOverviewLayout(birinci), birinci);

// --- 12) Gecersiz girdi guvenli.
[null, undefined, '', 42].forEach((girdi) => {
  const r = applyOverviewLayout(girdi);
  assert.equal(r, typeof girdi === 'string' ? girdi : '');
});

// --- 15) DUZUM CEDVELI acilir (Cember 29).
// Olculdu (2026-10-02, animasyon kategorisi, 6 kurs): 1 satir / 2 hucreli bir cedvelin bir
// hucresinde yalnizca gorsel, digerinde yalnizca metin duruyor. Cedvelin otomatik duzeni
// genis metin hucresine yer verip gorsel hucresini sikistiriyor: 600x326'lik bir gorsel
// 60x320 render ediliyordu, metin hucresinde 741px bosluk kaliyordu.
const duzumCedveli = [
  '<table><tbody><tr>',
  '<td><p><img src="/uploads/fm/a.jpg" width="600" /></p></td>',
  '<td><p>' + 'Bu kurs hakkinda uzun bir aciklama metni. '.repeat(4) + '</p></td>',
  '</tr></tbody></table>'
].join('');
const duzumSonuc = applyOverviewLayout(duzumCedveli);
assert.doesNotMatch(duzumSonuc, /<table/i, 'duzum cedveli blok akisina acilmali');
assert.equal(say(duzumSonuc, /class="uv-ov-media"/g), 1, 'gorsel normal medya kabina alinmali');
assert.deepEqual(gorselKaynaklari(duzumSonuc), gorselKaynaklari(duzumCedveli), 'gorsel sirasi korunmali');
assert.equal(gorunenMetin(duzumSonuc), gorunenMetin(duzumCedveli), 'metin korunmali');

// Iki gorselli hucre de ayni sekilde acilir (1364/553 deseni).
const ikiGorselli = [
  '<table><tbody><tr>',
  '<td><p><img src="/uploads/fm/b1.jpg" /><img src="/uploads/fm/b2.jpg" /></p></td>',
  '<td><p>' + 'Karakter tasarimi egitimi aciklamasi. '.repeat(4) + '</p></td>',
  '</tr></tbody></table>'
].join('');
const ikiSonuc = applyOverviewLayout(ikiGorselli);
assert.doesNotMatch(ikiSonuc, /<table/i, 'iki gorselli duzum cedveli de acilmali');
assert.equal(say(ikiSonuc, /<img/g), 2, 'iki gorsel de korunmali');

// --- 16) GERCEK VERI TABLOLARI DOKUNULMAZ (kapsam kilidi).
// (a) Birden fazla satir
const veriTablosu = [
  '<table><tbody>',
  '<tr><td><p><img src="/uploads/fm/c.jpg" /></p></td><td><p>' + 'Satir bir aciklamasi uzun metin. '.repeat(3) + '</p></td></tr>',
  '<tr><td>Ikinci satir</td><td>Deger</td></tr>',
  '</tbody></table>'
].join('');
assert.match(applyOverviewLayout(veriTablosu), /<table/i, 'cok satirli tablo dokunulmamali');

// (b) <th> tasiyan tablo
const basliklitablo = '<table><tbody><tr><th>Baslik</th><td><p><img src="/uploads/fm/d.jpg" /></p></td></tr></tbody></table>';
assert.match(applyOverviewLayout(basliklitablo), /<table/i, 'th tasiyan tablo dokunulmamali');

// (c) iframe'li hucre (video tablosu) — videolar yan yana 600x338 goruntulenir, bozulmamali
const videoTablosu = [
  '<table><tbody><tr>',
  '<td><iframe src="https://www.youtube.com/embed/x"></iframe></td>',
  '<td><p>' + 'Video aciklamasi uzun metin olarak burada. '.repeat(3) + '</p></td>',
  '</tr></tbody></table>'
].join('');
assert.match(applyOverviewLayout(videoTablosu), /<table/i, 'iframe tasiyan tablo dokunulmamali');

// (d) Iki hucresi de metinli tablo (karsilastirma tablosu)
const metinTablosu = [
  '<table><tbody><tr>',
  '<td><p>' + 'Sol hucre metni burada duruyor. '.repeat(3) + '</p></td>',
  '<td><p>' + 'Sag hucre metni burada duruyor. '.repeat(3) + '</p></td>',
  '</tr></tbody></table>'
].join('');
assert.match(applyOverviewLayout(metinTablosu), /<table/i, 'iki metinli tablo dokunulmamali');

// --- 17) Duzum cedveli donusumu idempotent.
assert.equal(applyOverviewLayout(duzumSonuc), duzumSonuc, 'ikinci cagri degisiklik yapmamali');

// --- 18) BLOGUN DOGRUDAN SAHIP OLDUGU GORSEL de siniflandirilir (Cember 30).
// Olculdu (2026-10-02, 1116 ve ayni icerikli 3 kurs): bir gorsel blogun DOGRUDAN icinde,
// ayni blogun icinde ayrica gorselli bir alt blok var. Cember 22b'nin "en icteki blok"
// kurali dis blogu aday olmaktan cikariyor, dogrudan duran gorsel de hicbir adaya girmiyor
// -> hic kaba alinmiyor, metnin yaninda 150x204 kaliyor, komsusu ise 236x320 (orantisiz).
const dogrudanGorsel = [
  '<div>Egitmen: Hasan Mert Oz',
  '<img src="/uploads/fm/pp1.jpg" />',
  '<div><img src="/uploads/fm/pp2.jpg" /></div>',
  '</div>'
].join('');
const dogrudanSonuc = applyOverviewLayout(dogrudanGorsel);
assert.equal(say(dogrudanSonuc, /class="uv-ov-media"/g), 2, 'hem dogrudan gorsel hem alt blok kaba alinmali');
assert.deepEqual(gorselKaynaklari(dogrudanSonuc), gorselKaynaklari(dogrudanGorsel), 'gorsel SIRASI korunmali (kap ilk gorselin yerine konur)');
assert.equal(gorunenMetin(dogrudanSonuc), gorunenMetin(dogrudanGorsel), 'metin korunmali');

// --- 19) UZUN METINLI blokta dogrudan gorsel DOKUNULMAZ (ihlal edilemez kural).
// 2026-10-02 olcumu: 157 siniflandirilmamis gorselin 153'u uzun metinli bloklarda; bunlara
// dokunulmaz, aksi halde metin yeniden akar.
const uzunMetinli = [
  '<div>' + 'Bu bolumde egitmenlerimizin ozgecmisi ve deneyimleri detayli anlatilir. '.repeat(2),
  '<img src="/uploads/fm/uzun1.jpg" />',
  '<div><img src="/uploads/fm/uzun2.jpg" /></div>',
  '</div>'
].join('');
const uzunSonuc = applyOverviewLayout(uzunMetinli);
assert.equal(say(uzunSonuc, /class="uv-ov-media"/g), 1, 'yalnizca alt blok kaba alinir, uzun metinli dis blok dokunulmaz');
assert.match(uzunSonuc, /Bu bolumde egitmenlerimizin/, 'uzun metin yerinde kalmali');

// --- 20) Dogrudan gorsel donusumu idempotent.
assert.equal(applyOverviewLayout(dogrudanSonuc), dogrudanSonuc, 'ikinci cagri degisiklik yapmamali');

// --- 21) EGITMEN KARTI hucresi: gorsel ustte, etiket ALTTA (Cember 30c).
// Olculdu (2026-10-02, canli 1116): iki hucreden birinde etiket gorselin altinda (ust 2483),
// digerinde USTUNDE (ust 2072) ve gorseller farkli yukseklikte basliyordu (2061 / 2131).
// Sebep: kap bir yolda ilk gorselin yerine, diger yolda blogun SONUNA konuyordu.
// Kapsam olculdu: bu desen 23 kurs / 27 hucre, etiketlerin TAMAMI "Egitmen: ..." —
// "Egitimimizden kareler" basligi bu desene hic girmiyor (bolum basligi ters cevrilmez).
const etiketUstte = [
  '<table><tbody><tr>',
  '<td><div>Egitmen: Emir Hakan Gul<img src="/uploads/fm/e2.jpg" /></div></td>',
  '<td><div><img src="/uploads/fm/e1.jpg" /></div><br /><br /><strong>Egitmen: Hasan Mert Oz</strong></td>',
  '</tr></tbody></table>'
].join('');
const kartSonuc = applyOverviewLayout(etiketUstte);
const hucreler = kartSonuc.split('<td').slice(1);
assert.equal(hucreler.length, 2, 'iki hucre korunmali');
hucreler.forEach((h, i) => {
  const kapYeri = h.indexOf('uv-ov-media');
  const etiketYeri = h.search(/Egitmen:/);
  assert.ok(kapYeri > -1, 'hucre ' + i + ': kap olmali');
  assert.ok(kapYeri < etiketYeri, 'hucre ' + i + ': gorsel kabi etiketten ONCE gelmeli');
});
assert.deepEqual(gorselKaynaklari(kartSonuc), gorselKaynaklari(etiketUstte), 'gorsel sirasi korunmali');
assert.equal(gorunenMetin(kartSonuc), gorunenMetin(etiketUstte), 'metin korunmali');
assert.equal(say(kartSonuc, /<br/g), 0, 'kap ile etiket arasindaki artik <br> kaldirilmali (hucre yukseklikleri esitlensin)');

// --- 22) BOLUM BASLIGI ters cevrilmez: galeri etiketin ALTINDA kalir.
const bolumBasligi = '<p>Egitimimizden kareler:</p><p>' + Array.from({ length: 6 }, (unused, i) => '<img src="/uploads/fm/g' + i + '.jpg" />').join('') + '</p>';
const bolumSonuc = applyOverviewLayout(bolumBasligi);
assert.ok(bolumSonuc.indexOf('Egitimimizden kareler') < bolumSonuc.indexOf('uv-ov-gallery'), 'bolum basligi galerinin USTUNDE kalmali');

// --- 23) Cok gorselli hucre (galeri) ve uzun metinli hucre DOKUNULMAZ.
const galeriHucresi = '<table><tbody><tr><td><p>Sertifikalar</p><p>' + Array.from({ length: 6 }, (unused, i) => '<img src="/uploads/fm/s' + i + '.jpg" />').join('') + '</p></td><td><p>yan</p></td></tr></tbody></table>';
const galeriSonuc = applyOverviewLayout(galeriHucresi);
assert.ok(galeriSonuc.indexOf('Sertifikalar') < galeriSonuc.indexOf('uv-ov-gallery'), 'galeri hucresinde etiket ustte kalmali');

// --- 24) Egitmen karti donusumu idempotent.
assert.equal(applyOverviewLayout(kartSonuc), kartSonuc, 'ikinci cagri degisiklik yapmamali');

// --- 13) ENTEGRASYON: donusum RENDER aninda, yalnizca statik sayfa yolunda.
const fs = require('fs');
const path = require('path');
const tabsKaynak = fs.readFileSync(path.join(__dirname, '..', 'src/services/legacy-product-tabs.js'), 'utf8');
assert.match(tabsKaynak, /applyOverviewLayout/, 'statik sayfa zincirine baglanmali');
const dinamikKaynak = fs.readFileSync(path.join(__dirname, '..', 'src/routes/legacy-product-detail.js'), 'utf8');
assert.doesNotMatch(dinamikKaynak, /applyOverviewLayout/, 'dinamik sayfaya uygulanmamali (course-overview.js orada calisiyor)');

// --- 14) ADMIN ENTEGRASYONU: donusum DB'ye yazilmaz; servis saf, prisma'ya dokunmaz.
const servisKaynak = fs.readFileSync(path.join(__dirname, '..', 'src/services/legacy-overview-layout.js'), 'utf8');
assert.doesNotMatch(servisKaynak, /prisma|update\(|create\(/, 'servis DB\'ye dokunmamali — admin icerigi ham kalir');

console.log('test-legacy-overview-layout OK');
