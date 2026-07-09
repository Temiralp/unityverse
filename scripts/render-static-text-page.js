const fs = require('fs/promises');
const path = require('path');

const cheerio = require('cheerio');
const ejs = require('ejs');

const rootDir = path.resolve(__dirname, '..');

async function renderStaticTextPage(slug) {
  if (!slug) {
    throw new Error('Usage: node scripts/render-static-text-page.js <sayfa-slug>');
  }

  const pagePath = path.join(rootDir, 'sayfa', slug, 'index.html');
  const sourceHtml = await fs.readFile(pagePath, 'utf8');
  const $ = cheerio.load(sourceHtml, { decodeEntities: false });
  const title = ($('#content h1').first().text() || $('title').first().text() || slug).trim();
  const description = ($('meta[name="description"]').attr('content') || title).trim();
  const content = $('#content').first();

  if (!content.length) {
    throw new Error(`Could not find #content in ${pagePath}`);
  }

  content.find('h1').first().remove();

  const header = await ejs.renderFile(path.join(rootDir, 'src/views/partials/header.ejs'), {
    pageTitle: `${title} | Unityverse Academy`,
    activeNav: '',
    extraStyles: ['/public/tema10/css/page.css']
  });
  const footer = await ejs.renderFile(path.join(rootDir, 'src/views/partials/footer.ejs'), {
    extraScripts: []
  });

  const body = [
    header.replace('<body>', '<body class="uv-text-page">'),
    '<main id="main-content">',
    '  <section class="uv-text-hero" aria-labelledby="page-title">',
    '    <div class="uv-shell">',
    '      <nav aria-label="Breadcrumb">',
    '        <ol class="uv-text-breadcrumb">',
    '          <li><a href="/">Ana Sayfa</a></li>',
    `          <li aria-current="page">${escapeHtml(title)}</li>`,
    '        </ol>',
    '      </nav>',
    `      <h1 id="page-title">${escapeHtml(title)}</h1>`,
    '    </div>',
    '  </section>',
    '  <section class="uv-text-section">',
    '    <div class="uv-shell">',
    '      <article class="uv-text-content">',
    content.html(),
    '      </article>',
    '    </div>',
    '  </section>',
    '</main>',
    footer
  ].join('\n');

  const rendered = body
    .replace(
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      `<meta name="viewport" content="width=device-width, initial-scale=1">\n  <meta name="description" content="${escapeHtml(description)}">`
    );

  await fs.writeFile(pagePath, rendered, 'utf8');
  console.log(`Rendered ${pagePath}`);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

renderStaticTextPage(process.argv[2]).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
