const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const registrationPages = [
  'uye-girisi/index.html',
  'uye-ol/index.html'
];

registrationPages.forEach((relativePath) => {
  const html = fs.readFileSync(path.join(root, relativePath), 'utf8');

  assert.match(html, /id="registerForm"/);
  assert.match(html, /ajax\/member\/register/);
  assert.match(html, />Üye Ol<\/button>/);
  assert.doesNotMatch(html, /Captcha\?[^"']*type=member/i);
  assert.doesNotMatch(html, /member_security_code/);
  assert.doesNotMatch(html, /Güvenlik Kodu giriniz/);
});

const formProtection = fs.readFileSync(
  path.join(root, 'public/tema10/js/form-protection.js'),
  'utf8'
);
const memberRoutes = fs.readFileSync(path.join(root, 'src/routes/members.js'), 'utf8');

assert.match(formProtection, /#registerForm/);
assert.match(formProtection, /loadToken\('member'\)/);
assert.match(formProtection, /createTrap\('member'/);
assert.match(memberRoutes, /router\.post\('\/register', memberBotGuard, registerRateLimiter/);
assert.match(memberRoutes, /router\.use\(requirePublicCsrf\)/);

console.log('Member registration CAPTCHA removal tests passed.');
