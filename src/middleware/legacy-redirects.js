const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '../..');

// Explicit 1-to-1 mapping for old Unityverse URLs to active live course / category URLs
const legacyExplicitRedirects = new Map([
  // Old Category URLs -> Direct Active Course URLs
  ['/kategori/film-ve-animasyon-icin-storyboard-yuz-yuze-egitimi/115', '/urun/film-ve-animasyon-icin-storyboard-yuz-yuze-egitimi-599/'],
  ['/kategori/film-ve-animasyon-icin-storyboard-cevrimici-egitimi/72', '/urun/film-ve-animasyon-icin-storyboard-canli-online-egitimi-551/'],
  ['/kategori/cocuk-ve-gencler-icin-2b-cizgi-film-ve-animasyon-yuz-yuze-egitimi/165', '/urun/2b-cizgi-film-ve-animasyon-yuz-yuze-egitimi-614/'],
  ['/kategori/cocuk-ve-gencler-icin-cocuklar-icin-2b-karakter-tasarim-uzmanligi-yuz-yuze-egitimi/183', '/urun/2b-oyun-karakter-tasarimi-ve-animasyon-ozel-ders-1250/'],
  ['/kategori/after-effects-ile-dijital-produksiyon-ve-kurgu-yuz-yuze-egitim/108', '/urun/after-effects-ve-premiere-pro-ile-video-kurgu-egitimi-592/'],
  ['/kategori/unity-ile-mid-core-oyun-gelistirme-online-cevrimici-egitimi/240', '/urun/unity-ile-oyun-gelistirme-canli-online-egitimi-staj-garantili-17/'],
  ['/kategori/cocuk-ve-gencler-icin-python-yuz-yuze-egitimi/205', '/urun/2024-python-bootcamp-sifirdan-python-yuz-yuze-egitimi-594/'],
  ['/kategori/yonetmenlik-ve-sinematografiye-giris-egitimi/92', '/urun/yonetmenlik-ve-sinematografiye-giris-yuz-yuze-egitimi-620/'],
  ['/kategori/blender-3b-oyun-modelleme-yuz-yuze-egitim/109', '/urun/blender-ile-3d-modelleme-ve-animasyon-egitimi-yuz-yuze-591/'],
  ['/kategori/kurumsal-egitim-senaryo-yazma/217', '/urun/senaryo-yazma-yuz-yuze-egitimi-622/'],
  ['/kategori/3ds-max-yuz-yuze-egitimi/131', '/urun/3ds-max-yuz-yuze-egitimi-615/'],
  ['/kategori/desinatorluk-egitimi/84', '/urun/desinatorluk-canli-online-egitimi-563/'],
  ['/kategori/kurumlar-icin-egitim-yazilim-kalitesi-ve-testi/211', '/urun/yazilim-test-otomasyonu-egitimi-canli-online-egitimi-staj-garantili-7/'],
  ['/kategori/grafik-tasarim-ve-video-efekt-uzmanligi-online-cevrimici-egitimi/241', '/urun/grafik-tasarim-ve-video-efekt-uzmanligi-canli-online-egitimi-staj-garantili-564/'],
  ['/kategori/cocuk-ve-gencler-icin-grafik-tasarim-uzmanligi-yuz-yuze-egitimi/168', '/urun/cocuklar-icin-grafik-tasarim-ve-video-efekt-yuz-yuze-egitimi-1043/'],
  ['/kategori/2b-oyun-karakter-tasarimi-ve-animasyon-egitimi/74', '/urun/2b-oyun-karakter-tasarimi-ve-animasyon-canli-online-egitimi-553/'],
  ['/kategori/autodesk-maya-ile-animasyon-yuz-yuze-egitimi/133', '/urun/maya-ile-modelleme-ve-animasyon-canli-online-ozel-ders-1047/'],
  ['/kategori/zbrush-ile-organik-modelleme-yuz-yuze-egitimi/107', '/urun/zbrush-ile-organik-modelleme-yuz-yuze-egitimi-590/'],
  ['/kategori/c-sharp-programlama-yuz-yuze-egitimi/113', '/urun/c-programlama-yuz-yuze-egitimi-596/'],
  ['/kategori/marvelous-designer-ile-giysi-tasarimi-egitimi/73', '/urun/marvelous-designer-ile-giysi-tasarimi-yuz-yuze-egitimi-600/'],
  ['/kategori/unity-ile-oyun-gelistirme-atolyesi/228', '/urun/unity-ile-oyun-gelistirme-canli-online-egitimi-staj-garantili-17/'],
  ['/kategori/cocuk-ve-gencler-icin-yazilim-egitimleri/191', '/urun/cocuklar-icin-canli-online-yazilim-kursu-1114/'],
  ['/kategori/kurumsal-yazilim-uzmanligi-egitimi/213', '/urun/yazilim-uzmanligi-yuz-yuze-egitimi-staj-garantili-669/'],
  ['/kategori/cizgi-film-ve-animasyon-atolyesi/230', '/urun/2b-cizgi-film-ve-animasyon-uzmanligi-canli-online-egitimi-565/'],
  ['/kategori/autodesk-maya-modelling-and-animation-one-to-one-private-classes/206', '/urun/maya-ile-modelleme-ve-animasyon-canli-online-ozel-ders-1047/'],
  ['/kategori/aranan-programci-olma-kamp-yuz-yuze-kursu-python-java-c/119', '/urun/aranan-programci-olma-kampi-yuz-yuze-kursu-4-ay-1352/'],
  ['/kategori/after-effects-ile-motion-grafik-egitimi/88', '/urun/after-effects-ve-premiere-pro-ile-video-kurgu-egitimi-592/'],
  ['/kategori/2022-python-bootcamp-sifirdan-python-egitimi/67', '/urun/2026-python-bootcamp-sifirdan-python-canli-online-egitimi-8/'],
  ['/kategori/python-ile-programlama-ozel-bire-bir-egitim/210', '/urun/python-canli-online-ozel-ders-1106/'],
  ['/kategori/kurumsal-egitim-python-ile-programlama/214', '/urun/2026-python-bootcamp-sifirdan-python-canli-online-egitimi-8/'],
  ['/kategori/autodesk-maya-modelleme-yuz-yuze-egitimi/120', '/urun/autodesk-maya-modelleme-yuz-yuze-egitimi-96-saat-936/'],
  ['/kategori/2022-python-bootcamp-sifirdan-python-yuz-yuze-egitimi/111', '/urun/2024-python-bootcamp-sifirdan-python-yuz-yuze-egitimi-594/'],
  ['/kategori/kurumsal-egitim-autodesk-fusion-360-endustriyel-urun-tasarimi-uzmanligi/224', '/urun/autodesk-fusion-360-endustriyel-urun-tasarimi-uzmanligi-canli-online-egitimi-584/'],
  ['/kategori/video-tasarimi-kurslari/96', '/kategori/grafik-tasarim-egitimleri-246/'],
  ['/kategori/oyun-gelistirme-kurslari/97', '/kategori/oyun-gelistirme-263/'],
  ['/kategori/video-tasarim-egitimleri/249', '/kategori/grafik-tasarim-egitimleri-246/'],
  ['/kategori/canli-online-egitimler/5', '/tum-urunler/'],
  ['/kategori/yuz-yuze-egitimler/106', '/tum-urunler/'],
  ['/kategori/yuz-yuze-atolyeler/238', '/tum-urunler/'],
  ['/kategori/online-kurslar/5', '/tum-urunler/'],
  ['/kategori/yuz-yuze-kurslar/106', '/tum-urunler/'],

  // Missing generic product folders (no ID suffix) -> Active course with ID suffix
  ['/urun/c-programlama-yuz-yuze-egitimi', '/urun/c-programlama-yuz-yuze-egitimi-596/'],
  ['/urun/grafik-tasarim-ve-video-efekt-canli-online-egitimi', '/urun/grafik-tasarim-ve-video-efekt-uzmanligi-canli-online-egitimi-staj-garantili-564/'],
  ['/urun/grafik-tasarim-ve-video-efekt-uzmanligi-canli-online-egitimi', '/urun/grafik-tasarim-ve-video-efekt-uzmanligi-canli-online-egitimi-staj-garantili-564/'],
  ['/urun/grafik-tasarim-ve-video-efekt-uzmanligi-yuz-yuze-egitimi', '/urun/grafik-tasarim-ve-video-efekt-uzmanligi-yuz-yuze-egitimi-staj-garantili-613/'],
  ['/urun/grafik-tasarim-ve-video-efekt-yuz-yuze-egitimi', '/urun/grafik-tasarim-ve-video-efekt-yuz-yuze-egitimi-8-ay-staj-garantili-1217/'],
  ['/urun/unity-ile-oyun-gelistirme-canli-online-egitimi', '/urun/unity-ile-oyun-gelistirme-canli-online-egitimi-staj-garantili-17/'],
  ['/urun/yazilim-test-otomasyonu-yuz-yuze-egitimi', '/urun/yazilim-test-otomasyonu-yuz-yuze-egitimi-603/']
]);

