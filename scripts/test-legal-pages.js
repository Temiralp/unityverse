// Cember 24: hukuki sayfalarin icerik guncellemesi + footer linkinin kaldirilmasi.
// Iki saf servis: (1) PDF'ten cikarilan duz metni sayfa HTML'ine cevirme, (2) footer linkini
// 629 statik dosyaya dokunmadan, render aninda tek yerden kaldirma.

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const { textToHtml } = require('../src/services/legal-page-content');
const { removeLegacyFooterLink, KALDIRILAN_FOOTER_YOLU } = require('../src/services/legacy-footer-links');

// ---------------------------------------------------------------- icerik cevirici
// "N. Baslik" -> <h2>
const basliklar = textToHtml('1. Taraflar\nIsbu sozlesme taraflar arasindadir.');
assert.match(basliklar, /<h2>1\. Taraflar<\/h2>/);
assert.match(basliklar, /<p>Isbu sozlesme taraflar arasindadir\.<\/p>/);

// "N.N. ..." alt bent paragraf olur, NUMARASI KORUNUR (hukuki metinde atif yapiliyor).
const altBent = textToHtml('1.1. Egitim baslamadan once iade edilir.');
assert.match(altBent, /<p>1\.1\. Egitim baslamadan once iade edilir\.<\/p>/);
assert.doesNotMatch(altBent, /<h2>/, 'alt bent baslik sayilmamali');

// Madde isaretleri listeye doner.
const liste = textToHtml('• Birinci madde\n• Ikinci madde');
assert.match(liste, /<ul>\s*<li>Birinci madde<\/li>\s*<li>Ikinci madde<\/li>\s*<\/ul>/);

// Satiri bolunmus paragraf TEK paragrafta birlesir (pdftotext satirlari sarar).
const sarilmis = textToHtml('Bu cumle ilk satirda baslar\nve ikinci satirda devam eder.');
assert.equal((sarilmis.match(/<p>/g) || []).length, 1, 'sarilan satirlar tek paragraf olmali');
assert.match(sarilmis, /baslar ve ikinci/, 'satirlar bosluklaizlenmeli');

// Bos satir yeni paragraf baslatir.
assert.equal((textToHtml('Birinci paragraf.\n\nIkinci paragraf.').match(/<p>/g) || []).length, 2);

// HTML kacisi: icerikteki < > & karakterleri sayfayi kirmamali.
const kacis = textToHtml('Sart: a < b & c > d');
assert.match(kacis, /a &lt; b &amp; c &gt; d/);
assert.doesNotMatch(kacis, /<p>Sart: a < b/);

// Bos/gecersiz girdi guvenli.
[null, undefined, '', '   '].forEach((girdi) => assert.equal(textToHtml(girdi), ''));

// Gercek metin kaybolmamali: girdideki her kelime ciktida da bulunmali.
const ornek = '1. Cayma Hakki\n1.1. Ilk ders yapilmadan once yazili olarak vazgecilirse bedel iade edilir.\n\n• Ucretsiz sertifika';
const duzMetin = (html) => html.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
ornek.replace(/[•\n]/g, ' ').split(/\s+/).filter(Boolean).forEach((kelime) => {
  assert.ok(duzMetin(basliklar + liste + altBent + textToHtml(ornek)).includes(kelime), `kelime kaybolmamali: ${kelime}`);
});

// ---------------------------------------------------------------- footer linki
const footerHtml = '<footer><ul>'
  + '<li><a href="./sayfa/hakkimizda-25/">Hakkımızda</a></li>'
  + `<li><a href=".${KALDIRILAN_FOOTER_YOLU}">Kişisel Verilerin Korunması Hakkında Aydınlatma Bildirimi</a></li>`
  + '<li><a href="./sayfa/mesafeli-satis-sozlesmesi-26/">Mesafeli Satış Sözleşmesi</a></li>'
  + '</ul></footer>';

const temiz = removeLegacyFooterLink(footerHtml);
assert.doesNotMatch(temiz, /Kişisel Verilerin Korunması/, 'istenmeyen link kaldirilmali');
assert.match(temiz, /Hakkımızda/, 'diger linkler KALMALI');
assert.match(temiz, /Mesafeli Satış Sözleşmesi/, 'diger linkler KALMALI');
assert.equal((temiz.match(/<li>/g) || []).length, 2, 'yalnizca bir <li> kaldirilmali');

// Idempotent + ilgisiz sayfaya dokunmaz.
assert.equal(removeLegacyFooterLink(temiz), temiz);
const alakasiz = '<div>Baska bir sayfa</div>';
assert.equal(removeLegacyFooterLink(alakasiz), alakasiz);
[null, undefined, 42].forEach((girdi) => assert.equal(removeLegacyFooterLink(girdi), girdi));

// Zincire bagli olmali (629 statik dosyaya dokunulmaz).
const middleware = fs.readFileSync(path.join(__dirname, '..', 'src/middleware/legacy-whatsapp.js'), 'utf8');
assert.match(middleware, /removeLegacyFooterLink/, 'footer temizligi enhanceLegacyHtml zincirinde olmali');

console.log('test-legal-pages OK');
