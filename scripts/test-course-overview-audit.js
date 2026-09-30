// Cember 19: "Egitime Ilk Bakis" denetimi — YALNIZCA rapor uretir, hicbir sey yazmaz.
// Kaynak DB'dir: ProductTab where systemKey='OVERVIEW' -> content. Statik HTML okunmaz;
// ziyaretcinin gordugu icerik DB'den gelir (synchronizeLegacyProductTabs paneli DB ile degistirir).

const assert = require('assert/strict');
const {
  AUDIT_THRESHOLDS,
  analyzeOverviewContent,
  analyseOverviewHtml,
  classifyImageBlocks,
  countConsecutiveBr,
  countNbsp,
  maxInlineWrapperDepth,
  auditOverviewTabs,
  summarizeAudit
} = require('../src/services/course-overview-audit');

// Basit test sarmalayicisi: asagidaki 27 senaryo Cember 19'da paralel calisan diger ajanin
// yazdigi `scripts/test-audit-course-overview.js` dosyasindan BIREBIR devralinmistir (26 senaryo)
// (Cember 19b birlestirmesi). Tek bir dogruluk kaynagi kalsin diye o dosya kaldirildi;
// senaryolarin hicbiri kaybolmadi. Sayim: 26 senaryo (dosyadaki 27. `test(` cagrisi sarmalayici
// fonksiyonun kendi tanimidir, senaryo degildir).
let gecen = 0;
let kalan = 0;
function test(ad, fn) {
  try { fn(); gecen += 1; } catch (hata) { kalan += 1; console.error(`FAIL: ${ad}\n  ${hata.message}`); }
}

// --- 1) Temiz icerik: hicbir isaret uretmemeli.
const temiz = analyzeOverviewContent('<p>Kisa bir aciklama.</p><p><img src="a.jpg" width="500"></p>');
assert.equal(temiz.gorselSayi, 1);
assert.equal(temiz.widthAtributuYok, 0);
assert.deepEqual(temiz.isaretler, []);
assert.equal(temiz.siddet, 0);

// --- 2) Ardisik <br> zinciri (esik: 3).
assert.equal(analyzeOverviewContent('<p>a<br><br>b</p>').ardisikBrBloklari, 0, '2 br esigin altinda');
const br = analyzeOverviewContent('<p>a<br><br><br>b</p><p>c<br /><br /><br /><br />d</p>');
assert.equal(br.ardisikBrBloklari, 2);
assert.ok(br.isaretler.includes('ardisikBr'));

// --- 3) &nbsp; dolgusu (esik: 20).
assert.ok(!analyzeOverviewContent('<p>' + '&nbsp;'.repeat(20) + '</p>').isaretler.includes('nbspDolgusu'));
const nbsp = analyzeOverviewContent('<p>' + '&nbsp;'.repeat(25) + '</p>');
assert.equal(nbsp.nbspSayisi, 25);
assert.ok(nbsp.isaretler.includes('nbspDolgusu'));

// --- 4) Gorsel metinle ayni blokta (esik: 60 karakter metin).
const kisaMetin = analyzeOverviewContent('<p>Kisa<img src="a.jpg" width="300"></p>');
assert.equal(kisaMetin.metinleKarisikBlok, 0, '60 karakterin altindaki metin karisik sayilmaz');
const uzunMetin = 'Bu paragrafta hem uzun bir metin hem de bir gorsel birlikte duruyor ve bu bir sorundur.';
const karisik = analyzeOverviewContent(`<p>${uzunMetin}<img src="a.jpg" width="300"></p>`);
assert.equal(karisik.metinleKarisikBlok, 1);
assert.ok(karisik.isaretler.includes('metinleKarisik'));

// --- 5) Ic ice bloklarda yalnizca EN ICTEKI blok sayilir (cift sayim olmamali).
const iceIce = analyzeOverviewContent(`<div><p>${uzunMetin}<img src="a.jpg" width="300"></p></div>`);
assert.equal(iceIce.metinleKarisikBlok, 1, 'dis <div> tekrar sayilmamali');

// --- 6) Kaptan genis gorsel (esik: 1076px).
const tasan = analyzeOverviewContent('<p><img src="a.jpg" width="1200"><img src="b.jpg" width="600"></p>');
assert.equal(tasan.kaptanGenisGorsel, 1);
assert.ok(tasan.isaretler.includes('kaptanGenis'));

