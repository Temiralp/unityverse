class ProductVariantValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ProductVariantValidationError';
  }
}

const MAX_VARIANT_LABEL_LENGTH = 80;
const MAX_PRODUCT_PRICE = 99999999.99;

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

function positiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function normalizeVariantLabel(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeVariantPrice(value) {
  const text = String(value == null ? '' : value).trim().replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return null;

  const number = Number(text);
  if (!Number.isFinite(number) || number <= 0 || number > MAX_PRODUCT_PRICE) return null;
  return number.toFixed(2);
}

function normalizeVariantStatus(value) {
  return value === 'DRAFT' ? 'DRAFT' : 'PUBLISHED';
}

function normalizeProductVariantRows(value, defaultIndex, options = {}) {
  const normalizedDefaultIndex = Number(defaultIndex);
  const seenProductIds = new Set();
  const seenVariantIds = new Set();
  const seenLabels = new Set();
  const rows = [];

  indexedRows(value).forEach((row, index) => {
    const variantId = positiveInteger(row && row.id);
    const variantProductId = positiveInteger(row && row.variantProductId);
    const label = normalizeVariantLabel(row && row.label);
    const price = normalizeVariantPrice(row && row.price);
    const hasInput = Boolean(
      variantId
      || variantProductId
      || label
      || String(row && row.price || '').trim()
    );

    if (!hasInput) return;
    if (options.requireManagedFields && !label) {
      throw new ProductVariantValidationError('Her eğitim süresi için süre alanı zorunludur.');
    }
    if (label.length > MAX_VARIANT_LABEL_LENGTH) {
      throw new ProductVariantValidationError(`Eğitim süresi en fazla ${MAX_VARIANT_LABEL_LENGTH} karakter olabilir.`);
    }
    if (options.requireManagedFields && price === null) {
      throw new ProductVariantValidationError('Her eğitim süresi için sıfırdan büyük geçerli bir fiyat girilmelidir.');
    }
    if (!variantProductId && !options.allowNewProducts) return;
    if (variantId && seenVariantIds.has(variantId)) {
      throw new ProductVariantValidationError('Aynı eğitim süresi satırı birden fazla kez gönderilemez.');
    }
    if (variantProductId && seenProductIds.has(variantProductId)) {
      throw new ProductVariantValidationError('Aynı kurs seçeneği birden fazla kez eklenemez.');
    }

    const labelKey = label.toLocaleLowerCase('tr-TR');
    if (options.requireManagedFields && seenLabels.has(labelKey)) {
      throw new ProductVariantValidationError('Aynı eğitim süresi birden fazla kez eklenemez.');
    }

    if (variantId) seenVariantIds.add(variantId);
    if (variantProductId) seenProductIds.add(variantProductId);
    if (labelKey) seenLabels.add(labelKey);
    const normalizedRow = {
      variantProductId,
      label: label || null,
      sortOrder: Number.isFinite(Number(row.sortOrder)) ? Number(row.sortOrder) : index,
      isDefault: index === normalizedDefaultIndex,
      isActive: row.isActivePresent
        ? isTruthyFormValue(row.isActive)
        : row.isActive === undefined || isTruthyFormValue(row.isActive)
    };
    if (options.requireManagedFields || options.allowNewProducts) {
      normalizedRow.id = variantId;
      normalizedRow.price = price;
      normalizedRow.status = normalizeVariantStatus(row && row.status);
      normalizedRow.isActive = normalizedRow.isActive && normalizedRow.status === 'PUBLISHED';
    }
    rows.push(normalizedRow);
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

function variantLabelKey(value) {
  return normalizeVariantLabel(value).toLocaleLowerCase('tr-TR');
}

function variantSlugPart(value) {
  return normalizeVariantLabel(value)
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'sure';
}

async function availableVariantSlug(tx, parent, label) {
  const parentSlug = String(parent.slug || `kurs-${parent.id}`).replace(/-+$/g, '');
  const base = `${parentSlug}-${variantSlugPart(label)}`.slice(0, 210).replace(/-+$/g, '');

  for (let suffix = 1; suffix <= 1000; suffix += 1) {
    const slug = suffix === 1 ? base : `${base}-${suffix}`;
    const existing = await tx.product.findUnique({ where: { slug }, select: { id: true } });
    if (!existing) return slug;
  }

  throw new ProductVariantValidationError('Eğitim süresi için benzersiz URL oluşturulamadı.');
}

function discountedVariantPrice(parent, price) {
  if (!parent.discountType || parent.discountValue == null) return null;

  const amount = Number(price);
  const discount = Number(parent.discountValue);
  if (!Number.isFinite(amount) || !Number.isFinite(discount)) return null;
  if (parent.discountType === 'PERCENT') {
    return (amount * (100 - discount) / 100).toFixed(2);
  }
  return Math.max(amount - discount, 0).toFixed(2);
}

async function createManagedVariantProduct(tx, parent, row) {
  const slug = await availableVariantSlug(tx, parent, row.label);
  return tx.product.create({
    data: {
      code: null,
      title: `${parent.title} — ${row.label}`,
      slug,
      summary: parent.summary,
      content: parent.content,
      image: parent.image,
      price: row.price,
      discountType: parent.discountType,
      discountValue: parent.discountValue,
      discountPrice: discountedVariantPrice(parent, row.price),
      vatRate: parent.vatRate,
      bankTransferDiscountRate: parent.bankTransferDiscountRate,
      duration: row.label,
      lessonType: parent.lessonType,
      certificate: parent.certificate,
      status: row.isActive ? 'PUBLISHED' : 'DRAFT',
      sortOrder: parent.sortOrder,
      categoryId: parent.categoryId
    },
    select: { id: true }
  });
}

async function setParentProductStatus(tx, parentProductId, value, options = {}) {
  const status = normalizeVariantStatus(value);

  if (status === 'DRAFT' && options.cascadeDraft === true) {
    const links = await tx.productVariant.findMany({
      where: { parentProductId, isArchived: false },
      select: { variantProductId: true }
    });

    if (links.length) {
      await tx.productVariant.updateMany({
        where: { parentProductId, isArchived: false },
        data: { isActive: false, isDefault: false }
      });

      for (const link of links) {
        await tx.product.update({
          where: { id: link.variantProductId },
          data: { status: 'DRAFT' }
        });
      }
    }
  }

  await tx.product.update({
    where: { id: parentProductId },
    data: { status }
  });
  return status;
}

async function productVariantParticipation(tx, productId) {
  return tx.productVariant.findFirst({
    where: {
      OR: [
        { parentProductId: productId },
        { variantProductId: productId }
      ]
    },
    select: { id: true, parentProductId: true, variantProductId: true }
  });
}

async function syncManagedProductVariants(tx, parentProductId, value, defaultIndex) {
  const rows = normalizeProductVariantRows(value, defaultIndex, {
    allowNewProducts: true,
    requireManagedFields: true
  });
  const parent = await tx.product.findUnique({ where: { id: parentProductId } });
  if (!parent) throw new ProductVariantValidationError('Ana kurs artık mevcut değil.');

  const existingLinks = await tx.productVariant.findMany({
    where: { parentProductId },
    include: { variantProduct: true },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }]
  });

  // A course that has never been a variant group remains a regular Product
  // while it has a single duration. Once it becomes a group, links are kept
  // (including disabled links) so old URLs and historical relations survive.
  if (!existingLinks.length && rows.length <= 1) {
    if (rows.length === 1) {
      await tx.product.update({
        where: { id: parentProductId },
        data: {
          duration: rows[0].label,
          price: rows[0].price,
          discountPrice: discountedVariantPrice(parent, rows[0].price)
        }
      });
    }
    return { rows, createdProductIds: [], mode: 'scalar' };
  }

  const byId = new Map(existingLinks.map((link) => [link.id, link]));
  const byProductId = new Map(existingLinks.map((link) => [link.variantProductId, link]));
  const byLabel = new Map();
  existingLinks.forEach((link) => {
    const key = variantLabelKey(link.label || link.variantProduct?.duration);
    if (!key) return;
    const matches = byLabel.get(key) || [];
    matches.push(link);
    byLabel.set(key, matches);
  });

  const submittedLinkIds = new Set();
  const submittedProductIds = new Set();
  const createdProductIds = [];

  // Clear defaults first to avoid the DB partial unique index being violated
  // while the selected default moves from one duration to another.
  await tx.productVariant.updateMany({
    where: { parentProductId },
    data: { isDefault: false }
  });

  for (const row of rows) {
    let link = row.id ? byId.get(row.id) : null;
    if (row.id && !link) {
      throw new ProductVariantValidationError('Gönderilen eğitim süresi bu ana kursa ait değil.');
    }
    if (link && row.variantProductId && link.variantProductId !== row.variantProductId) {
      throw new ProductVariantValidationError('Eğitim süresi ile bağlı kurs bilgisi eşleşmiyor.');
    }
    if (!link && row.variantProductId) link = byProductId.get(row.variantProductId) || null;

    // A removed/draft duration can be restored without creating a second child
    // or a second URL when its normalized label identifies one old link safely.
    if (!link && !row.variantProductId) {
      const labelMatches = (byLabel.get(variantLabelKey(row.label)) || [])
        .filter((candidate) => !submittedLinkIds.has(candidate.id));
      if (labelMatches.length === 1) link = labelMatches[0];
    }

    let variantProductId = link ? link.variantProductId : row.variantProductId;
    if (variantProductId === parentProductId) {
      throw new ProductVariantValidationError('Ana kurs kendi eğitim seçeneği olarak bağlanamaz.');
    }

    if (!variantProductId) {
      const createdProduct = await createManagedVariantProduct(tx, parent, row);
      variantProductId = createdProduct.id;
      createdProductIds.push(createdProduct.id);
    } else if (!link) {
      const [candidate, conflictingLink] = await Promise.all([
        tx.product.findUnique({ where: { id: variantProductId }, select: { id: true } }),
        tx.productVariant.findUnique({ where: { variantProductId } })
      ]);
      if (!candidate) {
        throw new ProductVariantValidationError('Seçilen eğitim seçeneği artık mevcut değil.');
      }
      if (conflictingLink) {
        throw new ProductVariantValidationError('Bir kurs yalnızca bir ana kursun eğitim seçeneği olabilir.');
      }
    }

    if (submittedProductIds.has(variantProductId)) {
      throw new ProductVariantValidationError('Aynı kurs seçeneği birden fazla kez eklenemez.');
    }
    submittedProductIds.add(variantProductId);

    await tx.product.update({
      where: { id: variantProductId },
      data: {
        duration: row.label,
        price: row.price,
        discountType: parent.discountType,
        discountValue: parent.discountValue,
        discountPrice: discountedVariantPrice(parent, row.price),
        vatRate: parent.vatRate,
        bankTransferDiscountRate: parent.bankTransferDiscountRate,
        status: row.isActive ? 'PUBLISHED' : 'DRAFT'
      }
    });

    const linkData = {
      label: row.label,
      sortOrder: row.sortOrder,
      isDefault: row.isActive && row.isDefault,
      isActive: row.isActive,
      isArchived: false
    };
    const savedLink = link
      ? await tx.productVariant.update({ where: { id: link.id }, data: linkData })
      : await tx.productVariant.create({
        data: { parentProductId, variantProductId, ...linkData }
      });
    submittedLinkIds.add(savedLink.id);
  }

  for (const link of existingLinks) {
    if (submittedLinkIds.has(link.id)) continue;
    await tx.productVariant.update({
      where: { id: link.id },
      data: { isActive: false, isDefault: false, isArchived: true }
    });
    await tx.product.update({
      where: { id: link.variantProductId },
      data: { status: 'DRAFT' }
    });
  }

  return { rows, createdProductIds, mode: 'variants' };
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

function publicProductVariants(variants) {
  return (Array.isArray(variants) ? variants : [])
    .filter((variant) => (
      variant
      && variant.isArchived !== true
      && variant.isActive !== false
      && variant.variantProduct
      && variant.variantProduct.status === 'PUBLISHED'
    ))
    .sort((left, right) => (
      Number(left.sortOrder || 0) - Number(right.sortOrder || 0)
      || Number(left.id || 0) - Number(right.id || 0)
    ));
}

module.exports = {
  MAX_PRODUCT_PRICE,
  MAX_VARIANT_LABEL_LENGTH,
  ProductVariantValidationError,
  normalizeProductVariantRows,
  normalizeVariantPrice,
  productVariantParticipation,
  productVariantLabel,
  publicProductVariants,
  replaceProductVariants,
  setParentProductStatus,
  syncManagedProductVariants
};
