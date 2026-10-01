// "Egitime Ilk Bakis" gorsel duzeni — RENDER aninda uygulanir, DB'YE YAZILMAZ.
// Admin editoru DB'deki ham icerigi gosterir: kodlar ve duz metin gorunumu bozulmaz.
//
// Siniflandirma (blok basina), olculmus kurallar:
//   metin > 60 karakter + gorsel -> DOKUNULMAZ. Metin paragrafini flex/grid'e cevirmek onu
//                                   yeniden akitir; 2026-10-01 canli olcumunde 534 karakterlik
//                                   bir paragraf bu yuzden bozulmustu.
//   gorsel yok                   -> dokunulmaz
//   gorsel >= 5                  -> uv-ov-gallery (kartli grid)
//   gorsel 1..4                  -> uv-ov-media   (esit yukseklikte, ortalanmis sira)
//
// Ardisik ve TAMAMEN METINSIZ gorsel bloklari tek kapta birlestirilir: boylece ayri
// paragraflara dagilmis 4 sertifika 2+2 olarak dizilir (Mimar istegi, 2026-10-01).
// Kisa etiket metni (<= 60 karakter, orn. "Egitimimizden kareler:") kendi blogunda KORUNUR.

const cheerio = require('cheerio');

const BLOK_SECICI = 'p, h1, h2, h3, h4, h5, h6, div, li, section, article';
const METIN_ESIGI = 60;      // bu uzunlugun ustu "metin blogu" sayilir ve dokunulmaz
const QALEREYA_ESIGI = 5;    // bu sayidan itibaren kartli grid

function isText(value) {
  return typeof value === 'string';
}

function gorselKaynaklari(html) {
  if (!isText(html)) return [];
  return (html.match(/<img\b[^>]*>/gi) || []).map((etiket) => {
    const eslesme = /\bsrc\s*=\s*["']?([^"'\s>]+)/i.exec(etiket);
    return eslesme ? eslesme[1] : '';
  });
}

function gorunenMetin(html) {
  if (!isText(html)) return '';
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;| /g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Gorselin "tasinabilir birimi": yalnizca o gorseli saran <a> varsa baglantiyi da tasir.
function gorselBirimi($, img) {
  const baglanti = img.closest('a');
  if (baglanti.length && baglanti.find('img').length === 1 && !gorunenMetin($.html(baglanti))) {
    return baglanti;
  }
  return img;
}

function blokMetni($, blok) {
  const kopya = blok.clone();
  kopya.find('img').remove();
  return gorunenMetin($.html(kopya));
}

function applyOverviewLayout(html) {
  if (!isText(html) || !html.trim()) return isText(html) ? html : '';
  if (html.includes('uv-ov-media') || html.includes('uv-ov-gallery')) return html; // idempotent

  const $ = cheerio.load(html, { decodeEntities: false }, false);

  // 1) Her ust seviye blogu siniflandir.
  const bloklar = $.root().children(BLOK_SECICI).toArray().map((element) => {
    const blok = $(element);
    const gorselSayisi = blok.find('img').length;
    const metin = blokMetni($, blok);
    return {
      blok,
      gorselSayisi,
      metinUzunlugu: metin.length,
      medyaBlogu: gorselSayisi > 0 && metin.length <= METIN_ESIGI,
      metinsiz: gorselSayisi > 0 && metin.length === 0
    };
  });

  // 2) Her medya blogunun gorsellerini tek bir kaba topla (metin yerinde kalir).
  bloklar.forEach((kayit) => {
    if (!kayit.medyaBlogu) return;
    const kap = $('<div>');
    kayit.blok.find('img').toArray().forEach((element) => {
      kap.append(gorselBirimi($, $(element)));
    });
    kayit.blok.append(kap);
    kayit.kap = kap;
  });

  // 3) Ardisik METINSIZ bloklari tek kapta birlestir (sertifikalar 2+2 dizilsin).
  for (let i = 0; i < bloklar.length; i += 1) {
    if (!bloklar[i].metinsiz) continue;
    let j = i + 1;
    while (j < bloklar.length && bloklar[j].metinsiz) {
      bloklar[i].kap.append(bloklar[j].kap.children());
      bloklar[i].gorselSayisi += bloklar[j].gorselSayisi;
      bloklar[j].blok.remove();
      bloklar[j].kaldirildi = true;
      j += 1;
    }
    i = j - 1;
  }

  // 4) Kap tipini gorsel sayisina gore belirle ve gerekiyorsa kartlara sar.
  bloklar.forEach((kayit) => {
    if (!kayit.medyaBlogu || kayit.kaldirildi) return;
    if (kayit.gorselSayisi >= QALEREYA_ESIGI) {
      kayit.kap.addClass('uv-ov-gallery');
      kayit.kap.children().each((unusedIndex, element) => {
        $(element).wrap('<div class="uv-ov-gallery-item"></div>');
      });
      return;
    }
    kayit.kap.addClass('uv-ov-media');
  });

  const sonuc = $.html();

  // 5) Guvenlik sozu: gorsel sirasi ve gorunen metin degismemeli; ihlalde ORIJINAL dondurulur.
  const onceGorsel = gorselKaynaklari(html);
  const sonraGorsel = gorselKaynaklari(sonuc);
  const korunuyor = onceGorsel.length === sonraGorsel.length
    && onceGorsel.every((kaynak, indeks) => kaynak === sonraGorsel[indeks])
    && gorunenMetin(html) === gorunenMetin(sonuc);

  return korunuyor ? sonuc : html;
}

module.exports = { applyOverviewLayout, gorselKaynaklari, gorunenMetin };
