const fs = require('fs/promises');
const path = require('path');
const { execFileSync } = require('child_process');

const cheerio = require('cheerio');
const ejs = require('ejs');

const rootDir = path.resolve(__dirname, '..');

const configs = {
  'KURUMSAL-EGITIMLER-10': {
    type: 'corporate',
    activeNav: 'corporate',
    eyebrow: 'Kurumsal Eğitimler',
    primaryCta: 'Bilgi Al',
    secondaryCta: 'İletişime Geç'
  },
  'yazilim-cozumleri-20': {
    type: 'software',
    activeNav: 'solutions',
    eyebrow: 'Yazılım Çözümleri',
    primaryCta: 'Bilgi Al',
    secondaryCta: 'İletişime Geç'
  }
};

async function renderStaticServicePage(slug) {
  const config = configs[slug];
  if (!config) {
    throw new Error(`Unsupported slug: ${slug}`);
  }

  const pagePath = path.join(rootDir, 'os', slug, 'index.html');
  const sourceHtml = await readSourceHtml(pagePath, slug);
  const $ = cheerio.load(sourceHtml, { decodeEntities: false });
  const title = ($('title').first().text() || config.eyebrow).trim();
  const sections = $('.tm-dis').first().children('section');

  if (config.type === 'software') {
    return renderSoftwarePage({ $, config, pagePath, sections, title });
  }

  return renderCorporatePage({ $, config, pagePath, sections, title });
}

