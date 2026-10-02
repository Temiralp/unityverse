#!/usr/bin/env node
// "Egitimimizden kareler" bolumunun TEKRARLARINI kaldirir — Cember 9 (toplu fiyat) deseni.
//
//   node scripts/normalize-duplicate-gallery.js                        # DRY-RUN (varsayilan, yazmaz)
//   node scripts/normalize-duplicate-gallery.js --apply                # tek transaction ile yazar
//   node scripts/normalize-duplicate-gallery.js --revert <rapor.json>  # birebir geri alir
//   --plan <dosya>   varsayilan: scripts/data/duplicate-gallery-2026-10-02.json
//
// Kapsam: plan dosyasindaki `kategori` (yoksa TUM kurslar) icinde etiketi 1'den fazla gecen
// OVERVIEW tablari. Slug listesi calisma aninda DB'den cozulur (Cember 9 dersi: yerel DB
// production'dan eskidir, elle liste yazilmaz).
//
// Guvenlik: kaldirilan her gorsel, kalan bolumde ayni src VEYA ayni DOSYA IMZASI (boyut+md5)
// ile karsilanmali. Karsilanmayan tek bir gorsel varsa kurs MANUAL isaretlenir ve YAZILMAZ.
//
// PRODUCTION'DA YALNIZCA MIMAR, YALNIZCA pg_dump YEDEGINDEN SONRA calistirir.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const prisma = require('../src/db');
const {
  tekrarQalereyalariniKaldir,
  qalereyaEtiketiSayisi,
  gorselKaynaklari,
  gorunenMetin
} = require('../src/services/course-overview-duplicate-gallery');

const PROJE_KOKU = path.join(__dirname, '..');
const VARSAYILAN_PLAN = path.join(__dirname, 'data', 'duplicate-gallery-2026-10-02.json');

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

// src -> yerel dosya yolu. `../../uploads/...` ve `/uploads/...` bicimleri ayni dosyayi gosterir.
function dosyaYolu(src) {
  const temiz = String(src).split('?')[0].replace(/^(\.\.\/)+/, '').replace(/^\/+/, '');
  if (!temiz.startsWith('uploads/')) return null;
  return path.join(PROJE_KOKU, decodeURIComponent(temiz));
}

const imzaOnbellegi = new Map();

function dosyaImzasi(src) {
  if (imzaOnbellegi.has(src)) return imzaOnbellegi.get(src);
  let imza = null;
  try {
    const yol = dosyaYolu(src);
    if (yol && fs.existsSync(yol)) {
      const veri = fs.readFileSync(yol);
      imza = `${veri.length}:${crypto.createHash('md5').update(veri).digest('hex')}`;
    }
  } catch (hata) {
    imza = null;
  }
  imzaOnbellegi.set(src, imza);
  return imza;
}

async function hedefTablar(plan) {
  const where = { systemKey: 'OVERVIEW' };
  if (plan.kategori) where.product = { category: { slug: plan.kategori } };
  const tablar = await prisma.productTab.findMany({
    where,
    select: { id: true, content: true, product: { select: { slug: true, title: true } } }
  });
  const haric = new Set(plan.haricTutulan || []);
  return tablar
    .filter((tab) => tab.content && qalereyaEtiketiSayisi(tab.content) > 1)
    .filter((tab) => !haric.has(tab.product.slug));
}

function kelimeKumesi(metin) {
  return metin.split(' ').filter(Boolean).sort().join(' ');
}

function satirHazirla(tab) {
  const sonuc = tekrarQalereyalariniKaldir(tab.content, { dosyaImzasi });
  const satir = {
    slug: tab.product.slug,
    baslik: tab.product.title,
    tabId: tab.id,
    durum: sonuc.durum,
    sebep: sonuc.sebep || '',
    etiketOnce: qalereyaEtiketiSayisi(tab.content),
    etiketSonra: qalereyaEtiketiSayisi(sonuc.sonuc),
    gorselOnce: gorselKaynaklari(tab.content).length,
    gorselSonra: gorselKaynaklari(sonuc.sonuc).length,
    tekrarsizOnce: new Set(gorselKaynaklari(tab.content)).size,
    tekrarsizSonra: new Set(gorselKaynaklari(sonuc.sonuc)).size,
    uzunlukOnce: tab.content.length,
    uzunlukSonra: sonuc.sonuc.length,
    kaldirilanBolum: sonuc.kaldirilanBolum,
    oncekiIcerik: tab.content,
    yeniIcerik: sonuc.sonuc
  };

  // Ek koruma: gorunen METIN kaybolmamali (etiket tekrarlari haric).
  if (satir.durum === 'DEGISECEK') {
    const once = kelimeKumesi(gorunenMetin(tab.content));
    const sonra = kelimeKumesi(gorunenMetin(sonuc.sonuc));
    if (once !== sonra) {
      const fazlalik = once.split(' ').length - sonra.split(' ').length;
      // Yalnizca etiket kelimeleri eksilmisse normaldir; baska metin kaybinda MANUAL.
      const etiketKelime = 2 * (satir.etiketOnce - satir.etiketSonra);
      if (fazlalik > etiketKelime) {
        satir.durum = 'MANUAL';
        satir.sebep = `beklenenden fazla metin kaybi (${fazlalik} kelime)`;
        satir.yeniIcerik = tab.content;
      }
    }
  }
  return satir;
}

