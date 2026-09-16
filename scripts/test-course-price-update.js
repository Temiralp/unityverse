#!/usr/bin/env node

// Toplu kurs fiyat guncellemesi (Cember 9): hedef fiyat cozumleme, istisnalar, rejim tespiti,
// ana/uskak (variant) mantigi admin paneliyle ayni, catisma -> MANUAL, idempotentlik, uygulama.

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');

const {
  applyPriceChanges,
  detectMode,
  durationMonths,
  planPriceChanges,
  resolveTargetPrice,
  summarizePlan
} = require('../src/services/course-price-update');

const root = path.resolve(__dirname, '..');
const plan = JSON.parse(fs.readFileSync(path.join(root, 'scripts/data/price-update-2026-09-16.json'), 'utf8'));

// 1) Plan dosyasi: 91 satir, 3 kategori, kurallar Mimar'in tablosuyla ayni
assert.equal(plan.rows.length, 91);
assert.deepEqual(plan.order, ['oyun', 'yazilim', 'grafik']);
assert.equal(plan.categories.oyun.prices['4'].online, 79000);
assert.equal(plan.categories.oyun.prices['8'].yuzyuze, 186250);
assert.equal(plan.categories.yazilim.prices['10'].online, 286000);
assert.equal(plan.categories.grafik.prices['4'].yuzyuze, 89000);
assert.equal(plan.categories.grafik.prices['8'].online, 89000);
assert.equal(plan.categories.grafik.prices['10'].yuzyuze, 149000);
assert.equal(plan.categories.grafik.excludeTitle, null, 'UI/UX dahil (Mimar 2026-09-16)');

// 2) Rejim tespiti (slug + baslik)
assert.equal(detectMode({ slug: 'unity-ile-oyun-gelistirme-yuz-yuze-egitimi-4-ay-1483', title: 'x' }), 'yuzyuze');
assert.equal(detectMode({ slug: 'back-end-development-onlinecanli-egitimi-986', title: 'x' }), 'online');
assert.equal(detectMode({ slug: 'unreal-engine-ile-metaverse-gelistirme-online-canli-egitim-851', title: 'x' }), 'online');
assert.equal(detectMode({ slug: 'kurs-1', title: 'Kurs – Yüz Yüze' }), 'yuzyuze');
assert.equal(detectMode({ slug: 'kurs-2', title: 'Kurs' }), null);
assert.equal(detectMode({ slug: 'kurs-online-yuz-yuze', title: 'x' }), null, 'ikisi birden -> belirsiz');

// 3) Sure ayristirma
assert.equal(durationMonths('8 ay'), 8);
assert.equal(durationMonths('10 Ay'), 10);
assert.equal(durationMonths('30 saat'), null);
assert.equal(durationMonths(null), null);

// 4) Hedef fiyat + istisnalar: 91 satirin tamami
const targets = plan.rows.map((row) => ({ row, target: resolveTargetPrice(row, plan) }));
const excluded = targets.filter((t) => t.target.excluded);
assert.equal(excluded.length, 8, 'oyun 5 + yazilim 3 cocuk');
assert.ok(excluded.every((t) => /çocuk/i.test(t.row.title)));
assert.ok(excluded.every((t) => t.row.category !== 'grafik'));
const uiux = targets.filter((t) => /UI\/UX/i.test(t.row.title));
assert.equal(uiux.length, 3);
assert.ok(uiux.every((t) => !t.target.excluded && t.target.price > 0), 'UI/UX fiyat alir');
// Ad/slug'da online veya yuz yuze gecmeyen 4 satir: MANUAL (Mimar plan satirina "mode" ekler)
const unresolvedMode = targets.filter((t) => !t.target.excluded && !t.target.price);
assert.deepEqual(unresolvedMode.map((t) => t.row.slug).sort(), [
  'siber-guvenlik-egitimi-1462',
  'siber-guvenlik-egitimi-4-ay-1463',
  'sifirdan-uzmanliga-it-ve-sistem-yonetimi-egitimi-1653',
  'sifirdan-uzmanliga-it-ve-sistem-yonetimi-egitimi-4-ay-1657'
]);
assert.ok(unresolvedMode.every((t) => /mode/.test(t.target.error)));
// Acik mode override tahmine ustun gelir
assert.equal(resolveTargetPrice({ ...unresolvedMode[0].row, mode: 'yuzyuze' }, plan).price, 98750);
assert.equal(resolveTargetPrice({ category: 'oyun', months: 4, slug: 'x-online-1', title: 'x', mode: 'yuzyuze' }, plan).price, 98750);
const byKey = (cat, months, mode) => targets.filter((t) => t.row.category === cat && t.row.months === months && t.target.mode === mode && !t.target.excluded);
assert.ok(byKey('oyun', 4, 'online').every((t) => t.target.price === 79000));
assert.ok(byKey('oyun', 8, 'yuzyuze').every((t) => t.target.price === 186250));
assert.ok(byKey('yazilim', 10, 'online').concat(byKey('yazilim', 10, 'yuzyuze')).every((t) => t.target.price === 286000));
assert.ok(byKey('grafik', 8, 'online').every((t) => t.target.price === 89000));

