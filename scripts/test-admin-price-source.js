const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');

const {
  parseCourseFile,
  productUpdateForImport
} = require('./migrate-courses');
const { serializeMemberPrices } = require('../src/routes/api');
const { buildFilterPayload } = require('../src/routes/legacy-filters');

const root = path.resolve(__dirname, '..');
const verifiedCourses = Object.freeze([
  {
    slug: 'grafik-tasarim-ve-video-efekt-uzmanligi-yuz-yuze-egitimi-1489',
    code: 'BN32',
    adminPrice: '49000.00',
    legacyPrice: '89000.00'
  },
  {
    slug: 'uiux-tasarim-egitimi-canli-online-egitimi-1514',
    code: '-8ay-4ay',
    adminPrice: '37560.00',
    legacyPrice: '61300.00'
  },
  {
    slug: 'cocuklar-icin-yazilim-uzmanligi-egitimi-canli-online-1587',
    code: 'DS5KIDSO',
    adminPrice: '16000.00',
    legacyPrice: '48000.00'
  },
  {
    slug: 'cocuklar-icin-unity-ile-oyun-gelistirme-canli-online-egitimi-1380',
    code: 'CS204',
    adminPrice: '20000.00',
    legacyPrice: '48000.00'
  },
  {
    slug: 'aranan-programci-olma-kampi-yuz-yuze-kursu-1498',
    code: 'ZE56-4ay',
    adminPrice: '56000.00',
    legacyPrice: '123750.00'
  },
  {
    slug: 'aranan-programci-olma-kampi-online-kursu-1501',
    code: 'DW12-4ay',
    adminPrice: '55000.00',
    legacyPrice: '86248.25'
  }
]);

function parseLegacyCourse(slug) {
  return parseCourseFile(path.join(root, 'urun', slug, 'index.html'));
}

verifiedCourses.forEach((expected) => {
  const course = parseLegacyCourse(expected.slug);
  assert.equal(course.code, expected.code, `${expected.slug} eğitim kodu`);
  assert.equal(course.price, expected.legacyPrice, `${expected.slug} statik fiyatı`);

  const updateData = productUpdateForImport({
    title: course.title,
    slug: course.slug,
    price: course.price,
    status: course.status
  }, '8 ay', course.duration);

  assert.equal(
    Object.prototype.hasOwnProperty.call(updateData, 'price'),
    false,
    `${expected.slug} importu admin fiyatına dokunmamalı`
  );
  assert.equal(updateData.title, course.title);
  assert.equal(updateData.status, course.status);
});

const memberPrices = serializeMemberPrices(verifiedCourses.map((course, index) => ({
  id: index + 1,
  slug: course.slug,
  price: course.adminPrice,
  discountPrice: index === 0 ? '45000.00' : null
})));

assert.equal(memberPrices.length, verifiedCourses.length);
verifiedCourses.forEach((course, index) => {
  assert.equal(memberPrices[index].slug, course.slug);
  assert.equal(memberPrices[index].price, course.adminPrice);
  assert.notEqual(memberPrices[index].price, course.legacyPrice);
});
assert.equal(memberPrices[0].discountPrice, '45000.00');

async function filterPriceTests() {
  const populatedPayload = await buildFilterPayload({
    product: {
      async findMany() {
        return verifiedCourses.map((course, index) => ({
          id: index + 1,
          slug: course.slug,
          title: course.slug,
          price: course.adminPrice,
          discountPrice: null,
          category: null
        }));
      }
    }
  });

  assert.equal(populatedPayload.total_product_count, verifiedCourses.length);
  assert.equal(
    populatedPayload.price_filters.reduce((total, bucket) => total + bucket.pcount, 0),
    verifiedCourses.length
  );

  const emptyPayload = await buildFilterPayload({
    product: {
      async findMany() {
        return [];
      }
    }
  });

  assert.deepEqual(
    emptyPayload.price_filters,
    [],
    'DB kursu yoxdursa statik qiymət filteri qaytarılmamalı'
  );
}

function frontendFallbackTests() {
  const source = fs.readFileSync(path.join(root, 'public/tema10/js/scripts.js'), 'utf8');

  assert.doesNotMatch(source, /legacyPriceHtmlFromSource/);
  assert.doesNotMatch(source, /renderLegacyListingFallbackPrices/);
  assert.doesNotMatch(source, /typeof window\.base_price/);
}

Promise.resolve()
  .then(filterPriceTests)
  .then(frontendFallbackTests)
  .then(() => {
    console.log('Admin/DB price source tests passed.');
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
