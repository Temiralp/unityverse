// Toplu kurs fiyat guncellemesi (plan dosyasi -> degisiklik listesi -> uygulama).
// Yazilan alanlar admin panelinin kurs formuyla birebir aynidir: Product.price ve
// Product.discountPrice (discountedVariantPrice formulu). Varyant gruplarinda admin gibi
// default varyantin fiyati ana kursun fiyati olur. Baska hicbir alan yazilmaz.
//
// Belirsiz durumlar (bulunamadi, rejim belirsiz, sure uyusmazligi, default varyant
// uyusmazligi, catisan hedefler) MANUAL olarak raporlanir ve dokunulmaz.

const { discountedVariantPrice } = require('./product-variants');

const ACTIONS = { UPDATE: 'UPDATE', SKIP: 'SKIP', MANUAL: 'MANUAL' };

function detectMode(row) {
  const haystack = `${row.slug || ''} ${row.title || ''}`.toLocaleLowerCase('tr-TR');
  const yuzyuze = /yuz-yuze|yüz yüze|yuz yuze/.test(haystack);
  const online = /online|canli|canlı/.test(haystack);
  if (yuzyuze && online) return null;
  if (yuzyuze) return 'yuzyuze';
  if (online) return 'online';
  return null;
}

function durationMonths(value) {
  const match = String(value || '').match(/^\s*(\d+)\s*ay\b/i);
  return match ? Number(match[1]) : null;
}

function isExcluded(row, category) {
  if (!category || !category.excludeTitle) return false;
  const needle = String(category.excludeTitle).toLocaleLowerCase('tr-TR');
  return String(row.title || '').toLocaleLowerCase('tr-TR').includes(needle);
}

function resolveTargetPrice(row, plan) {
  const category = plan.categories[row.category];
  if (!category) return { error: `Bilinmeyen kategori: ${row.category}` };
  if (isExcluded(row, category)) return { excluded: true, reason: `istisna: başlıkta "${category.excludeTitle}"` };

  // Plan satirinda acik "mode" varsa (Mimar karari) slug/baslik tahminine ustun gelir.
  const mode = row.mode === 'online' || row.mode === 'yuzyuze' ? row.mode : detectMode(row);
  if (!mode) return { error: 'rejim (online / yüz yüze) belirlenemedi — plan satırına "mode" ekleyin' };

  const bucket = category.prices[String(row.months)];
  if (!bucket || bucket[mode] == null) return { error: `${row.months} ay için fiyat kuralı yok` };
  return { price: Number(bucket[mode]), mode };
}

function money(value) {
  return Number(value).toFixed(2);
}

function priceChange(product, price) {
  const after = { price: money(price), discountPrice: discountedVariantPrice(product, price) };
  const before = {
    price: product.price == null ? null : money(product.price),
    discountPrice: product.discountPrice == null ? null : money(product.discountPrice)
  };
  return { productId: product.id, slug: product.slug, before, after };
}

function isSameChange(change) {
  return change.before.price === change.after.price && change.before.discountPrice === change.after.discountPrice;
}

function activeDefaultVariant(product) {
  return (product.productVariants || []).find((link) => link.isDefault && link.isActive && !link.isArchived) || null;
}

// Bir satir icin hangi urunlerin hangi fiyati alacagini belirler (admin davranisi).
function resolveChanges(row, product, price) {
  const link = (product.variantOfProducts || [])[0];
  if (link) {
    // Varyant cocugu: kendi fiyati; default varyantsa ana kursun fiyati da (admin: parent.price = default)
    const labelMonths = durationMonths(link.label) ?? durationMonths(product.duration);
    if (labelMonths !== row.months) {
      return { error: `süre uyuşmazlığı: DB "${link.label || product.duration}" ≠ Excel ${row.months} ay` };
    }
    const changes = [priceChange(product, price)];
    if (link.isDefault && link.isActive && !link.isArchived && link.parentProduct) {
      changes.push(priceChange(link.parentProduct, price));
    }
    return { changes };
  }

  const defaultVariant = activeDefaultVariant(product);
  if (defaultVariant) {
    // Ana kurs: Excel satiri sayfada gorunen (default) varyanti temsil eder
    const labelMonths = durationMonths(defaultVariant.label) ?? durationMonths(defaultVariant.variantProduct?.duration);
    if (labelMonths !== row.months) {
      return { error: `default varyant uyuşmazlığı: DB default "${defaultVariant.label}" ≠ Excel ${row.months} ay` };
    }
    return { changes: [priceChange(defaultVariant.variantProduct, price), priceChange(product, price)] };
  }

  const months = durationMonths(product.duration);
  if (months !== row.months) {
    return { error: `süre uyuşmazlığı: DB "${product.duration}" ≠ Excel ${row.months} ay` };
  }
  return { changes: [priceChange(product, price)] };
}

