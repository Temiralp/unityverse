const assert = require('assert');
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const homepage = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
const standaloneForm = fs.readFileSync(
  path.join(projectRoot, 'form/hemen-bilgi-al-1/index.html'),
  'utf8'
);
const successPage = fs.readFileSync(path.join(projectRoot, 'form/tesekkur/index.html'), 'utf8');
const successCss = fs.readFileSync(path.join(projectRoot, 'public/tema10/css/form-success.css'), 'utf8');
const formProtection = fs.readFileSync(
  path.join(projectRoot, 'public/tema10/js/form-protection.js'),
  'utf8'
);
const leadRoutes = fs.readFileSync(path.join(projectRoot, 'src/routes/leads.js'), 'utf8');
const redirectStatement = "window.location.assign('/form/tesekkur/');";

function functionSource(html, functionName, nextMarker) {
  const start = html.indexOf(`function ${functionName}`);
  const end = html.indexOf(nextMarker, start);
  assert(start >= 0 && end > start, `Missing function: ${functionName}`);
  return html.slice(start, end);
}

const homepageSubmit = functionSource(homepage, 'postHomepageInfoForm(formId)', "var owl = $('#module1_2696");
const standaloneSubmit = functionSource(standaloneForm, 'postForm()', 'function uploadFile');

assert(homepageSubmit.includes('ajax/sendHomepageInfoForm'));
assert(!homepageSubmit.includes('ajax/sendCustomForm'));
assert(standaloneSubmit.includes('ajax/sendInformationPageForm'));
assert(!standaloneSubmit.includes('ajax/sendCustomForm'));
assert(formProtection.includes('sendHomepageInfoForm'));
assert(formProtection.includes('sendInformationPageForm'));
assert(leadRoutes.includes("router.post('/sendHomepageInfoForm', leadHandlers)"));
assert(leadRoutes.includes("router.post('/sendInformationPageForm', leadHandlers)"));

[homepageSubmit, standaloneSubmit].forEach((submitSource) => {
  assert(submitSource.includes('status'));
  assert(submitSource.includes('success'));
  assert.strictEqual((submitSource.match(/window\.location\.assign\('\/form\/tesekkur\/'\);/g) || []).length, 1);
  assert(submitSource.indexOf(redirectStatement) > submitSource.indexOf('status'));
  assert(submitSource.indexOf(redirectStatement) < submitSource.indexOf('else'));
  assert(submitSource.includes('_error'));
});

assert(successPage.includes('<meta name="robots" content="noindex, nofollow">'));
assert(successPage.includes('<h1 id="form-success-title">Formumuz başarıyla ulaşmıştır</h1>'));
assert(successPage.includes('/public/tema10/css/form-success.css?v=20260714'));
assert(successPage.includes('</body>'));
assert(successCss.includes('@media (max-width: 480px)'));
assert(successCss.includes('width: min(560px, 100%)'));

console.log('Form success redirect tests passed for homepage and standalone form.');
