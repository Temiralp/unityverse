// Cember 20: OVERVIEW icerigindeki Word yapistirma artiklarinin temizlenmesi.
// Kural: METIN ve GORSEL asla kaybolmaz. Servis bunu kendi icinde dogrular ve ihlal olursa
// bozuk icerik dondurmez, HATA FIRLATIR (sessiz veri kaybi olmasin).

const assert = require('assert/strict');
const {
  normalizeOverviewContent,
  gorselKaynaklari,
  gorunenMetin,
  assertIcerikKorundu
} = require('../src/services/course-overview-normalize');

const govde = (html) => normalizeOverviewContent(html).content;

// --- N1: 3+ ardisik <br> tek <br>'ye iner; 2 ve alti dokunulmaz.
assert.equal(govde('<p>a<br><br><br>b</p>'), '<p>a<br>b</p>');
assert.equal(govde('<p>a<br><br><br><br><br>b</p>'), '<p>a<br>b</p>');
assert.equal(govde('<p>a<br><br>b</p>'), '<p>a<br><br>b</p>', '2 br gercek satir sonu olabilir, dokunulmaz');
assert.equal(govde('<p>a<br>b</p>'), '<p>a<br>b</p>');
assert.equal(govde('<p>a<BR /><br/><br>b</p>'), '<p>a<br>b</p>', 'buyuk harf ve self-closing de sayilmali');

// --- N2: 2+ ardisik &nbsp; (bosluklu da olsa) tek bosluga iner; tek &nbsp; dokunulmaz.
assert.equal(govde('<p>a&nbsp;&nbsp;&nbsp;b</p>'), '<p>a b</p>');
assert.equal(govde('<p>a&nbsp; &nbsp; &nbsp;b</p>'), '<p>a b</p>', 'bosluklu dizi de yigindir');
assert.equal(govde('<p>a   b</p>'), '<p>a b</p>', 'gercek U+00A0 karakteri de sayilmali');
assert.equal(govde('<p>a&nbsp;b</p>'), '<p>a&nbsp;b</p>', 'tek &nbsp; anlamli olabilir, dokunulmaz');

// --- N3: yalnizca bosluk/<br>/&nbsp; tasiyan bloklar silinir.
assert.equal(govde('<p></p>'), '');
assert.equal(govde('<div>  </div>'), '');
assert.equal(govde('<div><br><br><br><br></div>'), '', 'yalnizca br tasiyan dolgu blogu silinir');
assert.equal(govde('<p>&nbsp;&nbsp;</p>'), '');
assert.equal(govde('<div><p></p><div></div></div>'), '', 'ic ice bos bloklar da temizlenir');

// --- N3 KORUMA: icinde metin veya gorsel olan blok ASLA silinmez.
assert.equal(govde('<p>metin</p>'), '<p>metin</p>');
assert.equal(govde('<p><img src="a.jpg"></p>'), '<p><img src="a.jpg"></p>');
assert.equal(govde('<div><br><img src="a.jpg"><br></div>'), '<div><br><img src="a.jpg"><br></div>');

// --- Temiz icerik BAYT BAYT ayni kalmali (Mimar sarti: duzgun olanlara dokunulmayacak).
const temiz = '<h2>Baslik</h2><p>Kisa aciklama metni.</p><p><img src="/uploads/fm/a.jpg" width="500"></p>';
const temizSonuc = normalizeOverviewContent(temiz);
assert.equal(temizSonuc.content, temiz);
assert.equal(temizSonuc.degisti, false, 'temiz icerikte degisiklik bayragi false olmali');

// --- GERCEK VERIDEN CIKAN HATA (2026-09-30): bos blok silininca iki yandaki <br> yan yana
// gelir ve YENI bir zincir olusur. Donusumler tek gecisle biterse ikinci calistirma yine
// degisiklik uretir (idempotent degil). Bu senaryo o hatayi kilitler.
assert.equal(
  govde('<p>a<br><br><div></div><br><br>b</p>'),
  '<p>a<br>b</p>',
  'bos blok silindikten sonra olusan yeni br zinciri de toplanmali'
);
assert.equal(govde('<div><br><br></div><div><br><br></div>'), '');

// --- Idempotent: ikinci gecis hicbir sey degistirmez.
const bozuk = '<div><br><br><br></div><p>a&nbsp;&nbsp;&nbsp;b<br><br><br><br>c</p><p></p>';
const birinci = normalizeOverviewContent(bozuk).content;
assert.equal(normalizeOverviewContent(birinci).content, birinci);
assert.equal(normalizeOverviewContent(birinci).degisti, false);

// --- KORUMA 1: gorsel kaynaklari birebir ayni kalmali (sira dahil).
const gorselli = '<div><br><br><br></div><p><img src="a.jpg" width="300">'
  + '&nbsp;&nbsp;&nbsp;<img src="b.jpg"></p><p></p><p><img src="c.jpg"></p>';
const gorselSonuc = normalizeOverviewContent(gorselli);
assert.deepEqual(gorselKaynaklari(gorselSonuc.content), ['a.jpg', 'b.jpg', 'c.jpg']);
assert.deepEqual(gorselKaynaklari(gorselli), gorselKaynaklari(gorselSonuc.content));

// --- KORUMA 2: gorunen metin birebir ayni kalmali.
const metinli = '<h2><span><strong><span><br><br><br><br>&nbsp; &nbsp; &nbsp;Baslik Metni</span></strong></span></h2>'
  + '<p>Ikinci paragraf.</p>';
assert.equal(gorunenMetin(normalizeOverviewContent(metinli).content), gorunenMetin(metinli));

// --- KORUMA 3: ihlal halinde HATA firlatilmali (sessiz veri kaybi yasak).
assert.throws(
  () => assertIcerikKorundu('<p><img src="a.jpg">metin</p>', '<p>metin</p>'),
  /gorsel/i,
  'gorsel kaybinda hata firlatmali'
);
assert.throws(
  () => assertIcerikKorundu('<p>metin burada</p>', '<p>metin</p>'),
  /metin/i,
  'metin kaybinda hata firlatmali'
);
assert.doesNotThrow(() => assertIcerikKorundu('<p>a<br><br><br>b</p>', '<p>a<br>b</p>'));

// --- Sayaclar rapor icin dogru olmali.
const sayacSonuc = normalizeOverviewContent('<div><br><br><br></div><p>a&nbsp;&nbsp;b</p><p></p>');
assert.equal(sayacSonuc.degisti, true);
assert.ok(sayacSonuc.sayaclar.brZinciri >= 1);
assert.ok(sayacSonuc.sayaclar.nbspYigini >= 1);
assert.ok(sayacSonuc.sayaclar.bosBlok >= 1);

// --- Gecersiz girdi guvenli.
[null, undefined, '', 123].forEach((girdi) => {
  const sonuc = normalizeOverviewContent(girdi);
  assert.equal(sonuc.degisti, false);
  assert.equal(sonuc.content, typeof girdi === 'string' ? girdi : '');
});

console.log('test-course-overview-normalize OK');
