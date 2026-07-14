const assert = require('assert');
const {
  legacyBlogImageAlias,
  localBlogImageExists,
  missingBlogContentImages,
  normalizeLocalBlogImagePath,
  validateBlogContentImages
} = require('../src/services/blog-images');

const lootjamPrefix = 'dijital-oyun-tasarimi-bolumu-bilgiyi-ticarilestirme-merkezi-is-birligiyle-lootjam-gerceklestirdi';
const legacyLootjamImage = `../../uploads/p/b/${lootjamPrefix}_2.jpg`;

assert.strictEqual(
  normalizeLocalBlogImagePath(legacyLootjamImage),
  `/uploads/p/b/${lootjamPrefix}_2.jpg`
);
assert.match(legacyBlogImageAlias(legacyLootjamImage), /^https:\/\/www\.gedik\.edu\.tr\//);
assert.strictEqual(localBlogImageExists(legacyLootjamImage), true);
assert.strictEqual(localBlogImageExists('/uploads/blog/does-not-exist.jpg'), false);
assert.strictEqual(localBlogImageExists('uploads/blog/does-not-exist.jpg'), false);
assert.strictEqual(localBlogImageExists('https://example.com/photo.jpg'), true);
assert.strictEqual(localBlogImageExists('data:image/png;base64,AA=='), true);
assert.deepStrictEqual(missingBlogContentImages('<img src="/uploads/blog/does-not-exist.jpg">'), [
  '/uploads/blog/does-not-exist.jpg'
]);
assert.strictEqual(missingBlogContentImages(`<img src="${legacyLootjamImage}">`).length, 0);
assert.strictEqual(validateBlogContentImages('<p>Görselsiz içerik</p>'), null);
assert.match(
  validateBlogContentImages('<img src="/uploads/blog/does-not-exist.jpg">'),
  /sunucuda bulunmayan görsel/
);

console.log('Blog image path tests passed.');