async function renderCorporatePage({ $, config, pagePath, sections, title }) {
  const intro = sections.eq(0).clone();
  const logos = sections.eq(1).clone();
  const details = sections.eq(2).clone();

  if (!intro.length || !logos.length || !details.length) {
    throw new Error(`Expected 3 content sections in ${pagePath}`);
  }

  cleanLegacyContent($, intro);
  cleanLegacyContent($, logos);
  cleanLegacyContent($, details);

  const heroHeading = firstNonEmptyParagraphText($, intro) || title;
  removeFirstNonEmptyParagraph($, intro);
  const heroDescription = firstNonEmptyParagraphText($, intro) || title;
  const logoHeading = lastNonEmptyParagraphText($, intro) || 'Bize Güvenen Kurumlar';
  removeLastNonEmptyParagraph($, intro);
  const introHtml = intro.html();
  const detailHeading = firstStrongText($, details) || 'Sunduğumuz Kurumsal Yazılım Eğitimleri';
  const detailHtml = details.html();
  const logoCards = logos.find('img').map((index, image) => {
    const img = $(image);
    return {
      src: normalizeAssetPath(img.attr('src')),
      alt: img.attr('alt') || `Unityverse Academy referans ${index + 1}`
    };
  }).get();

  const header = await ejs.renderFile(path.join(rootDir, 'src/views/partials/header.ejs'), {
    pageTitle: `${title} | Unityverse Academy`,
    activeNav: config.activeNav,
    extraStyles: ['/public/tema10/css/service.css']
  });
  const footer = await ejs.renderFile(path.join(rootDir, 'src/views/partials/footer.ejs'), {
    extraScripts: []
  });

  const rendered = [
    header.replace('<body>', '<body class="uv-service-page">'),
    '<main id="main-content">',
    '  <section class="uv-service-hero" aria-labelledby="service-title">',
    '    <div class="uv-shell uv-service-hero__grid">',
    '      <div class="uv-service-hero__copy">',
    `        <p class="uv-eyebrow">${escapeHtml(config.eyebrow)}</p>`,
    `        <h1 id="service-title">${escapeHtml(heroHeading)}</h1>`,
    `        <p>${escapeHtml(heroDescription)}</p>`,
    '        <div class="uv-service-hero__actions">',
    `          <a class="btn-primary" href="/form/hemen-bilgi-al-1/">${escapeHtml(config.primaryCta)}</a>`,
    `          <a class="btn-secondary" href="/sayfa/iletisim-5/">${escapeHtml(config.secondaryCta)}</a>`,
    '        </div>',
    '      </div>',
    '    </div>',
    '  </section>',
    '  <section class="uv-service-section">',
    '    <div class="uv-shell">',
    '      <div class="section-title">',
    `        <p class="section-title__eyebrow">${escapeHtml(config.eyebrow)}</p>`,
    `        <h2 class="section-title__heading">${escapeHtml(title)}</h2>`,
    '      </div>',
    `      <div class="uv-service-richtext">${introHtml}</div>`,
    '      <div class="uv-service-benefits" aria-label="Kurumsal eğitim avantajları">',
    ...benefitCards(),
    '      </div>',
    '    </div>',
    '  </section>',
    '  <section class="uv-service-section uv-service-section--white">',
    '    <div class="uv-shell">',
    '      <div class="section-title">',
    '        <p class="section-title__eyebrow">Referanslar</p>',
    `        <h2 class="section-title__heading">${escapeHtml(logoHeading)}</h2>`,
    '      </div>',
    '      <div class="uv-service-logo-grid" aria-label="Kurumsal referans logoları">',
    ...logoCards.map((logo) => [
      '        <a class="uv-service-logo-card" href="#!" aria-label="Referans logosu">',
      `          <img src="${escapeHtml(logo.src)}" alt="${escapeHtml(logo.alt)}" width="240" height="120" loading="lazy" decoding="async">`,
      '        </a>'
    ].join('\n')),
    '      </div>',
    '    </div>',
    '  </section>',
    '  <section class="uv-service-section">',
    '    <div class="uv-shell">',
    '      <div class="section-title">',
    '        <p class="section-title__eyebrow">Eğitimler</p>',
    `        <h2 class="section-title__heading">${escapeHtml(detailHeading)}</h2>`,
    '      </div>',
    `      <div class="uv-service-content uv-service-richtext">${detailHtml}</div>`,
    '    </div>',
    '  </section>',
    '  <section class="uv-service-cta">',
    '    <div class="uv-shell">',
    '      <div class="uv-service-cta__inner">',
    '        <div>',
    '          <h2>Bize Ulaşın</h2>',
    '          <p>Şirketinizin ihtiyaçlarına uygun özel eğitim planları oluşturmak için bizimle iletişime geçin.</p>',
    '        </div>',
    '        <div class="uv-service-cta__actions">',
    '          <a class="btn-primary" href="/form/hemen-bilgi-al-1/">Bilgi Al</a>',
    '          <a class="btn-secondary" href="/sayfa/iletisim-5/">İletişime Geç</a>',
    '        </div>',
    '      </div>',
    '    </div>',
    '  </section>',
    '</main>',
    footer
  ].join('\n');

  await fs.writeFile(pagePath, rendered, 'utf8');
  console.log(`Rendered ${pagePath}`);
}

