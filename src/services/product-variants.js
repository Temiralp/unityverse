class ProductVariantValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ProductVariantValidationError';
  }
}

function indexedRows(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return [];

  return Object.keys(value)
    .sort((left, right) => Number(left) - Number(right))
    .map((key) => value[key]);
}

function isTruthyFormValue(value) {
  return value === true
    || value === 'true'
    || value === '1'
    || value === 'on';
}

function normalizeProductVariantRows(value, defaultIndex) {
  const normalizedDefaultIndex = Number(defaultIndex);
  const seenProductIds = new Set();
  const rows = [];

  indexedRows(value).forEach((row, index) => {
    const variantProductId = Number(row && row.variantProductId);
    if (!Number.isInteger(variantProductId) || variantProductId <= 0) return;
    if (seenProductIds.has(variantProductId)) {
      throw new ProductVariantValidationError('Aynı kurs seçeneği birden fazla kez eklenemez.');
    }

    seenProductIds.add(variantProductId);
    rows.push({
      variantProductId,
      label: String(row.label || '').trim() || null,
      sortOrder: Number.isFinite(Number(row.sortOrder)) ? Number(row.sortOrder) : index,
      isDefault: index === normalizedDefaultIndex,
      isActive: row.isActivePresent
        ? isTruthyFormValue(row.isActive)
        : row.isActive === undefined || isTruthyFormValue(row.isActive)
    });
  });

  const activeRows = rows.filter((row) => row.isActive);
  if (activeRows.length && !activeRows.some((row) => row.isDefault)) {
    rows.forEach((row) => {
      row.isDefault = row === activeRows[0];
    });
  } else if (!activeRows.length) {
    rows.forEach((row) => {
      row.isDefault = false;
    });
  }

  return rows;
}

async function replaceProductVariants(tx, parentProductId, value, defaultIndex) {
  const rows = normalizeProductVariantRows(value, defaultIndex);

  if (rows.some((row) => row.variantProductId === parentProductId)) {
    throw new ProductVariantValidationError('Ana kurs kendi eğitim seçeneği olarak bağlanamaz.');
  }

  if (rows.length) {
    const variantProductIds = rows.map((row) => row.variantProductId);
    const [existingProducts, conflictingLinks] = await Promise.all([
      tx.product.findMany({
        where: { id: { in: variantProductIds } },
        select: { id: true }
      }),
      tx.productVariant.findMany({
        where: {
          variantProductId: { in: variantProductIds },
          parentProductId: { not: parentProductId }
        },
        select: { variantProductId: true }
      })
    ]);

    if (existingProducts.length !== rows.length) {
      throw new ProductVariantValidationError('Seçilen eğitim seçeneklerinden biri artık mevcut değil.');
    }

    if (conflictingLinks.length) {
      throw new ProductVariantValidationError('Bir kurs yalnızca bir ana kursun eğitim seçeneği olabilir.');
    }
  }

  await tx.productVariant.deleteMany({ where: { parentProductId } });

  if (rows.length) {
    await tx.productVariant.createMany({
      data: rows.map((row) => ({
        parentProductId,
        ...row
      }))
    });
  }

  return rows;
}

function productVariantLabel(variant) {
  return String(
    variant.label
      || (variant.variantProduct && variant.variantProduct.duration)
      || ''
  ).trim();
}

module.exports = {
  ProductVariantValidationError,
  normalizeProductVariantRows,
  productVariantLabel,
  replaceProductVariants
};
