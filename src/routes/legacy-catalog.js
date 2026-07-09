const fs = require('fs/promises');
const path = require('path');
const express = require('express');
const prisma = require('../db');

const router = express.Router();
const rootDir = path.resolve(__dirname, '../..');
const allProductsTemplatePath = path.join(rootDir, 'tum-urunler/index.html');
const legacyBlogDetailTemplatePath = path.join(rootDir, 'blog-detay', 'unreal-engine-egitimi-295', 'index.html');
const productGridPattern = /<section class="pbl-product-card-area-4 pbl-product-card-area-mobile-2" style="--gap:10px">[\s\S]*?<\/section>/i;
const blogPaginationPattern = /<div class="box-pagination col-md-6 col-sm-6 text-right"><ul class="pagination">[\s\S]*?<\/ul><\/div>/i;
const blogGridPattern = /(<div class="products-list row grid ana_urunler">)([\s\S]*?)(\s*<\/div>\s*<div class="product-filter product-filter-bottom filters-panel")/i;
const blogSearchInputPattern = /(<input\b[^>]*\bid=["']blog_query["'][^>]*\bvalue=["'])[^"']*(["'])/i;
const blogDetailTitlePattern = /<h1 class="modtitle">[\s\S]*?<\/h1>/i;
const blogDetailMetaTitlePattern = /<title>[\s\S]*?<\/title>/i;
const blogDetailMetaNameTitlePattern = /<meta name='title' content='[^']*' \/>/i;
const blogDetailMetaDescriptionPattern = /<meta name='description' content='[^']*' \/>/i;
const blogDetailCanonicalPattern = /<link rel="canonical" href="[^"]*" \/>/i;
const blogDetailBreadcrumbCurrentPattern = /<li><a href="#">[\s\S]*?<\/a><\/li>/i;
const blogDetailArticleDatePattern = /<span class="article-date">[\s\S]*?<\/span>/i;
const blogDetailBannerPattern = /<div class="banners">[\s\S]*?<\/div>\s*<\/div>/i;
const blogDetailContentPattern = /(<div class="row blog-icerik">\s*<div class="col-md-12">\s*)[\s\S]*?(\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<div class="modal fade" id="bize_sorun")/i;

let allProductsTemplate = null;
let legacyBlogTotalPages = null;
let legacyStaticBlogCards = null;
let legacyBlogDetailTemplate = null;

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

