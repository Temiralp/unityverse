const fs = require('fs/promises');
const path = require('path');

const ejs = require('ejs');

const rootDir = path.resolve(__dirname, '..');

async function renderStaticCartPage() {
  const pagePath = path.join(rootDir, 'uye/sepet/index.html');
  const header = await ejs.renderFile(path.join(rootDir, 'src/views/partials/header.ejs'), {
    pageTitle: 'Sepetim | Unityverse Academy',
    activeNav: '',
    extraStyles: ['/public/tema10/css/cart.css?v=20260623-2']
  });
  const footer = await ejs.renderFile(path.join(rootDir, 'src/views/partials/footer.ejs'), {
    extraScripts: [
      '/public/tema10/js/jquery-2.2.4.min.js',
      '/public/tema10/js/notify.min.js',
      '/public/tema10/js/cart-static.js?v=20260623-2'
    ]
  });

  const rendered = [
    header.replace('<body>', '<body class="uv-cart-page">'),
    '<main id="main-content">',
    '  <section class="uv-cart-hero" aria-labelledby="cart-title">',
    '    <div class="uv-shell">',
    '      <nav class="uv-cart-breadcrumb" aria-label="Sayfa yolu">',
    '        <a href="/">Ana Sayfa</a>',
    '        <span aria-hidden="true">/</span>',
    '        <span>Sepet</span>',
    '      </nav>',
    '      <h1 id="cart-title">Sepetim</h1>',
    '      <p>Seçtiğiniz eğitimleri kontrol edin, adetleri düzenleyin ve ödeme adımına geçin.</p>',
    '    </div>',
    '  </section>',
    '  <section class="uv-cart-section" aria-label="Alışveriş sepeti">',
    '    <div class="uv-shell">',
    '      <section class="uv-cart-empty" id="basket_null" aria-live="polite">',
    '        <span class="uv-cart-empty__icon" aria-hidden="true"><i class="fa fa-shopping-cart"></i></span>',
    '        <h2>Sepetiniz boş</h2>',
    '        <p>Sepetinizde kurs bulunmamaktadır. Size uygun eğitimleri inceleyerek sepetinize ekleyebilirsiniz.</p>',
    '        <a class="btn-primary" href="/tum-urunler/">Eğitimleri Keşfet</a>',
    '      </section>',
    '      <div class="uv-cart-layout">',
    '        <section class="uv-cart-items" aria-labelledby="cart-items-title">',
    '          <div class="section-title">',
    '            <p class="section-title__eyebrow">Alışveriş Listesi</p>',
    '            <h2 id="cart-items-title">Sepetteki Eğitimler</h2>',
    '          </div>',
    '          <div class="uv-cart-products" id="basket_products"></div>',
    '        </section>',
    '        <aside class="uv-cart-summary" id="basket_full" aria-labelledby="cart-summary-title">',
    '          <div class="uv-cart-summary__sticky">',
    '            <h2 id="cart-summary-title">Sipariş Özeti</h2>',
    '            <div class="siparis_ozeti" id="basket_prices"></div>',
    '            <a class="btn-primary uv-cart-checkout go_to_invoice_btn next_step_btn" onclick="return goToInvoice()" href="#!">Ödemeye Geç</a>',
    '          </div>',
    '        </aside>',
    '      </div>',
    '      <p class="uv-cart-status" role="status" aria-live="polite" data-cart-status></p>',
    '      <div id="lastviewedproducts" class="uv-cart-last-viewed"></div>',
    '    </div>',
    '  </section>',
    '</main>',
    '<div id="site_locked" aria-hidden="true"></div>',
    '<div class="uv-cart-modal" id="campaign_popup" role="dialog" aria-modal="true" aria-labelledby="campaign_topic" aria-hidden="true">',
    '  <div class="uv-cart-modal__panel">',
    '    <div class="uv-cart-modal__header">',
    '      <div>',
    '        <h2 id="campaign_topic"></h2>',
    '        <p id="campaign_text"></p>',
    '      </div>',
    '      <button class="uv-cart-modal__close" type="button" aria-label="Kapat" data-cart-modal-close>&times;</button>',
    '    </div>',
    '    <div id="campain_products"></div>',
    '  </div>',
    '</div>',
    '<script>',
    '  window.site_url = "/";',
    '  window.min_order_amount = parseFloat("");',
    '  window.total_price = parseFloat("0");',
    '  window.has_must_be_delete_items = "";',
    '  window.uvCartAjaxEnabled = false;',
    '</script>',
    footer
  ].join('\n');

  await fs.writeFile(pagePath, rendered, 'utf8');
  console.log(`Rendered ${pagePath}`);
}

renderStaticCartPage().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
