// Cember 25-a: ucus oncesi koruma.
// Mimar'in endisesi (2026-10-02): "birini duzeltirken digeri bozulabilir".
// Bu yuzden her kurs icin icerik temizliginden ONCE ve SONRA duzen (layout) parmak izi
// hesaplanir; herhangi bir gosterge KOTULESIYORSA kurs MANUAL isaretlenir ve DOKUNULMAZ.

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const { layoutBarmakIzi, barmakIziRiski } = require('../src/services/course-overview-normalize');

// --- 1) Parmak izi dogru olculmeli.
const qalereyali = `<h2>Egitimimizden kareler:${'<img src="g.jpg">'.repeat(6)}</h2>`;
const iz = layoutBarmakIzi(qalereyali);
assert.equal(iz.gorsel, 6);
assert.equal(iz.qalereya, 1);
assert.equal(iz.kart, 6);
assert.equal(iz.duzenlenenGorsel, 6, 'tum gorseller bir kapta hizalanmali');

const duzenlenmeyen = `<p>${'A'.repeat(200)}<img src="a.jpg"></p>`;
const iz2 = layoutBarmakIzi(duzenlenmeyen);
assert.equal(iz2.gorsel, 1);
assert.equal(iz2.duzenlenenGorsel, 0, 'metinli blok hizalanmaz — dogru davranis');

// --- 2) Risk yoksa bos liste.
assert.deepEqual(barmakIziRiski(iz, iz), []);
assert.deepEqual(
  barmakIziRiski({ gorsel: 6, qalereya: 1, kart: 6, duzenlenenGorsel: 6 },
                 { gorsel: 6, qalereya: 1, kart: 6, duzenlenenGorsel: 6 }),
  []
);

// --- 3) Her kotulesme yakalanmali.
const temel = { gorsel: 10, qalereya: 1, kart: 10, duzenlenenGorsel: 10 };
assert.ok(barmakIziRiski(temel, { ...temel, gorsel: 9 }).length, 'gorsel kaybi yakalanmali');
assert.ok(barmakIziRiski(temel, { ...temel, qalereya: 0 }).length, 'galeri kaybi yakalanmali');
assert.ok(barmakIziRiski(temel, { ...temel, kart: 8 }).length, 'kart azalmasi yakalanmali');
assert.ok(barmakIziRiski(temel, { ...temel, duzenlenenGorsel: 7 }).length, 'hizalanan gorsel azalmasi yakalanmali');

// --- 4) IYILESME risk degildir (temizlik bos bloklari kaldirip kaplari birlestirebilir).
assert.deepEqual(barmakIziRiski(temel, { ...temel, duzenlenenGorsel: 10, kart: 10, qalereya: 1 }), []);
assert.deepEqual(barmakIziRiski({ ...temel, duzenlenenGorsel: 4 }, temel), [], 'daha fazla gorsel hizalanmasi iyidir');

// --- 5) Gercek senaryo: bos blok temizligi medya kaplarini BIRLESTIRIR (medya sayisi duser)
// ama hizalanan gorsel sayisi DUSMEZ -> risk sayilmamali.
const once = '<p><img src="1.jpg"></p><p></p><p><img src="2.jpg"></p>';
const sonra = '<p><img src="1.jpg"></p><p><img src="2.jpg"></p>';
assert.deepEqual(barmakIziRiski(layoutBarmakIzi(once), layoutBarmakIzi(sonra)), [],
  'kap birlesmesi risk degildir');

// --- 6) CLI korumayi kullanmali ve MANUAL kayitlari yazmamali.
const cli = fs.readFileSync(path.join(__dirname, 'normalize-course-overview.js'), 'utf8');
assert.match(cli, /barmakIziRiski/, 'CLI ucus oncesi kontrolu yapmali');
assert.match(cli, /MANUAL/, 'riskli kurslar MANUAL isaretlenmeli');
assert.match(cli, /satir\.durum === 'DEGISECEK'/, 'yalnizca DEGISECEK kayitlar yazilmali');

console.log('test-normalize-preflight OK');
