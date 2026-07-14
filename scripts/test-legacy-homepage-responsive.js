const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  LEGACY_HOMEPAGE_MARKER,
  ensureLegacyHomepageLocalAssets
} = require('../src/services/legacy-homepage');

const externalUploadPattern = /\b(?:src|data-src)=["']https:\/\/(?:www\.)?unityverseacademy\.com\/uploads\//gi;

const basicPage = `<!doctype html><html><body><div class="${LEGACY_HOMEPAGE_MARKER}"><img src="https://unityverseacademy.com/uploads/test.webp"><img data-src="https://www.unityverseacademy.com/uploads/lazy.webp"></div><a href="https://unityverseacademy.com/uploads/file.webp">Link</a><meta property="og:image" content="https://unityverseacademy.com/uploads/social.webp"></body></html>`;
const localizedPage = ensureLegacyHomepageLocalAssets(basicPage);

assert(localizedPage.includes('src="/uploads/test.webp"'));
assert(localizedPage.includes('data-src="/uploads/lazy.webp"'));
assert(localizedPage.includes('href="https://unityverseacademy.com/uploads/file.webp"'));
assert(localizedPage.includes('content="https://unityverseacademy.com/uploads/social.webp"'));
assert.strictEqual(ensureLegacyHomepageLocalAssets(localizedPage), localizedPage);
assert.strictEqual(ensureLegacyHomepageLocalAssets('<div>Other page</div>'), '<div>Other page</div>');
assert.strictEqual(ensureLegacyHomepageLocalAssets(null), null);

const projectRoot = path.resolve(__dirname, '..');
const homepagePath = path.join(projectRoot, 'index.html');
const homepage = fs.readFileSync(homepagePath, 'utf8');
const remoteHomepageImages = homepage.match(externalUploadPattern) || [];
const normalizedHomepage = ensureLegacyHomepageLocalAssets(homepage);

assert(remoteHomepageImages.length > 0, 'The fixture should contain legacy external homepage images');
assert.strictEqual(
  (normalizedHomepage.match(externalUploadPattern) || []).length,
  0,
  'All homepage image sources should use local uploads after rendering'
);

const localizedUploadPaths = [...normalizedHomepage.matchAll(/\b(?:src|data-src)=["'](\/uploads\/[^"']+)["']/gi)]
  .map((match) => match[1].split('?')[0]);

localizedUploadPaths.forEach((uploadPath) => {
  assert(
    fs.existsSync(path.join(projectRoot, uploadPath.replace(/^\//, ''))),
    `Local homepage asset is missing: ${uploadPath}`
  );
});

assert(
  /@media \(max-width: 1199\.98px\)[\s\S]*?\.home-info-form-side\s*\{\s*display:\s*none;\s*\}/.test(homepage),
  'The blue information panel should be hidden at the mobile form breakpoint'
);
assert(homepage.includes('.mobile-only-layout'));
assert(homepage.includes('.desktop-only-layout'));
assert(homepage.includes('id="custom_form_home_mobile"'));
assert(homepage.includes('id="custom_form_home_desktop"'));

const formFieldNames = (formId) => {
  const form = normalizedHomepage.match(new RegExp(`<form[^>]+id="${formId}"[\\s\\S]*?<\\/form>`));
  assert(form, `Missing form: ${formId}`);
  return [...form[0].matchAll(/\bname="([^"]+)"/g)].map((match) => match[1]);
};

assert.deepStrictEqual(
  formFieldNames('custom_form_home_mobile'),
  formFieldNames('custom_form_home_desktop'),
  'Mobile and desktop homepage forms should submit the same fields'
);

console.log(`Legacy homepage responsive tests passed; ${remoteHomepageImages.length} image references resolve locally.`);
