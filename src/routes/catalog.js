const express = require('express');

const prisma = require('../db');

const router = express.Router();
const BLOG_PAGE_SIZE = 9;
const CATALOG_PAGE_SIZE = 12;

const instructors = [
  {
    name: 'Prof. Dr. Çetin Kaya Koç',
    image: '/uploads/fm/Kurucu_Eğitmen_Prof__Dr__Çetin_Kaya_Koç_pdf_11.jpg',
    link: 'http://cetinkayakoc.net/ozgecmis.html',
    specialty: 'Yazılım Eğitimleri',
    bio: '',
    courses: []
  },
  {
    name: 'Öğr. Gör. Nevin Eryılmaz',
    image: '/uploads/fm/Kurucu_Eğitmen_Öğr__Gör__Nevin_Eryılmaz_pdf_1.jpg',
    link: '/uploads/fm/akademik_nevin_eryilmaz1.pdf',
    specialty: 'Akademik Eğitmen',
    bio: '',
    courses: []
  },
  { name: 'Ramin Abbaszadi', image: '/uploads/fm/Ramin_Abbaszadi_pdf_11.jpg', link: '/uploads/fm/RaminAbbaszadi_CV.pdf', specialty: 'Eğitmen', bio: '', courses: [] },
  { name: 'Doç. Dr. Ali Çivril', image: '/uploads/fm/Doç__Dr__Ali_Çivril_pdf_11.jpg', link: 'https://www.alicivril.com/index-tr.html', specialty: 'Eğitmen', bio: '', courses: [] },
  { name: 'Engin Deniz Erbaş', image: '/uploads/fm/Ögr__Gör__Engin_Deniz_Erbaş_pdf_12.jpg', link: '/uploads/fm/EnginDenizErbas_Cv.pdf', specialty: 'Eğitmen', bio: '', courses: [] },
  { name: 'Hüseyin Çay', image: '/uploads/fm/Hüseyin_Çay_pdf_11.jpg', link: '/uploads/fm/huseyıncay.pdf', specialty: 'Eğitmen', bio: '', courses: [] },
  { name: 'Yılmaz Erdoğan', image: '/uploads/fm/Yılmaz_Erdoğan_pdf_11.jpg', link: '/uploads/fm/Yilmaz_Erdogan_CV.pdf', specialty: 'Eğitmen', bio: '', courses: [] },
  { name: 'Esmanur Bayar', image: '/uploads/fm/Esma_Bayar_pdf_11.jpg', link: '/uploads/fm/cv_esmanurbayar1.pdf', specialty: 'Eğitmen', bio: '', courses: [] },
  { name: 'İlyas Sözüer', image: '/uploads/fm/İlyas_Sözüer_pdf_11.jpg', link: '/uploads/fm/ilyas_sözüer_cfa422_ozgecmis.pdf', specialty: 'Eğitmen', bio: '', courses: [] },
  { name: 'Tuncay Türkyılmaz', image: '/uploads/fm/Ögr__Gör__Tuncay_Türkyılmaz_pdf_11.jpg', link: '/uploads/fm/Tuncay_TurkyılmazCV.pdf', specialty: 'Eğitmen', bio: '', courses: [] },
  { name: 'Feyyaz Ağırman', image: '/uploads/fm/Feyyaz_Ağırman_pdf_11.jpg', link: '/uploads/fm/FEYYAZ_AĞIRMAN_CV_TR.pdf', specialty: 'Eğitmen', bio: '', courses: [] },
  { name: 'Arda Bulu', image: '/uploads/fm/Arda_BULU_pdf_12.jpg', link: '/uploads/fm/Arda_BULU_CV_En1.pdf', specialty: 'Eğitmen', bio: '', courses: [] },
  { name: 'İlkim Erbudak', image: '/uploads/fm/Çalışma_Yüzeyi_1-20_(6).jpg', link: '/uploads/fm/ilkim+erbudak+ingilizce+CV.pdf', specialty: 'Eğitmen', bio: '', courses: [] },
  { name: 'Hasan Mert Öz', image: '/uploads/fm/Adsız_tasarım_(1).png', link: '/uploads/fm/Hasan_Mert_Öz_-_CV.pdf', specialty: 'Eğitmen', bio: '', courses: [] }
];

