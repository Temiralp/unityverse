// Cember 23: normalizasyon plani artik KATEGORI ile de verilebilir.
// Neden: yerel DB production'dan eski (bilinen durum) — elle yazilan slug listesi production'da
// eksik/yanlis olur. Kategori verildiginde liste CALISMA ANINDA DB'den cozulur (Cember 9 dersi).

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const { planKurslariniCoz } = require('../src/services/course-overview-normalize');

const yazmaCagrilari = [];
const fakePrisma = {
  product: {
    findMany: async (args) => {
      assert.equal(args.where.category.slug, 'yazilim', 'kategori filtresi sorguya yansimali');
      assert.ok(args.where.tabs, 'yalnizca OVERVIEW tabi olan kurslar secilmeli');
      return [{ slug: 'kurs-a' }, { slug: 'kurs-b' }];
    },
    update: async () => { yazmaCagrilari.push('update'); }
  }
};

(async () => {
  // 1) Kategori verilince liste DB'den cozulur.
  const kategoriden = await planKurslariniCoz(fakePrisma, { kategori: 'yazilim' });
  assert.deepEqual(kategoriden, ['kurs-a', 'kurs-b']);
  assert.deepEqual(yazmaCagrilari, [], 'plan cozumu DB\'ye yazmamali');

  // 2) Acik slug listesi verilince oldugu gibi kullanilir (eski planlar calismaya devam eder).
  const listeden = await planKurslariniCoz(fakePrisma, { kurslar: ['x', 'y'] });
  assert.deepEqual(listeden, ['x', 'y']);

  // 3) Ikisi birden verilirse: kategoriden gelen liste + acik liste, tekrarsiz.
  const birlesik = await planKurslariniCoz(fakePrisma, { kategori: 'yazilim', kurslar: ['kurs-a', 'z'] });
  assert.deepEqual(birlesik.sort(), ['kurs-a', 'kurs-b', 'z'].sort());

  // 4) Hicbiri yoksa bos liste (CLI "yazilacak kayit yok" der).
  assert.deepEqual(await planKurslariniCoz(fakePrisma, {}), []);

  // 5) Plan dosyasi gercekten var ve kategori alani tasiyor.
  const planYolu = path.join(__dirname, 'data', 'overview-normalize-yazilim-2026-10-01.json');
  assert.ok(fs.existsSync(planYolu), 'yazilim kategorisi plan dosyasi olusturulmali');
  const plan = JSON.parse(fs.readFileSync(planYolu, 'utf8'));
  assert.equal(plan.kategori, 'yazilim');
  assert.ok(Array.isArray(plan.haricTutulan), 'daha once normalize edilen kurslar icin alan bulunmali');

  // 6) CLI kategori destegini kullanmali.
  const cli = fs.readFileSync(path.join(__dirname, 'normalize-course-overview.js'), 'utf8');
  assert.match(cli, /planKurslariniCoz/, 'CLI plan cozumunu servisten almali');

  console.log('test-overview-normalize-plan OK');
})().catch((hata) => { console.error(hata); process.exit(1); });