// --- 7) width atributu olmayan gorsel.
assert.equal(analyzeOverviewContent('<p><img src="a.jpg"></p>').widthAtributuYok, 1);

// --- 8) Ayni blokta 2+ gorsel (sarmalayici icinde olsa da sayilir).
const coklu = analyzeOverviewContent('<p><img src="a.jpg" width="200"><span><img src="b.jpg" width="200"></span></p>');
assert.equal(coklu.cokluGorselBloklari, 1);

// --- 9) Bos / gecersiz girdi guvenli varsayilan dondurmeli.
[null, undefined, '', '   ', 123].forEach((girdi) => {
  const bos = analyzeOverviewContent(girdi);
  assert.equal(bos.gorselSayi, 0);
  assert.deepEqual(bos.isaretler, []);
});

// --- 10) Esikler disaridan degistirilebilmeli (rapor ayarlanabilir olsun).
const gevsek = analyzeOverviewContent('<p>a<br><br><br>b</p>', { ...AUDIT_THRESHOLDS, ardisikBr: 5 });
assert.equal(gevsek.ardisikBrBloklari, 0);

// 1. Empty / whitespace-only overview
// ---------------------------------------------------------------------------
test('empty string → bosOverview = true', () => {
  const r = analyseOverviewHtml('');
  assert.equal(r.bosOverview, true);
  assert.equal(r.gorselYok, true);
});

test('whitespace-only → bosOverview = true', () => {
  const r = analyseOverviewHtml('   \n\t  ');
  assert.equal(r.bosOverview, true);
});

test('only empty div → bosOverview = true', () => {
  const r = analyseOverviewHtml('<div> </div>');
  assert.equal(r.bosOverview, true);
});

// ---------------------------------------------------------------------------
// 2. Text-only, no images
// ---------------------------------------------------------------------------
test('text-only → gorselYok = true', () => {
  const r = analyseOverviewHtml('<p>Hello world</p>');
  assert.equal(r.bosOverview, false);
  assert.equal(r.gorselYok, true);
  assert.equal(r.toplamGorsel, 0);
});

// ---------------------------------------------------------------------------
// 3. Consecutive <br> detection
// ---------------------------------------------------------------------------
test('countConsecutiveBr: 4 consecutive br → 4', () => {
  assert.equal(countConsecutiveBr('<br><br><br><br>'), 4);
});

test('countConsecutiveBr: br separated by text → 1', () => {
  assert.equal(countConsecutiveBr('<br>hello<br>'), 1);
});

test('countConsecutiveBr: mixed self-closing → 3', () => {
  assert.equal(countConsecutiveBr('<br/><BR><br />'), 3);
});

test('analyseOverviewHtml: 3+ br → ardisikBr = true', () => {
  const html = '<p>text<br><br><br>more</p>';
  const r = analyseOverviewHtml(html);
  assert.equal(r.ardisikBr, true);
  assert.equal(r.maxArdisikBr, 3);
});

test('analyseOverviewHtml: 2 br only → ardisikBr = false', () => {
  const html = '<p>text<br><br>more</p>';
  const r = analyseOverviewHtml(html);
  assert.equal(r.ardisikBr, false);
});

// ---------------------------------------------------------------------------
// 4. &nbsp; padding detection
// ---------------------------------------------------------------------------
test('countNbsp: 25 nbsps → 25', () => {
  const html = '&nbsp;'.repeat(25);
  assert.equal(countNbsp(html), 25);
});

test('analyseOverviewHtml: 20+ nbsp → nbspDolgusu = true', () => {
  const html = '<p>' + '&nbsp;'.repeat(21) + 'text</p>';
  const r = analyseOverviewHtml(html);
  assert.equal(r.nbspDolgusu, true);
  assert.equal(r.toplamNbsp, 21);
});

test('analyseOverviewHtml: 5 nbsp → nbspDolgusu = false', () => {
  const html = '<p>' + '&nbsp;'.repeat(5) + 'text</p>';
  const r = analyseOverviewHtml(html);
  assert.equal(r.nbspDolgusu, false);
});

// ---------------------------------------------------------------------------
// 5. Mixed text + image blocks
// ---------------------------------------------------------------------------
test('image alone in paragraph → metinleKarisikGorselBlogu = 0', () => {
  const html = '<p><img src="a.jpg"></p>';
  const r = analyseOverviewHtml(html);
  assert.equal(r.metinleKarisikGorselBlogu, 0);
});