function normalizeSearchText(value) {
  return String(value || '')
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripHtml(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeAssetPath(value, fallback = '/uploads/fm/placeholder-social.png') {
  const pathValue = String(value || '').trim();
  if (!pathValue) return fallback;
  if (/^(https?:)?\/\//i.test(pathValue) || pathValue.startsWith('data:')) return pathValue;
  return pathValue.startsWith('/') ? pathValue : `/${pathValue}`;
}

function formatBlogDate(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
}

function productImage(product) {
  return product.image || '../uploads/fm/placeholder-social.png';
}

function productUrl(product) {
  return `../urun/${encodeURIComponent(product.slug)}/`;
}

function productSearchText(product) {
  return normalizeSearchText([
    product.title,
    product.summary,
    product.content,
    product.duration,
    product.lessonType,
    product.certificate,
    product.category ? product.category.name : '',
    product.category ? product.category.slug : '',
    product.slug
  ].join(' '));
}

function shouldIncludeProduct(product, query, categorySlug) {
  if (categorySlug && (!product.category || product.category.slug !== categorySlug)) {
    return false;
  }

  if (!query) return true;
  return productSearchText(product).includes(normalizeSearchText(query));
}

function renderLegacyProductCard(product, index) {
  const title = escapeHtml(product.title);
  const url = productUrl(product);
  const image = escapeHtml(productImage(product));
  const metadata = escapeHtml([
    product.summary,
    product.duration,
    product.lessonType,
    product.certificate,
    product.category ? product.category.name : ''
  ].filter(Boolean).join(' '));

  return `<div class="pbl-product-card-item"><div class="pbl-private-info"><span class="sr-only">${metadata}</span></div><div class="pbl-product-card-item-image ratio-1"><a href="${url}"><img class="lazy" src="${image}" alt="${title}"></a>
				<div class="product-action">
		            <button onclick="return toggleFavorite(${product.id})" class="pbl-product-detail-buy-box-buttons-add-favorites favorite-${product.id}" data-toggle="tooltip" data-original-title="Favorilerine Ekle"
								title="Favorilerine Ekle" data-placement="right"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><path fill="currentColor" d="M19.66 3.99c-2.64-1.8-5.9-.96-7.66 1.1c-1.76-2.06-5.02-2.91-7.66-1.1c-1.4.96-2.28 2.58-2.34 4.29c-.14 3.88 3.3 6.99 8.55 11.76l.1.09c.76.69 1.93.69 2.69-.01l.11-.1c5.25-4.76 8.68-7.87 8.55-11.75c-.06-1.7-.94-3.32-2.34-4.28zM12.1 18.55l-.1.1l-.1-.1C7.14 14.24 4 11.39 4 8.5C4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5c0 2.89-3.14 5.74-7.9 10.05z"></path></svg></button>
		            <button onclick="openProductDetailsModal(${product.id})"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><path fill="currentColor" d="M12 9a3 3 0 0 1 3 3a3 3 0 0 1-3 3a3 3 0 0 1-3-3a3 3 0 0 1 3-3m0-4.5c5 0 9.27 3.11 11 7.5c-1.73 4.39-6 7.5-11 7.5S2.73 16.39 1 12c1.73-4.39 6-7.5 11-7.5M3.18 12a9.821 9.821 0 0 0 17.64 0a9.821 9.821 0 0 0-17.64 0"/></svg> Hızlı Bakış</button>
		        </div></div><div class="pbl-product-card-item-name">
    <a href="${url}">${title}</a>
</div><div class="pbl-product-card-item-brand">
        <a href="../marka/unityverse-academy-1/">Unityverse Academy</a>
    </div><div class="pbl-product-card-item-price-add-chart"><div class="add-cart">
		<button class="add" onclick="return addToBasket(${product.id},1, false, 0, 0, ${index})">
                    Eğitime Kaydol
         </button>
	</div></div></div>`;
}

async function loadAllProductsTemplate() {
  if (!allProductsTemplate) {
    allProductsTemplate = await fs.readFile(allProductsTemplatePath, 'utf8');
  }

  return allProductsTemplate;
}

async function loadLegacyBlogDetailTemplate() {
  if (!legacyBlogDetailTemplate) {
    legacyBlogDetailTemplate = await fs.readFile(legacyBlogDetailTemplatePath, 'utf8');
  }

  return legacyBlogDetailTemplate;
}

async function publishedProducts() {
  return prisma.product.findMany({
    where: { status: 'PUBLISHED' },
    include: { category: true },
    orderBy: [{ sortOrder: 'asc' }, { id: 'desc' }]
  });
}

function legacyPageInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function legacyBlogPaginationItem(page, currentPage, label = String(page)) {
  if (page === currentPage) {
    return `<li onclick="return false" class="active"><a href="#">${label}</a></li>`;
  }

  return `<li onclick="return getresults(${page})"><a href="#!">${label}</a></li>`;
}

function legacyBlogPaginationPages(currentPage, totalPages) {
  if (totalPages <= 8) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 5) {
    return [1, 2, 3, 4, 5, 6, 7, 'ellipsis', totalPages];
  }

  if (currentPage >= totalPages - 4) {
    return [1, 'ellipsis', totalPages - 6, totalPages - 5, totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }

  return [1, 'ellipsis-prev', currentPage - 2, currentPage - 1, currentPage, currentPage + 1, currentPage + 2, 'ellipsis-next', totalPages];
}

function renderLegacyBlogPagination(currentPage, totalPages) {
  const items = legacyBlogPaginationPages(currentPage, totalPages).map((page) => {
    if (page === 'ellipsis' || page === 'ellipsis-next') {
      return legacyBlogPaginationItem(Math.min(totalPages, currentPage + 4), currentPage, '...');
    }

    if (page === 'ellipsis-prev') {
      return legacyBlogPaginationItem(Math.max(1, currentPage - 4), currentPage, '...');
    }

    return legacyBlogPaginationItem(page, currentPage);
  });

  if (currentPage < totalPages) {
    items.push(`<li onclick="return getresults(${currentPage + 1})"><a href="#">&gt;</a></li>`);
  }

  return `<div class="box-pagination col-md-6 col-sm-6 text-right"><ul class="pagination">${items.join('')}</ul></div>`;
}

function blogExcerpt(post, maxLength = 140) {
  const text = stripHtml(post.excerpt || post.content || '');
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}...`;
}

function renderAdminBlogCard(post) {
  const title = escapeHtml(post.title);
  const excerpt = escapeHtml(blogExcerpt(post));
  const image = escapeAttribute(normalizeAssetPath(post.image));
  const href = `/blog-detay/${encodeURIComponent(post.slug)}/`;

  return `<div class="product-layout col-md-4 col-sm-6 col-xs-12">
									<div class="product-item-container">
										<div class="left-block">
											<div class="product-image-container second_img ">
												<a href="${href}"><img src="${image}" alt="${title}" class="img-responsive" /></a>
											</div>
										</div>
										<div class="right-block">
											<div class="caption">
												<h2><a href="${href}">${title}</a></h2>
												<h4 class="pbl-blog-small-text">${excerpt}</h4>
											</div>
											<div class="button-group">
												<a class="addToCart w100" href="${href}"><span class="">Devamı</span></a>
											</div>
										</div><!-- right block -->
									</div>
						</div>`;
}

function renderLegacyBlogDetailBanner(post) {
  const image = normalizeAssetPath(post.image, '');
  if (!image) return '';

  return `<div class="banners">
									<div>
											<img src="${escapeAttribute(image)}" alt="${escapeAttribute(post.title)}">
									</div>
								</div>
							</div>`;
}

async function renderLegacyBlogDetail(post, req) {
  const template = await loadLegacyBlogDetailTemplate();
  const title = escapeHtml(post.title);
  const description = escapeAttribute(blogExcerpt(post, 160));
  const canonical = `${req.protocol}://${req.get('host')}/blog-detay/${post.slug}/`;
  const content = post.content || '';
  const renderedHtml = template
    .replace(blogDetailMetaTitlePattern, `<title>${title}</title>`)
    .replace(blogDetailMetaNameTitlePattern, `<meta name='title' content='${escapeAttribute(post.title)}' />`)
    .replace(blogDetailMetaDescriptionPattern, `<meta name='description' content='${description}' />`)
    .replace(blogDetailCanonicalPattern, `<link rel="canonical" href="${canonical}" />`)
    .replace(blogDetailBreadcrumbCurrentPattern, `<li><a href="#">${title}</a></li>`)
    .replace(blogDetailTitlePattern, `<h1 class="modtitle">${title}</h1>`)
    .replace(blogDetailArticleDatePattern, `<span class="article-date">${escapeHtml(formatBlogDate(post.publishedAt || post.createdAt))}</span>`)
    .replace(blogDetailBannerPattern, renderLegacyBlogDetailBanner(post))
    .replace(blogDetailContentPattern, `$1\n${content}\n$2`);

  return ensureLegacyWhatsappButton(normalizeLegacyBlogPaths(renderedHtml));
}

function createBlogCard(post) {
  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    excerpt: blogExcerpt(post),
    image: normalizeAssetPath(post.image),
    href: `/blog-detay/${post.slug}/`,
    publishedAt: post.publishedAt,
    formattedDate: formatBlogDate(post.publishedAt || post.createdAt),
    status: post.status
  };
}

function extractLegacyBlogCards(html) {
  const gridMatch = html.match(blogGridPattern);
  if (!gridMatch) return [];

  return gridMatch[2].match(/\s*<div class="product-layout col-md-4 col-sm-6 col-xs-12">[\s\S]*?(?=\s*<div class="product-layout col-md-4 col-sm-6 col-xs-12">|\s*$)/g) || [];
}

function legacyBlogCardKey(card) {
  const hrefMatch = card.match(/href=(["'])([^"']*\/blog-detay\/[^"']+)\1/i);

  return hrefMatch ? hrefMatch[2].replace(/^(\.\.\/)+/, '/') : card;
}

function legacyBlogCardText(card) {
  return stripHtml(card);
}

function renderLegacyBlogEmptySearch(query) {
  return `<div class="col-xs-12"><div class="alert alert-info" role="status">"${escapeHtml(query)}" araması için sonuç bulunamadı.</div></div>`;
}

async function collectLegacyBlogCards() {
  if (legacyStaticBlogCards) return legacyStaticBlogCards;

  const totalPages = await detectLegacyBlogTotalPages();
  const pagePaths = [
    path.join(rootDir, 'blog', 'index.html'),
    ...Array.from({ length: totalPages }, (_, index) => path.join(rootDir, 'blog', String(index + 1), 'index.html'))
  ];
  const cardsByKey = new Map();

  await Promise.all(pagePaths.map(async (pagePath) => {
    try {
      const html = await fs.readFile(pagePath, 'utf8');

      extractLegacyBlogCards(html).forEach((card) => {
        cardsByKey.set(legacyBlogCardKey(card), card);
      });
    } catch (error) {
      // Missing legacy blog pages are ignored; pagination is based on existing folders.
    }
  }));

  legacyStaticBlogCards = [...cardsByKey.values()];
  return legacyStaticBlogCards;
}

async function collectAdminBlogCards() {
  const posts = await prisma.blogPost.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }]
  });

  return posts.map(renderAdminBlogCard);
}