// 5) Sahte DB: standalone, ana+cocuk (default), ana+cocuk (pasif), sure uyusmazligi, catisma
function product(overrides) {
  return {
    id: 0, slug: '', title: '', status: 'PUBLISHED', duration: null, price: '1000', discountType: null,
    discountValue: null, discountPrice: null, productVariants: [], variantOfProducts: [], ...overrides
  };
}
const parent = product({ id: 10, slug: 'p-online-1', duration: '8 ay', price: '98750' });
const child8 = product({ id: 11, slug: 'p-online-8-ay-11', duration: '8 ay', price: '98750' });
const child4 = product({ id: 12, slug: 'p-online-4-ay-12', duration: '4 ay', price: '49000' });
parent.productVariants = [
  { id: 1, label: '8 ay', isDefault: true, isActive: true, isArchived: false, variantProductId: 11, variantProduct: child8 },
  { id: 2, label: '4 ay', isDefault: false, isActive: false, isArchived: false, variantProductId: 12, variantProduct: child4 }
];
child8.variantOfProducts = [{ parentProductId: 10, label: '8 ay', isDefault: true, isActive: true, isArchived: false, parentProduct: parent }];
child4.variantOfProducts = [{ parentProductId: 10, label: '4 ay', isDefault: false, isActive: false, isArchived: false, parentProduct: parent }];
const standalone = product({ id: 20, slug: 's-yuz-yuze-20', duration: '4 ay', price: '56000' });
const discounted = product({ id: 21, slug: 'd-online-21', duration: '4 ay', price: '50000', discountType: 'PERCENT', discountValue: '10', discountPrice: '45000.00' });
const wrongDuration = product({ id: 22, slug: 'w-online-22', duration: '6 ay', price: '1' });
const already = product({ id: 23, slug: 'a-online-23', duration: '4 ay', price: '79000.00' });
const mixedParent = product({ id: 30, slug: 'm-online-30', duration: '8 ay', price: '49000' });
const mixedChild4 = product({ id: 31, slug: 'm-online-4-ay-31', duration: '4 ay', price: '49000' });
mixedParent.productVariants = [{ id: 3, label: '4 ay', isDefault: true, isActive: true, isArchived: false, variantProductId: 31, variantProduct: mixedChild4 }];
mixedChild4.variantOfProducts = [{ parentProductId: 30, label: '4 ay', isDefault: true, isActive: true, isArchived: false, parentProduct: mixedParent }];
const db = [parent, child8, child4, standalone, discounted, wrongDuration, already, mixedParent, mixedChild4];
const productsBySlug = new Map(db.map((p) => [p.slug, p]));