function renderPage(res, view, options) {
  res.render(view, {
    extraStyles: ['/public/tema10/css/corporate.css'],
    ...options
  });
}

router.get(['/sayfa/hakkimizda-25', '/sayfa/hakkimizda-25/', '/sayfa/hakkimizda/25', '/sayfa/hakkimizda/25/'], (req, res) => {
  renderPage(res, 'pages/about', {
    activeNav: 'about',
    pageTitle: 'Hakkımızda | Unityverse Academy',
    extraScripts: ['/public/tema10/js/counters.js'],
    instructors: instructors.slice(0, 2)
  });
});

router.get(['/sayfa/egitmenler-10', '/sayfa/egitmenler-10/', '/sayfa/egitmenlerimiz-10', '/sayfa/egitmenlerimiz-10/'], (req, res) => {
  renderPage(res, 'pages/instructors', {
    activeNav: 'trainers',
    pageTitle: 'Eğitmenlerimiz | Unityverse Academy',
    extraScripts: ['/public/tema10/js/instructors.js'],
    instructors
  });
});

router.get(['/sayfa/iletisim-5', '/sayfa/iletisim-5/', '/sayfa/iletisim-bilgileri-5', '/sayfa/iletisim-bilgileri-5/'], async (req, res) => {
  let contactCourses = [];

  try {
    contactCourses = await prisma.product.findMany({
      where: { status: 'PUBLISHED' },
      select: { title: true, slug: true },
      orderBy: { title: 'asc' },
      take: 250
    });
  } catch (error) {
    contactCourses = [];
  }

  renderPage(res, 'pages/contact', {
    activeNav: 'contact',
    pageTitle: 'İletişim Bilgileri | Unityverse Academy',
    extraScripts: [
      '/public/tema10/js/form-protection.js?v=4',
      '/public/tema10/js/contact-form.js'
    ],
    contactCourses
  });
});

router.get(['/blog', '/blog/', '/blog/:page(\\d+)', '/blog/:page(\\d+)/'], async (req, res, next) => {
  try {
    const pageRequest = blogPageRequest(req);
    const { currentPage, pageSize, usesQueryPagination } = pageRequest;
    const where = { status: 'PUBLISHED' };
    const totalPosts = await prisma.blogPost.count({ where });
    const totalPages = Math.max(1, Math.ceil(totalPosts / pageSize));

    if (totalPosts > 0 && currentPage > totalPages) {
      return res.redirect(blogPageHref(totalPages, pageSize, usesQueryPagination));
    }

    const posts = totalPosts === 0
      ? []
      : await prisma.blogPost.findMany({
        where,
        orderBy: [{ id: 'desc' }]
      });
    const pagedPosts = sortBlogPosts(posts).slice(
      (currentPage - 1) * pageSize,
      currentPage * pageSize
    );

    return res.render('pages/blog', {
      activeNav: 'blog',
      pageTitle: 'Blog | Unityverse Academy',
      extraStyles: ['/public/tema10/css/blog.css'],
      blogCards: pagedPosts.map(createBlogCard),
      totalPosts,
      pagination: blogPagination(currentPage, totalPages, pageRequest)
    });
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

    if (!post) {
      return next();
    }

    const relatedPosts = await prisma.blogPost.findMany({
      where: {
        status: 'PUBLISHED',
        id: { not: post.id }
      },
      orderBy: [{ id: 'desc' }]
    });

    return res.render('pages/blog-detail', {
      activeNav: 'blog',
      pageTitle: `${post.title} | Unityverse Academy`,
      extraStyles: ['/public/tema10/css/blog.css'],
      extraScripts: ['/public/tema10/js/blog.js'],
      post: {
        ...post,
        image: normalizeAssetPath(post.image),
        formattedDate: formatBlogDate(post.publishedAt || post.createdAt)
      },
      relatedPosts: sortBlogPosts(relatedPosts).slice(0, 3).map(createBlogCard),
      sharePath: `${req.protocol}://${req.get('host')}/blog-detay/${post.slug}/`
    });
  } catch (error) {
    return next(error);
  }
});

