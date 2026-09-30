// "Egitime Ilk Bakis" (OVERVIEW) icerik denetimi — SALT OKUR, hicbir sey yazmaz.
//
// Kaynak DB'dir: ProductTab where systemKey='OVERVIEW' -> content.
// Statik `urun/<slug>/index.html` OKUNMAZ: ziyaretcinin gordugu icerik DB'den gelir, paneli
// `synchronizeLegacyProductTabs` DB icerigiyle degistirir (src/services/legacy-product-tabs.js:91).
//
// Amac: hangi kursta hangi bozukluk var, kurs kurs listelemek. Mimar dokunulacak kurslari bu
// rapora bakarak secer; duzeltme ayri bir cemberde, onaylanan liste uzerinden yapilir.

const VOID_TAGS = new Set(['img', 'br', 'hr', 'input', 'meta', 'link', 'source', 'area', 'base', 'col']);
const BLOCK_TAGS = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div', 'li', 'td', 'th', 'blockquote']);

// Esikler bilincli olarak disaridan degistirilebilir: "kac &nbsp; dolgu sayilir" gibi kararlar
// subjektiftir, rapor ayarlanabilir kalmalidir.
const AUDIT_THRESHOLDS = {
  ardisikBr: 3,          // kac ardisik <br> yapay bosluk sayilir
  nbspDolgusu: 20,       // icerikte kac &nbsp; dolgu sayilir
  karisikMetinUzunlugu: 60, // gorselle ayni blokta bu kadar karakter metin varsa "karisik"
  kapGenisligi: 1076     // kurs sekmesi kabinin masaustu genisligi (olculdu)
};

// Siddet puani: raporu siralamak icin. Duzeltme kararini puan degil Mimar verir.
const SIDDET_AGIRLIKLARI = {
  metinleKarisik: 5,
  kaptanGenis: 4,
  ardisikBr: 2,
  nbspDolgusu: 1
};

const INLINE_WRAPPER_TAGS = new Set(['span', 'strong', 'b', 'em', 'i', 'u', 'a', 'font', 'small']);

function isText(value) {
  return typeof value === 'string';
}

// --- Yardimci olcumler. Bunlar tek tek de disa aciliyor cunku rapor disinda normalizasyon
// cemberinde de kullanilacaklar ve ayri ayri test edilebilir olmalari gerekiyor.

// Ardisik <br> zincirinin EN UZUNU (kac tane ust uste geldigi). "<br>metin<br>" -> 1
function countConsecutiveBr(html) {
  if (!isText(html)) return 0;
  let enUzun = 0;
  const zincirDeseni = /(?:<br\s*\/?>\s*)+/gi;
  let eslesme;
  while ((eslesme = zincirDeseni.exec(html)) !== null) {
    const adet = (eslesme[0].match(/<br/gi) || []).length;
    if (adet > enUzun) enUzun = adet;
  }
  return enUzun;
}

function countNbsp(html) {
  if (!isText(html)) return 0;
  return (html.match(/&nbsp;|\u00a0/g) || []).length;
}

// Satir ici sarmalayicilarin (<span><strong><span>...) en derin ic ice yigilmasi.
// Word'den yapistirilan icerigin en guclu parmak izidir.
function maxInlineWrapperDepth(html) {
  if (!isText(html)) return 0;
  let derinlik = 0;
  let enDerin = 0;
  const tagPattern = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g;
  let eslesme;
  while ((eslesme = tagPattern.exec(html)) !== null) {
    const tag = eslesme[2].toLowerCase();
    if (!INLINE_WRAPPER_TAGS.has(tag)) continue;
    if (/\/\s*$/.test(eslesme[3])) continue;
    if (eslesme[1] === '/') {
      derinlik = Math.max(0, derinlik - 1);
      continue;
    }
    derinlik += 1;
    if (derinlik > enDerin) enDerin = derinlik;
  }
  return enDerin;
}

