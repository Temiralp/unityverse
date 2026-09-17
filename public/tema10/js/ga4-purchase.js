// GA4 "purchase" olayı — ödeme sonuç sayfası (Çember 13).
// Payload sunucuda hesaplanır ve <script type="application/json" data-ga4-purchase> içinde gelir.
// Aynı kayıt için sayfa yenilense bile olay bir kez gönderilir (localStorage anahtarı).
(function () {
  'use strict';

  var holder = document.querySelector('[data-ga4-purchase]');
  if (!holder) return;

  var measurementId = holder.getAttribute('data-measurement-id');
  var payload;
  try {
    payload = JSON.parse(holder.textContent || '');
  } catch (error) {
    return;
  }
  if (!measurementId || !payload || !payload.transaction_id) return;

  var guardKey = 'uv-ga4-purchase-' + payload.transaction_id;
  try {
    if (window.localStorage.getItem(guardKey)) return;
  } catch (error) {
    // localStorage kapalı olabilir; olay yine gönderilir
  }

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;

  var loader = document.createElement('script');
  loader.async = true;
  loader.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(measurementId);
  document.head.appendChild(loader);

  gtag('js', new Date());
  gtag('config', measurementId);
  gtag('event', 'purchase', payload);

  try {
    window.localStorage.setItem(guardKey, String(Date.now()));
  } catch (error) {
    // yok say
  }
}());