function formatMoney(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return number.toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function productPrice(product) {
  const basePrice = product.price == null ? null : Number(product.price);
  const effectivePrice = product.discountPrice == null ? basePrice : Number(product.discountPrice);

  return {
    base: basePrice == null ? null : formatMoney(basePrice),
    effective: effectivePrice == null ? null : formatMoney(effectivePrice),
    hasDiscount: basePrice != null && effectivePrice != null && effectivePrice < basePrice
  };
}

function plainCourse(product) {
  const displayPrice = product.displayPrice || productPrice(product);
  const priceNumber = product.discountPrice == null
    ? Number(product.price || 0)
    : Number(product.discountPrice || 0);
  const searchText = [
    product.title,
    product.summary,
    product.content,
    product.lessonType,
    product.certificate,
    product.category ? product.category.name : ''
  ].join(' ').toLowerCase();

  return {
    id: product.id,
    title: product.title,
    slug: product.slug,
    summary: product.summary || '',
    image: product.image || '',
    category: product.category ? product.category.name : 'Eğitim',
    categorySlug: product.category ? product.category.slug : '',
    format: product.lessonType || '',
    duration: product.duration || '',
    certificate: product.certificate || '',
    price: priceNumber,
    displayPrice,
    href: `/urun/${product.slug}/`,
    isStajGarantili: searchText.includes('staj'),
    isOnline: searchText.includes('online'),
    isYuzYuze: searchText.includes('yüz yüze') || searchText.includes('yuz yuze'),
    level: searchText.includes('ileri') ? 'ileri' : searchText.includes('orta') ? 'orta' : 'baslangic'
  };
}

function stripHtml(value) {
  return String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function splitText(value) {
  return stripHtml(value)
    .split(/[\n\r.;•]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeAssetPath(value) {
  const path = String(value || '').trim();
  if (!path) return '';
  if (/^(https?:)?\/\//.test(path) || path.startsWith('/')) return path;
  return `/${path.replace(/^(\.\.\/)+/, '').replace(/^\.?\//, '')}`;
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

function blogExcerpt(post, maxLength = 140) {
  const text = stripHtml(post.excerpt || post.content || '');
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}...`;
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

function blogSortTime(post) {
  const date = post.publishedAt || post.createdAt;
  const time = date ? new Date(date).getTime() : 0;

  return Number.isNaN(time) ? 0 : time;
}

function sortBlogPosts(posts) {
  return [...posts].sort((a, b) => {
    const byDate = blogSortTime(b) - blogSortTime(a);
    if (byDate !== 0) return byDate;
    return Number(b.id || 0) - Number(a.id || 0);
  });
}

function blogPageInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function blogPageRequest(req) {
  const usesQueryPagination = req.query.pg !== undefined || req.query.ps !== undefined;
  const currentPage = blogPageInteger(req.query.pg || req.params.page, 1);
  const pageSize = Math.min(48, blogPageInteger(req.query.ps, BLOG_PAGE_SIZE));

  return {
    currentPage,
    pageSize,
    usesQueryPagination
  };
}

function blogPageHref(page, pageSize, usesQueryPagination) {
  if (usesQueryPagination) {
    return `/blog/?pg=${page}&ps=${pageSize}`;
  }

  return page === 1 ? '/blog/' : `/blog/${page}/`;
}

function blogPagination(currentPage, totalPages, options = {}) {
  const pageSize = options.pageSize || BLOG_PAGE_SIZE;
  const usesQueryPagination = Boolean(options.usesQueryPagination);
  const pages = [];
  const start = Math.max(1, currentPage - 2);
  const end = Math.min(totalPages, currentPage + 2);

  for (let page = start; page <= end; page += 1) {
    pages.push({
      number: page,
      href: blogPageHref(page, pageSize, usesQueryPagination),
      isCurrent: page === currentPage
    });
  }

  return {
    currentPage,
    totalPages,
    hasPrev: currentPage > 1,
    hasNext: currentPage < totalPages,
    prevHref: blogPageHref(currentPage - 1, pageSize, usesQueryPagination),
    nextHref: blogPageHref(currentPage + 1, pageSize, usesQueryPagination),
    pages
  };
}

function firstItems(items, count, fallback) {
  const source = items.length ? items : fallback;
  return source.slice(0, count);
}

function activeNavForProduct(product) {
  const categorySlug = product.category ? product.category.slug || '' : '';
  const haystack = `${categorySlug} ${product.title || ''}`.toLowerCase();

  if (haystack.includes('oyun') || haystack.includes('unity') || haystack.includes('unreal')) return 'game';
  if (haystack.includes('grafik') || haystack.includes('tasar') || haystack.includes('ui') || haystack.includes('video')) return 'design';
  if (haystack.includes('3d') || haystack.includes('3b') || haystack.includes('model')) return 'modeling';
  if (haystack.includes('animasyon') || haystack.includes('after')) return 'animation';
  if (haystack.includes('yazilim') || haystack.includes('program') || haystack.includes('python') || haystack.includes('test')) return 'software';

  return 'courses';
}

function buildProductDetail(product, relatedCourses) {
  const contentItems = splitText(product.content);
  const summaryItems = splitText(product.summary);
  const learnFallback = [
    'Gerçek proje akışıyla uygulamalı üretim yaparsınız',
    'Portfolyoya eklenebilir çıktılar hazırlarsınız',
    'Sektör odaklı araçları ve çalışma düzenini öğrenirsiniz',
    'Mentor desteğiyle kariyer hedefinize göre ilerlersiniz'
  ];
  const overview = product.summary || 'Bu eğitim, uygulamalı ders yapısı ve kariyer odaklı öğrenme akışıyla mesleki gelişiminizi destekler.';
  const learnItems = firstItems(contentItems.concat(summaryItems), 6, learnFallback);
  const curriculumSeeds = firstItems(contentItems, 9, [
    'Temel kavramlar ve araç kurulumu',
    'Uygulamalı ders akışı ve örnek üretimler',
    'Proje geliştirme ve portfolyo hazırlığı',
    'Kariyer hazırlığı ve final değerlendirme'
  ]);
  const curriculum = [];

  for (let index = 0; index < curriculumSeeds.length; index += 3) {
    const topics = curriculumSeeds.slice(index, index + 3);

    curriculum.push({
      title: `Modül ${curriculum.length + 1}`,
      topics,
      project: curriculum.length === 0
        ? `${product.title} için başlangıç projesi`
        : 'Portfolyo çıktısı ve uygulama çalışması'
    });
  }

  return {
    overview,
    why: [
      'Ana sayfadaki kariyer odaklı eğitim yaklaşımıyla aynı pratik üretim yapısını sürdürür.',
      'Dersler portfolyo, mentorluk ve sektör beklentileri etrafında kurgulanır.',
      'Eğitim sonunda öğrenilen konular gerçek proje çıktılarıyla pekiştirilir.'
    ],
    learnItems,
    curriculum,
    certificates: [
      {
        title: product.certificate || 'E-Devlet Onaylı Sertifika',
        description: 'Eğitim tamamlandığında sertifika süreciyle kariyer dosyanızı güçlendirebilirsiniz.'
      },
      {
        title: 'Unityverse Academy Katılım Belgesi',
        description: 'Program katılımı ve proje üretimi eğitim sonunda görünür hale gelir.'
      }
    ],
    instructors: [
      {
        name: 'Unityverse Academy Eğitmen Kadrosu',
        title: product.category ? `${product.category.name} Uzmanları` : 'Alan Uzmanları',
        bio: 'Sektör deneyimi olan eğitmenler uygulamalı proje akışı, mentorluk ve portfolyo hazırlığına odaklanır.',
        photo: null,
        cvUrl: '/sayfa/egitmenler-10/'
      }
    ],
    gallery: [
      product.image,
      product.category ? product.category.image : null
    ].filter(Boolean),
    faq: [
      {
        question: 'Eğitim kimler için uygun?',
        answer: 'Kariyer hedefi olan, uygulamalı öğrenmek isteyen ve düzenli proje üretimine zaman ayırabilecek öğrenciler için uygundur.'
      },
      {
        question: 'Eğitim sonunda sertifika veriliyor mu?',
        answer: product.certificate || 'Sertifika bilgisi eğitim danışmanları tarafından kayıt sürecinde paylaşılır.'
      },
      {
        question: 'Staj garantisi var mı?',
        answer: 'Staj garantisi seçili programlarda geçerlidir. Bu kurs için güncel koşulları kayıt öncesinde danışmanla netleştirebilirsiniz.'
      }
    ],
    relatedCourses: relatedCourses.map((course) => ({
      ...course,
      displayPrice: productPrice(course)
    }))
  };
}

router.get(['/urun/:slug', '/urun/:slug/'], async (req, res, next) => {
  try {
    const slug = String(req.params.slug || '').trim();
    const product = await prisma.product.findFirst({
      where: {
        slug,
        status: 'PUBLISHED'
      },
      include: { category: true }
    });

    if (!product) {
      return res.status(404).send('404 File Not Found');
    }

    const relatedCourses = await prisma.product.findMany({
      where: {
        status: 'PUBLISHED',
        id: { not: product.id },
        categoryId: product.categoryId || undefined
      },
      include: { category: true },
      orderBy: [{ sortOrder: 'asc' }, { id: 'desc' }],
      take: 8
    });

    res.render('catalog/product', {
      activeNav: activeNavForProduct(product),
      pageTitle: `${product.title} | Unityverse Academy`,
      extraStyles: ['/public/tema10/css/product-detail.css'],
      extraScripts: ['/public/tema10/js/courses.js', '/public/tema10/js/product-detail.js'],
      product: {
        ...product,
        displayPrice: productPrice(product)
      },
      detail: buildProductDetail(product, relatedCourses),
      relatedCoursesJson: relatedCourses.map((course) => plainCourse(course)),
      sharePath: `/urun/${product.slug}/`
    });
  } catch (error) {
    next(error);
  }
});

router.get(['/tum-urunler', '/tum-urunler/'], async (req, res, next) => {
  try {
    const categorySlug = String(req.query.kategori || req.query.category || '').trim();
    const q = String(req.query.q || '').trim();
    const currentPage = Math.max(1, Number.parseInt(req.query.page || '1', 10) || 1);
    const where = { status: 'PUBLISHED' };

    if (categorySlug) {
      where.category = { slug: categorySlug };
    }

    const [categories, allProducts] = await Promise.all([
      prisma.category.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]
      }),
      prisma.product.findMany({
        where,
        include: { category: true },
        orderBy: [{ sortOrder: 'asc' }, { id: 'desc' }]
      })
    ]);

    const selectedCategory = categorySlug
      ? categories.find((category) => category.slug === categorySlug)
      : null;
    const filteredProducts = q
      ? allProducts.filter((product) => {
        const haystack = [
          product.title,
          product.summary,
          product.content,
          product.lessonType,
          product.certificate,
          product.category ? product.category.name : ''
        ].join(' ').toLocaleLowerCase('tr-TR');

        return haystack.includes(q.toLocaleLowerCase('tr-TR'));
      })
      : allProducts;
    const totalProducts = filteredProducts.length;
    const totalPages = Math.max(1, Math.ceil(totalProducts / CATALOG_PAGE_SIZE));
    const safePage = Math.min(currentPage, totalPages);
    const pagedProducts = filteredProducts.slice(
      (safePage - 1) * CATALOG_PAGE_SIZE,
      safePage * CATALOG_PAGE_SIZE
    );
    const productsWithPrice = pagedProducts.map((product) => ({
      ...product,
      displayPrice: productPrice(product)
    }));

    res.render('catalog/products', {
      activeNav: 'courses',
      pageTitle: 'Tüm Eğitimler | Unityverse Academy',
      extraStyles: ['/public/tema10/css/catalog.css'],
      extraScripts: ['/public/tema10/js/courses.js'],
      categories,
      products: productsWithPrice,
      coursesJson: productsWithPrice.map((product) => plainCourse(product)),
      selectedCategory,
      categorySlug,
      q,
      totalProducts,
      pagination: {
        currentPage: safePage,
        totalPages,
        pageSize: CATALOG_PAGE_SIZE,
        hasPrev: safePage > 1,
        hasNext: safePage < totalPages
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
