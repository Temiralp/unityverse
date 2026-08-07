require('dotenv').config();

const { PrismaClient } = require('@prisma/client');

const BASE_URL = process.env.CATALOG_SYNC_TEST_BASE_URL || 'http://localhost:8010';
const prisma = new PrismaClient();

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function fetchText(path) {
  const response = await fetch(`${BASE_URL}${path}`);
  const body = await response.text();
  return { response, body };
}

async function main() {
  const unique = `catalog-sync-smoke-${Date.now()}`;
  const title = `Catalog Sync Smoke ${unique}`;
  let productId = null;

  try {
    console.log(`Test serveri: ${BASE_URL}`);
    console.log('1. Geçici PUBLISHED kurs oluşturulur...');

    const product = await prisma.product.create({
      data: {
        title,
        slug: unique,
        summary: 'Admin catalog sync smoke test course.',
        price: '100.00',
        status: 'PUBLISHED',
        sortOrder: -999999
      }
    });
    productId = product.id;

    console.log('2. /tum-urunler arama sonucunda kurs görünür mü yoxlanılır...');
    const listPublished = await fetchText(`/tum-urunler/?q=${encodeURIComponent(unique)}`);
    assert(listPublished.response.status === 200, `/tum-urunler HTTP ${listPublished.response.status}`);
    assert(listPublished.body.includes('uv-product-card-item'), 'Köhnə ürün kartı markup-u /tum-urunler içinde bulunamadı.');
    assert(listPublished.body.includes(title), 'PUBLISHED kurs köhnə /tum-urunler kart listesinde görünmedi.');

    console.log('3. /urun/:slug detay sayfası açılır mı yoxlanılır...');
    const detailPublished = await fetchText(`/urun/${unique}/`);
    assert(detailPublished.response.status === 200, `/urun/:slug HTTP ${detailPublished.response.status}`);
    assert(detailPublished.body.includes(title), 'PUBLISHED kurs detay sayfasında görünmedi.');
    assert(detailPublished.body.includes('product-view row'), 'Köhnə ürün detay product-view markup-u bulunamadı.');
    assert(detailPublished.body.includes('uv-product-detail-buy-box'), 'Köhnə ürün detay kayıt kutusu markup-u bulunamadı.');
    assert(detailPublished.body.includes('producttab col-xs-12'), 'Köhnə ürün detay tab markup-u bulunamadı.');
    assert(detailPublished.body.includes('list-filter size-filter font-small'), 'Köhnə eğitim saatleri seçenek listesi markup-u bulunamadı.');
    assert(detailPublished.body.includes(`id="poptions1_${productId}"`), 'Eğitim saatleri seçenek listesi ürün id-si ile render edilmedi.');
    assert(detailPublished.body.includes('Bizi Takip Edin'), 'Ana sayfa footer sosyal başlığı detay sayfasında bulunamadı.');
    assert(detailPublished.body.includes('Bizimle Çalışmak İster Misiniz?'), 'Ana sayfa footer kariyer linki detay sayfasında bulunamadı.');
    assert(!detailPublished.body.includes('Qiyməti'), 'Detay sayfasında Türkçe olmayan fiyat metni bulunmamalı.');
    assert(!detailPublished.body.includes('görmək'), 'Detay sayfasında Türkçe olmayan görünür metin bulunmamalı.');
    assert(!detailPublished.body.includes('uv-product-detail'), 'Yeni frontend ürün detay markup-u legacy sayfada görünmemeli.');

    console.log('4. Kurs DRAFT yapılır...');
    await prisma.product.update({
      where: { id: productId },
      data: { status: 'DRAFT' }
    });

    console.log('5. DRAFT kurs listing/detail tarafında gizlenir mi yoxlanılır...');
    const listDraft = await fetchText(`/tum-urunler/?q=${encodeURIComponent(unique)}`);
    assert(listDraft.response.status === 200, `/tum-urunler draft HTTP ${listDraft.response.status}`);
    assert(!listDraft.body.includes(title), 'DRAFT kurs /tum-urunler içinde görünmeye devam ediyor.');

    const detailDraft = await fetchText(`/urun/${unique}/`);
    assert(detailDraft.response.status === 404, `/urun/:slug draft HTTP ${detailDraft.response.status}; 404 bekleniyordu.`);

    console.log('\nSonuç: admin ürün yayına alma/taslağa çekme davranışı public eğitim sayfalarına doğru yansıyor.');
  } finally {
    if (productId) {
      await prisma.product.delete({ where: { id: productId } }).catch(() => {});
      console.log('Temizlik: geçici test kursu silindi.');
    }

    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error(`\nTest başarısız: ${error.message}`);
  await prisma.$disconnect().catch(() => {});
  process.exitCode = 1;
});
