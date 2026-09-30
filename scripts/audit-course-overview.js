#!/usr/bin/env node
// "Egitime Ilk Bakis" denetim raporu — SALT OKUR, DB'ye hicbir sey yazmaz.
//
// Kullanim:
//   node scripts/audit-course-overview.js              # ozet + en problemli 20 kurs
//   node scripts/audit-course-overview.js --json       # ayrica scripts/data/overview-audit-<tarih>.json
//   node scripts/audit-course-overview.js --limit 50   # listede kac kurs gosterilecek
//   node scripts/audit-course-overview.js --kategori yazilim   # YALNIZCA o kategori
//
// Mimar karari (2026-09-30): kategori kategori ilerlenir — once "yazilim", basarili olursa
// "oyun-gelistirme", "grafik-tasarim", "3d-modelleme". Hepsi birden ele alinmaz.
//
// Production'da da calistirilabilir (yalnizca okuma, yedek gerekmez) — Mimar yurutur.

const fs = require('fs');
const path = require('path');

const prisma = require('../src/db');
const {
  AUDIT_THRESHOLDS,
  auditOverviewTabs,
  summarizeAudit
} = require('../src/services/course-overview-audit');

function parseArgs(argv) {
  const secenekler = { json: false, limit: 20, kategoriSlug: null };
  argv.forEach((deger, indeks) => {
    if (deger === '--json') secenekler.json = true;
    if (deger === '--limit') secenekler.limit = Number(argv[indeks + 1]) || secenekler.limit;
    if (deger === '--kategori') secenekler.kategoriSlug = argv[indeks + 1] || null;
  });
  return secenekler;
}

function bugununEtiketi() {
  const simdi = new Date();
  const ikiHane = (sayi) => String(sayi).padStart(2, '0');
  return `${simdi.getFullYear()}${ikiHane(simdi.getMonth() + 1)}${ikiHane(simdi.getDate())}`;
}

function sutun(deger, genislik) {
  const metin = String(deger);
  return metin.length > genislik ? `${metin.slice(0, genislik - 1)}…` : metin.padEnd(genislik);
}

async function main() {
  const secenekler = parseArgs(process.argv.slice(2));
  const satirlar = await auditOverviewTabs(prisma, { kategoriSlug: secenekler.kategoriSlug });
  const ozet = summarizeAudit(satirlar);
  const toplamKurs = secenekler.kategoriSlug
    ? await prisma.product.count({ where: { category: { slug: secenekler.kategoriSlug } } })
    : await prisma.product.count();

  console.log('=== "Egitime Ilk Bakis" denetim raporu ===');
  console.log(`Kapsam: ${secenekler.kategoriSlug ? `kategori = ${secenekler.kategoriSlug}` : 'TUM kurslar'}`);
  console.log(`Esikler: ardisik <br> >= ${AUDIT_THRESHOLDS.ardisikBr} | &nbsp; > ${AUDIT_THRESHOLDS.nbspDolgusu}`
    + ` | karisik metin > ${AUDIT_THRESHOLDS.karisikMetinUzunlugu} karakter | kap ${AUDIT_THRESHOLDS.kapGenisligi}px`);
  console.log('');
  console.log(`Toplam kurs (product)          : ${toplamKurs}`);
  console.log(`OVERVIEW tab'i olan            : ${ozet.overviewTabiOlan}`);
  console.log(`OVERVIEW tab'i HIC olmayan     : ${toplamKurs - ozet.overviewTabiOlan}  (panel bos render edilir)`);
  console.log(`  - gorseli olmayan            : ${ozet.gorselYok}`);
  console.log(`  - gorselli ve PROBLEMLI      : ${ozet.gorselliProblemli}`);
  console.log(`  - gorselli ve temiz          : ${ozet.gorselliTemiz}`);
  console.log('');
  console.log('Isaret sikligi:');
  console.log(`  ardisik <br> zinciri         : ${ozet.isaretSayilari.ardisikBr}`);
  console.log(`  &nbsp; dolgusu               : ${ozet.isaretSayilari.nbspDolgusu}`);
  console.log(`  gorsel metinle ayni blokta   : ${ozet.isaretSayilari.metinleKarisik}`);
  console.log(`  kaptan genis gorsel          : ${ozet.isaretSayilari.kaptanGenis}`);
  console.log('');
  console.log(`Toplam gorsel                  : ${ozet.toplamGorsel}`);
  console.log(`  width atributu olmayan       : ${ozet.widthAtributuYok}`);
  console.log('');

  const siralanan = [...satirlar].sort((a, b) => b.siddet - a.siddet || b.metinleKarisikBlok - a.metinleKarisikBlok);
  console.log(`--- En problemli ${Math.min(secenekler.limit, siralanan.length)} kurs ---`);
  console.log(`${sutun('sid', 4)}${sutun('gorsel', 7)}${sutun('karisik', 8)}${sutun('genis', 6)}${sutun('br', 4)}${sutun('nbsp', 6)}slug`);
  siralanan.slice(0, secenekler.limit).forEach((satir) => {
    console.log(
      sutun(satir.siddet, 4)
      + sutun(satir.gorselSayi, 7)
      + sutun(satir.metinleKarisikBlok, 8)
      + sutun(satir.kaptanGenisGorsel, 6)
      + sutun(satir.ardisikBrBloklari, 4)
      + sutun(satir.nbspSayisi, 6)
      + (satir.slug || `#${satir.productId}`)
    );
  });

  if (secenekler.json) {
    const hedefKlasor = path.join(__dirname, 'data');
    fs.mkdirSync(hedefKlasor, { recursive: true });
    const kapsamEki = secenekler.kategoriSlug ? `-${secenekler.kategoriSlug}` : '';
    const dosya = path.join(hedefKlasor, `overview-audit${kapsamEki}-${bugununEtiketi()}.json`);
    fs.writeFileSync(dosya, `${JSON.stringify({
      olusturuldu: new Date().toISOString(),
      kapsam: secenekler.kategoriSlug || 'tum-kurslar',
      esikler: AUDIT_THRESHOLDS,
      toplamKurs,
      ozet,
      kurslar: siralanan
    }, null, 2)}\n`);
    console.log(`\nJSON raporu yazildi: ${path.relative(process.cwd(), dosya)}`);
  }

  console.log('\nNot: bu script DB\'ye hicbir sey yazmaz. Duzeltme ayri bir cemberde, Mimar\'in onayladigi liste uzerinden yapilir.');
}

main()
  .catch((hata) => {
    console.error('Denetim basarisiz:', hata.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