function ozetYaz(satirlar) {
  const sayac = satirlar.reduce((acc, satir) => ({ ...acc, [satir.durum]: (acc[satir.durum] || 0) + 1 }), {});
  satirlar.forEach((satir) => {
    console.log(`\n[${satir.durum}] ${satir.slug}`);
    console.log(`   etiket ${satir.etiketOnce} -> ${satir.etiketSonra} | gorsel ${satir.gorselOnce} -> ${satir.gorselSonra}`
      + ` (tekrarsiz ${satir.tekrarsizOnce} -> ${satir.tekrarsizSonra}) | uzunluk ${satir.uzunlukOnce} -> ${satir.uzunlukSonra}`);
    if (satir.sebep) console.log(`   sebep: ${satir.sebep}`);
  });
  console.log(`\nOZET: ${satirlar.length} kurs | ` + Object.entries(sayac).map(([k, v]) => `${k}=${v}`).join(' | '));
  return sayac;
}

async function main() {
  const secenekler = parseArgs(process.argv.slice(2));

  if (secenekler.revert) {
    const rapor = JSON.parse(fs.readFileSync(path.resolve(secenekler.revert), 'utf8'));
    const geriAlinacak = (rapor.kurslar || []).filter((satir) => satir.durum === 'DEGISECEK');
    await prisma.$transaction(
      geriAlinacak.map((satir) => prisma.productTab.update({ where: { id: satir.tabId }, data: { content: satir.oncekiIcerik } }))
    );
    let birebir = 0;
    for (const satir of geriAlinacak) {
      const tab = await prisma.productTab.findUnique({ where: { id: satir.tabId }, select: { content: true } });
      if (tab && tab.content === satir.oncekiIcerik) birebir += 1;
    }
    console.log(`REVERT: ${birebir}/${geriAlinacak.length} kurs bayt bayt orijinal icerige dondu.`);
    return;
  }

  const plan = JSON.parse(fs.readFileSync(secenekler.plan, 'utf8'));
  console.log(`Plan: ${path.basename(secenekler.plan)} | kapsam: ${plan.kategori || 'TUM KURSLAR'}`);

  const tablar = await hedefTablar(plan);
  console.log(`Etiketi 1'den fazla gecen OVERVIEW tabi: ${tablar.length}`);
  if (!tablar.length) { console.log('Yapilacak is yok.'); return; }

  const satirlar = tablar.map(satirHazirla);
  const sayac = ozetYaz(satirlar);

  if (!secenekler.apply) {
    console.log('\nBu bir DRY-RUN idi. Yazmak icin: --apply  (once pg_dump yedegi alin)');
    return;
  }

  const yazilacak = satirlar.filter((satir) => satir.durum === 'DEGISECEK');
  if (!yazilacak.length) { console.log('\nYazilacak satir yok.'); return; }

  await prisma.$transaction(
    yazilacak.map((satir) => prisma.productTab.update({ where: { id: satir.tabId }, data: { content: satir.yeniIcerik } }))
  );

  let dogrulanan = 0;
  for (const satir of yazilacak) {
    const tab = await prisma.productTab.findUnique({ where: { id: satir.tabId }, select: { content: true } });
    if (tab && tab.content === satir.yeniIcerik) dogrulanan += 1;
  }
  console.log(`\nAPPLY: ${dogrulanan}/${yazilacak.length} kurs DB'den yeniden okunarak dogrulandi.`);

  const dosya = path.join(__dirname, 'data', `duplicate-gallery-rapor-${zamanEtiketi()}.json`);
  fs.writeFileSync(dosya, `${JSON.stringify({ olusturuldu: new Date().toISOString(), plan: path.basename(secenekler.plan), ozet: sayac, kurslar: satirlar }, null, 2)}\n`);
  console.log(`Rapor (revert icin gerekli): ${dosya}`);
}

main()
  .catch((hata) => { console.error(hata); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