const fakePlan = {
  categories: { oyun: { excludeTitle: 'çocuk', prices: { 4: { online: 79000, yuzyuze: 98750 }, 8: { online: 123750, yuzyuze: 186250 } } } },
  rows: [
    { category: 'oyun', months: 8, slug: 'p-online-1', title: 'Ana' },
    { category: 'oyun', months: 8, slug: 'p-online-8-ay-11', title: 'Cocuk 8' },
    { category: 'oyun', months: 4, slug: 'p-online-4-ay-12', title: 'Cocuk 4 pasif' },
    { category: 'oyun', months: 4, slug: 's-yuz-yuze-20', title: 'Tek' },
    { category: 'oyun', months: 4, slug: 'd-online-21', title: 'Indirimli' },
    { category: 'oyun', months: 4, slug: 'w-online-22', title: 'Sure yanlis' },
    { category: 'oyun', months: 4, slug: 'a-online-23', title: 'Zaten' },
    { category: 'oyun', months: 4, slug: 'yok-online-99', title: 'Yok' },
    { category: 'oyun', months: 8, slug: 'm-online-30', title: 'Ana default 4 ay' },
    { category: 'oyun', months: 8, slug: 'x-online-7', title: 'Çocuklar için' }
  ]
};
const entries = planPriceChanges(fakePlan, productsBySlug);
const byslug = Object.fromEntries(entries.map((e) => [e.slug, e]));
// Ana kurs (default 8 ay uyumlu): ana + default cocuk fiyati -> 123750 (admin: parent.price = default variant)
assert.equal(byslug['p-online-1'].action, 'UPDATE');
assert.deepEqual(byslug['p-online-1'].changes.map((c) => [c.productId, c.after.price]), [[11, '123750.00'], [10, '123750.00']]);
// Cocuk (default) satiri ayni hedefi verir -> tekrar degil, ayni degisiklik (dedupe)
assert.equal(byslug['p-online-8-ay-11'].action, 'UPDATE');
assert.deepEqual(byslug['p-online-8-ay-11'].changes.map((c) => c.productId).sort(), [10, 11]);
// Pasif 4 ay cocuk: yalnizca cocuk guncellenir, ana kursa dokunulmaz
assert.equal(byslug['p-online-4-ay-12'].action, 'UPDATE');
assert.deepEqual(byslug['p-online-4-ay-12'].changes.map((c) => [c.productId, c.after.price]), [[12, '79000.00']]);
// Standalone
assert.deepEqual(byslug['s-yuz-yuze-20'].changes[0].after, { price: '98750.00', discountPrice: null });
// Indirimli: discountPrice admin formuluyle yeniden hesaplanir
assert.deepEqual(byslug['d-online-21'].changes[0].after, { price: '79000.00', discountPrice: '71100.00' });
// Sure uyusmazligi -> MANUAL
assert.equal(byslug['w-online-22'].action, 'MANUAL');
assert.match(byslug['w-online-22'].reason, /süre/);
// Zaten hedefte -> SKIP
assert.equal(byslug['a-online-23'].action, 'SKIP');
assert.match(byslug['a-online-23'].reason, /zaten/i);
// Bulunamadi -> MANUAL
assert.equal(byslug['yok-online-99'].action, 'MANUAL');
assert.match(byslug['yok-online-99'].reason, /bulunamadı/);
// Ana kursun default varianti Excel suresinden farkli -> MANUAL (Mimar karari)
assert.equal(byslug['m-online-30'].action, 'MANUAL');
assert.match(byslug['m-online-30'].reason, /varyant/);
// Istisna -> SKIP
assert.equal(byslug['x-online-7'].action, 'SKIP');
assert.match(byslug['x-online-7'].reason, /istisna/i);
// Tek urun ikinci kez farkli fiyatla hedeflenirse catisma -> her iki satir MANUAL
const conflictEntries = planPriceChanges({
  categories: fakePlan.categories,
  rows: [
    { category: 'oyun', months: 8, slug: 'p-online-1', title: 'Ana' },
    { category: 'oyun', months: 8, slug: 'p-online-8-ay-11', title: 'Ayni cocuk farkli rejim', mode: 'yuzyuze' }
  ]
}, productsBySlug);
assert.ok(conflictEntries.every((e) => e.action === 'MANUAL'), JSON.stringify(conflictEntries.map((e) => [e.slug, e.action, e.reason])));

// 6) Ozet + uygulama (sahte prisma, transaction) + idempotentlik
const summary = summarizePlan(entries);
assert.equal(summary.UPDATE, 5);
assert.equal(summary.SKIP, 2);
assert.equal(summary.MANUAL, 3);
assert.equal(summary.writes, 5, 'benzersiz urun yazimi: 10, 11, 12, 20, 21');

(async () => {
  const updates = [];
  const fakePrisma = {
    async $transaction(fn) { return fn({ product: { async update(args) { updates.push(args); return {}; } } }); }
  };
  const result = await applyPriceChanges(fakePrisma, entries);
  assert.equal(result.written, 5);
  assert.deepEqual(updates.find((u) => u.where.id === 21).data, { price: '79000.00', discountPrice: '71100.00' });
  assert.deepEqual(updates.find((u) => u.where.id === 10).data, { price: '123750.00', discountPrice: null });
  assert.ok(updates.every((u) => Object.keys(u.data).sort().join() === 'discountPrice,price'), 'yalnizca fiyat alanlari yazilir');

  // Ikinci calistirma (fiyatlar guncellenmis gibi): 0 yazim
  updates.forEach((u) => { const p = db.find((x) => x.id === u.where.id); Object.assign(p, u.data); });
  const second = planPriceChanges(fakePlan, productsBySlug);
  assert.equal(summarizePlan(second).writes, 0);

  // 7) Script sozlesmesi
  const script = fs.readFileSync(path.join(root, 'scripts/update-course-prices.js'), 'utf8');
  assert.match(script, /--apply/);
  assert.match(script, /--revert/);
  assert.match(script, /pg_dump/);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts['prices:plan'], 'node scripts/update-course-prices.js --plan');
  assert.equal(pkg.scripts['prices:apply'], 'node scripts/update-course-prices.js --apply --plan');

  console.log('course price update OK');
})().catch((error) => { console.error(error); process.exit(1); });