test('image with 60+ chars text → metinleKarisikGorselBlogu = 1', () => {
  const longText = 'A'.repeat(65);
  const html = `<p><img src="a.jpg">${longText}</p>`;
  const r = analyseOverviewHtml(html);
  assert.equal(r.metinleKarisikGorselBlogu, 1);
});

test('heading with image and text → metinleKarisikGorselBlogu = 1', () => {
  const longText = 'Neden Bu Eğitimi Tercih Etmelisiniz? ' + 'X'.repeat(30);
  const html = `<h2><span><strong><img src="a.jpg">${longText}</strong></span></h2>`;
  const r = analyseOverviewHtml(html);
  assert.equal(r.metinleKarisikGorselBlogu, 1);
});

// ---------------------------------------------------------------------------
// 6. Oversized images (width > 1076)
// ---------------------------------------------------------------------------
test('image width=1200 → kaptanGenisGorsel = 1', () => {
  const html = '<p><img src="a.jpg" width="1200"></p>';
  const r = analyseOverviewHtml(html);
  assert.equal(r.kaptanGenisGorsel, 1);
});

test('image width=500 → kaptanGenisGorsel = 0', () => {
  const html = '<p><img src="a.jpg" width="500"></p>';
  const r = analyseOverviewHtml(html);
  assert.equal(r.kaptanGenisGorsel, 0);
});

// ---------------------------------------------------------------------------
// 7. Images without width attribute
// ---------------------------------------------------------------------------
test('image without width → widthAtributuYok = 1', () => {
  const html = '<p><img src="a.jpg"></p>';
  const r = analyseOverviewHtml(html);
  assert.equal(r.widthAtributuYok, 1);
});

test('image with width → widthAtributuYok = 0', () => {
  const html = '<p><img src="a.jpg" width="400"></p>';
  const r = analyseOverviewHtml(html);
  assert.equal(r.widthAtributuYok, 0);
});

// ---------------------------------------------------------------------------
// 8. Multi-image blocks (2+ images in same parent)
// ---------------------------------------------------------------------------
test('2 images in same p → cokluGorselBlogu = 1', () => {
  const html = '<p><img src="a.jpg"><img src="b.jpg"></p>';
  const r = analyseOverviewHtml(html);
  assert.equal(r.cokluGorselBlogu, 1);
});

test('2 images in separate p → cokluGorselBlogu = 0', () => {
  const html = '<p><img src="a.jpg"></p><p><img src="b.jpg"></p>';
  const r = analyseOverviewHtml(html);
  assert.equal(r.cokluGorselBlogu, 0);
});

// ---------------------------------------------------------------------------
// 9. Inline wrapper depth
// ---------------------------------------------------------------------------
test('maxInlineWrapperDepth: span>strong>span = 3', () => {
  const html = '<span><strong><span>text</span></strong></span>';
  assert.equal(maxInlineWrapperDepth(html), 3);
});

test('deep nesting around image → satirIciSarmalayiciDerinligi >= 3', () => {
  const html = '<h2><span><strong><span><img src="a.jpg"></span></strong></span></h2>';
  const r = analyseOverviewHtml(html);
  assert.ok(r.satirIciSarmalayiciDerinligi >= 3,
    `Expected >= 3, got ${r.satirIciSarmalayiciDerinligi}`);
});

// ---------------------------------------------------------------------------
// 10. Real-world bozuk HTML (from the analysis doc)
// ---------------------------------------------------------------------------
test('real-world bozuk HTML → multiple flags', () => {
  const html = `
    <h2><span><strong><span><br><br><br><br>
    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
    <img src="test.jpg" width="1200"></span></strong>
    <IMG src="test2.jpg">
    <span>Neden Bu Eğitimi Tercih Etmelisiniz? Detaylı Anlatım İçeriği</span></span></h2>
  `;
  const r = analyseOverviewHtml(html);

  assert.equal(r.bosOverview, false);
  assert.equal(r.ardisikBr, true);
  assert.ok(r.maxArdisikBr >= 4, `Expected >= 4 consecutive br, got ${r.maxArdisikBr}`);
  assert.equal(r.nbspDolgusu, true);
  assert.ok(r.toplamNbsp >= 20, `Expected >= 20 nbsp, got ${r.toplamNbsp}`);
  assert.equal(r.kaptanGenisGorsel, 1);
  assert.ok(r.toplamGorsel >= 2, `Expected >= 2 images, got ${r.toplamGorsel}`);
  assert.ok(r.satirIciSarmalayiciDerinligi >= 3);
});

