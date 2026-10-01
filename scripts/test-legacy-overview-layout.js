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
