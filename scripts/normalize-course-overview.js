#!/usr/bin/env node
// "Egitime Ilk Bakis" icerik normalizasyonu — Cember 9 (toplu fiyat guncellemesi) deseni.
//
//   node scripts/normalize-course-overview.js                         # DRY-RUN (varsayilan, yazmaz)
//   node scripts/normalize-course-overview.js --apply                 # tek transaction ile yazar
//   node scripts/normalize-course-overview.js --revert <rapor.json>   # birebir geri alir
//   --plan <dosya>   varsayilan: scripts/data/overview-normalize-2026-09-30.json
//
// PRODUCTION'DA YALNIZCA MIMAR, YALNIZCA pg_dump YEDEGINDEN SONRA calistirir.

const fs = require('fs');
const path = require('path');

const prisma = require('../src/db');
const { normalizeOverviewContent, gorunenMetin, gorselKaynaklari } = require('../src/services/course-overview-normalize');

const VARSAYILAN_PLAN = path.join(__dirname, 'data', 'overview-normalize-2026-09-30.json');

function parseArgs(argv) {
  const secenekler = { apply: false, revert: null, plan: VARSAYILAN_PLAN };
  argv.forEach((deger, indeks) => {
    if (deger === '--apply') secenekler.apply = true;
    if (deger === '--revert') secenekler.revert = argv[indeks + 1] || null;
    if (deger === '--plan') secenekler.plan = path.resolve(argv[indeks + 1] || VARSAYILAN_PLAN);
  });
  return secenekler;
}

function zamanEtiketi() {
  const s = new Date();
  const ik = (n) => String(n).padStart(2, '0');
  return `${s.getFullYear()}${ik(s.getMonth() + 1)}${ik(s.getDate())}_${ik(s.getHours())}${ik(s.getMinutes())}`;
}

async function overviewTabiniGetir(slug) {
  const urun = await prisma.product.findFirst({
    where: { slug },
    select: { id: true, title: true, tabs: { where: { systemKey: 'OVERVIEW' }, select: { id: true, content: true } } }
  });
  if (!urun) return { slug, durum: 'URUN_YOK' };
  if (!urun.tabs.length) return { slug, durum: 'OVERVIEW_TABI_YOK', productId: urun.id };
  return { slug, durum: 'HAZIR', productId: urun.id, baslik: urun.title, tabId: urun.tabs[0].id, icerik: urun.tabs[0].content };
}

async function dryRun(plan) {
  const satirlar = [];
  for (const slug of plan.kurslar) {
    const kayit = await overviewTabiniGetir(slug);
    if (kayit.durum !== 'HAZIR') { satirlar.push({ ...kayit, atlandi: true }); continue; }

    let sonuc;
    try {
      sonuc = normalizeOverviewContent(kayit.icerik);
    } catch (hata) {
      satirlar.push({ ...kayit, durum: 'KORUMA_IHLALI', hata: hata.message, atlandi: true });
      continue;
    }

    satirlar.push({
      slug,
      productId: kayit.productId,
      tabId: kayit.tabId,
      baslik: kayit.baslik,
      durum: sonuc.degisti ? 'DEGISECEK' : 'DEGISIKLIK_YOK',
      atlandi: !sonuc.degisti,
      oncekiUzunluk: kayit.icerik.length,
      sonrakiUzunluk: sonuc.content.length,
      sayaclar: sonuc.sayaclar,
      gorselSayisi: gorselKaynaklari(kayit.icerik).length,
      metinAyni: gorunenMetin(kayit.icerik) === gorunenMetin(sonuc.content),
      oncekiIcerik: kayit.icerik,
      sonrakiIcerik: sonuc.content
    });
  }
  return satirlar;
}

function tabloYaz(satirlar) {
  console.log('durum            uzunluk        br  nbsp bos  gorsel metin  slug');
  satirlar.forEach((satir) => {
    if (satir.durum !== 'DEGISECEK' && satir.durum !== 'DEGISIKLIK_YOK') {
      console.log(`${satir.durum.padEnd(17)}${'-'.padEnd(35)}${satir.slug}`);
      return;
    }
    const uzunluk = `${satir.oncekiUzunluk} → ${satir.sonrakiUzunluk}`;
    console.log(
      satir.durum.padEnd(17)
      + uzunluk.padEnd(15)
      + String(satir.sayaclar.brZinciri).padEnd(4)
      + String(satir.sayaclar.nbspYigini).padEnd(5)
      + String(satir.sayaclar.bosBlok).padEnd(5)
      + String(satir.gorselSayisi).padEnd(7)
      + (satir.metinAyni ? 'ayni ' : 'FARKLI')
      + '  ' + satir.slug
    );
  });
}

