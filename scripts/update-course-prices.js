#!/usr/bin/env node

// Toplu kurs fiyat guncellemesi.
//   node scripts/update-course-prices.js --plan scripts/data/<plan>.json              # dry-run (yazmaz)
//   node scripts/update-course-prices.js --apply --plan <plan> [--report <dosya.json>] # uygular + dogrular
//   node scripts/update-course-prices.js --revert <report.json>                       # rapordaki "before" degerlerine dondurur
// Production'da yalnizca Mimar calistirir; --apply oncesi pg_dump yedegi zorunludur.

require('dotenv').config();

const fs = require('fs');
const path = require('path');

const prisma = require('../src/db');
const {
  ACTIONS,
  applyPriceChanges,
  planPriceChanges,
  summarizePlan,
  uniqueWrites
} = require('../src/services/course-price-update');

const PRODUCT_SELECT = {
  id: true, slug: true, title: true, status: true, duration: true, price: true,
  discountType: true, discountValue: true, discountPrice: true,
  productVariants: {
    select: {
      id: true, label: true, isDefault: true, isActive: true, isArchived: true, variantProductId: true,
      variantProduct: { select: { id: true, slug: true, duration: true, price: true, discountType: true, discountValue: true, discountPrice: true } }
    },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }]
  },
  variantOfProducts: {
    select: {
      parentProductId: true, label: true, isDefault: true, isActive: true, isArchived: true,
      parentProduct: { select: { id: true, slug: true, duration: true, price: true, discountType: true, discountValue: true, discountPrice: true } }
    },
    orderBy: { id: 'asc' },
    take: 1
  }
};

function argValue(flag) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? null : process.argv[index + 1];
}

function money(value) {
  return value == null ? '-' : Number(value).toLocaleString('tr-TR');
}

async function loadProducts(slugs) {
  const products = await prisma.product.findMany({ where: { slug: { in: slugs } }, select: PRODUCT_SELECT });
  return new Map(products.map((product) => [product.slug, product]));
}

function printEntries(entries) {
  let currentCategory = null;
  entries.forEach((entry) => {
    if (entry.category !== currentCategory) {
      currentCategory = entry.category;
      console.log(`\n=== ${currentCategory} ===`);
    }
    const head = `${entry.action.padEnd(6)} ${String(entry.months).padStart(2)} ay  ${entry.slug}`;
    if (entry.action === ACTIONS.UPDATE) {
      entry.changes.forEach((change) => {
        console.log(`${head}\n         ${change.slug}: ${money(change.before.price)} → ${money(change.after.price)}`);
      });
    } else {
      console.log(`${head}\n         ${entry.reason}`);
    }
  });
}

async function verifyWrites(writes) {
  const ids = writes.map((write) => write.productId);
  const rows = await prisma.product.findMany({ where: { id: { in: ids } }, select: { id: true, slug: true, price: true, discountPrice: true } });
  const byId = new Map(rows.map((row) => [row.id, row]));
  let mismatches = 0;
  writes.forEach((write) => {
    const row = byId.get(write.productId);
    const ok = row && Number(row.price).toFixed(2) === write.after.price
      && ((row.discountPrice == null && write.after.discountPrice == null)
        || (row.discountPrice != null && Number(row.discountPrice).toFixed(2) === write.after.discountPrice));
    if (!ok) mismatches += 1;
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${write.slug}: DB ${money(row && row.price)} (hedef ${money(write.after.price)})`);
  });
  return mismatches;
}

async function runPlan(planPath, apply, reportPath) {
  const plan = JSON.parse(fs.readFileSync(path.resolve(planPath), 'utf8'));
  const productsBySlug = await loadProducts(plan.rows.map((row) => row.slug));
  const entries = planPriceChanges(plan, productsBySlug);
  const summary = summarizePlan(entries);

  console.log(`Plan: ${plan.name} (${plan.rows.length} satır) — ${apply ? 'UYGULAMA' : 'DRY-RUN (hiçbir şey yazılmaz)'}`);
  printEntries(entries);
  console.log(`\nÖzet: UPDATE ${summary.UPDATE} · SKIP ${summary.SKIP} · MANUAL ${summary.MANUAL} · benzersiz ürün yazımı ${summary.writes}`);

  if (!apply) {
    console.log('\nUygulamak için: önce pg_dump yedeği alın, sonra --apply ile çalıştırın.');
    return 0;
  }

  const result = await applyPriceChanges(prisma, entries);
  console.log(`\n${result.written} ürün yazıldı (tek transaction). Doğrulama:`);
  const mismatches = await verifyWrites(result.writes);
  if (reportPath) {
    fs.writeFileSync(path.resolve(reportPath), JSON.stringify({
      plan: plan.name, appliedAt: new Date().toISOString(), writes: result.writes, entries
    }, null, 2));
    console.log(`Rapor yazıldı: ${reportPath} (--revert ile geri alınabilir)`);
  }
  console.log(mismatches === 0 ? '\nSONUÇ: tüm yazımlar doğrulandı.' : `\nSONUÇ: ${mismatches} uyuşmazlık! pg_dump yedeğini kontrol edin.`);
  return mismatches === 0 ? 0 : 1;
}

async function runRevert(reportPath) {
  const report = JSON.parse(fs.readFileSync(path.resolve(reportPath), 'utf8'));
  const writes = uniqueWrites(report.entries).map((change) => ({ ...change, after: change.before, before: change.after }));
  const entries = [{ action: ACTIONS.UPDATE, changes: writes }];
  console.log(`Geri alma: ${report.plan} (${writes.length} ürün, ${report.appliedAt} uygulamasının "before" değerleri)`);
  const result = await applyPriceChanges(prisma, entries);
  const mismatches = await verifyWrites(result.writes);
  console.log(mismatches === 0 ? 'SONUÇ: geri alma doğrulandı.' : `SONUÇ: ${mismatches} uyuşmazlık!`);
  return mismatches === 0 ? 0 : 1;
}

async function main() {
  const planPath = argValue('--plan');
  const revertPath = argValue('--revert');
  const apply = process.argv.includes('--apply');
  if (!planPath && !revertPath) {
    console.error('Kullanım: --plan <plan.json> [--apply] [--report <rapor.json>]  |  --revert <rapor.json>');
    return 2;
  }
  return revertPath ? runRevert(revertPath) : runPlan(planPath, apply, argValue('--report'));
}

main()
  .then((code) => prisma.$disconnect().then(() => process.exit(code)))
  .catch((error) => {
    console.error(error);
    prisma.$disconnect().finally(() => process.exit(1));
  });
