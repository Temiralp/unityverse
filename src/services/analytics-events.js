// GA4 e-ticaret olaylari: odeme sonuc sayfasi icin "purchase" payload'i sunucuda hesaplanir.
// Yalnizca basarili KART odemesinde (havale degil) ve tutar > 0 ise uretilir; aksi halde null.
// Sema: GA4 onerilen "purchase" olayi (currency, value, transaction_id, items[item_id|item_name], coupon).

const CURRENCY = 'TRY';

function amountToNumber(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? Number(amount.toFixed(2)) : null;
}

function purchaseItem(registration) {
  const item = {};
  const slug = registration.product && registration.product.slug ? String(registration.product.slug) : '';
  const name = registration.courseTitle ? String(registration.courseTitle) : '';
  if (slug) item.item_id = slug;
  if (name) item.item_name = name;
  return item.item_id || item.item_name ? item : null;
}

function buildPurchaseEvent({ type, resultMethod, registration } = {}) {
  if (type !== 'success' || resultMethod === 'bank' || !registration) return null;

  const value = amountToNumber(registration.totalAmount);
  const item = purchaseItem(registration);
  if (value == null || !item) return null;

  const event = {
    transaction_id: String(registration.id),
    value,
    currency: CURRENCY,
    items: [item]
  };
  if (registration.couponCode) event.coupon = String(registration.couponCode);
  return event;
}

// <script type="application/json"> icine gomulecek JSON: "<" kacislanir, boylece "</script>"
// dizisi belgeyi kiramaz (JSON.parse icin degismezdir).
function serializeForScript(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

module.exports = { buildPurchaseEvent, serializeForScript };
