// Hukuki sayfalarin (mesafeli satis, gizlilik/KVKK, iptal-iade) duz metnini sayfa HTML'ine cevirir.
//
// Kaynak: Mimar'in verdigi PDF'lerden `pdftotext -layout` ile cikarilan metin.
// Amac: metni OLDUGU GIBI korumak — yorum katmadan, cumle degistirmeden. Yalnizca yapi verilir:
//   "N. Baslik"   -> <h2>          (ana bolum)
//   "N.N. ..."    -> <p>           (alt bent; NUMARASI korunur, metinde ona atif yapiliyor)
//   "• ..." / "- " -> <ul><li>
//   digerleri     -> <p>
// pdftotext satirlari sardigi icin bos satira kadar olan satirlar tek paragrafta birlestirilir.

const BASLIK_DESENI = /^\d+\.\s+\S/;
const ALT_BENT_DESENI = /^\d+\.\d+\.?\s+\S/;
const MADDE_DESENI = /^[•\-–]\s+\S/;

function kacir(metin) {
  return String(metin)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function textToHtml(metin) {
  if (typeof metin !== 'string' || !metin.trim()) return '';

  const parcalar = [];
  let paragraf = [];
  let liste = [];

  const paragrafiKapat = () => {
    if (!paragraf.length) return;
    parcalar.push(`<p>${kacir(paragraf.join(' '))}</p>`);
    paragraf = [];
  };
  const listeyiKapat = () => {
    if (!liste.length) return;
    parcalar.push(`<ul>\n${liste.map((madde) => `  <li>${kacir(madde)}</li>`).join('\n')}\n</ul>`);
    liste = [];
  };

  metin.split('\n').forEach((hamSatir) => {
    const satir = hamSatir.trim().replace(/\s+/g, ' ');

    if (!satir) { paragrafiKapat(); listeyiKapat(); return; }

    if (MADDE_DESENI.test(satir)) {
      paragrafiKapat();
      liste.push(satir.replace(MADDE_DESENI, (eslesme) => eslesme.slice(1).trimStart()));
      return;
    }

    listeyiKapat();

    // Alt bent kontrolu baslik kontrolunden ONCE gelmeli: "1.1." hem iki desene de uyuyor.
    if (ALT_BENT_DESENI.test(satir)) {
      paragrafiKapat();
      paragraf.push(satir);
      return;
    }

    if (BASLIK_DESENI.test(satir)) {
      paragrafiKapat();
      parcalar.push(`<h2>${kacir(satir)}</h2>`);
      return;
    }

    paragraf.push(satir);
  });

  paragrafiKapat();
  listeyiKapat();

  return parcalar.join('\n');
}

module.exports = { textToHtml };