function planPriceChanges(plan, productsBySlug) {
  const entries = plan.rows.map((row) => {
    const base = { category: row.category, months: row.months, slug: row.slug, title: row.title, changes: [] };
    const target = resolveTargetPrice(row, plan);
    if (target.excluded) return { ...base, action: ACTIONS.SKIP, reason: target.reason };
    if (target.error) return { ...base, action: ACTIONS.MANUAL, reason: target.error };

    const product = productsBySlug.get(row.slug);
    if (!product) return { ...base, action: ACTIONS.MANUAL, reason: 'kurs DB’de bulunamadı (slug)', target: target.price, mode: target.mode };

    const resolved = resolveChanges(row, product, target.price);
    if (resolved.error) {
      return { ...base, action: ACTIONS.MANUAL, reason: resolved.error, target: target.price, mode: target.mode, kind: kindOf(product) };
    }
    const effective = resolved.changes.filter((change) => !isSameChange(change));
    return {
      ...base,
      action: effective.length ? ACTIONS.UPDATE : ACTIONS.SKIP,
      reason: effective.length ? '' : 'zaten hedef fiyatta',
      target: target.price,
      mode: target.mode,
      kind: kindOf(product),
      changes: effective
    };
  });

  return markConflicts(entries);
}

function kindOf(product) {
  if ((product.variantOfProducts || []).length) return 'child';
  if ((product.productVariants || []).length) return 'parent';
  return 'standalone';
}

// Ayni urun iki satirdan farkli fiyat alirsa her iki satir MANUAL olur.
function markConflicts(entries) {
  const targetsByProduct = new Map();
  entries.forEach((entry) => {
    if (entry.action !== ACTIONS.UPDATE) return;
    entry.changes.forEach((change) => {
      const seen = targetsByProduct.get(change.productId) || new Set();
      seen.add(change.after.price);
      targetsByProduct.set(change.productId, seen);
    });
  });

  return entries.map((entry) => {
    if (entry.action !== ACTIONS.UPDATE) return entry;
    const conflicting = entry.changes.find((change) => targetsByProduct.get(change.productId).size > 1);
    if (!conflicting) return entry;
    return {
      ...entry,
      action: ACTIONS.MANUAL,
      reason: `çatışma: ${conflicting.slug} başka bir satırdan farklı fiyat alıyor`,
      changes: []
    };
  });
}

// Benzersiz urun yazimlari (ayni urun birden fazla satirdan ayni fiyatla gelirse bir kez yazilir).
function uniqueWrites(entries) {
  const writes = new Map();
  entries.filter((entry) => entry.action === ACTIONS.UPDATE).forEach((entry) => {
    entry.changes.forEach((change) => {
      if (!writes.has(change.productId)) writes.set(change.productId, change);
    });
  });
  return [...writes.values()];
}

function summarizePlan(entries) {
  const summary = { UPDATE: 0, SKIP: 0, MANUAL: 0, writes: uniqueWrites(entries).length };
  entries.forEach((entry) => { summary[entry.action] += 1; });
  return summary;
}

async function applyPriceChanges(prismaClient, entries) {
  const writes = uniqueWrites(entries);
  await prismaClient.$transaction(async (tx) => {
    for (const change of writes) {
      await tx.product.update({
        where: { id: change.productId },
        data: { price: change.after.price, discountPrice: change.after.discountPrice }
      });
    }
  });
  return { written: writes.length, writes };
}

module.exports = {
  ACTIONS,
  applyPriceChanges,
  detectMode,
  durationMonths,
  planPriceChanges,
  resolveTargetPrice,
  summarizePlan,
  uniqueWrites
};
