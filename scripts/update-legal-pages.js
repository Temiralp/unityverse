#!/usr/bin/env node
// Hukuki sayfalarin icerigini (PDF'ten cikarilmis metinden) statik sayfaya yazar.
//
//   node scripts/update-legal-pages.js --kaynak <klasor>            # DRY-RUN (varsayilan)
//   node scripts/update-legal-pages.js --kaynak <klasor> --apply    # dosyalari gunceller
//
// Yalnizca `<div id="content" ...> ... </div>` kabinin ICI degistirilir; sayfanin basligi,
// meta etiketleri, header/footer'i ve diger her seyi oldugu gibi kalir (SEO-kritik).
// Belgeler ileride tekrar guncellenecegi icin bu adim script'le yapilir, elle degil.

const fs = require('fs');
const path = require('path');
const { textToHtml } = require('../src/services/legal-page-content');

const rootDir = path.join(__dirname, '..');

// Hangi metin dosyasi hangi sayfaya gidiyor (Mimar 2026-10-01).
const ESLESMELER = [
  { metin: 'mesafeli-satis-sozlesmesi.txt', sayfa: 'sayfa/mesafeli-satis-sozlesmesi-26/index.html' },
  { metin: 'gizlilik-politikasi-kvkk.txt', sayfa: 'sayfa/uyelik-sozlesmesi-ve-gizlilik-politikasi-27/index.html' },
  { metin: 'iptal-ve-iade.txt', sayfa: 'sayfa/iptal-ve-iade-kosullari-28/index.html' }
];

const ICERIK_KABI = /(<div\b[^>]*id="content"[^>]*>)([\s\S]*?)(<\/div>\s*(?:<\/div>|<aside|<footer))/i;

function parseArgs(argv) {
  const secenekler = { apply: false, kaynak: null };
  argv.forEach((deger, indeks) => {
    if (deger === '--apply') secenekler.apply = true;
    if (deger === '--kaynak') secenekler.kaynak = argv[indeks + 1] || null;
  });
  return secenekler;
}

function duzMetin(html) {
  return html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;| /g, ' ').replace(/\s+/g, ' ').trim();
}

function main() {
  const secenekler = parseArgs(process.argv.slice(2));
  if (!secenekler.kaynak) {
    console.error('Kaynak klasor gerekli: --kaynak <pdftotext ciktilarinin bulundugu klasor>');
    process.exitCode = 1;
    return;
  }

  console.log(`=== Hukuki sayfa guncellemesi — ${secenekler.apply ? 'APPLY' : 'DRY-RUN (yazma yok)'} ===\n`);

  ESLESMELER.forEach(({ metin, sayfa }) => {
    const metinYolu = path.join(secenekler.kaynak, metin);
    const sayfaYolu = path.join(rootDir, sayfa);

    if (!fs.existsSync(metinYolu)) { console.log(`ATLANDI (metin yok): ${metin}`); return; }
    if (!fs.existsSync(sayfaYolu)) { console.log(`ATLANDI (sayfa yok): ${sayfa}`); return; }

    const sayfaHtml = fs.readFileSync(sayfaYolu, 'utf8');
    const eslesme = ICERIK_KABI.exec(sayfaHtml);
    if (!eslesme) { console.log(`ATLANDI (icerik kabi bulunamadi): ${sayfa}`); return; }

    const yeniIcerik = textToHtml(fs.readFileSync(metinYolu, 'utf8'));
    if (!yeniIcerik) { console.log(`ATLANDI (metin bos): ${metin}`); return; }

    const eskiBaslik = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(eslesme[2]);
    const baslik = eskiBaslik ? eskiBaslik[0] : '';
    const govde = `\n${baslik}\n${yeniIcerik}\n`;
    const yeniSayfa = sayfaHtml.replace(ICERIK_KABI, (tam, acilis, eski, kapanis) => `${acilis}${govde}${kapanis}`);

    const oncekiUzunluk = duzMetin(eslesme[2]).length;
    const sonrakiUzunluk = duzMetin(govde).length;
    console.log(`${sayfa}`);
    console.log(`   metin: ${oncekiUzunluk} → ${sonrakiUzunluk} karakter | h1 korundu: ${baslik ? 'evet' : 'HAYIR'}`);
    console.log(`   dosya: ${sayfaHtml.length} → ${yeniSayfa.length} bayt | icerik disi degisiklik: `
      + `${sayfaHtml.replace(ICERIK_KABI, '#') === yeniSayfa.replace(ICERIK_KABI, '#') ? 'YOK' : 'VAR (!)'}`);

    if (secenekler.apply) {
      fs.writeFileSync(sayfaYolu, yeniSayfa);
      console.log('   → yazildi');
    }
  });

  if (!secenekler.apply) console.log('\nBu bir DRY-RUN idi. Yazmak icin: --apply');
}

main();
