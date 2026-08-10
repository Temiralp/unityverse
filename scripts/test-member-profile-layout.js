const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const ejs = require('ejs');
const cheerio = require('cheerio');

const root = path.resolve(__dirname, '..');
const viewPath = path.join(root, 'src/views/members/profile.ejs');
const paymentViewPath = path.join(root, 'src/views/payments/iframe.ejs');
const paymentResultViewPath = path.join(root, 'src/views/payments/result.ejs');
const headerPath = path.join(root, 'src/views/partials/header.ejs');
const serverSource = fs.readFileSync(path.join(root, 'src/server.js'), 'utf8');
const profileCss = fs.readFileSync(
  path.join(root, 'public/tema10/css/member-profile.css'),
  'utf8'
);
const navbarCss = fs.readFileSync(
  path.join(root, 'public/tema10/css/homepage-navbar.css'),
  'utf8'
);
const sharedLayoutCss = fs.readFileSync(
  path.join(root, 'public/tema10/css/payment.css'),
  'utf8'
);

async function run() {
  const html = await ejs.renderFile(viewPath, {
    pageTitle: 'Profilim | Unityverse Academy',
    noindex: true,
    bodyClass: 'member-profile-page',
    cspNonce: 'test-nonce',
    extraStyles: [
      '/public/tema10/css/payment.css',
      '/public/tema10/css/member-profile.css?v=20260810-2'
    ],
    extraScripts: ['/public/tema10/js/member-profile.js']
  });
  const defaultLegacyHeaderHtml = await ejs.renderFile(headerPath, {
    pageTitle: 'Test',
    cspNonce: 'test-nonce',
    useLegacyPaymentHeader: true
  });
  const paymentHtml = await ejs.renderFile(paymentViewPath, {
    pageTitle: 'Güvenli Ödeme | Test Eğitimi',
    cspNonce: 'test-nonce',
    extraStyles: ['/public/tema10/css/payment.css'],
    extraScripts: ['/public/tema10/js/payment.js'],
    registration: { id: 42, courseTitle: 'Test Eğitimi' },
    formattedAmount: '1.000,00',
    installmentWhatsappUrl: 'https://example.com/whatsapp',
    bankTransfer: {
      amount: '900,00',
      originalAmount: '1.000,00',
      discountRate: '10.00',
      accountName: 'Test Hesabı',
      bankName: 'Test Bankası',
      branch: 'Test Şubesi',
      accountNo: '12345',
      iban: 'TR000000000000000000000000',
      reference: 'Kayıt #42'
    },
    selectedPaymentMethod: 'card',
    paymentOptions: { installmentsEnabled: false, maxInstallment: '0' },
    iframeUrl: 'https://www.paytr.com/odeme/guvenli/test-token',
    cardPaymentError: null,
    appliedCoupon: null,
    csrfToken: 'test-csrf-token'
  });
  const paymentResultHtml = await ejs.renderFile(paymentResultViewPath, {
    pageTitle: 'Ödeme Sonucu',
    cspNonce: 'test-nonce',
    extraStyles: ['/public/tema10/css/payment.css'],
    type: 'success',
    eyebrow: 'Ödeme sonucu',
    title: 'İşleminiz alındı',
    message: 'Test sonucu',
    resultMethod: 'card',
    registration: null,
    paymentUrl: null,
    courseUrl: '/tum-urunler/'
  });
  const $ = cheerio.load(html);
  const $payment = cheerio.load(paymentHtml);
  const $paymentResult = cheerio.load(paymentResultHtml);

  assert.match(html, /<body class="member-profile-page">/);
  assert.match(html, /<meta name="robots" content="noindex">/);
  assert.match(html, /class="uv-payment-legacy-header"/);
  assert.match(html, /class="uv-payment-legacy-footer"/);
  assert.equal($('.uv-payment-legacy-header > .member-home-navbar').length, 1);
  assert.equal($('.uv-payment-legacy-header > .uv-payment-legacy-header__nav').length, 0);
  assert.doesNotMatch(html, /class="uv-payment-legacy-header__profile"/);
  assert.match(html, /class="member-profile-home" href="\/">Ana Sayfaya Dön<\/a>/);
  assert.match(html, /class="member-profile-logout"[^>]*data-member-logout>Çıkış Yap<\/button>/);
  assert.equal((html.match(/data-member-logout/g) || []).length, 1);
  assert.equal($('.uv-payment-legacy-header__top-inner > .member-profile-nav').length, 1);
  assert.equal($('.uv-payment-legacy-header__brand-inner .member-profile-nav').length, 0);
  assert.match(defaultLegacyHeaderHtml, /class="uv-payment-legacy-header__profile"/);
  assert.doesNotMatch(defaultLegacyHeaderHtml, /class="member-profile-nav"/);
  assert.doesNotMatch(defaultLegacyHeaderHtml, /class="header-bottom member-home-navbar"/);
  assert.match(defaultLegacyHeaderHtml, /class="uv-payment-legacy-header__nav"/);
  assert.equal($('.uv-payment-legacy-header--responsive-payment').length, 0);
  assert.equal($('[data-navbar-toggle]').length, 0);

  const profileNavbarLabels = $('.member-home-navbar__links a')
    .map((index, element) => $(element).text().trim())
    .get();
  assert.deepEqual(profileNavbarLabels, [
    'Eğitimlerimiz',
    'Kurumsal Eğitimler',
    'Hakkımızda',
    'Eğitmenler',
    'Bilgi/Randevu Al',
    'İletişim',
    'Blog',
    'Yazılım Çözümleri'
  ]);
  assert.equal($('.member-home-navbar__courses-dropdown').attr('open'), undefined);
  assert.equal($('.member-home-navbar__courses-link').prop('tagName'), 'SUMMARY');
  assert.equal($('.member-home-navbar__courses-link span').text().trim(), 'Tüm Kurslarımız');
  assert.deepEqual(
    $('.member-home-navbar__courses-menu a').map((index, element) => $(element).text().trim()).get(),
    [
      'Oyun Geliştirme Eğitimleri',
      'Yazılım Eğitimleri',
      'Grafik - Tasarım Eğitimleri',
      '3D Modelleme Eğitimleri',
      'Animasyon Eğitimleri',
      'Ses Tasarım Eğitimleri',
      'Senaryo, Sinema ve Yönetmenlik Eğitimleri',
      'Endüstriyel Ürün Tasarım Eğitimleri',
      'Dil Eğitimleri',
      'Dijital Pazarlama Eğitimleri',
      'Özel Dersler',
      'Muhasebe ve Ofis Eğitimleri',
      'Mimarlık Eğitimleri'
    ]
  );

  [
    '/tum-urunler/',
    '/os/KURUMSAL-EGITIMLER-10/',
    '/sayfa/hakkimizda-25/',
    '/sayfa/egitmenler-10/',
    '/form/hemen-bilgi-al-1/',
    '/sayfa/iletisim-5/',
    '/blog/',
    '/os/yazilim-cozumleri-20/'
  ].forEach((href) => {
    assert.match(html, new RegExp(`href="${href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
  });

  assert.match(html, /data-member-profile/);
  assert.match(html, /data-member-course-list/);
  assert.match(html, /member-profile\.css\?v=20260810-2/);
  assert.match(html, /homepage-navbar\.css\?v=20260810-2/);
  assert.match(html, /\/public\/tema10\/js\/member-profile\.js/);
  assert.match(serverSource, /member-profile\.css\?v=20260810-2/);
  assert.match(profileCss, /@media \(max-width: 900px\)/);
  assert.match(profileCss, /@media \(max-width: 640px\)/);
  assert.doesNotMatch(profileCss, /member-home-navbar/);
  assert.match(navbarCss, /@media \(max-width: 1199px\)/);
  assert.match(navbarCss, /\.member-home-navbar__courses-dropdown\[open\]/);
  assert.doesNotMatch(navbarCss, /member-home-navbar__links a:hover/);
  assert.doesNotMatch(navbarCss, /member-home-navbar__courses-link:hover/);
  assert.doesNotMatch(navbarCss, /member-home-navbar__courses-menu a:hover/);
  assert.match(navbarCss, /@media \(max-width: 1199\.98px\)/);
  assert.match(navbarCss, /\.uv-payment-legacy-header--responsive-payment/);
  assert.match(navbarCss, /justify-content: space-between/);
  assert.match(navbarCss, /transform: translateX\(-100%\)/);
  assert.match(navbarCss, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(profileCss, /\.member-profile-page \.uv-payment-legacy-header__brand-inner/);
  assert.match(sharedLayoutCss, /@media \(max-width: 900px\)/);
  assert.match(sharedLayoutCss, /@media \(max-width: 640px\)/);
  assert.match(sharedLayoutCss, /\.uv-payment-legacy-header__nav-inner/);
  assert.match(sharedLayoutCss, /\.uv-payment-legacy-footer__grid/);

  [$payment, $paymentResult].forEach(($paymentPage) => {
    const $paymentHeader = $paymentPage('.uv-payment-legacy-header--responsive-payment');

    assert.equal($paymentHeader.length, 1);
    assert.equal($paymentHeader.attr('data-navbar-mobile-query'), '(max-width: 1199.98px)');
    assert.equal($paymentPage('.member-home-navbar').length, 1);
    assert.equal($paymentPage('.uv-payment-legacy-header__nav').length, 0);
    assert.equal($paymentPage('.member-home-navbar__courses-menu a').length, 13);
    assert.equal($paymentPage('.member-home-navbar__courses-dropdown').attr('open'), undefined);
    assert.equal($paymentPage('[data-navbar-toggle]').prop('tagName'), 'BUTTON');
    assert.equal($paymentPage('[data-navbar-toggle]').attr('aria-expanded'), 'false');
    assert.equal($paymentPage('[data-navbar-toggle]').attr('aria-controls'), 'uv-payment-mobile-navigation');
    assert.equal($paymentPage('#uv-payment-mobile-navigation[data-navbar-drawer]').length, 1);
    assert.equal($paymentPage('[data-navbar-close]').prop('tagName'), 'BUTTON');
    assert.equal($paymentPage('[data-navbar-backdrop]').prop('tagName'), 'BUTTON');
    assert.equal($paymentPage('.uv-payment-legacy-header__mobile-logo').length, 1);
    assert.equal($paymentPage('.uv-payment-mobile-profile[href="/uye/"]').length, 1);
    assert.match($paymentPage.html(), /navbar\.js\?v=20260810-1/);
  });
  assert.match(paymentHtml, /homepage-navbar\.css\?v=20260810-2/);
  assert.match(paymentResultHtml, /homepage-navbar\.css\?v=20260810-2/);
  assert.equal($payment('[data-payment-checkout]').length, 1);
  assert.equal($payment('[data-payment-iframe]').length, 1);
  assert.equal($payment('[data-bank-transfer]').length, 1);
  assert.equal($payment('input[name="_csrf"]').attr('value'), 'test-csrf-token');

  const profileRouteIndex = serverSource.indexOf("app.get(['/uye', '/uye/']");
  const staticDirectoriesIndex = serverSource.indexOf('legacyStaticDirectories.forEach');
  assert(profileRouteIndex >= 0, 'Member profile page route should exist');
  assert(
    profileRouteIndex < staticDirectoriesIndex,
    'Member profile page route should render before the legacy static directory handler'
  );

  console.log('Member and payment shared navbar tests passed.');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