// --- Basit blok tarayici: ic ice bloklarda yalnizca EN ICTEKI blogu saymak icin gereklidir.
// Regex ile `<p>...</p>` eslestirmek ic ice yapida yanlis sonuc verir, bu yuzden etiketler
// sirayla yurunur ve bir yigin (stack) tutulur.
function scanBlocks(html) {
  const bloklar = [];
  const yigin = [];
  const tagPattern = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g;
  let eslesme;

  while ((eslesme = tagPattern.exec(html)) !== null) {
    const kapanis = eslesme[1] === '/';
    const tag = eslesme[2].toLowerCase();
    const kendiniKapatan = /\/\s*$/.test(eslesme[3]);

    if (tag === 'img' && !kapanis) {
      yigin.forEach((girdi) => { girdi.gorsel += 1; });
      continue;
    }
    if (VOID_TAGS.has(tag) || kendiniKapatan) continue;

    if (!kapanis) {
      if (BLOCK_TAGS.has(tag)) {
        yigin.push({ tag, ic: eslesme.index + eslesme[0].length, gorsel: 0, altBlok: 0 });
      }
      continue;
    }

    if (!BLOCK_TAGS.has(tag)) continue;
    // Kapanis etiketi: yiginda ayni adli en yakin girdiye kadar geri sar (bozuk HTML'e dayanikli).
    let indeks = yigin.length - 1;
    while (indeks >= 0 && yigin[indeks].tag !== tag) indeks -= 1;
    if (indeks < 0) continue;

    const kapanan = yigin.splice(indeks)[0];
    if (yigin.length) {
      const ust = yigin[yigin.length - 1];
      ust.altBlok += 1;
      if (kapanan.gorsel) ust.altBlokGorsel = true;
    }
    bloklar.push({
      tag: kapanan.tag,
      gorsel: kapanan.gorsel,
      enIcteki: kapanan.altBlok === 0,
      metin: html
        .slice(kapanan.ic, eslesme.index)
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;| /g, ' ')
        .replace(/&[a-zA-Z#0-9]+;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    });
  }

  return bloklar;
}

function analyzeOverviewContent(html, thresholds = AUDIT_THRESHOLDS) {
  const esik = { ...AUDIT_THRESHOLDS, ...thresholds };
  const bos = {
    gorselSayi: 0,
    widthAtributuYok: 0,
    ardisikBrBloklari: 0,
    nbspSayisi: 0,
    metinleKarisikBlok: 0,
    kaptanGenisGorsel: 0,
    cokluGorselBloklari: 0,
    icerikUzunlugu: 0,
    isaretler: [],
    siddet: 0
  };
  if (!isText(html) || !html.trim()) return bos;

  const gorseller = html.match(/<img\b[^>]*>/gi) || [];
  const genislikler = gorseller.map((etiket) => {
    const eslesme = /\bwidth\s*=\s*["']?(\d+)/i.exec(etiket);
    return eslesme ? Number(eslesme[1]) : null;
  });

  const brDeseni = new RegExp(`(?:<br\\s*/?>\\s*){${esik.ardisikBr},}`, 'gi');
  const bloklar = scanBlocks(html);

  const sonuc = {
    gorselSayi: gorseller.length,
    widthAtributuYok: genislikler.filter((genislik) => genislik === null).length,
    ardisikBrBloklari: (html.match(brDeseni) || []).length,
    nbspSayisi: (html.match(/&nbsp;| /g) || []).length,
    metinleKarisikBlok: bloklar.filter(
      (blok) => blok.enIcteki && blok.gorsel > 0 && blok.metin.length > esik.karisikMetinUzunlugu
    ).length,
    kaptanGenisGorsel: genislikler.filter((genislik) => genislik !== null && genislik > esik.kapGenisligi).length,
    cokluGorselBloklari: bloklar.filter((blok) => blok.enIcteki && blok.gorsel > 1).length,
    icerikUzunlugu: html.length,
    isaretler: [],
    siddet: 0
  };

  if (sonuc.ardisikBrBloklari > 0) sonuc.isaretler.push('ardisikBr');
  if (sonuc.nbspSayisi > esik.nbspDolgusu) sonuc.isaretler.push('nbspDolgusu');
  if (sonuc.metinleKarisikBlok > 0) sonuc.isaretler.push('metinleKarisik');
  if (sonuc.kaptanGenisGorsel > 0) sonuc.isaretler.push('kaptanGenis');

  sonuc.siddet = sonuc.isaretler.reduce((toplam, isaret) => toplam + (SIDDET_AGIRLIKLARI[isaret] || 0), 0);
  return sonuc;
}

// Gorsel iceren en icteki bloklari ikiye ayirir: yalnizca gorsel tasiyanlar ve metinle karisik olanlar.
function classifyImageBlocks(html, thresholds = AUDIT_THRESHOLDS) {
  const esik = { ...AUDIT_THRESHOLDS, ...thresholds };
  const sonuc = { imageOnly: 0, mixed: 0 };
  if (!isText(html)) return sonuc;

  scanBlocks(html)
    .filter((blok) => blok.enIcteki && blok.gorsel > 0)
    .forEach((blok) => {
      if (blok.metin.length > esik.karisikMetinUzunlugu) sonuc.mixed += 1;
      else sonuc.imageOnly += 1;
    });

  return sonuc;
}

// Diger ajanin olcum seti ile birlestirilmis giris noktasi (Cember 19b).
// analyzeOverviewContent'in dondurdugu her sey + bayrak (boolean) alanlari.
function analyseOverviewHtml(html, thresholds = AUDIT_THRESHOLDS) {
  const esik = { ...AUDIT_THRESHOLDS, ...thresholds };
  const temel = analyzeOverviewContent(html, esik);
  const duzMetin = isText(html)
    ? html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;|\u00a0/g, ' ').replace(/&[a-zA-Z#0-9]+;/g, ' ').trim()
    : '';

  return {
    ...temel,
    bosOverview: temel.gorselSayi === 0 && duzMetin.length === 0,
    gorselYok: temel.gorselSayi === 0,
    toplamGorsel: temel.gorselSayi,
    maxArdisikBr: countConsecutiveBr(html),
    ardisikBr: countConsecutiveBr(html) >= esik.ardisikBr,
    toplamNbsp: countNbsp(html),
    nbspDolgusu: countNbsp(html) > esik.nbspDolgusu,
    metinleKarisikGorselBlogu: temel.metinleKarisikBlok,
    cokluGorselBlogu: temel.cokluGorselBloklari,
    satirIciSarmalayiciDerinligi: maxInlineWrapperDepth(html)
  };
}

// Prisma disaridan verilir ki test sahte nesneyle calisabilsin (repo deseni).
async function auditOverviewTabs(prisma, { thresholds = AUDIT_THRESHOLDS, kategoriSlug = null } = {}) {
  // Mimar karari (2026-09-30): kategori kategori ilerlenecek (once "yazilim"), hepsi birden degil.
  const where = { systemKey: 'OVERVIEW' };
  if (kategoriSlug) where.product = { category: { slug: kategoriSlug } };

  const kayitlar = await prisma.productTab.findMany({
    where,
    select: {
      productId: true,
      content: true,
      product: {
        select: { slug: true, title: true, status: true, category: { select: { slug: true, name: true } } }
      }
    }
  });

  return kayitlar.map((kayit) => ({
    productId: kayit.productId,
    slug: kayit.product ? kayit.product.slug : null,
    baslik: kayit.product ? kayit.product.title : null,
    durum: kayit.product ? kayit.product.status : null,
    kategori: kayit.product && kayit.product.category ? kayit.product.category.slug : null,
    ...analyseOverviewHtml(kayit.content, thresholds)
  }));
}

function summarizeAudit(satirlar) {
  const isaretSayilari = { ardisikBr: 0, nbspDolgusu: 0, metinleKarisik: 0, kaptanGenis: 0 };
  let gorselYok = 0;
  let gorselliProblemli = 0;
  let gorselliTemiz = 0;
  let toplamGorsel = 0;
  let widthAtributuYok = 0;

  satirlar.forEach((satir) => {
    toplamGorsel += satir.gorselSayi;
    widthAtributuYok += satir.widthAtributuYok;
    satir.isaretler.forEach((isaret) => { isaretSayilari[isaret] += 1; });
    if (satir.gorselSayi === 0) gorselYok += 1;
    else if (satir.isaretler.length) gorselliProblemli += 1;
    else gorselliTemiz += 1;
  });

  return {
    overviewTabiOlan: satirlar.length,
    gorselYok,
    gorselliProblemli,
    gorselliTemiz,
    toplamGorsel,
    widthAtributuYok,
    isaretSayilari
  };
}

module.exports = {
  AUDIT_THRESHOLDS,
  SIDDET_AGIRLIKLARI,
  analyzeOverviewContent,
  analyseOverviewHtml,
  classifyImageBlocks,
  countConsecutiveBr,
  countNbsp,
  maxInlineWrapperDepth,
  auditOverviewTabs,
  summarizeAudit
};
