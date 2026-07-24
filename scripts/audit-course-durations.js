#!/usr/bin/env node

const prisma = require('../src/db');
const {
  publicProductVariants,
  renderEducationOptions
} = require('../src/routes/legacy-product-detail');

async function main() {
  const products = await prisma.product.findMany({
    where: { status: 'PUBLISHED' },
    include: {
      productVariants: {
        include: { variantProduct: true },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }]
      }
    },
    orderBy: { id: 'asc' }
  });

  const missingDuration = products.filter((product) => !String(product.duration || '').trim());
  const invalidStoredPlaceholders = products.filter((product) => (
    String(product.duration || '').trim().toLocaleLowerCase('tr-TR') === 'eğitim'
  ));
  const invalidRenderedPlaceholders = products.filter((product) => (
    />\s*Eğitim\s*</u.test(renderEducationOptions(product, product.productVariants))
  ));
  const hiddenUnknownDurationBlocks = missingDuration.filter((product) => (
    !publicProductVariants(product.productVariants).some((variant) => (
      String(variant.label || variant.variantProduct.duration || '').trim()
    ))
    && renderEducationOptions(product, product.productVariants) === ''
  ));
  const target = products.find((product) => (
    product.slug === 'yazilim-uzmanligi-yuz-yuze-egitim-1473'
  ));
  const correctedConflict = products.find((product) => (
    product.slug === 'zbrush-ile-organik-modelleme-canli-online-ozel-ders-24-saat-1297'
  ));

  const result = {
    publishedCourses: products.length,
    withDuration: products.length - missingDuration.length,
    withoutTrustworthyDuration: missingDuration.length,
    invalidStoredPlaceholders: invalidStoredPlaceholders.length,
    invalidRenderedPlaceholders: invalidRenderedPlaceholders.length,
    hiddenUnknownDurationBlocks: hiddenUnknownDurationBlocks.length,
    targetCourse: target ? { slug: target.slug, duration: target.duration } : null,
    correctedConflict: correctedConflict
      ? { slug: correctedConflict.slug, duration: correctedConflict.duration }
      : null
  };

  console.log(JSON.stringify(result, null, 2));

  if (!target || target.duration !== '8 ay') {
    throw new Error('Target course duration is not 8 ay.');
  }
  if (!correctedConflict || correctedConflict.duration !== '24 saat') {
    throw new Error('Corrected ZBrush course duration is not 24 saat.');
  }
  if (invalidStoredPlaceholders.length || invalidRenderedPlaceholders.length) {
    throw new Error('Invalid Eğitim duration placeholder still exists.');
  }
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