async function renderSoftwarePage({ $, config, pagePath, sections, title }) {
  const media = sections.eq(0).clone();
  const overview = sections.eq(1).clone();
  const details = sections.eq(2).clone();

  if (!media.length || !overview.length || !details.length) {
    throw new Error(`Expected 3 content sections in ${pagePath}`);
  }

  cleanLegacyContent($, media);
  cleanLegacyContent($, overview);
  cleanLegacyContent($, details);

  const overviewHeading = firstMeaningfulHeading($, overview) || 'SEMANTİK TEKNOLOJİ - DEPO YÖNETİM SİSTEMİ & ÖZEL YAZILIM ÇÖZÜMLERİ';
  const heroDescription = firstUsefulSentence(overview.text()) || title;
  const detailHeading = firstMeaningfulHeading($, details) || 'ÜRÜN DETAYLARI';
  const mediaCards = media.find('img').map((index, image) => {
    const img = $(image);
    return {
      src: normalizeAssetPath(img.attr('src')),
      alt: img.attr('alt') || `Unityverse Academy yazılım çözümü ${index + 1}`
    };
  }).get();

  const header = await ejs.renderFile(path.join(rootDir, 'src/views/partials/header.ejs'), {
    pageTitle: `${title} | Unityverse Academy`,
    activeNav: config.activeNav,
    extraStyles: ['/public/tema10/css/service.css']
  });
  const footer = await ejs.renderFile(path.join(rootDir, 'src/views/partials/footer.ejs'), {
    extraScripts: []
  });

  const rendered = [
    header.replace('<body>', '<body class="uv-service-page">'),
    '<main id="main-content">',
    '  <section class="uv-service-hero" aria-labelledby="service-title">',
    '    <div class="uv-shell uv-service-hero__grid">',
    '      <div class="uv-service-hero__copy">',
    `        <p class="uv-eyebrow">${escapeHtml(config.eyebrow)}</p>`,
    `        <h1 id="service-title">${escapeHtml(title)}</h1>`,
    `        <p>${escapeHtml(heroDescription)}</p>`,
    '        <div class="uv-service-hero__actions">',
    `          <a class="btn-primary" href="/form/hemen-bilgi-al-1/">${escapeHtml(config.primaryCta)}</a>`,
    `          <a class="btn-secondary" href="/sayfa/iletisim-5/">${escapeHtml(config.secondaryCta)}</a>`,
    '        </div>',
    '      </div>',
    '    </div>',
    '  </section>',
    '  <section class="uv-service-section uv-service-section--white">',
    '    <div class="uv-shell">',
    '      <div class="uv-service-media-grid" aria-label="Yazılım çözümleri görselleri">',
    ...renderMediaCards(mediaCards),
    '      </div>',
    '    </div>',
    '  </section>',
    '  <section class="uv-service-section">',
    '    <div class="uv-shell">',
    '      <div class="section-title">',
    `        <p class="section-title__eyebrow">${escapeHtml(config.eyebrow)}</p>`,
    `        <h2 class="section-title__heading">${escapeHtml(overviewHeading)}</h2>`,
    '      </div>',
    `      <div class="uv-service-content uv-service-richtext">${overview.html()}</div>`,
    '    </div>',
    '  </section>',
    '  <section class="uv-service-section uv-service-section--white">',
    '    <div class="uv-shell">',
    '      <div class="section-title">',
    '        <p class="section-title__eyebrow">Ürün Detayları</p>',
    `        <h2 class="section-title__heading">${escapeHtml(detailHeading)}</h2>`,
    '      </div>',
    `      <div class="uv-service-content uv-service-richtext">${details.html()}</div>`,
    '    </div>',
    '  </section>',
    '  <section class="uv-service-cta">',
    '    <div class="uv-shell">',
    '      <div class="uv-service-cta__inner">',
    '        <div>',
    '          <h2>İLETİŞİM & DEMO BİLGİLERİ</h2>',
    '          <p>Demo ve Teknik Bilgi İçin: +90 212 807 0 120</p>',
    '        </div>',
    '        <div class="uv-service-cta__actions">',
    '          <a class="btn-primary" href="/form/hemen-bilgi-al-1/">Bilgi Al</a>',
    '          <a class="btn-secondary" href="/sayfa/iletisim-5/">İletişime Geç</a>',
    '        </div>',
    '      </div>',
    '    </div>',
    '  </section>',
    '</main>',
    footer
  ].join('\n');

  await fs.writeFile(pagePath, rendered, 'utf8');
  console.log(`Rendered ${pagePath}`);
}

