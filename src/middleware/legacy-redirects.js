const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '../..');

// Catalog sections that require trailing slash for canonical URLs and relative assets
const trailingSlashSections = ['urun', 'blog-detay', 'kategori', 'os', 'sayfa', 'blog', 'tum-urunler'];

function createLegacyRedirectsMiddleware() {
  return function legacyRedirectsMiddleware(req, res, next) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return next();
    }

    const rawPath = req.path || '/';

    // 1. Old Pobol format: /blog-detay/slug/123 -> /blog-detay/slug-123/
    //                      /urun/slug/123 -> /urun/slug-123/
    //                      /kategori/slug/123 -> /kategori/slug-123/
    //                      /os/slug/123 -> /os/slug-123/
    const oldFormatMatch = rawPath.match(/^\/(blog-detay|urun|kategori|os)\/(.+)\/(\d+)\/?$/i);
    if (oldFormatMatch) {
      const [, section, slug, id] = oldFormatMatch;
      const cleanSection = section.toLowerCase();
      const cleanSlug = slug.endsWith('-') ? `${slug}${id}` : `${slug}-${id}`;
      const query = req.url.includes('?') ? '?' + req.url.split('?')[1] : '';
      return res.redirect(301, `/${cleanSection}/${cleanSlug}/${query}`);
    }

    // 2. Trailing slash normalization for catalog sections (e.g. /blog-detay/title-16 -> /blog-detay/title-16/)
    const pathParts = rawPath.split('/').filter(Boolean);
    if (pathParts.length >= 1 && trailingSlashSections.includes(pathParts[0].toLowerCase())) {
      if (!rawPath.endsWith('/') && !path.extname(rawPath)) {
        const query = req.url.includes('?') ? '?' + req.url.split('?')[1] : '';
        return res.redirect(301, `${rawPath}/${query}`);
      }
    }

    // 3. Fallback for missing uploads/fm PDF files -> redirect 301 to homepage
    if (rawPath.startsWith('/uploads/fm/') && rawPath.toLowerCase().endsWith('.pdf')) {
      const fullPath = path.join(rootDir, rawPath);
      if (!fs.existsSync(fullPath)) {
        return res.redirect(301, '/');
      }
    }

    return next();
  };
}

module.exports = createLegacyRedirectsMiddleware;
