const fs = require('fs/promises');
const path = require('path');
const express = require('express');
const prisma = require('../db');
const { bankTransferQuote } = require('../services/bank-transfer-pricing');
const { productVariantLabel } = require('../services/product-variants');
const { prepareLegacyTabContent } = require('../services/youtube-embeds');

const router = express.Router();
const rootDir = path.resolve(__dirname, '../..');
const legacyProductTemplatePath = path.join(
  rootDir,
  'urun/2026-python-bootcamp-sifirdan-python-canli-online-egitimi-8/index.html'
);
const homeTemplatePath = path.join(rootDir, 'index.html');
const breadcrumbPattern = /<ul class="breadcrumb">[\s\S]*?<\/ul>/i;
const productDetailsPattern = /<div class="product-view row" id="product_details_content">[\s\S]*?<div class="modal fade" id="bize_sorun"/i;
const footerPattern = /<footer class="footer-container type_footer4">[\s\S]*?<\/footer>/i;

let legacyProductTemplate = null;
let homeFooterTemplate = null;

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toNumber(value) {
  if (value == null) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function effectivePrice(product) {
  const discountPrice = toNumber(product.discountPrice);
  if (discountPrice > 0) return discountPrice;
  return toNumber(product.price);
}

function formatMoney(value) {
  return new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(toNumber(value));
}

function formatRate(value) {
  return Number(value).toLocaleString('tr-TR', {
    maximumFractionDigits: 2
  });
}

function normalizeLegacyAssetPath(value) {
  const assetPath = String(value || '').trim();
  if (!assetPath) return '../../uploads/fm/placeholder-social.png';
  if (/^https?:\/\//i.test(assetPath) || assetPath.startsWith('data:')) return assetPath;
  if (assetPath.startsWith('../../') || assetPath.startsWith('../')) return assetPath;
  if (assetPath.startsWith('/')) return `../..${assetPath}`;
  return `../../${assetPath}`;
}

function productCode(product) {
  return product.code || `UV-${product.id}`;
}

function categoryName(product) {
  return product.category ? product.category.name : 'Eğitimler';
}

function categoryUrl(product) {
  if (!product.category || !product.category.slug) return '../../tum-urunler/';
  return `../../tum-urunler/?kategori=${encodeURIComponent(product.category.slug)}`;
}

function findTab(product, systemKey, fallbackIndex) {
  const tab = product.tabs.find((item) => item.systemKey === systemKey) || product.tabs[fallbackIndex];
  return tab && String(tab.content || '').trim() ? tab.content : '';
}

function renderFallbackOverview(product) {
  const content = product.content || product.summary || `${product.title} eğitimi hakkında detaylı bilgi.`;
  return `<h2 style="text-align: center;"><span style="font-size: 24px; color: #000080;"><strong>${escapeHtml(product.title)}</strong></span></h2>
<p><span style="font-size: 16px; color: #333333;">${escapeHtml(content)}</span></p>`;
}

function renderFallbackCurriculum(product) {
  if (!product.learningOutcomes.length) {
    return '<p><span style="font-size: 16px; color: #333333;">Ders içerikleri eğitim danışmanı tarafından kayıt sürecinde paylaşılır.</span></p>';
  }

  return `<ul>
${product.learningOutcomes.map((outcome) => `<li><span style="font-size: 16px; color: #333333;">${escapeHtml(outcome.text)}</span></li>`).join('\n')}
</ul>`;
}

function renderFallbackWhy(product) {
  return `<p><span style="font-size: 16px; color: #333333;">${escapeHtml(product.title)} eğitim programı uygulamalı öğrenme, mentorluk ve kariyer odaklı gelişim için hazırlanmıştır.</span></p>
<ul>
  <li><span style="font-size: 16px; color: #333333;">Sektör ihtiyaçlarına uygun güncel içerik.</span></li>
  <li><span style="font-size: 16px; color: #333333;">Unityverse Academy eğitmen kadrosu ile destekli eğitim süreci.</span></li>
  <li><span style="font-size: 16px; color: #333333;">Eğitim sonunda kariyer hedeflerine uygun proje ve portföy desteği.</span></li>
</ul>`;
}

function renderTabContent(product, systemKey, fallbackIndex, fallbackRenderer) {
  return findTab(product, systemKey, fallbackIndex) || fallbackRenderer(product);
}

function renderBreadcrumb(product) {
  return `<ul class="breadcrumb">
			<li><a href="../../"><i class="fa fa-home"></i></a></li>
			<li><a href="${categoryUrl(product)}">${escapeHtml(categoryName(product))}</a></li>
		</ul>`;
}

function publicProductVariants(variants) {
  return (Array.isArray(variants) ? variants : [])
    .filter((variant) => (
      variant
      && variant.isActive !== false
      && variant.variantProduct
      && variant.variantProduct.status === 'PUBLISHED'
    ))
    .sort((left, right) => (
      Number(left.sortOrder || 0) - Number(right.sortOrder || 0)
      || Number(left.id || 0) - Number(right.id || 0)
    ));
}

function renderProductVariantOptions(product, variants) {
  const visibleVariants = publicProductVariants(variants)
    .filter((variant) => productVariantLabel(variant));
  const productDuration = String(product.duration || '').trim();
  const rows = visibleVariants.length
    ? visibleVariants
    : productDuration ? [{
      id: product.id,
      variantProductId: product.id,
      variantProduct: product,
      label: productDuration,
      isDefault: true
    }] : [];

  return rows.map((variant) => {
    const variantProduct = variant.variantProduct;
    const label = escapeHtml(productVariantLabel(variant));
    const optionUrl = escapeHtml(`../../urun/${variantProduct.slug}`);
    const isActive = Number(variantProduct.id) === Number(product.id);

    return `<li data-product-id="${variantProduct.id}" producturl="${optionUrl}" value="${variantProduct.id}" class="${isActive ? 'active ' : ''}" data-bs-toggle="tooltip" data-bs-title="${label}"><a href="${optionUrl}">${label}</a></li>`;
  }).join('\n');
}

function renderEducationOptions(product, variants) {
  const options = renderProductVariantOptions(product, variants);
  if (!options) return '';

  return `<h4>Eğitim Seçenekleri</h4>
				<div class="w-100">
					<div class="attr-detail attr-size ">
						<strong class="mr-10">Eğitim Saatleri: </strong>
						<ul class="list-filter size-filter font-small " name="poptions1_${product.id}" id="poptions1_${product.id}">
							${options}
						</ul>
					</div>
				</div>`;
}

async function loadProductVariantContext(prismaClient, slug) {
  const product = await prismaClient.product.findFirst({
    where: {
      slug,
      status: 'PUBLISHED'
    },
    include: {
      category: true,
      tabs: { orderBy: { sortOrder: 'asc' } },
      learningOutcomes: { orderBy: { sortOrder: 'asc' } },
      productVariants: {
        include: { variantProduct: true },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }]
      },
      variantOfProducts: {
        where: { isActive: true },
        select: { parentProductId: true },
        orderBy: { id: 'asc' },
        take: 1
      }
    }
  });

  if (!product) return null;

  let variants = product.productVariants;
  if (!variants.length && product.variantOfProducts.length) {
    variants = await prismaClient.productVariant.findMany({
      where: { parentProductId: product.variantOfProducts[0].parentProductId },
      include: { variantProduct: true },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }]
    });
  }

  return {
    product,
    variants: publicProductVariants(variants)
  };
}