async function collectAllBlogCards() {
  const [adminCards, staticCards] = await Promise.all([
    collectAdminBlogCards(),
    collectLegacyBlogCards()
  ]);
  const cardsByKey = new Map();

  [...adminCards, ...staticCards].forEach((card) => {
    cardsByKey.set(legacyBlogCardKey(card), card);
  });

  return [...cardsByKey.values()];
}

function replaceLegacyBlogGrid(html, cards) {
  return html.replace(blogGridPattern, `$1\n${cards.join('\n')}\n$3`);
}

async function renderLegacyBlogList(html, currentPage, pageSize) {
  const cards = await collectAllBlogCards();
  const totalPages = Math.max(1, Math.ceil(cards.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pagedCards = cards.slice((safeCurrentPage - 1) * pageSize, safeCurrentPage * pageSize);

  return replaceLegacyBlogGrid(html, pagedCards)
    .replace(blogPaginationPattern, renderLegacyBlogPagination(safeCurrentPage, totalPages));
}

async function renderLegacyBlogSearch(html, query) {
  const normalizedQuery = normalizeSearchText(query);
  const cards = await collectAllBlogCards();
  const matchingCards = cards.filter((card) => normalizeSearchText(legacyBlogCardText(card)).includes(normalizedQuery));
  const results = matchingCards.length ? matchingCards.join('\n') : renderLegacyBlogEmptySearch(query);

  return html
    .replace(blogGridPattern, `$1\n${results}\n$3`)
    .replace(blogPaginationPattern, '')
    .replace(blogSearchInputPattern, `$1${escapeAttribute(query)}$2`);
}

function normalizeLegacyBlogPaths(html) {
  return html
    .replace(/\b(href|src|action)=(["'])(\.\.\/)+/g, '$1=$2/')
    .replace(/url\((["']?)(\.\.\/)+/g, 'url($1/');
}

function ensureLegacyWhatsappButton(html) {
  if (html.includes('legacy-whatsapp-appointment')) return html;

  const style = `<style>
a.legacy-whatsapp-appointment{position:fixed;display:flex;align-items:center;justify-content:center;gap:10px;height:45px;bottom:75px;right:24px;left:inherit;background-color:#25d366;color:#fff!important;border-radius:40px;text-align:center;box-shadow:0 8px 24px rgba(37,211,102,.35);z-index:9999;padding:0 22px;font-size:16px;font-weight:600;line-height:1;text-decoration:none!important;webkit-transition:all 200ms ease 0s;-moz-transition:all 200ms ease 0s;-ms-transition:all 200ms ease 0s;-o-transition:all 200ms ease 0s;transition:all 200ms ease 0s;}
a.legacy-whatsapp-appointment i{font-size:24px;line-height:1;}
a.legacy-whatsapp-appointment:hover{background-color:#1ebe5d;color:#fff!important;}
@media (max-width:767px){a.legacy-whatsapp-appointment{right:15px;bottom:78px;height:42px;padding:0 16px;font-size:14px;}a.legacy-whatsapp-appointment i{font-size:22px;}}
</style>`;
  const button = '<a class="legacy-whatsapp-appointment" href="https://api.whatsapp.com/send?phone=905454228887&text=Merhaba,%20e%C4%9Fitimler%20hakk%C4%B1nda%20bilgi%20almak%20istiyorum" aria-label="WhatsApp ile iletişime geç" target="_blank" rel="noreferrer noopener"><i class="fa fa-whatsapp" aria-hidden="true"></i><span>Bir uzman ile görüşün</span></a>';

  return html
    .replace('</head>', `${style}\n</head>`)
    .replace('</body>', `${button}\n</body>`);
}

async function detectLegacyBlogTotalPages() {
  if (legacyBlogTotalPages) return legacyBlogTotalPages;

  const blogRoot = path.join(rootDir, 'blog');
  const entries = await fs.readdir(blogRoot, { withFileTypes: true }).catch(() => []);
  const pagesFromFolders = entries
    .filter((entry) => entry.isDirectory() && /^\d+$/.test(entry.name))
    .map((entry) => Number.parseInt(entry.name, 10));

  legacyBlogTotalPages = Math.max(1, ...pagesFromFolders);
  return legacyBlogTotalPages;
}

async function legacyBlogPagePath(page, preferNumberedPage = false) {
  const pagePath = page === 1 && !preferNumberedPage
    ? path.join(rootDir, 'blog', 'index.html')
    : path.join(rootDir, 'blog', String(page), 'index.html');

  await fs.access(pagePath);
  return pagePath;
}

router.get(['/blog', '/blog/', '/blog/:page(\\d+)', '/blog/:page(\\d+)/'], async (req, res, next) => {
  try {
    const requestedPage = legacyPageInteger(req.query.pg || req.params.page, 1);
    const pageSize = Math.min(48, legacyPageInteger(req.query.ps, 12));
    const currentPage = requestedPage;
    const staticTotalPages = await detectLegacyBlogTotalPages();
    const templatePage = Math.min(currentPage, staticTotalPages);
    const pagePath = await legacyBlogPagePath(templatePage, req.params.page !== undefined);
    const template = await fs.readFile(pagePath, 'utf8');
    const blogQuery = String(req.query.blog_query || '').trim();
    const renderedHtml = blogQuery
      ? await renderLegacyBlogSearch(template, blogQuery)
      : await renderLegacyBlogList(template, currentPage, pageSize);
    const html = ensureLegacyWhatsappButton(normalizeLegacyBlogPaths(renderedHtml));

    res.setHeader('Cache-Control', 'no-cache');
    return res.send(html);
  } catch (error) {
    return next(error);
  }
});

router.get(['/blog-detay/:slug', '/blog-detay/:slug/'], async (req, res, next) => {
  try {
    const slug = String(req.params.slug || '').trim();
    const post = await prisma.blogPost.findFirst({
      where: {
        slug,
        status: 'PUBLISHED'
      }
    });

    if (!post) return next();

    res.setHeader('Cache-Control', 'no-cache');
    return res.send(await renderLegacyBlogDetail(post, req));
  } catch (error) {
    return next(error);
  }
});

router.get(['/tum-urunler', '/tum-urunler/'], async (req, res, next) => {
  try {
    const [template, products] = await Promise.all([
      loadAllProductsTemplate(),
      publishedProducts()
    ]);
    const query = String(req.query.q || '').trim();
    const categorySlug = String(req.query.kategori || req.query.category || '').trim();
    const cards = products
      .filter((product) => shouldIncludeProduct(product, query, categorySlug))
      .map((product, index) => renderLegacyProductCard(product, index))
      .join('\n');
    const productGrid = `<section class="pbl-product-card-area-4 pbl-product-card-area-mobile-2" style="--gap:10px">\n${cards}\n</section>`;
    const html = template.replace(productGridPattern, productGrid);

    res.setHeader('Cache-Control', 'no-cache');
    res.send(html);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
