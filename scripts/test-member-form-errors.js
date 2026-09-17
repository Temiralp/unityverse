#!/usr/bin/env node

// Uye kayit/giris formlari: sunucunun 4xx JSON mesaji (409 kayitli uye, 429 rate-limit,
// 400 dogrulama, 401 hatali sifre) kullaniciya gosterilmeli; sabit "Sunucu hatasi" yalnizca
// mesajsiz (gercek 5xx / ag) hatalarda kalmali.

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');

const { LEGACY_SCRIPTS_VERSION } = require('../src/services/legacy-assets');

const root = path.resolve(__dirname, '..');

// 1) Kayit formlari (iki statik sayfa): error callback jqXHR.responseJSON.message kullanir
['uye-girisi/index.html', 'uye-ol/index.html'].forEach((file) => {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  const registerBlock = html.slice(html.indexOf('url: "../ajax/member/register"'), html.indexOf('url: "../ajax/member/register"') + 1400);
  assert.match(registerBlock, /error: function\(jqXHR\) \{/, `${file}: error callback jqXHR almali`);
  assert.match(registerBlock, /jqXHR && jqXHR\.responseJSON && jqXHR\.responseJSON\.message/, `${file}: sunucu mesaji`);
  assert.match(registerBlock, /Sunucu hatası\. Lütfen daha sonra tekrar deneyiniz\./, `${file}: mesajsiz hata icin varsayilan`);
  assert.equal((html.match(/error: function\(\) \{\s*_error\('', "Sunucu hatası/g) || []).length, 0, `${file}: eski sabit callback kalmamali`);
});

// 2) Giris formu (scripts.js): error callback eklendi, ayni desen
const scripts = fs.readFileSync(path.join(root, 'public/tema10/js/scripts.js'), 'utf8');
const signinBlock = scripts.slice(scripts.indexOf('url: site_url + "ajax/member/signin"'), scripts.indexOf('url: site_url + "ajax/member/signin"') + 1400);
assert.match(signinBlock, /error: function\(jqXHR\) \{/);
assert.match(signinBlock, /jqXHR && jqXHR\.responseJSON && jqXHR\.responseJSON\.message/);
assert.match(signinBlock, /Giriş yapılamadı\. Lütfen daha sonra tekrar deneyiniz\./);

// 3) Onbellek: scripts.js surumu artti (legacy-assets tum sayfalarda ?v= yeniden yazar)
assert.equal(LEGACY_SCRIPTS_VERSION, '5.4.119');

// 4) Sunucu tarafi degismedi: kayit route'u ayni mesajlari donuyor
const members = fs.readFileSync(path.join(root, 'src/routes/members.js'), 'utf8');
assert.match(members, /Bu e-posta adresi ile kayıtlı bir üye var\./);
assert.match(members, /Çok kısa sürede çok fazla üyelik denemesi/);

console.log('member form error messages OK');