// Sections that use trailing slashes for directory index serving
const trailingSlashSections = ['urun', 'blog-detay', 'kategori', 'os', 'sayfa', 'blog', 'tum-urunler'];

function createLegacyRedirectsMiddleware() {
  return function legacyRedirectsMiddleware(req, res, next) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return next();
    }

    // Set noindex header for utility/login/register pages
    const lowerPath = (req.path || '/').toLowerCase();
    if (lowerPath.startsWith('/uye-girisi') || lowerPath.startsWith('/uye-ol') || lowerPath.startsWith('/sifremi-unuttum') || lowerPath.startsWith('/uye')) {
      res.setHeader('X-Robots-Tag', 'noindex, follow');
    }

    let rawPath = lowerPath;
    const normalizedKey = rawPath.length > 1 && rawPath.endsWith('/') ? rawPath.slice(0, -1) : rawPath;
    const query = req.url.includes('?') ? '?' + req.url.split('?')[1] : '';

    // 1. Explicit 1-to-1 Redirects
    if (legacyExplicitRedirects.has(normalizedKey)) {
      return res.redirect(301, `${legacyExplicitRedirects.get(normalizedKey)}${query}`);
    }
    if (legacyExplicitRedirects.has(rawPath)) {
      return res.redirect(301, `${legacyExplicitRedirects.get(rawPath)}${query}`);
    }

    // 2. Old Unityverse format with slash ID: /blog-detay/slug/123 -> /blog-detay/slug-123/
    //                                  /urun/slug/123 -> /urun/slug-123/
    //                                  /kategori/slug/123 -> /kategori/slug-123/
    //                                  /os/slug/123 -> /os/slug-123/
    const oldFormatMatch = req.path.match(/^\/(blog-detay|urun|kategori|os)\/(.+)\/(\d+)\/?$/i);
    if (oldFormatMatch) {
      const [, section, slug, id] = oldFormatMatch;
      const cleanSection = section.toLowerCase();
      const cleanSlug = slug.endsWith('-') ? `${slug}${id}` : `${slug}-${id}`;
      const targetDir = path.join(rootDir, cleanSection, cleanSlug);

      if (fs.existsSync(targetDir)) {
        return res.redirect(301, `/${cleanSection}/${cleanSlug}/${query}`);
      }

      // Safe Fallbacks if target folder doesn't exist on disk
      if (cleanSection === 'blog-detay') {
        return res.redirect(301, `/blog/${query}`);
      } else if (cleanSection === 'kategori') {
        return res.redirect(301, `/tum-urunler/${query}`);
      } else if (cleanSection === 'os') {
        return res.redirect(301, `/${query}`);
      }
    }

    // 3. Trailing slash normalization & Missing page fallback for catalog sections
    const pathParts = req.path.split('/').filter(Boolean);
    if (pathParts.length >= 1 && trailingSlashSections.includes(pathParts[0].toLowerCase())) {
      // Check if folder exists on disk
      const requestedSubPath = pathParts.slice(1).join('/');
      if (requestedSubPath) {
        const section = pathParts[0].toLowerCase();
        const fullFolder = path.join(rootDir, pathParts[0], requestedSubPath);
        if (!fs.existsSync(fullFolder)) {
          if (section === 'blog-detay') return res.redirect(301, `/blog/${query}`);
          if (section === 'kategori') return res.redirect(301, `/tum-urunler/${query}`);
          if (section === 'os') return res.redirect(301, `/${query}`);
        }
      }

      // If folder exists but missing trailing slash, add trailing slash
      if (!req.path.endsWith('/') && !path.extname(req.path)) {
        return res.redirect(301, `${req.path}/${query}`);
      }
    }

    // 4. Fallback for missing uploads/fm PDF files -> redirect 301 to homepage
    if (req.path.startsWith('/uploads/fm/') && req.path.toLowerCase().endsWith('.pdf')) {
      const fullPath = path.join(rootDir, req.path);
      if (!fs.existsSync(fullPath)) {
        return res.redirect(301, '/');
      }
    }

    return next();
  };
}

module.exports = createLegacyRedirectsMiddleware;