// ---------------------------------------------------------------------------
// 11. Image total count
// ---------------------------------------------------------------------------
test('3 images → toplamGorsel = 3', () => {
  const html = '<p><img src="1.jpg"><img src="2.jpg"></p><p><img src="3.jpg"></p>';
  const r = analyseOverviewHtml(html);
  assert.equal(r.toplamGorsel, 3);
});

// ---------------------------------------------------------------------------
// 12. classifyImageBlocks helper
// ---------------------------------------------------------------------------
test('classifyImageBlocks: one image-only, one mixed', () => {
  const html = '<p><img src="a.jpg"></p><p><img src="b.jpg">' + 'X'.repeat(65) + '</p>';
  const result = classifyImageBlocks(html);
  assert.equal(result.imageOnly, 1);
  assert.equal(result.mixed, 1);
});

// ---------------------------------------------------------------------------

// --------------------------------------------------------------------------
// Devralinan senaryolarin sonucu
// --------------------------------------------------------------------------
assert.equal(kalan, 0, `devralinan ${gecen + kalan} senaryodan ${kalan} tanesi basarisiz`);
assert.ok(gecen >= 26, `devralinan senaryo sayisi 26'nin altina dusmemeli (su an ${gecen})`);

// --- 11) DB okuma: fake prisma ile. HICBIR YAZMA CAGRISI OLMAMALI.
const yazmaCagrilari = [];
const fakePrisma = {
  productTab: {
    findMany: async (args) => {
      assert.equal(args.where.systemKey, 'OVERVIEW', 'yalnizca OVERVIEW tab okunmali');
      return [
        { productId: 1, content: '<p><img src="a.jpg" width="1200"></p>', product: { slug: 'kurs-a', title: 'Kurs A', status: 'PUBLISHED' } },
        { productId: 2, content: '<p>Temiz metin</p>', product: { slug: 'kurs-b', title: 'Kurs B', status: 'PUBLISHED' } }
      ];
    },
    update: async () => { yazmaCagrilari.push('tab.update'); },
    create: async () => { yazmaCagrilari.push('tab.create'); }
  },
  product: {
    count: async () => 2,
    update: async () => { yazmaCagrilari.push('product.update'); }
  }
};

(async () => {
  const satirlar = await auditOverviewTabs(fakePrisma);
  assert.equal(satirlar.length, 2);
  assert.equal(satirlar[0].slug, 'kurs-a');
  assert.ok(satirlar[0].isaretler.includes('kaptanGenis'));
  assert.deepEqual(satirlar[1].isaretler, []);
  assert.deepEqual(yazmaCagrilari, [], 'denetim DB\'ye ASLA yazmamali');

  // --- 12) Ozet: rapor semasi.
  const ozet = summarizeAudit(satirlar);
  assert.equal(ozet.overviewTabiOlan, 2);
  assert.equal(ozet.gorselliProblemli, 1);
  assert.equal(ozet.gorselYok, 1);
  assert.equal(ozet.gorselliTemiz, 0);
  assert.equal(typeof ozet.isaretSayilari.kaptanGenis, 'number');
  assert.equal(ozet.isaretSayilari.kaptanGenis, 1);

  // --- 13) Kategori filtresi: Mimar kategori kategori ilerliyor (once "yazilim").
  let gorulenWhere = null;
  const kategoriPrisma = {
    productTab: {
      findMany: async (args) => { gorulenWhere = args.where; return []; }
    }
  };
  await auditOverviewTabs(kategoriPrisma, { kategoriSlug: 'yazilim' });
  assert.equal(gorulenWhere.systemKey, 'OVERVIEW');
  assert.equal(gorulenWhere.product.category.slug, 'yazilim', 'kategori filtresi sorguya yansimali');

  await auditOverviewTabs(kategoriPrisma);
  assert.equal(gorulenWhere.product, undefined, 'kategori verilmezse filtre eklenmemeli');

  console.log(`test-course-overview-audit OK (devralinan ${gecen} senaryo dahil)`);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
