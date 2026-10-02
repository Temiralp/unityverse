// Cember 30b: "Egitimimizden kareler" bolumunun TEKRARLARINI kaldirir.
//
// Olculen gercek durum (2026-10-02, blender-3b-oyun-modelleme-canli-online-egitim-2):
// etiket 3 kez geciyor; bolumlerde 57 gorsel referansi ama yalnizca 31 tekrarsiz src ve
// GORSEL OLARAK 22 farkli fotograf — cunku blobid043/044, blobid138/139, blobid817/818
// ciftleri md5'i AYNI dosyalardir (ayni foto iki kez yuklenmis). Bu yuzden guvenlik sozu
// src esitligiyle yetinmez, DOSYA IMZASI da kabul eder.
//
// Kaldirma kurali: ILK etiketin bolumu korunur; sonraki KOK SEVIYE etiket bloklari ve onlari
// izleyen METINSIZ kardesler kaldirilir (metinli blokta durur — CTA kutusu korunur).
// Kaldirilan her gorsel, KALAN gorsellerden biriyle (ayni src VEYA ayni imza) karsilanmali;
// aksi halde durum MANUAL olur ve icerik DEGISTIRILMEZ.

const assert = require('assert/strict');
const {
  tekrarQalereyalariniKaldir,
  qalereyaEtiketiSayisi
} = require('../src/services/course-overview-duplicate-gallery');

const img = (ad) => '<img src="/uploads/fm/' + ad + '" />';
const say = (html, desen) => (html.match(desen) || []).length;
const srcler = (html) => (html.match(/<img\b[^>]*>/gi) || [])
  .map((e) => (/\bsrc\s*=\s*["']?([^"'\s>]+)/i.exec(e) || [])[1] || '');

// --- 1) Ayni src'li tekrar bolumu kaldirilir.
const ayniSrc = [
  '<div>Uzun bir kurs aciklamasi burada duruyor.<h2>Egitimimizden kareler:</h2>' + img('a.jpg') + img('b.jpg') + '</div>',
  '<h2>Egitimimizden kareler:</h2>' + img('a.jpg'),
  '<h2></h2>' + img('b.jpg')
].join('');
const r1 = tekrarQalereyalariniKaldir(ayniSrc);
assert.equal(r1.durum, 'DEGISECEK', 'tekrar bolumu kaldirilmali');
assert.equal(qalereyaEtiketiSayisi(r1.sonuc), 1, 'tek etiket kalmali');
assert.deepEqual(srcler(r1.sonuc), ['/uploads/fm/a.jpg', '/uploads/fm/b.jpg'], 'korunan bolumun gorselleri aynen kalmali');
assert.equal(r1.kaldirilanGorsel, 2, 'iki gorsel referansi kaldirilmali');
assert.match(r1.sonuc, /Uzun bir kurs aciklamasi/, 'metin korunmali');

// --- 2) Farkli src ama AYNI DOSYA IMZASI olan tekrar da kaldirilir (blobid043/044 vakasi).
const farkliSrc = [
  '<div>Aciklama metni.<h2>Egitimimizden kareler:</h2>' + img('blobid043.jpg') + '</div>',
  '<h2>Egitimimizden kareler:</h2>' + img('blobid044.jpg')
].join('');
const imzalar = { '/uploads/fm/blobid043.jpg': 'md5-x', '/uploads/fm/blobid044.jpg': 'md5-x' };
const r2 = tekrarQalereyalariniKaldir(farkliSrc, { dosyaImzasi: (src) => imzalar[src] || null });
assert.equal(r2.durum, 'DEGISECEK', 'imzasi ayni olan tekrar kaldirilmali');
assert.deepEqual(srcler(r2.sonuc), ['/uploads/fm/blobid043.jpg'], 'korunan src kalmali');

// --- 3) Karsilanmayan (tekil) gorsel varsa MANUAL — icerik DEGISMEZ.
const tekilVar = [
  '<div>Aciklama metni.<h2>Egitimimizden kareler:</h2>' + img('a.jpg') + '</div>',
  '<h2>Egitimimizden kareler:</h2>' + img('a.jpg') + img('yalniz-burada.jpg')
].join('');
const r3 = tekrarQalereyalariniKaldir(tekilVar, { dosyaImzasi: () => null });
assert.equal(r3.durum, 'MANUAL', 'karsilanmayan gorsel MANUAL olmali');
assert.equal(r3.sonuc, tekilVar, 'MANUAL durumda icerik bayt bayt ayni kalmali');
assert.match(r3.sebep, /yalniz-burada\.jpg/, 'sebep hangi gorselin karsilanmadigini soylemeli');

// --- 4) Bolum METINLI blokta durur: CTA kutusu korunur.
const ctaIle = [
  '<div>Aciklama metni.<h2>Egitimimizden kareler:</h2>' + img('a.jpg') + '</div>',
  '<h2>Egitimimizden kareler:</h2>' + img('a.jpg'),
  '<div class="alert alert-success">Ogrencilerimizin Ilham Verici Basari Hikayelerini Kesfedin</div>'
].join('');
const r4 = tekrarQalereyalariniKaldir(ctaIle);
assert.equal(r4.durum, 'DEGISECEK');
assert.match(r4.sonuc, /Basari Hikayelerini Kesfedin/, 'CTA kutusu kaldirilmamali');
assert.equal(qalereyaEtiketiSayisi(r4.sonuc), 1);

// --- 5) Tek etiket varsa DOKUNULMAZ.
const tekEtiket = '<div>Aciklama.<h2>Egitimimizden kareler:</h2>' + img('a.jpg') + '</div>';
const r5 = tekrarQalereyalariniKaldir(tekEtiket);
assert.equal(r5.durum, 'DOKUNULMAZ');
assert.equal(r5.sonuc, tekEtiket, 'tek etiketli icerik bayt bayt ayni kalmali');

// --- 6) Idempotent: kaldirilmis icerik ikinci cagrida degismez.
const r6 = tekrarQalereyalariniKaldir(r1.sonuc);
assert.equal(r6.durum, 'DOKUNULMAZ');
assert.equal(r6.sonuc, r1.sonuc);

// --- 7) Bos/gecersiz girdi cokmez.
assert.equal(tekrarQalereyalariniKaldir('').durum, 'DOKUNULMAZ');
assert.equal(tekrarQalereyalariniKaldir(null).sonuc, '');

// --- 8) Servis DB'ye dokunmaz (saf fonksiyon).
const fs = require('fs');
const path = require('path');
const kaynak = fs.readFileSync(path.join(__dirname, '..', 'src/services/course-overview-duplicate-gallery.js'), 'utf8');
assert.doesNotMatch(kaynak, /prisma|require\('\.\.\/db'\)/, 'servis prisma kullanmamali');
assert.doesNotMatch(kaynak, /sanitizeProductTabContent/, 'sanitize cagrilmamali (yol degisikligi yapar)');

console.log('test-course-overview-duplicate-gallery OK');