function cleanLegacyContent($, root) {
  root.find('svg').remove();
  root.contents().filter((_, node) => node.type === 'comment').remove();

  root.find('[style], [class], [id]').each((_, element) => {
    const node = $(element);
    node.removeAttr('style');
    node.removeAttr('class');
    node.removeAttr('id');
  });

  root.find('br').each((_, element) => {
    const node = $(element);
    if (!node.next().length && !node.prev().length) node.remove();
  });

  root.find('img').each((_, element) => {
    const img = $(element);
    img.attr('src', normalizeAssetPath(img.attr('src')));
    img.attr('loading', 'lazy');
    img.attr('decoding', 'async');
  });

  root.find('a').each((_, element) => {
    const link = $(element);
    const href = link.attr('href') || '';
    if (href.startsWith('../../')) {
      link.attr('href', normalizeAssetPath(href));
    }
  });
}

function benefitCards() {
  return [
    ['fa-bullseye', 'Özelleştirilmiş Eğitim Programları'],
    ['fa-code', 'Uygulamalı ve Proje Tabanlı Eğitimler'],
    ['fa-certificate', 'Sertifikalı Eğitimler']
  ].map(([icon, text]) => [
    '        <article class="uv-service-benefit">',
    `          <span aria-hidden="true"><i class="fa ${icon}"></i></span>`,
    `          <p>${escapeHtml(text)}</p>`,
    '        </article>'
  ].join('\n'));
}

function renderMediaCards(cards) {
  if (!cards.length) return [];

  const primary = cards[0];
  const side = cards.slice(1);
  return [
    '        <a class="uv-service-media-card uv-service-media-card--primary" href="#!" aria-label="Yazılım çözümü görseli">',
    `          <img src="${escapeHtml(primary.src)}" alt="${escapeHtml(primary.alt)}" width="760" height="520" loading="lazy" decoding="async">`,
    '        </a>',
    '        <div class="uv-service-media-grid__side">',
    ...side.map((card) => [
      '          <a class="uv-service-media-card" href="#!" aria-label="Yazılım çözümü görseli">',
      `            <img src="${escapeHtml(card.src)}" alt="${escapeHtml(card.alt)}" width="520" height="250" loading="lazy" decoding="async">`,
      '          </a>'
    ].join('\n')),
    '        </div>'
  ];
}

async function readSourceHtml(pagePath, slug) {
  const html = await fs.readFile(pagePath, 'utf8');
  if (html.includes('tm-dis')) return html;

  try {
    return execFileSync('git', ['show', `HEAD:os/${slug}/index.html`], {
      cwd: rootDir,
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 8
    });
  } catch (error) {
    return html;
  }
}

function firstNonEmptyParagraphText($, root) {
  const paragraph = root.find('p').filter((_, element) => $(element).text().replace(/\s+/g, ' ').trim()).first();
  return paragraph.text().replace(/\s+/g, ' ').trim();
}

function lastNonEmptyParagraphText($, root) {
  const paragraphs = root.find('p').filter((_, element) => $(element).text().replace(/\s+/g, ' ').trim());
  return paragraphs.last().text().replace(/\s+/g, ' ').trim();
}

function firstStrongText($, root) {
  return root.find('strong,b').map((_, element) => $(element).text().replace(/\s+/g, ' ').trim()).get().find(Boolean) || '';
}

function firstMeaningfulHeading($, root) {
  return root.find('p,strong,b,span').map((_, element) => $(element).text().replace(/\s+/g, ' ').trim()).get()
    .find((text) => text.length >= 8 && text.length <= 120) || '';
}

function firstUsefulSentence(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  const semantic = text.match(/Yıldız Teknopark.*?sunuyoruz\./);
  if (semantic) return semantic[0];
  return text.slice(0, 220).trim();
}

function removeFirstNonEmptyParagraph($, root) {
  root.find('p').filter((_, element) => $(element).text().replace(/\s+/g, ' ').trim()).first().remove();
}

function removeLastNonEmptyParagraph($, root) {
  root.find('p').filter((_, element) => $(element).text().replace(/\s+/g, ' ').trim()).last().remove();
}

function normalizeAssetPath(value) {
  return String(value || '').trim().replace(/^(\.\.\/)+/, '/').replace(/^\.?\//, '/');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

renderStaticServicePage(process.argv[2]).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