function renderLegacyProductDetails(product, pageOrigin, variants = []) {
  const title = escapeHtml(product.title);
  const summary = escapeHtml(product.summary || '');
  const image = normalizeLegacyAssetPath(product.image);
  const safeImage = escapeHtml(image);
  const code = escapeHtml(productCode(product));
  const category = escapeHtml(categoryName(product));
  const categorySlug = escapeHtml(product.category?.slug || '');
  const categoryHref = escapeHtml(categoryUrl(product));
  const price = effectivePrice(product);
  const formattedPrice = price > 0 ? `${formatMoney(price)} TL` : 'Fiyatı görmek için giriş yapın';
  const transferQuote = bankTransferQuote(product);
  const transferDiscount = price > 0 && transferQuote.hasDiscount
    ? `<small class="uv-bank-transfer-discount">Havale ile %${escapeHtml(formatRate(transferQuote.discountRate))} indirim: <strong>${escapeHtml(formatMoney(transferQuote.amount))} TL</strong></small>`
    : '';
  const productHref = `../../urun/${encodeURIComponent(product.slug)}/`;
  const overview = prepareLegacyTabContent(
    renderTabContent(product, 'OVERVIEW', 0, renderFallbackOverview),
    product.content,
    'tab-info',
    pageOrigin
  );
  const curriculum = prepareLegacyTabContent(
    renderTabContent(product, 'CURRICULUM', 1, renderFallbackCurriculum),
    product.content,
    'tab-additional-content2',
    pageOrigin
  );
  const why = prepareLegacyTabContent(
    renderTabContent(product, 'WHY', 2, renderFallbackWhy),
    product.content,
    'tab-additional-content3',
    pageOrigin
  );

  return `<div class="product-view row" id="product_details_content">
<div class="left-content-product col-lg-12 col-xs-12">
	<div class="row">
		<div class="content-product-left pbl-product-page-pictures ratio-1 col-sm-5 col-xs-12 ">
			<div class="large-image" data-content="Ön Sipariş">
				<div class="swiper pbl-product-slider" style="-swiper-navigation-color: var(--renk1); - -swiper-pagination-color: var(--renk1)">
					<div class="swiper-wrapper">
						<div class="swiper-slide"><a data-fancybox="gallery" data-index="0" title="${title}" href="${safeImage}"><img class="img_zoom lazy" data-zoom-image="${safeImage}" data-og-src="${safeImage}" src="${safeImage}" title="${title}" alt="${title}"/></a></div>
					</div>
					<div class="swiper-button-prev"></div>
					<div class="swiper-button-next"></div>
				</div>
			</div>
			<div thumbsSlider="" class="swiper pbl-product-slider-thumb">
				<div class="swiper-wrapper">
					<div class="swiper-slide thumbnail-slide"><img src="${safeImage}" data-zoom-image="${safeImage}" title="${title}" alt="${title}" /></div>
				</div>
				<div class="swiper-button-prev"></div>
				<div class="swiper-button-next"></div>
			</div>
		</div>
		<div class="content-product-right col-sm-7 col-xs-12">
			<div class="title-product"><h1>${title}</h1></div>
			<div class="pbl-stock-code"><span>Eğitim Kodu :</span><a href="javascript:void(0)" onclick="return copyToClipboard('${code}')"> ${code}</a></div>
			<div class="product-label form-group"><div class="uv-product-price-row"><div class="product_page_price price"><span class="price-new">${formattedPrice}</span></div>${transferDiscount}</div></div>
			<div class="d-flex flex-row" style="gap:10px">
				<button onclick="return alarmWhenPriceDrop(${product.id})" class="pbl-notifyme-price-drops"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 15 15"><path fill="currentColor" fill-rule="evenodd" d="m6.448.436l-1.13 1.129a.5.5 0 0 1-.344.143H3.196c-.822 0-1.488.666-1.488 1.488v1.778a.5.5 0 0 1-.143.345L.435 6.448a1.49 1.49 0 0 0 0 2.104l1.13 1.13a.5.5 0 0 1 .143.344v1.778c0 .822.666 1.488 1.488 1.488h1.778a.5.5 0 0 1 .345.143l1.129 1.13a1.49 1.49 0 0 0 2.104 0l1.13-1.13a.5.5 0 0 1 .344-.143h1.778c.822 0 1.488-.666 1.488-1.488v-1.778a.5.5 0 0 1 .143-.345l1.13-1.129a1.49 1.49 0 0 0 0-2.104l-1.13-1.13a.5.5 0 0 1-.143-.344V3.196c0-.822-.666-1.488-1.488-1.488h-1.778a.5.5 0 0 1-.345-.143L8.552.435a1.49 1.49 0 0 0-2.104 0m-1.802 9.21l5-5l.708.708l-5 5zM5 5v1h1V5zm4 5h1V9H9z" clip-rule="evenodd" /></svg> Fiyatı Düşünce Haber Ver</button>
				<button onclick="return openRecommendProduct(${product.id})" class="pbl-notifyme-price-drops"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><g fill="currentColor"><path d="M22 7.535V17a3 3 0 0 1-2.824 2.995L19 20H5a3 3 0 0 1-2.995-2.824L2 17V7.535l9.445 6.297l.116.066a1 1 0 0 0 .878 0l.116-.066z"/><path d="M19 4c1.08 0 2.027.57 2.555 1.427L12 11.797l-9.555-6.37a3 3 0 0 1 2.354-1.42L5 4z"/></g></svg> Ürünü Tavsiye Et</button>
			</div>
			<div class="product-box-desc product-features-box">
				<div class="inner-box-desc">
					<div class="brand"><span>Yer :</span><a href="../../marka/unityverse-academy-1/"> Unityverse Academy</a></div>
					<div class="brand"><span>Kategori :</span><a href="${categoryHref}"> ${category}</a></div>
				</div>
				<div class="inner-box-desc product_features"></div>
			</div>
			<div id="product">
				${renderEducationOptions(product, variants)}
				<div class="pbl-product-detail-buy-box b2c">
					<div class="pbl-product-detail-buy-box-quantity in_stock_class" data-buy-box-quantity="Adet">
						<div class="pbl-product-detail-buy-box-quantity-input"><input type="number" id="productcount" data-count-factor="0" value="1"></div>
						<div class="pbl-product-detail-buy-box-quantity-up-button plus-btn"></div>
						<div class="pbl-product-detail-buy-box-quantity-down-button minus-btn"></div>
					</div>
					<div class="pbl-product-detail-buy-box-buttons in_out_stock_div">
						<button onclick="__addToBasket(${product.id}, $('#productcount').val(), false, 0)" class="pbl-product-detail-buy-box-buttons-bay-button in_stock_class">Kursa Kayıt ol</button>
						<button onclick="__addToBasket(${product.id}, $('#productcount').val(), true, 0)" class="pbl-product-detail-buy-box-buttons-buy-now in_stock_class">Hemen Kayıt Ol</button>
						<a href="javascript:void(0)" style="display: none;" onclick="alarmWhenStock(${product.id})" class="pbl-product-detail-buy-box-buttons-let-me-know">GELİNCE HABER VER</a>
						<button onclick="return toggleFavorite(${product.id})" class="pbl-product-detail-buy-box-buttons-add-favorites favorite-${product.id}" data-toggle="tooltip" data-original-title="Favorilerine Ekle" title="Favorilerine Ekle"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><path fill="currentColor" d="M19.66 3.99c-2.64-1.8-5.9-.96-7.66 1.1c-1.76-2.06-5.02-2.91-7.66-1.1c-1.4.96-2.28 2.58-2.34 4.29c-.14 3.88 3.3 6.99 8.55 11.76l.1.09c.76.69 1.93.69 2.69-.01l.11-.1c5.25-4.76 8.68-7.87 8.55-11.75c-.06-1.7-.94-3.32-2.34-4.28zM12.1 18.55l-.1.1l-.1-.1C7.14 14.24 4 11.39 4 8.5C4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5c0 2.89-3.14 5.74-7.9 10.05z"></path></svg></button>
					</div>
				</div>
				<div class="pbl-scl-media">
					<span>PAYLAŞ :</span>
					<a rel="nofollow" href="https://web.whatsapp.com/send?text=${productHref}" target="_blank" class="pbl-scl-whatsapp" title="Whatsapp"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><path fill="currentColor" d="M19.05 4.91A9.816 9.816 0 0 0 12.04 2c-5.46 0-9.91 4.45-9.91 9.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21c5.46 0 9.91-4.45 9.91-9.91c0-2.65-1.03-5.14-2.9-7.01z" /></svg></a>
					<a rel="nofollow" href="https://www.facebook.com/sharer/sharer.php?&amp;u=${productHref}" target="_blank" class="pbl-scl-facebook" title="Facebook"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><path fill="currentColor" d="M14 13.5h2.5l1-4H14v-2c0-1.03 0-2 2-2h1.5V2.14c-.326-.043-1.557-.14-2.857-.14C11.928 2 10 3.657 10 6.7v2.8H7v4h3V22h4v-8.5Z" /></svg></a>
					<a rel="nofollow" href="https://twitter.com/share?url=${productHref}&text=${encodeURIComponent(product.title)}" target="_blank" class="pbl-scl-twitter" title="Twitter"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><path fill="currentColor" d="M18.205 2.25h3.308l-7.227 8.26l8.502 11.24H16.13l-5.214-6.817L4.95 21.75H1.64l7.73-8.835L1.215 2.25H8.04l4.713 6.231l5.45-6.231Z" /></svg></a>
					<a rel="nofollow" title="E-Mail" href="mailto:?subject=Bu ürünü görmenizi istiyorum...&amp;body=Buradan ürün detayını inceleyebilirsin: ${productHref}" target="_blank" class="pbl-scl-email"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 256 256"><path fill="currentColor" d="M224 44H32a12 12 0 0 0-12 12v136a20 20 0 0 0 20 20h176a20 20 0 0 0 20-20V56a12 12 0 0 0-12-12Zm-30.85 24L128 127.72L62.85 68ZM44 188V83.28l75.89 69.57a12 12 0 0 0 16.22 0L212 83.28V188Z" /></svg></a>
				</div>
			</div>
		</div>
	</div>
</div>
<div class="producttab col-xs-12">
	<div class="tabsslider col-xs-12" style="display: block;">
		<div class="pbl-all-features-tab-close-button"></div>
		<ul class="nav nav-tabs">
			<li class="active in" data-tab="tab-info"><a data-toggle="tab" href="#tab-info">Eğitime İlk Bakış</a></li>
			<li data-tab="tab-additional-content2"><a data-toggle="tab" href="#tab-additional-content2">Ders İçerikleri</a></li>
			<li data-tab="tab-additional-content3"><a data-toggle="tab" href="#tab-additional-content3">Neden Bu Eğitimi Almalısınız?</a></li>
		</ul>
		<div class="tab-content col-xs-12">
			<div id="tab-info" class="tab-pane fade active in" data-course-overview data-course-category="${categorySlug}">${overview}</div>
			<div id="tab-additional-content2" class="tab-pane fade">${curriculum}</div>
			<div id="tab-additional-content3" class="tab-pane fade">${why}</div>
		</div>
	</div>
</div>
<div class="related titleLine products-list grid module col-md-12">
	<h3 class="modtitle"><span>Benzer Eğitimler</span></h3>
	<div class="releate-products">
		<div class="text-muted">${summary}</div>
	</div>
</div>
<script type="text/javascript">
var base_price = ${price.toFixed(2)};
function calculateExtraPrice() {
	return ["", 0, 0];
}
function __addToBasket(productid, count, getit, pdigital = 0) {
	if (typeof _addToBasket === "function") {
		_addToBasket(productid, count || 1, "", "", getit, 0, "", 0, pdigital);
	}
	return false;
}
</script>
<script>
document.addEventListener('DOMContentLoaded', function () {
	var buyBox = document.querySelector('.pbl-product-detail-buy-box');
	var footer = document.querySelector('footer');
	if (!buyBox || !footer) return;
	function checkFooterIntersection() {
		var footerRect = footer.getBoundingClientRect();
		var buyBoxRect = buyBox.getBoundingClientRect();
		buyBox.classList.toggle('hidden-by-footer', buyBoxRect.bottom > footerRect.top);
	}
	window.addEventListener('scroll', checkFooterIntersection);
	window.addEventListener('resize', checkFooterIntersection);
	checkFooterIntersection();
	});
	</script>
	<script src="../../public/tema10/js/course-overview.js?v=20260726-2" defer></script>
	</div>
	</div>
	</div>
	</div>
	</div>
	</div>
	<div class="modal fade" id="bize_sorun"`;
	}

