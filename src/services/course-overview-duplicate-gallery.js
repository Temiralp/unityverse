// "Egitimimizden kareler" bolumunun TEKRARLARINI kaldirir — saf servis, DB'ye dokunmaz.
//
// Olculen gercek durum (2026-10-02, blender-3b-oyun-modelleme-canli-online-egitim-2):
// etiket 3 kez geciyor. Bolumlerde 57 gorsel referansi var ama yalnizca 31 tekrarsiz src ve
// GORSEL OLARAK 22 farkli fotograf: blobid043/044, blobid138/139, blobid817/818 ciftlerinin
// md5'i aynidir (ayni foto admin editorunden iki kez yuklenmis). Bu yuzden "kaldirilan gorsel
// kalanlarla karsilaniyor mu" sorusu yalnizca src esitligiyle cevaplanamaz; DOSYA IMZASI da
// kabul edilir. Imza fonksiyonu dısarıdan verilir (CLI'de fs, testte sahte) — servis saf kalir.
//
// Kaldirma kurali:
//   - ILK etiketin bolumu KORUNUR (blender'da bu bolum buyuk metin div'inin icindedir).
//   - Sonraki KOK SEVIYE etiket bloklari ve onlari izleyen METINSIZ kardesler kaldirilir.
//     Metinli blokta durulur: "Basari Hikayeleri" CTA kutusu bu sayede korunur.
//   - Kaldirilan her gorsel, KALAN gorsellerden biriyle (ayni src VEYA ayni imza) karsilanmali.
//     Karsilanmayan tek bir gorsel varsa durum MANUAL olur ve icerik DEGISTIRILMEZ.

const cheerio = require('cheerio');

const ETIKET = /e[gğ]itimimizden\s*kareler/i;

function isText(value) {
  return typeof value === 'string';
}

function gorunenMetin(html) {
  if (!isText(html)) return '';
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;| /g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function gorselKaynaklari(html) {
  if (!isText(html)) return [];
  return (html.match(/<img\b[^>]*>/gi) || []).map((etiket) => {
    const eslesme = /\bsrc\s*=\s*["']?([^"'\s>]+)/i.exec(etiket);
    return eslesme ? eslesme[1] : '';
  });
}

function qalereyaEtiketiSayisi(html) {
  if (!isText(html)) return 0;
  return (gorunenMetin(html).match(/e[gğ]itimimizden\s*kareler/gi) || []).length;
}

// Kok seviyedeki etiket bloklarinin bolum araliklarini bulur.
// Bolum = etiket blogu + ardindan gelen METINSIZ kardesler.
function bolumAraliklari($) {
  const cocuklar = $.root().children().toArray();
  const etiketli = cocuklar
    .map((element, indeks) => ({ element, indeks }))
    .filter(({ element }) => ETIKET.test($(element).text()));

  return etiketli.map(({ indeks }) => {
    const dugumler = [cocuklar[indeks]];
    for (let i = indeks + 1; i < cocuklar.length; i += 1) {
      const sonraki = cocuklar[i];
      if (ETIKET.test($(sonraki).text())) break;
      if (gorunenMetin($.html($(sonraki)))) break;
      dugumler.push(sonraki);
    }
    return { indeks, dugumler };
  });
}

function tekrarQalereyalariniKaldir(html, secenekler = {}) {
  const dokunulmaz = (sebep) => ({
    sonuc: isText(html) ? html : '',
    durum: 'DOKUNULMAZ',
    kaldirilanBolum: 0,
    kaldirilanGorsel: 0,
    sebep
  });

  if (!isText(html) || !html.trim()) return dokunulmaz('icerik bos');
  if (qalereyaEtiketiSayisi(html) < 2) return dokunulmaz('etiket birden fazla gecmiyor');

  const $ = cheerio.load(html, { decodeEntities: false }, false);
  const araliklar = bolumAraliklari($);

  // Ilk etiket icerikte nerede olursa olsun (blender'da nested) korunur: kok seviyedeki
  // etiket bloklarindan yalnizca ILKINDEN SONRAKILER kaldirilir. Etiket ilk kez nested
  // geciyorsa kok seviyedeki butun etiket bloklari tekrardir.
  const ilkKokEtiket = araliklar.length ? araliklar[0].indeks : -1;
  const nestedIlkVar = (() => {
    if (ilkKokEtiket < 0) return true;
    const oncekiler = $.root().children().toArray().slice(0, ilkKokEtiket);
    return oncekiler.some((element) => ETIKET.test($(element).text()));
  })();

  const kaldirilacak = nestedIlkVar ? araliklar : araliklar.slice(1);
  if (!kaldirilacak.length) {
    return { ...dokunulmaz('kok seviyede kaldirilabilir tekrar bolumu yok'), durum: 'MANUAL' };
  }

  const kaldirilanHtml = kaldirilacak
    .map(({ dugumler }) => dugumler.map((element) => $.html($(element))).join(''))
    .join('');
  const kaldirilanGorseller = gorselKaynaklari(kaldirilanHtml);

  // Kalacak icerigin gorselleri
  const kaldirilacakDugumler = new Set(kaldirilacak.flatMap(({ dugumler }) => dugumler));
  const kalanHtml = $.root().children().toArray()
    .filter((element) => !kaldirilacakDugumler.has(element))
    .map((element) => $.html($(element)))
    .join('');
  const kalanGorseller = new Set(gorselKaynaklari(kalanHtml));

  const dosyaImzasi = typeof secenekler.dosyaImzasi === 'function' ? secenekler.dosyaImzasi : () => null;
  const kalanImzalar = new Set(
    [...kalanGorseller].map((src) => dosyaImzasi(src)).filter(Boolean)
  );

  const karsilanmayan = kaldirilanGorseller.filter((src) => {
    if (kalanGorseller.has(src)) return false;
    const imza = dosyaImzasi(src);
    return !(imza && kalanImzalar.has(imza));
  });

  if (karsilanmayan.length) {
    return {
      sonuc: html,
      durum: 'MANUAL',
      kaldirilanBolum: 0,
      kaldirilanGorsel: 0,
      sebep: 'kalan bolumde karsiligi olmayan gorsel: ' + [...new Set(karsilanmayan)].slice(0, 3).join(', ')
    };
  }

  kaldirilacak.forEach(({ dugumler }) => dugumler.forEach((element) => $(element).remove()));

  return {
    sonuc: $.html(),
    durum: 'DEGISECEK',
    kaldirilanBolum: kaldirilacak.length,
    kaldirilanGorsel: kaldirilanGorseller.length,
    sebep: ''
  };
}

module.exports = {
  tekrarQalereyalariniKaldir,
  qalereyaEtiketiSayisi,
  gorselKaynaklari,
  gorunenMetin
};
