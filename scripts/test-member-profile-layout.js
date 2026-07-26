const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const ejs = require('ejs');
const cheerio = require('cheerio');

const root = path.resolve(__dirname, '..');
const viewPath = path.join(root, 'src/views/members/profile.ejs');
const headerPath = path.join(root, 'src/views/partials/header.ejs');
const serverSource = fs.readFileSync(path.join(root, 'src/server.js'), 'utf8');
const profileCss = fs.readFileSync(
  path.join(root, 'public/tema10/css/member-profile.css'),
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
      '/public/tema10/css/member-profile.css?v=20260724-2'
    ],
    extraScripts: ['/public/tema10/js/member-profile.js']
  });
  const defaultLegacyHeaderHtml = await ejs.renderFile(headerPath, {
    pageTitle: 'Test',
    cspNonce: 'test-nonce',
    useLegacyPaymentHeader: true
  });
  const $ = cheerio.load(html);

  assert.match(html, /<body class="member-profile-page">/);
  assert.match(html, /<meta name="robots" content="noindex">/);
  assert.match(html, /class="uv-payment-legacy-header"/);
  assert.match(html, /class="uv-payment-legacy-footer"/);
  assert.doesNotMatch(html, /class="uv-payment-legacy-header__profile"/);
  assert.match(html, /class="member-profile-home" href="\/">Ana Sayfaya Dön<\/a>/);
  assert.match(html, /class="member-profile-logout"[^>]*data-member-logout>Çıkış Yap<\/button>/);
  assert.equal((html.match(/data-member-logout/g) || []).length, 1);
  assert.equal($('.uv-payment-legacy-header__top-inner > .member-profile-nav').length, 1);
  assert.equal($('.uv-payment-legacy-header__brand-inner .member-profile-nav').length, 0);
  assert.match(defaultLegacyHeaderHtml, /class="uv-payment-legacy-header__profile"/);
  assert.doesNotMatch(defaultLegacyHeaderHtml, /class="member-profile-nav"/);

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
  assert.match(html, /\/public\/tema10\/js\/member-profile\.js/);
  assert.match(profileCss, /@media \(max-width: 900px\)/);
  assert.match(profileCss, /@media \(max-width: 640px\)/);
  assert.doesNotMatch(profileCss, /\.member-profile-page \.uv-payment-legacy-header__brand-inner/);
  assert.match(sharedLayoutCss, /@media \(max-width: 900px\)/);
  assert.match(sharedLayoutCss, /@media \(max-width: 640px\)/);
  assert.match(sharedLayoutCss, /\.uv-payment-legacy-header__nav-inner/);
  assert.match(sharedLayoutCss, /\.uv-payment-legacy-footer__grid/);

  const profileRouteIndex = serverSource.indexOf("app.get(['/uye', '/uye/']");
  const staticDirectoriesIndex = serverSource.indexOf('legacyStaticDirectories.forEach');
  assert(profileRouteIndex >= 0, 'Member profile page route should exist');
  assert(
    profileRouteIndex < staticDirectoriesIndex,
    'Member profile page route should render before the legacy static directory handler'
  );

  console.log('Member profile shared layout tests passed.');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