async function loadLegacyProductTemplate() {
  if (!legacyProductTemplate) {
    legacyProductTemplate = await fs.readFile(legacyProductTemplatePath, 'utf8');
  }

  return legacyProductTemplate;
}

async function loadHomeFooterTemplate() {
  if (!homeFooterTemplate) {
    const homeTemplate = await fs.readFile(homeTemplatePath, 'utf8');
    const match = homeTemplate.match(footerPattern);

    homeFooterTemplate = match
      ? match[0]
        .replace(/(href|src|action)="\.\//g, '$1="../../')
        .replace(/(href|src|action)='\.\//g, "$1='../../")
      : '';
  }

  return homeFooterTemplate;
}

function renderPage(template, footer, product, pageOrigin, variants = []) {
  const title = escapeHtml(product.title);
  const canonicalUrl = `${pageOrigin}/urun/${encodeURIComponent(product.slug)}/`;
  const description = escapeHtml(product.summary || `${product.title} - Unityverse Academy`);
  let html = template
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${title}</title>`)
    .replace(/<link\s+rel=["']canonical["']\s+href=["'][^"']*["']\s*\/?>/i, `<link rel="canonical" href="${canonicalUrl}" />`)
    .replace(/<meta\s+property=["']og:url["']\s+content=["'][^"']*["']\s*\/?>/i, `<meta property="og:url" content="${canonicalUrl}" />`)
    .replace(/<meta\s+property=["']og:title["']\s+content=["'][^"']*["']\s*\/?>/i, `<meta property="og:title" content="${title}" />`)
    .replace(/<meta\s+name=["']description["']\s+content=["'][^"']*["']\s*\/?>/i, `<meta name="description" content="${description}" />`)
    .replace('</head>', '<link rel="stylesheet" href="../../public/tema10/css/bank-transfer-discount.css?v=20260725-1"></head>')
    .replace(breadcrumbPattern, renderBreadcrumb(product))
    .replace(productDetailsPattern, renderLegacyProductDetails(product, pageOrigin, variants));

  if (footer) {
    html = html.replace(footerPattern, footer);
  }

  return html;
}

router.get(['/urun/:slug', '/urun/:slug/'], async (req, res, next) => {
  try {
    const context = await loadProductVariantContext(prisma, req.params.slug);

    if (!context) {
      res.status(404).send('404 File Not Found');
      return;
    }

    const [template, footer] = await Promise.all([
      loadLegacyProductTemplate(),
      loadHomeFooterTemplate()
    ]);
    const pageOrigin = `${req.protocol}://${req.get('host')}`;
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.send(renderPage(template, footer, context.product, pageOrigin, context.variants));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
module.exports.loadProductVariantContext = loadProductVariantContext;
module.exports.publicProductVariants = publicProductVariants;
module.exports.renderEducationOptions = renderEducationOptions;
module.exports.renderLegacyProductDetails = renderLegacyProductDetails;
module.exports.renderProductVariantOptions = renderProductVariantOptions;
