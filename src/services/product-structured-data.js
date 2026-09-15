// Kurs detay sayfasi icin schema.org Product JSON-LD'sini DB verisinden uretir.
// Sablondan (Python kursu) miras kalan blogun yerine yazilir; her istekte saf
// hesaplanir, sabit tarih/bellek durumu icermez.

const BRAND_NAME = 'Unityverse Academy';
// Yalnizca "@type": "Product" iceren ld+json blogunu yakalar; icinde </script> gecmez
// (tempered pattern), bu yuzden WebSite blogu ile birlesmez.
const PRODUCT_JSON_LD_PATTERN = /<script type="application\/ld\+json">(?:(?!<\/script>)[\s\S])*?"@type":\s*"Product"(?:(?!<\/script>)[\s\S])*<\/script>/;

function plainText(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function offerPrice(product) {
  const discountPrice = toNumber(product.discountPrice);
  const price = discountPrice > 0 ? discountPrice : toNumber(product.price);
  // Statik sayfalarla paritet: fiyat yoksa "0" (uyeye ozel fiyat politikasi).
  return price > 0 ? price.toFixed(2) : '0';
}

function productSku(product) {
  return product.code || `UV-${product.id}`;
}

function buildProductStructuredData(product, { canonicalUrl, imageUrl, description }) {
  return {
    '@context': 'https://schema.org/',
    '@type': 'Product',
    name: plainText(product.title),
    image: imageUrl,
    description: plainText(description),
    sku: productSku(product),
    brand: { '@type': 'Brand', name: BRAND_NAME },
    offers: {
      '@type': 'Offer',
      priceCurrency: 'TRY',
      price: offerPrice(product),
      priceValidUntil: `${new Date().getFullYear()}-12-31`,
      url: canonicalUrl,
      itemCondition: 'https://schema.org/NewCondition',
      availability: 'https://schema.org/InStock',
      seller: { '@type': 'Organization', name: BRAND_NAME }
    }
  };
}

// JSON icindeki "<" karakterleri kacislanir; boylece "</script>" dizisi HTML'i kiramaz.
function renderProductJsonLd(product, context) {
  const json = JSON.stringify(buildProductStructuredData(product, context), null, 2)
    .replace(/</g, '\\u003c');
  return `<script type="application/ld+json">\n${json}\n</script>`;
}

function replaceProductJsonLd(html, product, context) {
  const source = String(html || '');
  if (!PRODUCT_JSON_LD_PATTERN.test(source)) return source;
  return source.replace(PRODUCT_JSON_LD_PATTERN, () => renderProductJsonLd(product, context));
}

module.exports = {
  buildProductStructuredData,
  plainText,
  renderProductJsonLd,
  replaceProductJsonLd
};
