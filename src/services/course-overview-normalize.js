// "Egitime Ilk Bakis" icerigini Word/WYSIWYG yapistirma artiklarindan temizler.
//
// Cember 20 kapsami — YALNIZCA su uc donusum:
//   N1: 3+ ardisik <br>            -> tek <br>      (1-2 br gercek satir sonu olabilir, dokunulmaz)
//   N2: 2+ ardisik &nbsp; / U+00A0 -> tek bosluk    (tek &nbsp; anlamli olabilir, dokunulmaz)
//   N3: yalnizca bosluk/<br>/&nbsp; tasiyan bloklar -> silinir
//
// BILEREK YAPILMAYANLAR: gorseli blogundan cikarmak, bloklari yeniden siralamak, tipografiyi
// (font/boyut) degistirmek, sinif eklemek, sanitizeProductTabContent cagirmak (o, gorsel
// yollarini ../../uploads -> /uploads olarak yeniden yazar; bu cemberin kapsami disindadir).
//
// GUVENLIK SOZU: metin ve gorsel asla kaybolmaz. Donusumden sonra ikisi de dogrulanir; ihlal
// varsa bozuk icerik DONDURULMEZ, hata firlatilir.

const BOS_BLOK_TAGLARI = 'p|div|h1|h2|h3|h4|h5|h6|span|strong|em|b|i|u|font|small';

function isText(value) {
  return typeof value === 'string';
}

// Gorsel kaynaklarini sirasiyla dondurur — korumayi kanitlamak icin kullanilir.
function gorselKaynaklari(html) {
  if (!isText(html)) return [];
  return (html.match(/<img\b[^>]*>/gi) || []).map((etiket) => {
    const eslesme = /\bsrc\s*=\s*["']?([^"'\s>]+)/i.exec(etiket);
    return eslesme ? eslesme[1] : '';
  });
}

// Etiketler cikarildiktan sonra kalan gorunen metin (bosluklar tek boslugia indirilir).
function gorunenMetin(html) {
  if (!isText(html)) return '';
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;| /g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function assertIcerikKorundu(once, sonra) {
  const onceGorsel = gorselKaynaklari(once);
  const sonraGorsel = gorselKaynaklari(sonra);
  if (onceGorsel.length !== sonraGorsel.length
    || onceGorsel.some((kaynak, indeks) => kaynak !== sonraGorsel[indeks])) {
    throw new Error(
      `Normalizasyon gorsel kaybina yol acti (${onceGorsel.length} -> ${sonraGorsel.length}); icerik yazilmadi.`
    );
  }
  if (gorunenMetin(once) !== gorunenMetin(sonra)) {
    throw new Error('Normalizasyon gorunen metin icerigini degistirdi; icerik yazilmadi.');
  }
  return true;
}

function normalizeOverviewContent(html) {
  const sayaclar = { brZinciri: 0, nbspYigini: 0, bosBlok: 0 };
  if (!isText(html) || !html) {
    return { content: isText(html) ? html : '', degisti: false, sayaclar };
  }

  let sonuc = html;

  const bosBlokDeseni = new RegExp(
    `<(${BOS_BLOK_TAGLARI})\\b[^>]*>(?:\\s|&nbsp;|\\u00a0|<br\\s*\\/?>)*<\\/\\1\\s*>`,
    'gi'
  );

  // Uc donusum BIRLIKTE, degisiklik durana kadar tekrarlanir. Tek gecis yetmez: bos bir blok
  // silinince iki yanindaki <br> yan yana gelir ve YENI bir zincir olusur — bu, gercek kurs
  // icerigi uzerinde 2026-09-30'da goruldu (tek gecisli surum idempotent degildi).
  // Ust sinir, patolojik bir girdide sonsuz donguyu onler.
  for (let tur = 0; tur < 12; tur += 1) {
    const turBasi = sonuc;

    // N1 — 3 veya daha fazla ardisik <br> tek <br> olur.
    sonuc = sonuc.replace(/(?:<br\s*\/?>\s*){3,}/gi, () => {
      sayaclar.brZinciri += 1;
      return '<br>';
    });

    // N2 — 2+ ardisik &nbsp; / U+00A0 tek bosluk olur.
    sonuc = sonuc.replace(/(?:&nbsp;|\u00a0)(?:\s*(?:&nbsp;|\u00a0))+/g, () => {
      sayaclar.nbspYigini += 1;
      return ' ';
    });

    // N3 — icinde metin/gorsel olmayan bloklar silinir.
    sonuc = sonuc.replace(bosBlokDeseni, () => {
      sayaclar.bosBlok += 1;
      return '';
    });

    if (sonuc === turBasi) break;
  }


  // Guvenlik sozu: ihlal varsa hata firlatir, bozuk icerik disari cikmaz.
  assertIcerikKorundu(html, sonuc);

  return { content: sonuc, degisti: sonuc !== html, sayaclar };
}

module.exports = {
  normalizeOverviewContent,
  gorselKaynaklari,
  gorunenMetin,
  assertIcerikKorundu
};