async function apply(satirlar) {
  const yazilacak = satirlar.filter((satir) => satir.durum === 'DEGISECEK');
  if (!yazilacak.length) { console.log('\nYazilacak kayit yok.'); return []; }

  await prisma.$transaction(
    yazilacak.map((satir) => prisma.productTab.update({
      where: { id: satir.tabId },
      data: { content: satir.sonrakiIcerik }
    }))
  );

  // DB'den YENIDEN OKUYUP dogrula (Cember 9 kurali).
  const dogrulama = [];
  for (const satir of yazilacak) {
    const tab = await prisma.productTab.findUnique({ where: { id: satir.tabId }, select: { content: true } });
    const tamam = tab && tab.content === satir.sonrakiIcerik;
    dogrulama.push({ slug: satir.slug, dogrulandi: tamam });
    if (!tamam) console.error(`  DOGRULAMA BASARISIZ: ${satir.slug}`);
  }
  console.log(`\n${yazilacak.length} kayit yazildi; dogrulanan: ${dogrulama.filter((d) => d.dogrulandi).length}/${yazilacak.length}`);
  return yazilacak;
}

async function revert(raporYolu) {
  const rapor = JSON.parse(fs.readFileSync(raporYolu, 'utf8'));
  const geriAlinacak = rapor.kurslar.filter((satir) => satir.durum === 'DEGISECEK');
  await prisma.$transaction(
    geriAlinacak.map((satir) => prisma.productTab.update({
      where: { id: satir.tabId },
      data: { content: satir.oncekiIcerik }
    }))
  );
  let tamam = 0;
  for (const satir of geriAlinacak) {
    const tab = await prisma.productTab.findUnique({ where: { id: satir.tabId }, select: { content: true } });
    if (tab && tab.content === satir.oncekiIcerik) tamam += 1;
  }
  console.log(`Geri alindi: ${tamam}/${geriAlinacak.length} kayit orijinal haline dondu.`);
}

async function main() {
  const secenekler = parseArgs(process.argv.slice(2));

  if (secenekler.revert) {
    await revert(secenekler.revert);
    return;
  }

  const plan = JSON.parse(fs.readFileSync(secenekler.plan, 'utf8'));
  console.log(`=== Overview normalizasyonu — ${secenekler.apply ? 'APPLY' : 'DRY-RUN (yazma yok)'} ===`);
  console.log(`Plan: ${path.relative(process.cwd(), secenekler.plan)} (${plan.kurslar.length} kurs)\n`);

  const satirlar = await dryRun(plan);
  tabloYaz(satirlar);

  const degisecek = satirlar.filter((s) => s.durum === 'DEGISECEK').length;
  const ihlal = satirlar.filter((s) => s.durum === 'KORUMA_IHLALI').length;
  console.log(`\nOzet: ${degisecek} degisecek | ${satirlar.length - degisecek - ihlal} dokunulmayacak | ${ihlal} koruma ihlali`);
  if (ihlal) { console.error('Koruma ihlali var — APPLY calistirilmamali.'); process.exitCode = 1; return; }

  if (!secenekler.apply) {
    console.log('\nBu bir DRY-RUN idi. Yazmak icin: --apply  (once pg_dump yedegi alin)');
    return;
  }

  const yazilan = await apply(satirlar);
  if (yazilan.length) {
    const dosya = path.join(__dirname, 'data', `overview-normalize-report-${zamanEtiketi()}.json`);
    fs.writeFileSync(dosya, `${JSON.stringify({ olusturuldu: new Date().toISOString(), plan: path.basename(secenekler.plan), kurslar: satirlar }, null, 2)}\n`);
    console.log(`Rapor (geri alma icin GEREKLI): ${path.relative(process.cwd(), dosya)}`);
  }
}

main()
  .catch((hata) => { console.error('Islem basarisiz:', hata.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
