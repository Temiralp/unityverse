const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const LOOTJAM_FILE_PREFIX = 'dijital-oyun-tasarimi-bolumu-bilgiyi-ticarilestirme-merkezi-is-birligiyle-lootjam-gerceklestirdi';
const LOOTJAM_SOURCE_ROOT = 'https://www.gedik.edu.tr/wp-content/uploads/2026/06';
const projectRoot = path.resolve(__dirname, '../..');

const legacyBlogImageAliases = new Map([
  [`/uploads/p/b/${LOOTJAM_FILE_PREFIX}_1.jpg`, `${LOOTJAM_SOURCE_ROOT}/${LOOTJAM_FILE_PREFIX}-10-scaled.jpg`],
  [`/uploads/p/b/${LOOTJAM_FILE_PREFIX}_2.jpg`, `${LOOTJAM_SOURCE_ROOT}/${LOOTJAM_FILE_PREFIX}.png`],
  [`/uploads/p/b/${LOOTJAM_FILE_PREFIX}_3.jpg`, `${LOOTJAM_SOURCE_ROOT}/${LOOTJAM_FILE_PREFIX}-3.jpg`],
  [`/uploads/p/b/${LOOTJAM_FILE_PREFIX}_4.jpg`, `${LOOTJAM_SOURCE_ROOT}/${LOOTJAM_FILE_PREFIX}-7.jpg`],
  [`/uploads/p/b/${LOOTJAM_FILE_PREFIX}_5.jpg`, `${LOOTJAM_SOURCE_ROOT}/${LOOTJAM_FILE_PREFIX}-5-scaled.jpg`],
  [`/uploads/p/b/${LOOTJAM_FILE_PREFIX}_6.jpg`, `${LOOTJAM_SOURCE_ROOT}/${LOOTJAM_FILE_PREFIX}-6.jpg`],
  [`/uploads/p/b/${LOOTJAM_FILE_PREFIX}_7.jpg`, `${LOOTJAM_SOURCE_ROOT}/${LOOTJAM_FILE_PREFIX}-8-scaled.jpg`],
  [`/uploads/p/b/${LOOTJAM_FILE_PREFIX}_8.jpg`, `${LOOTJAM_SOURCE_ROOT}/${LOOTJAM_FILE_PREFIX}-4-scaled.jpg`],
  [`/uploads/p/b/${LOOTJAM_FILE_PREFIX}_9.jpg`, `${LOOTJAM_SOURCE_ROOT}/${LOOTJAM_FILE_PREFIX}-9-scaled.jpg`],
  [`/uploads/p/b/${LOOTJAM_FILE_PREFIX}_10.jpg`, `${LOOTJAM_SOURCE_ROOT}/${LOOTJAM_FILE_PREFIX}-11-scaled.jpg`],
  [`/uploads/p/b/${LOOTJAM_FILE_PREFIX}_11.jpg`, `${LOOTJAM_SOURCE_ROOT}/${LOOTJAM_FILE_PREFIX}-12-scaled.jpg`],
  ['/uploads/fm/Yoshi’s_Crafted_World.jpg', 'https://assets.nintendo.com/image/upload/c_fill,w_1200/q_auto:best/f_auto/dpr_2.0/store/software/switch/70010000000734/db8a252a84301594bdc4eed1be3dbd8d3de5086bc79f6ee1f8060c9a5630101f']
]);

function decodedPathname(value) {
  const pathname = String(value || '').trim().split(/[?#]/)[0];
  try {
    return decodeURIComponent(pathname);
  } catch (error) {
    return pathname;
  }
}

function normalizeLocalBlogImagePath(value) {
  const pathname = decodedPathname(value).replace(/\\/g, '/');
  if (!pathname || /^(?:data:|https?:|\/\/)/i.test(pathname)) return null;

  const withoutParents = pathname.replace(/^(?:\.\.\/)+/, '/');
  const rootRelative = withoutParents.startsWith('/')
    ? withoutParents
    : `/${withoutParents.replace(/^\.\//, '')}`;

  return path.posix.normalize(rootRelative);
}

function legacyBlogImageAlias(value) {
  const localPath = normalizeLocalBlogImagePath(value);
  return localPath ? legacyBlogImageAliases.get(localPath) || null : null;
}

function localBlogImageExists(value) {
  const localPath = normalizeLocalBlogImagePath(value);
  if (!localPath) return true;
  if (legacyBlogImageAliases.has(localPath)) return true;

  const absolutePath = path.resolve(projectRoot, `.${localPath}`);
  if (!absolutePath.startsWith(`${projectRoot}${path.sep}`)) return false;
  return fs.existsSync(absolutePath);
}

function missingBlogContentImages(content) {
  const $ = cheerio.load(`<article id="blog-image-audit">${content || ''}</article>`, {
    decodeEntities: false
  });
  const missing = new Set();

  $('#blog-image-audit img[src]').each((_, image) => {
    const source = String($(image).attr('src') || '').trim();
    if (normalizeLocalBlogImagePath(source) && !localBlogImageExists(source)) {
      missing.add(source);
    }
  });

  return [...missing];
}

function validateBlogContentImages(content) {
  const missing = missingBlogContentImages(content);
  if (!missing.length) return null;

  return `İçerikte sunucuda bulunmayan görsel var: ${missing[0]}. Görseli editörden yeniden yükleyin veya geçerli bir URL kullanın.`;
}

function redirectLegacyBlogImage(req, res, next) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();

  const target = legacyBlogImageAlias(req.originalUrl || req.url || req.path);
  return target ? res.redirect(302, target) : next();
}

module.exports = {
  legacyBlogImageAlias,
  localBlogImageExists,
  missingBlogContentImages,
  normalizeLocalBlogImagePath,
  redirectLegacyBlogImage,
  validateBlogContentImages
};
