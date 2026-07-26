const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const prisma = require('../db');
const { BLOG_CATEGORIES, blogCategoryByLegacyId } = require('../config/blog-categories');
const { requireAdmin, redirectIfLoggedIn } = require('../middleware/auth');
const {
  clearLoginFailures,
  isIpBlocked,
  isLoginBlocked,
  recordIpFailure,
  recordLoginFailure
} = require('../middleware/rate-limit');
const { parseIdParam } = require('../middleware/parse-id');
const { makeSlug } = require('../utils/slug');
const {
  buildProductFormOutcomes,
  buildProductFormTabs,
  replaceProductContentStructure
} = require('../services/product-tabs');
const {
  ProductVariantValidationError,
  normalizeProductVariantRows,
  replaceProductVariants
} = require('../services/product-variants');
const { validateBlogContentImages } = require('../services/blog-images');
const {
  hasAnyRegistrationProfileInput,
  validateRegistrationProfile
} = require('../services/registration-profile');
const {
  RegistrationPiiConfigurationError,
  RegistrationPiiDecryptionError,
  decryptRegistrationPii,
  encryptRegistrationPii
} = require('../services/registration-pii');
const {
  DEFAULT_BANK_TRANSFER_DISCOUNT_RATE,
  bankTransferQuote,
  isValidBankTransferDiscountRate,
  normalizeBankTransferDiscountRate,
  registrationPayableAmount
} = require('../services/bank-transfer-pricing');

const router = express.Router();
const ADMIN_LOGIN_SCOPE = 'admin-login';
const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_RATE_LIMIT_MAX_ATTEMPTS = 5;
const ADMIN_LOGIN_IP_SCOPE = 'admin-login-ip';
const ADMIN_LOGIN_IP_LIMIT = 5;
const ADMIN_LOGIN_IP_WINDOW_MS = 60 * 60 * 1000;
const PAGE_SIZE_OPTIONS = [5, 10, 25, 50, 100];
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const BLOG_UPLOAD_DIRECTORY = path.resolve(__dirname, '../../uploads/blog');
const PRODUCT_UPLOAD_DIRECTORY = path.resolve(__dirname, '../../uploads/products');
const BLOG_IMAGE_MAX_SIZE = 5 * 1024 * 1024;
const BLOG_IMAGE_EXTENSIONS = {
  'image/avif': '.avif',
  'image/gif': '.gif',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp'
};
const blogImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: BLOG_IMAGE_MAX_SIZE,
    files: 1
  },
  fileFilter(req, file, callback) {
    if (!BLOG_IMAGE_EXTENSIONS[file.mimetype]) {
      return callback(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname));
    }

    return callback(null, true);
  }
}).single('coverImage');
const productImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: BLOG_IMAGE_MAX_SIZE,
    files: 1
  },
  fileFilter(req, file, callback) {
    if (!BLOG_IMAGE_EXTENSIONS[file.mimetype]) {
      return callback(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname));
    }

    return callback(null, true);
  }
}).single('productImage');

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

[ 'id', 'interestId', 'registrationId', 'installmentId'].forEach((paramName) => {
  router.param(paramName, parseIdParam); 
})

router.use((req, res, next) => {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }

  res.locals.csrfToken = req.session.csrfToken;

  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const isMultipartAdminForm = req.method === 'POST'
    && req.is('multipart/form-data')
    && (
      req.path === '/blog'
      || req.path === '/blog/image'
      || /^\/blog\/\d+$/.test(req.path)
      || req.path === '/products'
      || req.path === '/products/image'
      || /^\/products\/\d+$/.test(req.path)
    );

  if (isMultipartAdminForm) {
    return next();
  }

  if (req.body && req.body._csrf === req.session.csrfToken) {
    return next();
  }

  return res.status(403).send('Geçersiz güvenlik anahtarı. Lütfen sayfayı yenileyip tekrar deneyin.');
});

function requireMultipartCsrf(req, res, next) {
  if (req.body && req.body._csrf === req.session.csrfToken) {
    return next();
  }

  return res.status(403).send('Geçersiz güvenlik anahtarı. Lütfen sayfayı yenileyip tekrar deneyin.');
}

function handleBlogImageUpload(req, res, next) {
  blogImageUpload(req, res, (error) => {
    if (!error) return next();

    if (error.code === 'LIMIT_FILE_SIZE') {
      req.blogUploadError = 'Kapak görseli en fazla 5 MB olabilir.';
    } else {
      req.blogUploadError = 'Kapak görseli JPG, PNG, WebP, GIF veya AVIF formatında olmalıdır.';
    }

    return next();
  });
}

function handleProductImageUpload(req, res, next) {
  productImageUpload(req, res, (error) => {
    if (!error) return next();

    if (error.code === 'LIMIT_FILE_SIZE') {
      req.productUploadError = 'Kurs görseli en fazla 5 MB olabilir.';
    } else {
      req.productUploadError = 'Kurs görseli JPG, PNG, WebP, GIF veya AVIF formatında olmalıdır.';
    }

    return next();
  });
}

function hasMemberModel() {
  return prisma.member && typeof prisma.member.count === 'function';
}

function isMissingTableError(error) {
  return error && error.code === 'P2021';
}

function hasCouponModel() {
  return prisma.coupon && typeof prisma.coupon.findMany === 'function';
}

function hasEducationRegistrationModel() {
  return prisma.educationRegistration && typeof prisma.educationRegistration.findMany === 'function';
}

function parseOptionalDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function endOfDay(date) {
  if (!date) return null;
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function endOfToday() {
  return endOfDay(startOfToday());
}

function formatDateTimeLocal(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 16);
}

function positiveInteger(value, fallback, maxValue) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) return fallback;
  return maxValue ? Math.min(number, maxValue) : number;
}

function paginationRequest(req) {
  const requestedLimit = positiveInteger(req.query.limit, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);

  return {
    page: positiveInteger(req.query.page, 1),
    limit: PAGE_SIZE_OPTIONS.includes(requestedLimit) ? requestedLimit : DEFAULT_PAGE_SIZE
  };
}

function pageHref(req, page, limit) {
  const params = new URLSearchParams();

  Object.entries(req.query || {}).forEach(([key, value]) => {
    if (key === 'page' || key === 'limit') return;
    const values = Array.isArray(value) ? value : [value];
    values.forEach((item) => {
      if (item !== undefined && item !== null && String(item) !== '') {
        params.append(key, String(item));
      }
    });
  });

  if (page > 1) params.set('page', String(page));
  if (limit !== DEFAULT_PAGE_SIZE) params.set('limit', String(limit));

  const query = params.toString();
  return `${req.baseUrl}${req.path}${query ? `?${query}` : ''}`;
}

function createPagination(req, totalCount, request) {
  const limit = request.limit;
  const totalPages = Math.max(Math.ceil(totalCount / limit), 1);
  const page = Math.min(request.page, totalPages);
  const startPage = Math.max(1, Math.min(page - 2, totalPages - 4));
  const endPage = Math.min(totalPages, startPage + 4);
  const pages = [];

  for (let current = startPage; current <= endPage; current += 1) {
    pages.push({
      number: current,
      href: pageHref(req, current, limit),
      isCurrent: current === page
    });
  }

  return {
    page,
    limit,
    totalCount,
    totalPages,
    skip: (page - 1) * limit,
    take: limit,
    startItem: totalCount ? (page - 1) * limit + 1 : 0,
    endItem: Math.min(page * limit, totalCount),
    hasPrevious: page > 1,
    hasNext: page < totalPages,
    previousHref: pageHref(req, Math.max(1, page - 1), limit),
    nextHref: pageHref(req, Math.min(totalPages, page + 1), limit),
    limitOptions: PAGE_SIZE_OPTIONS.map((option) => ({
      value: option,
      href: pageHref(req, 1, option),
      isCurrent: option === limit
    })),
    pages
  };
}

async function getAdvisorOptions() {
  return prisma.adminUser.findMany({
    orderBy: [{ name: 'asc' }, { email: 'asc' }],
    select: { id: true, name: true, email: true }
  });
}

function normalizeAdvisorId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function applyFollowUpFilter(where, followUp) {
  const todayStart = startOfToday();
  const todayEnd = endOfDay(todayStart);

  if (followUp === 'today') {
    where.nextFollowUpAt = { gte: todayStart, lte: todayEnd };
  } else if (followUp === 'overdue') {
    where.nextFollowUpAt = { lt: todayStart };
  } else if (followUp === 'scheduled') {
    where.nextFollowUpAt = { not: null };
  }
}

function currentAdminName(req) {
  return req.session.adminUser ? req.session.adminUser.name : null;
}

async function getLeadDetail(id) {
  return prisma.lead.findUnique({
    where: { id: Number(id) },
    include: {
      advisor: true,
      notes: { orderBy: { createdAt: 'desc' } },
      statusHistory: { orderBy: { createdAt: 'desc' } }
    }
  });
}

async function getRegistrationDetail(id) {
  return prisma.educationRegistration.findUnique({
    where: { id: Number(id) },
    include: {
      advisor: true,
      member: true,
      product: true,
      notes: { orderBy: { createdAt: 'desc' } },
      statusHistory: { orderBy: { createdAt: 'desc' } },
      payments: { orderBy: { paidAt: 'desc' } },
      installments: { orderBy: { dueDate: 'asc' } }
    }
  });
}

async function safeMemberCount() {
  if (!hasMemberModel()) return 0;

  try {
    return await prisma.member.count();
  } catch (error) {
    if (isMissingTableError(error)) return 0;
    throw error;
  }
}

async function safeMembersList(req, where) {
  if (!hasMemberModel()) {
    return { members: [], totalCount: 0, pagination: createPagination(req, 0, paginationRequest(req)), tableReady: false };
  }

  try {
    const totalCount = await prisma.member.count({ where });
    const pagination = createPagination(req, totalCount, paginationRequest(req));
    const members = await prisma.member.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take
      });

    return { members, totalCount, pagination, tableReady: true };
  } catch (error) {
    if (isMissingTableError(error)) {
      return { members: [], totalCount: 0, pagination: createPagination(req, 0, paginationRequest(req)), tableReady: false };
    }

    throw error;
  }
}

async function safeCouponsList(req, where) {
  if (!hasCouponModel()) {
    return { coupons: [], totalCount: 0, pagination: createPagination(req, 0, paginationRequest(req)), tableReady: false };
  }

  try {
    const totalCount = await prisma.coupon.count({ where });
    const pagination = createPagination(req, totalCount, paginationRequest(req));
    const coupons = await prisma.coupon.findMany({
        where,
        include: { products: { include: { product: true } } },
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take
      });
    return { coupons, totalCount, pagination, tableReady: true };
  } catch (error) {
    if (isMissingTableError(error)) {
      return { coupons: [], totalCount: 0, pagination: createPagination(req, 0, paginationRequest(req)), tableReady: false };
    }

    throw error;
  }
}

async function safeEducationRegistrationCount() {
  if (!hasEducationRegistrationModel()) return 0;

  try {
    return await prisma.educationRegistration.count();
  } catch (error) {
    if (isMissingTableError(error)) return 0;
    throw error;
  }
}

async function safeEducationRegistrationsList(req, where) {
  if (!hasEducationRegistrationModel()) {
    return { registrations: [], totalCount: 0, pagination: createPagination(req, 0, paginationRequest(req)), tableReady: false };
  }

  try {
    const totalCount = await prisma.educationRegistration.count({ where });
    const pagination = createPagination(req, totalCount, paginationRequest(req));
    const registrations = await prisma.educationRegistration.findMany({
        where,
        include: { advisor: true, member: true, product: true, payments: true },
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take
      });

    return { registrations, totalCount, pagination, tableReady: true };
  } catch (error) {
    if (isMissingTableError(error)) {
      return { registrations: [], totalCount: 0, pagination: createPagination(req, 0, paginationRequest(req)), tableReady: false };
    }

    throw error;
  }
}

const registrationStatusLabels = {
  NEW: 'Yeni',
  CONTACTED: 'İletişime Geçildi',
  CONFIRMED: 'Onaylandı',
  CANCELLED: 'İptal'
};

const paymentStatusLabels = {
  PENDING: 'Ödeme Bekliyor',
  PARTIAL: 'Kısmi Ödeme',
  PAID: 'Ödendi',
  REFUNDED: 'İade'
};

const invoiceStatusLabels = {
  NOT_ISSUED: 'Fatura Kesilmedi',
  ISSUED: 'Fatura Kesildi',
  CANCELLED: 'Fatura İptal'
};

const installmentStatusLabels = {
  PENDING: 'Bekliyor',
  PAID: 'Ödendi',
  OVERDUE: 'Gecikti',
  CANCELLED: 'İptal'
};

const leadStatusLabels = {
  NEW: 'Yeni',
  CONTACTED: 'İletişime Geçildi',
  CLOSED: 'Kapandı'
};

const memberStatusLabels = {
  ACTIVE: 'Aktif',
  PASSIVE: 'Pasif'
};

function normalizeRegistrationStatus(value) {
  return Object.prototype.hasOwnProperty.call(registrationStatusLabels, value) ? value : 'NEW';
}

function normalizePaymentStatus(value) {
  return Object.prototype.hasOwnProperty.call(paymentStatusLabels, value) ? value : 'PENDING';
}

function normalizeInvoiceStatus(value) {
  return Object.prototype.hasOwnProperty.call(invoiceStatusLabels, value) ? value : 'NOT_ISSUED';
}

function normalizeInstallmentStatus(value) {
  return Object.prototype.hasOwnProperty.call(installmentStatusLabels, value) ? value : 'PENDING';
}

function normalizeLeadStatus(value) {
  return Object.prototype.hasOwnProperty.call(leadStatusLabels, value) ? value : 'NEW';
}

function normalizeMemberStatus(value) {
  return Object.prototype.hasOwnProperty.call(memberStatusLabels, value) ? value : 'ACTIVE';
}

function normalizePublishStatus(value) {
  return value === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT';
}

function nullableText(value) {
  const text = String(value || '').trim();
  return text || null;
}

function setPrivateNoStore(res) {
  res.set('Cache-Control', 'private, no-store');
}

function sendRegistrationPiiUnavailable(res) {
  setPrivateNoStore(res);
  return res.status(503).send('Kişisel bilgiler şu anda güvenli şekilde işlenemiyor. Lütfen daha sonra tekrar deneyin.');
}

function isRegistrationPiiError(error) {
  return error instanceof RegistrationPiiConfigurationError
    || error instanceof RegistrationPiiDecryptionError;
}

function handleRegistrationPiiError(res, error) {
  if (!isRegistrationPiiError(error)) return false;
  sendRegistrationPiiUnavailable(res);
  return true;
}

function withoutEncryptedRegistrationPii(registration) {
  if (!registration) return registration;

  const {
    identityDocumentNumberEncrypted,
    birthDateEncrypted,
    addressEncrypted,
    ...safeRegistration
  } = registration;

  return safeRegistration;
}

function hasStoredRegistrationPii(registration) {
  return Boolean(
    registration?.identityDocumentNumberEncrypted
    || registration?.birthDateEncrypted
    || registration?.addressEncrypted
  );
}

function hasSubmittedRegistrationPii(body) {
  return hasAnyRegistrationProfileInput({
    identityDocumentType: body?.identityDocumentType,
    identityDocumentNumber: body?.identityDocumentNumber,
    documentCountryCode: body?.documentCountryCode,
    birthDate: body?.birthDate,
    country: body?.country,
    city: body?.city,
    district: body?.district,
    postalCode: body?.postalCode,
    addressLine: body?.addressLine
  });
}

function numberOrZero(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function normalizeDecimalInput(value) {
  return String(value || '').trim().replace(',', '.');
}

function optionalDecimal(value) {
  const normalized = normalizeDecimalInput(value);
  if (!normalized) return null;

  const number = Number(normalized);
  return Number.isFinite(number) && number >= 0 ? normalized : null;
}

function decimalOrDefault(value, fallback) {
  return optionalDecimal(value) || fallback;
}

function isInvalidDecimal(value) {
  return Boolean(normalizeDecimalInput(value)) && optionalDecimal(value) === null;
}

function normalizeDiscountType(value) {
  return value === 'PERCENT' || value === 'AMOUNT' ? value : null;
}

function calculateDiscountPrice(price, discountType, discountValue) {
  if (!price || !discountType || !discountValue) return null;

  const priceNumber = Number(price);
  const discountNumber = Number(discountValue);
  if (!Number.isFinite(priceNumber) || !Number.isFinite(discountNumber)) return null;

  if (discountType === 'PERCENT') {
    return (priceNumber * (100 - discountNumber) / 100).toFixed(2);
  }

  return Math.max(priceNumber - discountNumber, 0).toFixed(2);
}

function formatMoney(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return number.toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function getProductPricing(product) {
  if (!product.price) return null;

  const basePrice = Number(product.price);
  const effectivePrice = product.discountPrice ? Number(product.discountPrice) : basePrice;
  const vatRate = product.vatRate == null ? 0 : Number(product.vatRate);
  const vatAmount = effectivePrice * vatRate / 100;
  const priceWithVat = effectivePrice + vatAmount;
  const transferQuote = bankTransferQuote(product);

  return {
    basePrice: formatMoney(basePrice),
    effectivePrice: formatMoney(effectivePrice),
    vatRate: formatMoney(vatRate),
    vatAmount: formatMoney(vatAmount),
    priceWithVat: formatMoney(priceWithVat),
    bankTransferDiscountRate: transferQuote.discountRate,
    bankTransferAmount: formatMoney(transferQuote.amount)
  };
}

function getRegistrationFinance(registration) {
  const payableAmount = registrationPayableAmount(registration);
  const totalAmount = payableAmount == null ? 0 : Number(payableAmount);
  const paidAmount = (registration.payments || []).reduce((sum, payment) => {
    return sum + Number(payment.amount || 0);
  }, 0);
  const remainingAmount = Math.max(totalAmount - paidAmount, 0);

  return {
    totalAmount,
    paidAmount,
    remainingAmount,
    totalAmountText: formatMoney(totalAmount),
    paidAmountText: formatMoney(paidAmount),
    remainingAmountText: formatMoney(remainingAmount)
  };
}

async function syncRegistrationPaymentStatus(tx, registrationId, authorName) {
  const registration = await tx.educationRegistration.findUnique({
    where: { id: registrationId },
    include: { payments: true }
  });

  if (!registration || registration.totalAmount == null) {
    return;
  }

  const finance = getRegistrationFinance(registration);
  const paymentStatus = finance.paidAmount <= 0
    ? 'PENDING'
    : finance.remainingAmount <= 0
      ? 'PAID'
      : 'PARTIAL';

  if (registration.paymentStatus === paymentStatus) {
    return;
  }

  await tx.educationRegistration.update({
    where: { id: registrationId },
    data: { paymentStatus }
  });

  await tx.educationRegistrationStatusHistory.create({
    data: {
      registrationId,
      fromStatus: registration.status,
      toStatus: registration.status,
      fromPaymentStatus: registration.paymentStatus,
      toPaymentStatus: paymentStatus,
      authorName
    }
  });
}

function validateProductForm(body) {
  if (!String(body.title || '').trim()) {
    return 'Başlık alanı zorunludur.';
  }

  if (
    isInvalidDecimal(body.price)
    || isInvalidDecimal(body.discountValue)
    || isInvalidDecimal(body.vatRate)
    || !isValidBankTransferDiscountRate(
      String(body.bankTransferDiscountRate || '').trim()
        ? body.bankTransferDiscountRate
        : DEFAULT_BANK_TRANSFER_DISCOUNT_RATE
    )
  ) {
    return 'Fiyat, indirim değeri, KDV ve Havale indirimi alanları geçerli sayı olmalıdır.';
  }

  const price = optionalDecimal(body.price);
  const discountType = normalizeDiscountType(body.discountType);
  const discountValue = optionalDecimal(body.discountValue);

  if ((discountType || discountValue) && (!discountType || !discountValue)) {
    return 'İndirim için indirim tipi ve indirim değeri birlikte girilmelidir.';
  }

  if (discountValue && !price) {
    return 'İndirim girmek için normal fiyat da girilmelidir.';
  }

  if (discountType === 'PERCENT' && Number(discountValue) > 100) {
    return 'Yüzde indirim 100 değerinden büyük olamaz.';
  }

  if (discountType === 'AMOUNT' && price && Number(discountValue) > Number(price)) {
    return 'Tutar indirimi normal fiyattan büyük olamaz.';
  }

  if (Number(body.bankTransferDiscountRate) >= 100) {
    return 'Havale indirimi 100 değerinden küçük olmalıdır.';
  }

  try {
    normalizeProductVariantRows(body.variants, body.defaultVariantIndex);
  } catch (error) {
    if (error instanceof ProductVariantValidationError) return error.message;
    throw error;
  }

  return null;
}

function productVariantFormRows(body) {
  try {
    return normalizeProductVariantRows(body.variants, body.defaultVariantIndex);
  } catch (error) {
    return [];
  }
}

function productUniqueErrorMessage(error) {
  const target = Array.isArray(error.meta && error.meta.target) ? error.meta.target : [];
  if (target.includes('code')) {
    return 'Bu ürün kodu zaten kullanılıyor. Lütfen farklı bir kod girin.';
  }

  return 'Bu slug zaten kullanılıyor. Lütfen farklı bir slug girin.';
}

function buildProductData(body) {
  const price = optionalDecimal(body.price);
  const discountType = normalizeDiscountType(body.discountType);
  const discountValue = optionalDecimal(body.discountValue);
  const code = String(body.code || '').trim().toUpperCase();

  return {
    code: code || null,
    title: String(body.title || '').trim(),
    slug: String(body.slug || '').trim() || makeSlug(body.title),
    summary: nullableText(body.summary),
    image: nullableText(body.image),
    price,
    discountType,
    discountValue: discountType ? discountValue : null,
    discountPrice: calculateDiscountPrice(price, discountType, discountValue),
    vatRate: decimalOrDefault(body.vatRate, '20'),
    bankTransferDiscountRate: normalizeBankTransferDiscountRate(
      body.bankTransferDiscountRate,
      DEFAULT_BANK_TRANSFER_DISCOUNT_RATE
    ),
    duration: nullableText(body.duration),
    lessonType: nullableText(body.lessonType),
    certificate: nullableText(body.certificate),
    status: normalizePublishStatus(body.status),
    sortOrder: numberOrZero(body.sortOrder),
    categoryId: body.categoryId ? Number(body.categoryId) : null
  };
}

async function saveUploadedProductImage(req) {
  if (!req.file) return null;

  const extension = BLOG_IMAGE_EXTENSIONS[req.file.mimetype];
  const filename = `${Date.now()}-${crypto.randomBytes(12).toString('hex')}${extension}`;
  await fs.promises.mkdir(PRODUCT_UPLOAD_DIRECTORY, { recursive: true });
  await fs.promises.writeFile(path.join(PRODUCT_UPLOAD_DIRECTORY, filename), req.file.buffer);
  req.savedProductImagePath = `/uploads/products/${filename}`;
  return req.savedProductImagePath;
}

async function renderProductForm(res, options) {
  const [categories, variantCandidates] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: 'asc' } }),
    findProductVariantCandidates(prisma, options.product && options.product.id)
  ]);
  const productVariants = options.productVariants
    || options.product?.productVariants
    || [];

  return res.status(options.statusCode || 200).render('admin/products/form', {
    product: options.product || null,
    productTabs: buildProductFormTabs(options.productTabs || options.product?.tabs || options.product?.tabsInput),
    learningOutcomes: buildProductFormOutcomes(options.learningOutcomes || options.product?.learningOutcomes || options.product?.learningOutcomesInput),
    productVariants,
    defaultVariantIndex: Math.max(0, productVariants.findIndex((variant) => variant.isDefault)),
    variantCandidates,
    categories,
    action: options.action || '/admin/products',
    pageTitle: options.pageTitle || 'Yeni Kurs',
    submitLabel: options.submitLabel || 'Kaydet',
    error: options.error || null
  });
}

function findProductVariantCandidates(prismaClient, excludedProductId) {
  const productId = Number(excludedProductId);
  return prismaClient.product.findMany({
    where: Number.isInteger(productId) && productId > 0
      ? { id: { not: productId } }
      : undefined,
    select: {
      id: true,
      title: true,
      duration: true,
      status: true
    },
    orderBy: [{ title: 'asc' }, { id: 'asc' }]
  });
}

function validateBlogForm(body) {
  if (!String(body.title || '').trim()) {
    return 'Başlık alanı zorunludur.';
  }

  if (body.publishedAt && !parseOptionalDate(body.publishedAt)) {
    return 'Yayın tarihi geçerli bir tarih olmalıdır.';
  }

  const category = blogCategoryByLegacyId(body.blogCategoryLegacyId);
  if (normalizePublishStatus(body.status) === 'PUBLISHED' && !category) {
    return 'Yayınlanan blog yazıları için kategori seçimi zorunludur.';
  }

  const imageError = validateBlogContentImages(body.content);
  if (imageError) return imageError;

  return null;
}

async function resolveBlogCategoryId(body) {
  const category = blogCategoryByLegacyId(body.blogCategoryLegacyId);
  if (!category) return null;

  const storedCategory = await prisma.blogCategory.findUnique({
    where: { legacyId: category.legacyId },
    select: { id: true, isActive: true }
  });

  if (!storedCategory || !storedCategory.isActive) {
    throw new Error(`Blog category ${category.legacyId} is not available.`);
  }

  return storedCategory.id;
}

function buildBlogData(body, imagePath) {
  return {
    title: String(body.title || '').trim(),
    slug: String(body.slug || '').trim() || makeSlug(body.title),
    excerpt: nullableText(body.excerpt),
    content: nullableText(body.content),
    image: imagePath === undefined ? nullableText(body.image) : imagePath,
    status: normalizePublishStatus(body.status),
    publishedAt: parseOptionalDate(body.publishedAt)
  };
}

async function saveUploadedBlogImage(req) {
  if (!req.file) return null;

  const extension = BLOG_IMAGE_EXTENSIONS[req.file.mimetype];
  const filename = `${Date.now()}-${crypto.randomBytes(12).toString('hex')}${extension}`;
  await fs.promises.mkdir(BLOG_UPLOAD_DIRECTORY, { recursive: true });
  await fs.promises.writeFile(path.join(BLOG_UPLOAD_DIRECTORY, filename), req.file.buffer);
  req.savedBlogImagePath = `/uploads/blog/${filename}`;
  return req.savedBlogImagePath;
}

function renderBlogForm(res, options) {
  return res.status(options.statusCode || 200).render('admin/blog/form', {
    post: options.post || null,
    action: options.action || '/admin/blog',
    pageTitle: options.pageTitle || 'Yeni Blog Yazısı',
    submitLabel: options.submitLabel || 'Kaydet',
    error: options.error || null,
    blogCategories: BLOG_CATEGORIES,
    publishedAtValue: formatDateTimeLocal(options.post && options.post.publishedAt)
  });
}

async function blogSlugExists(slug, excludedId) {
  const post = await prisma.blogPost.findUnique({
    where: { slug },
    select: { id: true }
  });

  return Boolean(post && post.id !== excludedId);
}

function buildCategoryData(body) {
  return {
    name: String(body.name || '').trim(),
    slug: String(body.slug || '').trim() || makeSlug(body.name),
    description: nullableText(body.description),
    image: nullableText(body.image),
    sortOrder: numberOrZero(body.sortOrder),
    isActive: body.isActive === 'on'
  };
}

function validateCategoryForm(body) {
  if (!String(body.name || '').trim()) {
    return 'Kategori adı zorunludur.';
  }

  return null;
}

function renderCategoryForm(res, options) {
  return res.status(options.statusCode || 200).render('admin/categories/form', {
    category: options.category || null,
    action: options.action || '/admin/categories',
    pageTitle: options.pageTitle || 'Yeni Kategori',
    submitLabel: options.submitLabel || 'Kaydet',
    error: options.error || null
  });
}

async function getRegistrationFormOptions() {
  const [members, products] = await Promise.all([
    hasMemberModel()
      ? prisma.member.findMany({ where: { status: 'ACTIVE' }, orderBy: [{ name: 'asc' }, { surname: 'asc' }], take: 250 })
      : [],
    prisma.product.findMany({ orderBy: [{ title: 'asc' }], take: 250 })
  ]);

  return { members, products };
}

async function renderRegistrationForm(res, options) {
  const { members, products } = await getRegistrationFormOptions();
  setPrivateNoStore(res);
  return res.status(options.statusCode || 200).render('admin/registrations/form', {
    registration: options.registration || null,
    members,
    products,
    statusLabels: registrationStatusLabels,
    paymentStatusLabels,
    invoiceStatusLabels,
    action: options.action || '/admin/registrations',
    pageTitle: options.pageTitle || 'Yeni Eğitim Kaydı',
    submitLabel: options.submitLabel || 'Kayıt Oluştur',
    error: options.error || null,
    fieldErrors: options.fieldErrors || {},
    profileRequired: options.profileRequired === true,
    focusAddress: options.focusAddress === true
  });
}

async function buildRegistrationData(body, options = {}) {
  const productCode = String(body.productCode || '').trim().toUpperCase();
  const productId = body.productId ? Number(body.productId) : null;
  const memberId = body.memberId ? Number(body.memberId) : null;
  const product = productCode
    ? await prisma.product.findUnique({ where: { code: productCode } })
    : productId
      ? await prisma.product.findUnique({ where: { id: productId } })
      : null;
  const member = memberId && hasMemberModel() ? await prisma.member.findUnique({ where: { id: memberId } }) : null;

  const courseTitle = String(body.courseTitle || (product ? product.title : '')).trim();
  const name = String(body.name || (member ? member.name : '')).trim();
  const surname = String(body.surname || (member ? member.surname || '' : '')).trim();
  const email = String(body.email || (member ? member.email || '' : '')).trim();
  const phone = String(body.phone || (member ? member.phone || '' : '')).trim();
  const shouldValidateProfile = options.requireProfile === true
    || options.hasStoredPii === true
    || hasSubmittedRegistrationPii(body);
  const profileValidation = shouldValidateProfile
    ? validateRegistrationProfile({
        ...body,
        name,
        surname,
        email,
        phone
      })
    : null;
  const normalizedProfile = profileValidation?.profile;
  const encryptedProfile = profileValidation?.isValid
    ? encryptRegistrationPii(normalizedProfile)
    : {};

  return {
    data: {
      memberId: member ? member.id : null,
      productId: product ? product.id : null,
      courseTitle,
      name: normalizedProfile?.name || name,
      surname: normalizedProfile?.surname || surname || null,
      email: normalizedProfile?.email || email || null,
      phone: normalizedProfile?.phone || phone,
      note: nullableText(body.note),
      advisorNote: nullableText(body.advisorNote),
      status: normalizeRegistrationStatus(body.status),
      paymentStatus: normalizePaymentStatus(body.paymentStatus),
      totalAmount: optionalDecimal(body.totalAmount),
      invoiceStatus: normalizeInvoiceStatus(body.invoiceStatus),
      paymentNote: nullableText(body.paymentNote),
      startsAt: parseOptionalDate(body.startsAt),
      ...encryptedProfile
    },
    isValid: Boolean(courseTitle && name && phone)
      && (!profileValidation || profileValidation.isValid),
    fieldErrors: profileValidation?.errors || {},
    profileRequired: shouldValidateProfile
  };
}

function validateRegistrationFinanceFields(body) {
  if (isInvalidDecimal(body.totalAmount)) {
    return 'Toplam tutar geçerli pozitif sayı olmalıdır.';
  }

  return null;
}

async function renderRegistrationDetail(res, registration, options = {}) {
  let registrationProfile;

  try {
    registrationProfile = decryptRegistrationPii(registration);
  } catch (error) {
    if (handleRegistrationPiiError(res, error)) return res;
    throw error;
  }

  setPrivateNoStore(res);
  return res.status(options.statusCode || 200).render('admin/registrations/show', {
    registration: withoutEncryptedRegistrationPii(registration),
    registrationProfile,
    advisorOptions: await getAdvisorOptions(),
    followUpValue: formatDateTimeLocal(registration.nextFollowUpAt),
    finance: getRegistrationFinance(registration),
    statusLabels: registrationStatusLabels,
    paymentStatusLabels,
    invoiceStatusLabels,
    installmentStatusLabels,
    error: options.error || null
  });
}

function normalizeIdList(value) {
  return (Array.isArray(value) ? value : value ? [value] : [])
    .map((item) => Number(item))
    .filter((item, index, list) => Number.isInteger(item) && item > 0 && list.indexOf(item) === index);
}

function buildCouponData(body) {
  return {
    code: String(body.code || '').trim().toUpperCase(),
    title: String(body.title || '').trim(),
    discountType: body.discountType === 'AMOUNT' ? 'AMOUNT' : 'PERCENT',
    discountValue: optionalDecimal(body.discountValue),
    usageLimit: body.usageLimit ? numberOrZero(body.usageLimit) : null,
    startsAt: parseOptionalDate(body.startsAt),
    expiresAt: parseOptionalDate(body.expiresAt),
    isActive: body.isActive === 'on'
  };
}

function validateCouponForm(body) {
  const data = buildCouponData(body);

  if (!data.code || !data.title || !data.discountValue || Number(data.discountValue) <= 0) {
    return 'Kod, başlık ve geçerli indirim değeri zorunludur.';
  }

  if (data.discountType === 'PERCENT' && Number(data.discountValue) > 100) {
    return 'Yüzde indirim 100 değerinden büyük olamaz.';
  }

  if (data.usageLimit !== null && data.usageLimit < 1) {
    return 'Kullanım limiti en az 1 olmalıdır.';
  }

  if (data.startsAt && data.expiresAt && data.expiresAt < data.startsAt) {
    return 'Bitiş tarihi başlangıç tarihinden önce olamaz.';
  }

  return null;
}

async function renderCouponForm(res, options) {
  const products = await prisma.product.findMany({ orderBy: [{ title: 'asc' }], take: 250 });
  return res.status(options.statusCode || 200).render('admin/coupons/form', {
    coupon: options.coupon || null,
    products,
    selectedProductIds: options.selectedProductIds || [],
    action: options.action || '/admin/coupons',
    pageTitle: options.pageTitle || 'Yeni Kupon',
    submitLabel: options.submitLabel || 'Kaydet',
    error: options.error || null
  });
}

async function syncCouponProducts(tx, couponId, productIds) {
  await tx.couponProduct.deleteMany({ where: { couponId } });

  if (!productIds.length) {
    return;
  }

  await tx.couponProduct.createMany({
    data: productIds.map((productId) => ({ couponId, productId })),
    skipDuplicates: true
  });
}

router.get('/login', redirectIfLoggedIn, (req, res) => {
  res.render('admin/login', { error: null });
});

router.post('/login', redirectIfLoggedIn, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const ipAttempt = await isIpBlocked({
      req,
      res,
      scope: ADMIN_LOGIN_IP_SCOPE,
      limit: ADMIN_LOGIN_IP_LIMIT
    });

    if (ipAttempt.blocked) {
      return res.status(429).render('admin/login', {
        error: 'Çok fazla hatalı giriş denemesi yapıldı. Lütfen 60 dakika sonra tekrar deneyin.'
      });
    }

    const loginAttempt = await isLoginBlocked({
      req,
      res,
      scope: ADMIN_LOGIN_SCOPE,
      email: normalizedEmail,
      limit: LOGIN_RATE_LIMIT_MAX_ATTEMPTS
    });

    if (loginAttempt.blocked) {
      return res.status(429).render('admin/login', {
        error: 'Çok fazla hatalı giriş denemesi yapıldı. Lütfen 15 dakika sonra tekrar deneyin.'
      });
    }

    const user = await prisma.adminUser.findUnique({ where: { email: normalizedEmail } });

    if (!user || !(await bcrypt.compare(password || '', user.passwordHash))) {
      await Promise.all([
        recordLoginFailure({
          res,
          scope: ADMIN_LOGIN_SCOPE,
          identifier: loginAttempt.identifier,
          limit: LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
          windowMs: LOGIN_RATE_LIMIT_WINDOW_MS
        }),
        recordIpFailure({
          scope: ADMIN_LOGIN_IP_SCOPE,
          identifier: ipAttempt.identifier,
          windowMs: ADMIN_LOGIN_IP_WINDOW_MS
        })
      ]);
      return res.status(401).render('admin/login', { error: 'E-posta veya şifre hatalı.' });
    }

    await clearLoginFailures(ADMIN_LOGIN_SCOPE, loginAttempt.identifier);
    const returnTo = req.session.returnTo || '/admin';
    req.session.regenerate((error) => {
      if (error) return next(error);

      req.session.adminUser = { id: user.id, email: user.email, name: user.name };
      req.session.csrfToken = crypto.randomBytes(32).toString('hex');
      return req.session.save((saveError) => {
        if (saveError) return next(saveError);
        return res.redirect(returnTo);
      });
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/logout', requireAdmin, (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.redirect('/admin/login');
  });
});

router.get('/', requireAdmin, async (req, res, next) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = endOfDay(todayStart);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const chartStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    const [
      productCount,
      publishedProductCount,
      categoryCount,
      blogCount,
      leadCount,
      todayLeadCount,
      openLeadCount,
      memberCount,
      monthlyMemberCount,
      registrationCount,
      activeRegistrationCount,
      pendingPaymentCount,
      confirmedRegistrationCount,
      todayLeadFollowUpCount,
      overdueLeadFollowUpCount,
      todayRegistrationFollowUpCount,
      overdueRegistrationFollowUpCount,
      latestLeads,
      latestRegistrations,
      pendingPayments,
      monthlyRegistrations,
      courseInterests
    ] = await Promise.all([
      prisma.product.count(),
      prisma.product.count({ where: { status: 'PUBLISHED' } }),
      prisma.category.count(),
      prisma.blogPost.count(),
      prisma.lead.count(),
      prisma.lead.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.lead.count({ where: { status: { in: ['NEW', 'CONTACTED'] } } }),
      safeMemberCount(),
      hasMemberModel() ? prisma.member.count({ where: { createdAt: { gte: monthStart } } }) : 0,
      safeEducationRegistrationCount(),
      hasEducationRegistrationModel()
        ? prisma.educationRegistration.count({ where: { status: { in: ['NEW', 'CONTACTED', 'CONFIRMED'] } } })
        : 0,
      hasEducationRegistrationModel()
        ? prisma.educationRegistration.count({ where: { paymentStatus: { in: ['PENDING', 'PARTIAL'] } } })
        : 0,
      hasEducationRegistrationModel()
        ? prisma.educationRegistration.count({ where: { status: 'CONFIRMED' } })
        : 0,
      prisma.lead.count({ where: { nextFollowUpAt: { gte: todayStart, lte: todayEnd } } }),
      prisma.lead.count({ where: { nextFollowUpAt: { lt: todayStart } } }),
      hasEducationRegistrationModel()
        ? prisma.educationRegistration.count({ where: { nextFollowUpAt: { gte: todayStart, lte: todayEnd } } })
        : 0,
      hasEducationRegistrationModel()
        ? prisma.educationRegistration.count({ where: { nextFollowUpAt: { lt: todayStart } } })
        : 0,
      prisma.lead.findMany({ orderBy: { createdAt: 'desc' }, take: 6 }),
      hasEducationRegistrationModel()
        ? prisma.educationRegistration.findMany({
            include: { member: true, product: true },
            orderBy: { createdAt: 'desc' },
            take: 6
          })
        : [],
      hasEducationRegistrationModel()
        ? prisma.educationRegistration.findMany({
            where: { paymentStatus: { in: ['PENDING', 'PARTIAL'] } },
            include: { product: true },
            orderBy: { updatedAt: 'desc' },
            take: 6
          })
        : [],
      hasEducationRegistrationModel()
        ? prisma.educationRegistration.findMany({
            where: { createdAt: { gte: chartStart } },
            select: { createdAt: true },
            orderBy: { createdAt: 'asc' }
          })
        : [],
      prisma.memberCourseInterest
        ? prisma.memberCourseInterest.findMany({
            include: { product: true },
            orderBy: { createdAt: 'desc' },
            take: 500
          })
        : []
    ]);

    const monthLabels = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
    const registrationDistribution = Array.from({ length: 12 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - 11 + index, 1);
      const count = monthlyRegistrations.filter((registration) => {
        return registration.createdAt.getFullYear() === date.getFullYear() && registration.createdAt.getMonth() === date.getMonth();
      }).length;

      return {
        label: `${monthLabels[date.getMonth()]} ${date.getFullYear()}`,
        count,
        value: 0
      };
    });

    const maxMonthlyRegistrationCount = Math.max(...registrationDistribution.map((item) => item.count), 1);
    registrationDistribution.forEach((item) => {
      item.value = Math.max(6, Math.round(item.count / maxMonthlyRegistrationCount * 100));
    });

    const interestMap = courseInterests.reduce((output, item) => {
      const key = item.productId;
      if (!output[key]) {
        output[key] = {
          product: item.product,
          count: 0
        };
      }

      output[key].count += 1;
      return output;
    }, {});

    const topInterestedCourses = Object.keys(interestMap)
      .map((key) => interestMap[key])
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    res.render('admin/dashboard', {
      stats: {
        todayLeadCount,
        openLeadCount,
        monthlyMemberCount,
        activeRegistrationCount,
        pendingPaymentCount,
        confirmedRegistrationCount,
        todayFollowUpCount: todayLeadFollowUpCount + todayRegistrationFollowUpCount,
        overdueFollowUpCount: overdueLeadFollowUpCount + overdueRegistrationFollowUpCount,
        todayLeadFollowUpCount,
        overdueLeadFollowUpCount,
        todayRegistrationFollowUpCount,
        overdueRegistrationFollowUpCount,
        productCount,
        publishedProductCount,
        categoryCount,
        blogCount,
        leadCount,
        memberCount,
        registrationCount
      },
      statusLabels: registrationStatusLabels,
      paymentStatusLabels,
      leadStatusLabels,
      latestLeads,
      latestRegistrations,
      pendingPayments,
      topInterestedCourses,
      registrationDistribution
    });
  } catch (error) {
    next(error);
  }
});

router.get('/crm', requireAdmin, async (req, res, next) => {
  try {
    const followUp = String(req.query.followUp || 'today').trim();
    const advisorId = String(req.query.advisorId || '').trim();
    const selectedAdvisorId = normalizeAdvisorId(advisorId);
    const todayStart = startOfToday();
    const todayEnd = endOfToday();
    const leadWhere = {};
    const registrationWhere = {};

    if (selectedAdvisorId) {
      leadWhere.advisorId = selectedAdvisorId;
      registrationWhere.advisorId = selectedAdvisorId;
    }

    applyFollowUpFilter(leadWhere, followUp);
    applyFollowUpFilter(registrationWhere, followUp);

    const [
      advisorOptions,
      leadItems,
      registrationItems,
      todayLeadCount,
      overdueLeadCount,
      scheduledLeadCount,
      todayRegistrationCount,
      overdueRegistrationCount,
      scheduledRegistrationCount
    ] = await Promise.all([
      getAdvisorOptions(),
      prisma.lead.findMany({
        where: leadWhere,
        include: { advisor: true },
        orderBy: [{ nextFollowUpAt: 'asc' }, { createdAt: 'desc' }],
        take: 50
      }),
      hasEducationRegistrationModel()
        ? prisma.educationRegistration.findMany({
            where: registrationWhere,
            include: { advisor: true, product: true },
            orderBy: [{ nextFollowUpAt: 'asc' }, { createdAt: 'desc' }],
            take: 50
          })
        : [],
      prisma.lead.count({ where: { ...(selectedAdvisorId ? { advisorId: selectedAdvisorId } : {}), nextFollowUpAt: { gte: todayStart, lte: todayEnd } } }),
      prisma.lead.count({ where: { ...(selectedAdvisorId ? { advisorId: selectedAdvisorId } : {}), nextFollowUpAt: { lt: todayStart } } }),
      prisma.lead.count({ where: { ...(selectedAdvisorId ? { advisorId: selectedAdvisorId } : {}), nextFollowUpAt: { not: null } } }),
      hasEducationRegistrationModel()
        ? prisma.educationRegistration.count({ where: { ...(selectedAdvisorId ? { advisorId: selectedAdvisorId } : {}), nextFollowUpAt: { gte: todayStart, lte: todayEnd } } })
        : 0,
      hasEducationRegistrationModel()
        ? prisma.educationRegistration.count({ where: { ...(selectedAdvisorId ? { advisorId: selectedAdvisorId } : {}), nextFollowUpAt: { lt: todayStart } } })
        : 0,
      hasEducationRegistrationModel()
        ? prisma.educationRegistration.count({ where: { ...(selectedAdvisorId ? { advisorId: selectedAdvisorId } : {}), nextFollowUpAt: { not: null } } })
        : 0
    ]);

    res.render('admin/crm/index', {
      advisorOptions,
      advisorId,
      followUp,
      leadItems,
      registrationItems,
      leadStatusLabels,
      registrationStatusLabels,
      paymentStatusLabels,
      stats: {
        todayCount: todayLeadCount + todayRegistrationCount,
        overdueCount: overdueLeadCount + overdueRegistrationCount,
        scheduledCount: scheduledLeadCount + scheduledRegistrationCount,
        todayLeadCount,
        todayRegistrationCount,
        overdueLeadCount,
        overdueRegistrationCount,
        scheduledLeadCount,
        scheduledRegistrationCount
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/categories', requireAdmin, async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    const isActive = String(req.query.isActive || '').trim();
    const where = {};

    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { slug: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } }
      ];
    }

    if (isActive === 'true' || isActive === 'false') {
      where.isActive = isActive === 'true';
    }

    const totalCount = await prisma.category.count({ where });
    const pagination = createPagination(req, totalCount, paginationRequest(req));
    const categories = await prisma.category.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { id: 'desc' }],
      skip: pagination.skip,
      take: pagination.take
    });

    res.render('admin/categories/index', {
      categories,
      totalCount,
      pagination,
      q,
      isActive
    });
  } catch (error) {
    next(error);
  }
});

router.get('/categories/new', requireAdmin, (req, res) => {
  renderCategoryForm(res, {
    category: null,
    action: '/admin/categories',
    pageTitle: 'Yeni Kategori',
    submitLabel: 'Kaydet'
  });
});

router.post('/categories', requireAdmin, async (req, res, next) => {
  try {
    const formError = validateCategoryForm(req.body);
    if (formError) {
      return renderCategoryForm(res, {
        statusCode: 400,
        category: req.body,
        action: '/admin/categories',
        pageTitle: 'Yeni Kategori',
        submitLabel: 'Kaydet',
        error: formError
      });
    }

    await prisma.category.create({ data: buildCategoryData(req.body) });
    res.redirect('/admin/categories');
  } catch (error) {
    if (error.code === 'P2002') {
      return renderCategoryForm(res, {
        statusCode: 400,
        category: req.body,
        action: '/admin/categories',
        pageTitle: 'Yeni Kategori',
        submitLabel: 'Kaydet',
        error: 'Bu slug zaten kullanılıyor. Lütfen farklı bir slug girin.'
      });
    }

    next(error);
  }
});

router.get('/categories/:id/edit', requireAdmin, async (req, res, next) => {
  try {
    const category = await prisma.category.findUnique({ where: { id: Number(req.params.id) } });

    if (!category) {
      return res.status(404).send('Kategori bulunamadı');
    }

    return renderCategoryForm(res, {
      category,
      action: `/admin/categories/${category.id}`,
      pageTitle: 'Kategoriyi Düzenle',
      submitLabel: 'Güncelle'
    });
  } catch (error) {
    next(error);
  }
});

router.post('/categories/:id', requireAdmin, async (req, res, next) => {
  try {
    const categoryId = Number(req.params.id);
    const currentCategory = await prisma.category.findUnique({ where: { id: categoryId } });

    if (!currentCategory) {
      return res.status(404).send('Kategori bulunamadı');
    }

    const formError = validateCategoryForm(req.body);
    if (formError) {
      return renderCategoryForm(res, {
        statusCode: 400,
        category: { ...req.body, id: categoryId },
        action: `/admin/categories/${categoryId}`,
        pageTitle: 'Kategoriyi Düzenle',
        submitLabel: 'Güncelle',
        error: formError
      });
    }

    await prisma.category.update({
      where: { id: categoryId },
      data: buildCategoryData(req.body)
    });

    res.redirect('/admin/categories');
  } catch (error) {
    if (error.code === 'P2002') {
      return renderCategoryForm(res, {
        statusCode: 400,
        category: { ...req.body, id: Number(req.params.id) },
        action: `/admin/categories/${req.params.id}`,
        pageTitle: 'Kategoriyi Düzenle',
        submitLabel: 'Güncelle',
        error: 'Bu slug zaten kullanılıyor. Lütfen farklı bir slug girin.'
      });
    }

    next(error);
  }
});

router.post('/categories/:id/status', requireAdmin, async (req, res, next) => {
  try {
    await prisma.category.update({
      where: { id: Number(req.params.id) },
      data: { isActive: req.body.isActive === 'true' }
    });

    res.redirect('/admin/categories');
  } catch (error) {
    next(error);
  }
});

router.post('/categories/:id/delete', requireAdmin, async (req, res, next) => {
  try {
    await prisma.category.delete({ where: { id: Number(req.params.id) } });
    res.redirect('/admin/categories');
  } catch (error) {
    next(error);
  }
});

router.get('/blog', requireAdmin, async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    const status = String(req.query.status || '').trim();
    const where = {};

    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { slug: { contains: q, mode: 'insensitive' } }
      ];
    }

    if (status === 'PUBLISHED' || status === 'DRAFT') {
      where.status = status;
    }

    const totalCount = await prisma.blogPost.count({ where });
    const pagination = createPagination(req, totalCount, paginationRequest(req));
    const posts = await prisma.blogPost.findMany({
      where,
      include: { blogCategory: true },
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      skip: pagination.skip,
      take: pagination.take
    });

    res.render('admin/blog/index', {
      posts,
      totalCount,
      pagination,
      q,
      status
    });
  } catch (error) {
    next(error);
  }
});

router.get('/blog/new', requireAdmin, (req, res) => {
  return renderBlogForm(res, {
    post: null,
    action: '/admin/blog',
    pageTitle: 'Yeni Blog Yazısı',
    submitLabel: 'Kaydet'
  });
});

router.post('/blog', requireAdmin, handleBlogImageUpload, requireMultipartCsrf, async (req, res, next) => {
  try {
    const formError = req.blogUploadError || validateBlogForm(req.body);
    const data = buildBlogData(req.body, null);

    if (formError) {
      return renderBlogForm(res, {
        statusCode: 400,
        post: req.body,
        action: '/admin/blog',
        pageTitle: 'Yeni Blog Yazısı',
        submitLabel: 'Kaydet',
        error: formError
      });
    }

    if (await blogSlugExists(data.slug)) {
      return renderBlogForm(res, {
        statusCode: 400,
        post: req.body,
        action: '/admin/blog',
        pageTitle: 'Yeni Blog Yazısı',
        submitLabel: 'Kaydet',
        error: 'Bu slug zaten kullanılıyor. Lütfen farklı bir slug girin.'
      });
    }

    data.blogCategoryId = await resolveBlogCategoryId(req.body);
    data.image = await saveUploadedBlogImage(req);
    await prisma.blogPost.create({ data });
    return res.redirect('/admin/blog');
  } catch (error) {
    if (error.code === 'P2002') {
      return renderBlogForm(res, {
        statusCode: 400,
        post: { ...req.body, image: req.savedBlogImagePath || null },
        action: '/admin/blog',
        pageTitle: 'Yeni Blog Yazısı',
        submitLabel: 'Kaydet',
        error: 'Bu slug zaten kullanılıyor. Lütfen farklı bir slug girin.'
      });
    }

    return next(error);
  }
});

router.post('/blog/image', requireAdmin, handleBlogImageUpload, requireMultipartCsrf, async (req, res, next) => {
  try {
    if (req.blogUploadError) {
      return res.status(400).json({
        success: false,
        data: { messages: [req.blogUploadError] }
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        data: { messages: ['Lütfen bir görsel dosyası seçin.'] }
      });
    }

    const imagePath = await saveUploadedBlogImage(req);
    return res.json({
      success: true,
      time: new Date().toISOString(),
      data: {
        files: [imagePath],
        isImages: [true],
        path: '',
        baseurl: '',
        messages: []
      }
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/products/image', requireAdmin, handleProductImageUpload, requireMultipartCsrf, async (req, res, next) => {
  try {
    if (req.productUploadError) {
      return res.status(400).json({
        success: false,
        data: { messages: [req.productUploadError] }
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        data: { messages: ['Lütfen bir görsel dosyası seçin.'] }
      });
    }

    const imagePath = await saveUploadedProductImage(req);
    return res.json({
      success: true,
      time: new Date().toISOString(),
      data: {
        files: [imagePath],
        isImages: [true],
        path: '',
        baseurl: '',
        messages: []
      }
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/blog/:id/edit', requireAdmin, async (req, res, next) => {
  try {
    const post = await prisma.blogPost.findUnique({
      where: { id: Number(req.params.id) },
      include: { blogCategory: true }
    });

    if (!post) {
      return res.status(404).send('Blog yazısı bulunamadı');
    }

    return renderBlogForm(res, {
      post,
      action: `/admin/blog/${post.id}`,
      pageTitle: 'Blog Yazısını Düzenle',
      submitLabel: 'Güncelle'
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/blog/:id', requireAdmin, handleBlogImageUpload, requireMultipartCsrf, async (req, res, next) => {
  try {
    const postId = Number(req.params.id);
    const currentPost = await prisma.blogPost.findUnique({ where: { id: postId } });

    if (!currentPost) {
      return res.status(404).send('Blog yazısı bulunamadı');
    }

    const formError = req.blogUploadError || validateBlogForm(req.body);
    const data = buildBlogData(req.body, currentPost.image);
    const formPost = { ...req.body, id: postId, image: currentPost.image };

    if (formError) {
      return renderBlogForm(res, {
        statusCode: 400,
        post: formPost,
        action: `/admin/blog/${postId}`,
        pageTitle: 'Blog Yazısını Düzenle',
        submitLabel: 'Güncelle',
        error: formError
      });
    }

    if (await blogSlugExists(data.slug, postId)) {
      return renderBlogForm(res, {
        statusCode: 400,
        post: formPost,
        action: `/admin/blog/${postId}`,
        pageTitle: 'Blog Yazısını Düzenle',
        submitLabel: 'Güncelle',
        error: 'Bu slug zaten kullanılıyor. Lütfen farklı bir slug girin.'
      });
    }

    data.blogCategoryId = await resolveBlogCategoryId(req.body);
    const uploadedImagePath = await saveUploadedBlogImage(req);
    if (uploadedImagePath) data.image = uploadedImagePath;

    await prisma.blogPost.update({
      where: { id: postId },
      data
    });

    return res.redirect('/admin/blog');
  } catch (error) {
    if (error.code === 'P2002') {
      return renderBlogForm(res, {
        statusCode: 400,
        post: { ...req.body, id: Number(req.params.id), image: req.savedBlogImagePath || null },
        action: `/admin/blog/${req.params.id}`,
        pageTitle: 'Blog Yazısını Düzenle',
        submitLabel: 'Güncelle',
        error: 'Bu slug zaten kullanılıyor. Lütfen farklı bir slug girin.'
      });
    }

    return next(error);
  }
});

router.post('/blog/:id/status', requireAdmin, async (req, res, next) => {
  try {
    const nextStatus = normalizePublishStatus(req.body.status);
    const currentPost = await prisma.blogPost.findUnique({
      where: { id: Number(req.params.id) },
      select: {
        blogCategoryId: true,
        blogCategory: { select: { isActive: true } }
      }
    });

    if (!currentPost) return res.status(404).send('Blog yazısı bulunamadı');
    if (nextStatus === 'PUBLISHED' && (!currentPost.blogCategoryId || !currentPost.blogCategory?.isActive)) {
      return res.status(400).send('Blog yazısını yayınlamadan önce kategori seçmelisiniz.');
    }

    await prisma.blogPost.update({
      where: { id: Number(req.params.id) },
      data: { status: nextStatus }
    });

    return res.redirect('/admin/blog');
  } catch (error) {
    return next(error);
  }
});

router.post('/blog/:id/delete', requireAdmin, async (req, res, next) => {
  try {
    await prisma.blogPost.delete({ where: { id: Number(req.params.id) } });
    return res.redirect('/admin/blog');
  } catch (error) {
    return next(error);
  }
});

router.get('/products', requireAdmin, async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    const status = String(req.query.status || '').trim();
    const categoryId = String(req.query.categoryId || '').trim();
    const lessonType = String(req.query.lessonType || '').trim();
    const discountType = String(req.query.discountType || '').trim();
    const priceFrom = String(req.query.priceFrom || '').trim();
    const priceTo = String(req.query.priceTo || '').trim();
    const minPrice = Number(priceFrom);
    const maxPrice = Number(priceTo);
    const where = {};

    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { code: { contains: q, mode: 'insensitive' } },
        { slug: { contains: q, mode: 'insensitive' } },
        { summary: { contains: q, mode: 'insensitive' } },
        { lessonType: { contains: q, mode: 'insensitive' } }
      ];
    }

    if (status === 'PUBLISHED' || status === 'DRAFT') {
      where.status = status;
    }

    const selectedCategoryId = Number(categoryId);
    if (categoryId === 'none') {
      where.categoryId = null;
    } else if (categoryId && Number.isInteger(selectedCategoryId)) {
      where.categoryId = selectedCategoryId;
    }

    if (lessonType) {
      where.lessonType = lessonType;
    }

    if (discountType === 'PERCENT' || discountType === 'AMOUNT') {
      where.discountType = discountType;
    } else if (discountType === 'none') {
      where.discountType = null;
    }

    if ((priceFrom && Number.isFinite(minPrice)) || (priceTo && Number.isFinite(maxPrice))) {
      where.price = {};
      if (priceFrom && Number.isFinite(minPrice)) where.price.gte = minPrice;
      if (priceTo && Number.isFinite(maxPrice)) where.price.lte = maxPrice;
    }

    const totalCount = await prisma.product.count({ where });
    const pagination = createPagination(req, totalCount, paginationRequest(req));
    const products = await prisma.product.findMany({
      where,
      include: { category: true },
      orderBy: [{ sortOrder: 'asc' }, { id: 'desc' }],
      skip: pagination.skip,
      take: pagination.take
    });
    const [categories, lessonTypeOptions] = await Promise.all([
      prisma.category.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
      prisma.product.findMany({
        distinct: ['lessonType'],
        orderBy: { lessonType: 'asc' },
        select: { lessonType: true },
        where: { lessonType: { not: null } }
      })
    ]);

    res.render('admin/products/index', {
      products: products.map((product) => ({
        ...product,
        pricing: getProductPricing(product)
      })),
      totalCount,
      pagination,
      q,
      status,
      categoryId,
      lessonType,
      discountType,
      priceFrom,
      priceTo,
      categories,
      lessonTypeOptions: lessonTypeOptions.map((item) => item.lessonType).filter(Boolean)
    });
  } catch (error) {
    next(error);
  }
});

router.get('/products/new', requireAdmin, async (req, res, next) => {
  try {
    await renderProductForm(res, {
      product: null,
      action: '/admin/products',
      pageTitle: 'Yeni Kurs',
      submitLabel: 'Kaydet'
    });
  } catch (error) {
    next(error);
  }
});

router.get('/products/variant-candidates', requireAdmin, async (req, res, next) => {
  try {
    const products = await findProductVariantCandidates(prisma, req.query.excludeId);
    res.json({ status: 'success', products });
  } catch (error) {
    next(error);
  }
});

router.post('/products', requireAdmin, handleProductImageUpload, requireMultipartCsrf, async (req, res, next) => {
  try {
    const formError = req.productUploadError || validateProductForm(req.body);
    const data = buildProductData(req.body);
    const productVariants = normalizeProductVariantRows(req.body.variants, req.body.defaultVariantIndex);

    if (formError) {
      return renderProductForm(res, {
        statusCode: 400,
        product: req.body,
        productVariants,
        action: '/admin/products',
        pageTitle: 'Yeni Kurs',
        submitLabel: 'Kaydet',
        error: formError
      });
    }

    const uploadedImagePath = await saveUploadedProductImage(req);
    if (uploadedImagePath) data.image = uploadedImagePath;

    await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({ data });
      await replaceProductContentStructure(tx, product.id, req.body.tabs, req.body.learningOutcomes);
      await replaceProductVariants(tx, product.id, productVariants, productVariants.findIndex((variant) => variant.isDefault));
    });
    res.redirect('/admin/products');
  } catch (error) {
    if (error.code === 'P2002') {
      return renderProductForm(res, {
        statusCode: 400,
        product: { ...req.body, image: req.savedProductImagePath || req.body.image },
        action: '/admin/products',
        pageTitle: 'Yeni Kurs',
        submitLabel: 'Kaydet',
        error: productUniqueErrorMessage(error)
      });
    }

    if (error instanceof ProductVariantValidationError) {
      return renderProductForm(res, {
        statusCode: 400,
        product: req.body,
        productVariants: productVariantFormRows(req.body),
        action: '/admin/products',
        pageTitle: 'Yeni Kurs',
        submitLabel: 'Kaydet',
        error: error.message
      });
    }

    next(error);
  }
});

router.get('/products/:id/edit', requireAdmin, async (req, res, next) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        tabs: { orderBy: { sortOrder: 'asc' } },
        learningOutcomes: { orderBy: { sortOrder: 'asc' } },
        productVariants: {
          include: { variantProduct: true },
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }]
        }
      }
    });

    if (!product) {
      return res.status(404).send('Kurs bulunamadı');
    }

    return renderProductForm(res, {
      product,
      action: `/admin/products/${product.id}`,
      pageTitle: 'Kursu Düzenle',
      submitLabel: 'Güncelle'
    });
  } catch (error) {
    next(error);
  }
});

router.post('/products/:id', requireAdmin, handleProductImageUpload, requireMultipartCsrf, async (req, res, next) => {
  let currentProduct = null;

  try {
    const productId = Number(req.params.id);
    currentProduct = await prisma.product.findUnique({ where: { id: productId } });

    if (!currentProduct) {
      return res.status(404).send('Kurs bulunamadı');
    }

    const formError = req.productUploadError || validateProductForm(req.body);
    const data = buildProductData(req.body);
    const productVariants = normalizeProductVariantRows(req.body.variants, req.body.defaultVariantIndex);

    if (formError) {
      return renderProductForm(res, {
        statusCode: 400,
        product: { ...req.body, id: productId, image: currentProduct.image },
        productVariants,
        action: `/admin/products/${productId}`,
        pageTitle: 'Kursu Düzenle',
        submitLabel: 'Güncelle',
        error: formError
      });
    }

    const uploadedImagePath = await saveUploadedProductImage(req);
    if (uploadedImagePath) data.image = uploadedImagePath;

    await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: productId },
        data
      });
      await replaceProductContentStructure(tx, productId, req.body.tabs, req.body.learningOutcomes);
      await replaceProductVariants(tx, productId, productVariants, productVariants.findIndex((variant) => variant.isDefault));
    });

    res.redirect('/admin/products');
  } catch (error) {
    if (error.code === 'P2002') {
      return renderProductForm(res, {
        statusCode: 400,
        product: { ...req.body, id: Number(req.params.id), image: req.savedProductImagePath || currentProduct?.image || req.body.image },
        action: `/admin/products/${req.params.id}`,
        pageTitle: 'Kursu Düzenle',
        submitLabel: 'Güncelle',
        error: productUniqueErrorMessage(error)
      });
    }

    if (error instanceof ProductVariantValidationError) {
      return renderProductForm(res, {
        statusCode: 400,
        product: {
          ...req.body,
          id: Number(req.params.id),
          image: req.savedProductImagePath || currentProduct?.image || req.body.image
        },
        productVariants: productVariantFormRows(req.body),
        action: `/admin/products/${req.params.id}`,
        pageTitle: 'Kursu Düzenle',
        submitLabel: 'Güncelle',
        error: error.message
      });
    }

    next(error);
  }
});

router.post('/products/:id/status', requireAdmin, async (req, res, next) => {
  try {
    const productId = Number(req.params.id);
    await prisma.product.update({
      where: { id: productId },
      data: { status: normalizePublishStatus(req.body.status) }
    });

    res.redirect('/admin/products');
  } catch (error) {
    next(error);
  }
});

router.post('/products/:id/delete', requireAdmin, async (req, res, next) => {
  try {
    await prisma.product.delete({ where: { id: Number(req.params.id) } });
    res.redirect('/admin/products');
  } catch (error) {
    if (error.code === 'P2003') {
      return res.status(409).send('Bu kurs eğitim kayıtlarıyla bağlı olduğu için silinemez. Önce yayından alın.');
    }

    next(error);
  }
});

router.get('/leads', requireAdmin, async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    const status = String(req.query.status || '').trim();
    const source = String(req.query.source || '').trim();
    const advisorId = String(req.query.advisorId || '').trim();
    const followUp = String(req.query.followUp || '').trim();
    const dateFrom = String(req.query.dateFrom || '').trim();
    const dateTo = String(req.query.dateTo || '').trim();
    const fromDate = parseOptionalDate(dateFrom);
    const toDate = endOfDay(parseOptionalDate(dateTo));
    const where = {};

    if (status && Object.prototype.hasOwnProperty.call(leadStatusLabels, status)) {
      where.status = status;
    }

    if (source) {
      where.source = source;
    }

    const selectedAdvisorId = normalizeAdvisorId(advisorId);
    if (selectedAdvisorId) {
      where.advisorId = selectedAdvisorId;
    }

    applyFollowUpFilter(where, followUp);

    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) where.createdAt.gte = fromDate;
      if (toDate) where.createdAt.lte = toDate;
    }

    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
        { message: { contains: q, mode: 'insensitive' } },
        { source: { contains: q, mode: 'insensitive' } }
      ];
    }

    const totalCount = await prisma.lead.count({ where });
    const pagination = createPagination(req, totalCount, paginationRequest(req));
    const leads = await prisma.lead.findMany({
      where,
      include: { advisor: true },
      orderBy: { createdAt: 'desc' },
      skip: pagination.skip,
      take: pagination.take
    });
    const [sourceOptions, advisorOptions] = await Promise.all([
      prisma.lead.findMany({
        distinct: ['source'],
        orderBy: { source: 'asc' },
        select: { source: true }
      }),
      getAdvisorOptions()
    ]);

    res.render('admin/leads/index', {
      leads,
      totalCount,
      pagination,
      q,
      status,
      source,
      advisorId,
      advisorOptions,
      followUp,
      sourceOptions: sourceOptions.map((item) => item.source).filter(Boolean),
      dateFrom,
      dateTo,
      statusLabels: leadStatusLabels
    });
  } catch (error) {
    next(error);
  }
});

router.get('/leads/:id', requireAdmin, async (req, res, next) => {
  try {
    const lead = await getLeadDetail(req.params.id);

    if (!lead) {
      return res.status(404).send('Başvuru bulunamadı');
    }

    res.render('admin/leads/show', {
      lead,
      advisorOptions: await getAdvisorOptions(),
      followUpValue: formatDateTimeLocal(lead.nextFollowUpAt),
      statusLabels: leadStatusLabels,
      error: null
    });
  } catch (error) {
    next(error);
  }
});

router.post('/leads/:id/status', requireAdmin, async (req, res, next) => {
  try {
    const leadId = Number(req.params.id);
    const nextStatus = normalizeLeadStatus(req.body.status);
    const nextFollowUpAt = parseOptionalDate(req.body.nextFollowUpAt);
    const advisorId = normalizeAdvisorId(req.body.advisorId);
    const updated = await prisma.$transaction(async (tx) => {
      const currentLead = await tx.lead.findUnique({ where: { id: leadId } });

      if (!currentLead) {
        return false;
      }

      await tx.lead.update({
        where: { id: leadId },
        data: {
          status: nextStatus,
          advisorId,
          nextFollowUpAt
        }
      });

      if (currentLead.status !== nextStatus) {
        await tx.leadStatusHistory.create({
          data: {
            leadId,
            fromStatus: currentLead.status,
            toStatus: nextStatus,
            authorName: currentAdminName(req),
            note: nullableText(req.body.statusNote)
          }
        });
      }

      return true;
    });

    if (!updated) {
      return res.status(404).send('Başvuru bulunamadı');
    }

    res.redirect(`/admin/leads/${req.params.id}`);
  } catch (error) {
    next(error);
  }
});

router.post('/leads/:id/notes', requireAdmin, async (req, res, next) => {
  try {
    const note = String(req.body.note || '').trim();

    if (!note) {
      const lead = await getLeadDetail(req.params.id);

      return res.status(400).render('admin/leads/show', {
        lead,
        advisorOptions: await getAdvisorOptions(),
        followUpValue: formatDateTimeLocal(lead.nextFollowUpAt),
        statusLabels: leadStatusLabels,
        error: 'Not alanı boş olamaz.'
      });
    }

    await prisma.leadNote.create({
      data: {
        leadId: Number(req.params.id),
        note,
        authorName: currentAdminName(req)
      }
    });

    res.redirect(`/admin/leads/${req.params.id}`);
  } catch (error) {
    next(error);
  }
});

router.get('/members', requireAdmin, async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    const status = String(req.query.status || '').trim();
    const mailList = String(req.query.mailList || '').trim();
    const smsList = String(req.query.smsList || '').trim();
    const dateFrom = String(req.query.dateFrom || '').trim();
    const dateTo = String(req.query.dateTo || '').trim();
    const fromDate = parseOptionalDate(dateFrom);
    const toDate = endOfDay(parseOptionalDate(dateTo));
    const where = {};

    if (status && Object.prototype.hasOwnProperty.call(memberStatusLabels, status)) {
      where.status = status;
    }

    if (mailList === 'true' || mailList === 'false') {
      where.mailList = mailList === 'true';
    }

    if (smsList === 'true' || smsList === 'false') {
      where.smsList = smsList === 'true';
    }

    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) where.createdAt.gte = fromDate;
      if (toDate) where.createdAt.lte = toDate;
    }

    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { surname: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } }
      ];
    }

    const { members, totalCount, pagination, tableReady } = await safeMembersList(req, where);

    res.render('admin/members/index', {
      members,
      totalCount,
      pagination,
      q,
      status,
      mailList,
      smsList,
      dateFrom,
      dateTo,
      statusLabels: memberStatusLabels,
      warning: tableReady ? null : 'Üye tablosu henüz oluşturulmadı. Migration çalıştırıldıktan sonra kayıtlar burada görünecek.'
    });
  } catch (error) {
    next(error);
  }
});

router.get('/members/:id', requireAdmin, async (req, res, next) => {
  try {
    if (!hasMemberModel()) {
      return res.redirect('/admin/members');
    }

    const member = await prisma.member.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        notes: { orderBy: { createdAt: 'desc' } },
        courseInterests: {
          include: { product: true },
          orderBy: { createdAt: 'desc' }
        },
        educationRegistrations: {
          include: { product: true },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!member) {
      return res.status(404).send('Üye bulunamadı');
    }

    const products = await prisma.product.findMany({
      orderBy: [{ title: 'asc' }],
      take: 250
    });

    res.render('admin/members/show', {
      member,
      products,
      statusLabels: memberStatusLabels,
      registrationStatusLabels,
      error: null
    });
  } catch (error) {
    if (isMissingTableError(error)) {
      return res.redirect('/admin/members');
    }

    next(error);
  }
});

router.post('/members/:id/notes', requireAdmin, async (req, res, next) => {
  try {
    const note = String(req.body.note || '').trim();
    if (!note) {
      const member = await prisma.member.findUnique({
        where: { id: Number(req.params.id) },
        include: {
          notes: { orderBy: { createdAt: 'desc' } },
          courseInterests: { include: { product: true }, orderBy: { createdAt: 'desc' } },
          educationRegistrations: { include: { product: true }, orderBy: { createdAt: 'desc' } }
        }
      });
      const products = await prisma.product.findMany({ orderBy: [{ title: 'asc' }], take: 250 });
      return res.status(400).render('admin/members/show', {
        member,
        products,
        statusLabels: memberStatusLabels,
        registrationStatusLabels,
        error: 'Not alanı boş olamaz.'
      });
    }

    await prisma.memberNote.create({
      data: {
        memberId: Number(req.params.id),
        note,
        authorName: req.session.adminUser ? req.session.adminUser.name : null
      }
    });

    res.redirect(`/admin/members/${req.params.id}`);
  } catch (error) {
    next(error);
  }
});

router.post('/members/:id/status', requireAdmin, async (req, res, next) => {
  try {
    await prisma.member.update({
      where: { id: Number(req.params.id) },
      data: { status: normalizeMemberStatus(req.body.status) }
    });

    res.redirect(`/admin/members/${req.params.id}`);
  } catch (error) {
    next(error);
  }
});

router.post('/members/:id/interests', requireAdmin, async (req, res, next) => {
  try {
    const productId = req.body.productId ? Number(req.body.productId) : null;
    if (!productId) {
      return res.redirect(`/admin/members/${req.params.id}`);
    }

    await prisma.memberCourseInterest.upsert({
      where: {
        memberId_productId: {
          memberId: Number(req.params.id),
          productId
        }
      },
      update: {
        note: nullableText(req.body.note)
      },
      create: {
        memberId: Number(req.params.id),
        productId,
        note: nullableText(req.body.note)
      }
    });

    res.redirect(`/admin/members/${req.params.id}`);
  } catch (error) {
    next(error);
  }
});

router.post('/members/:id/interests/:interestId/delete', requireAdmin, async (req, res, next) => {
  try {
    await prisma.memberCourseInterest.deleteMany({
      where: {
        id: Number(req.params.interestId),
        memberId: Number(req.params.id)
      }
    });

    res.redirect(`/admin/members/${req.params.id}`);
  } catch (error) {
    next(error);
  }
});

router.get('/registrations', requireAdmin, async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    const status = String(req.query.status || '').trim();
    const paymentStatus = String(req.query.paymentStatus || '').trim();
    const productId = String(req.query.productId || '').trim();
    const source = String(req.query.source || '').trim();
    const advisorId = String(req.query.advisorId || '').trim();
    const followUp = String(req.query.followUp || '').trim();
    const createdFrom = String(req.query.createdFrom || '').trim();
    const createdTo = String(req.query.createdTo || '').trim();
    const startsFrom = String(req.query.startsFrom || '').trim();
    const startsTo = String(req.query.startsTo || '').trim();
    const createdFromDate = parseOptionalDate(createdFrom);
    const createdToDate = endOfDay(parseOptionalDate(createdTo));
    const startsFromDate = parseOptionalDate(startsFrom);
    const startsToDate = endOfDay(parseOptionalDate(startsTo));
    const where = {};

    if (status && Object.prototype.hasOwnProperty.call(registrationStatusLabels, status)) {
      where.status = status;
    }

    if (paymentStatus && Object.prototype.hasOwnProperty.call(paymentStatusLabels, paymentStatus)) {
      where.paymentStatus = paymentStatus;
    }

    const selectedProductId = Number(productId);
    if (productId && Number.isInteger(selectedProductId)) {
      where.productId = selectedProductId;
    }

    if (source) {
      where.source = source;
    }

    const selectedAdvisorId = normalizeAdvisorId(advisorId);
    if (selectedAdvisorId) {
      where.advisorId = selectedAdvisorId;
    }

    applyFollowUpFilter(where, followUp);

    if (createdFromDate || createdToDate) {
      where.createdAt = {};
      if (createdFromDate) where.createdAt.gte = createdFromDate;
      if (createdToDate) where.createdAt.lte = createdToDate;
    }

    if (startsFromDate || startsToDate) {
      where.startsAt = {};
      if (startsFromDate) where.startsAt.gte = startsFromDate;
      if (startsToDate) where.startsAt.lte = startsToDate;
    }

    if (q) {
      where.OR = [
        { courseTitle: { contains: q, mode: 'insensitive' } },
        { product: { is: { code: { contains: q, mode: 'insensitive' } } } },
        { name: { contains: q, mode: 'insensitive' } },
        { surname: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } }
      ];
    }

    const { registrations, totalCount, pagination, tableReady } = await safeEducationRegistrationsList(req, where);
    const [products, sourceOptions, advisorOptions] = await Promise.all([
      prisma.product.findMany({
        orderBy: { title: 'asc' },
        select: { id: true, code: true, title: true }
      }),
      tableReady
        ? prisma.educationRegistration.findMany({
            distinct: ['source'],
            orderBy: { source: 'asc' },
            select: { source: true }
          })
        : [],
      getAdvisorOptions()
    ]);

    setPrivateNoStore(res);
    res.render('admin/registrations/index', {
      registrations: registrations.map(withoutEncryptedRegistrationPii),
      totalCount,
      pagination,
      q,
      status,
      paymentStatus,
      productId,
      source,
      advisorId,
      advisorOptions,
      followUp,
      createdFrom,
      createdTo,
      startsFrom,
      startsTo,
      products,
      sourceOptions: sourceOptions.map((item) => item.source).filter(Boolean),
      statusLabels: registrationStatusLabels,
      paymentStatusLabels,
      warning: tableReady ? null : 'Eğitim kayıt tablosu henüz oluşturulmadı. Migration çalıştırıldıktan sonra kayıtlar burada görünecek.'
    });
  } catch (error) {
    next(error);
  }
});

router.get('/registrations/new', requireAdmin, async (req, res, next) => {
  try {
    await renderRegistrationForm(res, {
      registration: null,
      action: '/admin/registrations',
      pageTitle: 'Yeni Eğitim Kaydı',
      submitLabel: 'Kayıt Oluştur',
      profileRequired: true
    });
  } catch (error) {
    next(error);
  }
});

router.post('/registrations', requireAdmin, async (req, res, next) => {
  try {
    if (!hasEducationRegistrationModel()) {
      return res.redirect('/admin/registrations');
    }

    const {
      data,
      isValid,
      fieldErrors,
      profileRequired
    } = await buildRegistrationData(req.body, { requireProfile: true });
    const financeError = validateRegistrationFinanceFields(req.body);

    if (!isValid || financeError) {
      return renderRegistrationForm(res, {
        statusCode: 400,
        registration: req.body,
        action: '/admin/registrations',
        pageTitle: 'Yeni Eğitim Kaydı',
        submitLabel: 'Kayıt Oluştur',
        error: financeError || 'Zorunlu kayıt ve kişisel bilgi alanlarını kontrol ediniz.',
        fieldErrors,
        profileRequired
      });
    }

    await prisma.educationRegistration.create({
      data: {
        ...data,
        source: 'admin',
      }
    });

    res.redirect('/admin/registrations');
  } catch (error) {
    if (handleRegistrationPiiError(res, error)) return;
    next(error);
  }
});

router.get('/registrations/:id/edit', requireAdmin, async (req, res, next) => {
  try {
    if (!hasEducationRegistrationModel()) {
      return res.redirect('/admin/registrations');
    }

    const registration = await prisma.educationRegistration.findUnique({
      where: { id: Number(req.params.id) },
      include: { product: true }
    });

    if (!registration) {
      return res.status(404).send('Eğitim kaydı bulunamadı');
    }

    const registrationProfile = decryptRegistrationPii(registration);
    const formRegistration = {
      ...withoutEncryptedRegistrationPii(registration),
      ...registrationProfile
    };

    return renderRegistrationForm(res, {
      registration: formRegistration,
      action: `/admin/registrations/${registration.id}`,
      pageTitle: 'Eğitim Kaydını Düzenle',
      submitLabel: 'Güncelle',
      profileRequired: hasStoredRegistrationPii(registration),
      focusAddress: req.query.focus === 'address'
    });
  } catch (error) {
    if (handleRegistrationPiiError(res, error)) return;
    next(error);
  }
});

router.post('/registrations/:id', requireAdmin, async (req, res, next) => {
  try {
    if (!hasEducationRegistrationModel()) {
      return res.redirect('/admin/registrations');
    }

    const registrationId = Number(req.params.id);
    const registrationExists = await prisma.educationRegistration.findUnique({
      where: { id: registrationId }
    });

    if (!registrationExists) {
      return res.status(404).send('Eğitim kaydı bulunamadı');
    }

    if (hasStoredRegistrationPii(registrationExists)) {
      decryptRegistrationPii(registrationExists);
    }

    const {
      data,
      isValid,
      fieldErrors,
      profileRequired
    } = await buildRegistrationData(req.body, {
      hasStoredPii: hasStoredRegistrationPii(registrationExists)
    });
    const financeError = validateRegistrationFinanceFields(req.body);

    if (!isValid || financeError) {
      return renderRegistrationForm(res, {
        statusCode: 400,
        registration: { ...req.body, id: registrationId },
        action: `/admin/registrations/${registrationId}`,
        pageTitle: 'Eğitim Kaydını Düzenle',
        submitLabel: 'Güncelle',
        error: financeError || (profileRequired
          ? 'Zorunlu kayıt ve kişisel bilgi alanlarını kontrol ediniz.'
          : 'Eğitim, ad ve telefon alanları zorunludur.'),
        fieldErrors,
        profileRequired
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const currentRegistration = await tx.educationRegistration.findUnique({
        where: { id: registrationId }
      });

      if (!currentRegistration) {
        return false;
      }

      await tx.educationRegistration.update({
        where: { id: registrationId },
        data
      });

      if (
        currentRegistration.status !== data.status
        || currentRegistration.paymentStatus !== data.paymentStatus
      ) {
        await tx.educationRegistrationStatusHistory.create({
          data: {
            registrationId,
            fromStatus: currentRegistration.status,
            toStatus: data.status,
            fromPaymentStatus: currentRegistration.paymentStatus,
            toPaymentStatus: data.paymentStatus,
            authorName: currentAdminName(req),
            note: 'Kayıt düzenleme formundan güncellendi.'
          }
        });
      }

      return true;
    });

    if (!updated) {
      return res.status(404).send('Eğitim kaydı bulunamadı');
    }

    res.redirect(`/admin/registrations/${registrationId}`);
  } catch (error) {
    if (handleRegistrationPiiError(res, error)) return;
    next(error);
  }
});

router.get('/registrations/:id', requireAdmin, async (req, res, next) => {
  try {
    if (!hasEducationRegistrationModel()) {
      return res.redirect('/admin/registrations');
    }

    const registration = await getRegistrationDetail(req.params.id);

    if (!registration) {
      return res.status(404).send('Eğitim kaydı bulunamadı');
    }

    return renderRegistrationDetail(res, registration);
  } catch (error) {
    if (handleRegistrationPiiError(res, error)) return;
    next(error);
  }
});

router.post('/registrations/:id/status', requireAdmin, async (req, res, next) => {
  try {
    if (!hasEducationRegistrationModel()) {
      return res.redirect('/admin/registrations');
    }

    const registrationId = Number(req.params.id);
    const nextStatus = normalizeRegistrationStatus(req.body.status);
    const nextPaymentStatus = normalizePaymentStatus(req.body.paymentStatus);
    const financeError = validateRegistrationFinanceFields(req.body);

    if (financeError) {
      const registration = await getRegistrationDetail(req.params.id);
      return renderRegistrationDetail(res, registration, {
        statusCode: 400,
        error: financeError
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const currentRegistration = await tx.educationRegistration.findUnique({
        where: { id: registrationId }
      });

      if (!currentRegistration) {
        return false;
      }

      await tx.educationRegistration.update({
        where: { id: registrationId },
        data: {
          status: nextStatus,
          paymentStatus: nextPaymentStatus,
          totalAmount: optionalDecimal(req.body.totalAmount),
          invoiceStatus: normalizeInvoiceStatus(req.body.invoiceStatus),
          advisorId: normalizeAdvisorId(req.body.advisorId),
          nextFollowUpAt: parseOptionalDate(req.body.nextFollowUpAt),
          startsAt: parseOptionalDate(req.body.startsAt),
          advisorNote: nullableText(req.body.advisorNote),
          paymentNote: nullableText(req.body.paymentNote)
        }
      });

      if (
        currentRegistration.status !== nextStatus
        || currentRegistration.paymentStatus !== nextPaymentStatus
      ) {
        await tx.educationRegistrationStatusHistory.create({
          data: {
            registrationId,
            fromStatus: currentRegistration.status,
            toStatus: nextStatus,
            fromPaymentStatus: currentRegistration.paymentStatus,
            toPaymentStatus: nextPaymentStatus,
            authorName: currentAdminName(req),
            note: nullableText(req.body.statusNote)
          }
        });
      }

      return true;
    });

    if (!updated) {
      return res.status(404).send('Eğitim kaydı bulunamadı');
    }

    res.redirect(`/admin/registrations/${req.params.id}`);
  } catch (error) {
    next(error);
  }
});

router.post('/registrations/:id/notes', requireAdmin, async (req, res, next) => {
  try {
    if (!hasEducationRegistrationModel()) {
      return res.redirect('/admin/registrations');
    }

    const note = String(req.body.note || '').trim();
    if (!note) {
      const registration = await getRegistrationDetail(req.params.id);

      return renderRegistrationDetail(res, registration, {
        statusCode: 400,
        error: 'Not alanı boş olamaz.'
      });
    }

    await prisma.educationRegistrationNote.create({
      data: {
        registrationId: Number(req.params.id),
        note,
        authorName: currentAdminName(req)
      }
    });

    res.redirect(`/admin/registrations/${req.params.id}`);
  } catch (error) {
    next(error);
  }
});

router.post('/registrations/:id/payments', requireAdmin, async (req, res, next) => {
  try {
    if (!hasEducationRegistrationModel()) {
      return res.redirect('/admin/registrations');
    }

    const registrationId = Number(req.params.id);
    const amount = optionalDecimal(req.body.amount);

    if (!amount || Number(amount) <= 0) {
      const registration = await getRegistrationDetail(req.params.id);
      return renderRegistrationDetail(res, registration, {
        statusCode: 400,
        error: 'Ödeme tutarı geçerli pozitif sayı olmalıdır.'
      });
    }

    const created = await prisma.$transaction(async (tx) => {
      const registration = await tx.educationRegistration.findUnique({
        where: { id: registrationId },
        select: { id: true }
      });

      if (!registration) {
        return false;
      }

      await tx.educationPayment.create({
        data: {
          registrationId,
          amount,
          method: nullableText(req.body.method),
          paidAt: parseOptionalDate(req.body.paidAt) || new Date(),
          note: nullableText(req.body.note),
          authorName: currentAdminName(req)
        }
      });

      await syncRegistrationPaymentStatus(tx, registrationId, currentAdminName(req));
      return true;
    });

    if (!created) {
      return res.status(404).send('Eğitim kaydı bulunamadı');
    }

    res.redirect(`/admin/registrations/${registrationId}`);
  } catch (error) {
    next(error);
  }
});

router.post('/registrations/:id/installments', requireAdmin, async (req, res, next) => {
  try {
    if (!hasEducationRegistrationModel()) {
      return res.redirect('/admin/registrations');
    }

    const registrationId = Number(req.params.id);
    const amount = optionalDecimal(req.body.amount);
    const dueDate = parseOptionalDate(req.body.dueDate);

    if (!amount || Number(amount) <= 0 || !dueDate) {
      const registration = await getRegistrationDetail(req.params.id);
      return renderRegistrationDetail(res, registration, {
        statusCode: 400,
        error: 'Taksit tutarı ve vade tarihi zorunludur.'
      });
    }

    const created = await prisma.$transaction(async (tx) => {
      const registration = await tx.educationRegistration.findUnique({
        where: { id: registrationId },
        select: { id: true }
      });

      if (!registration) {
        return false;
      }

      await tx.educationInstallment.create({
        data: {
          registrationId,
          title: nullableText(req.body.title),
          amount,
          dueDate,
          status: normalizeInstallmentStatus(req.body.status),
          note: nullableText(req.body.note)
        }
      });

      return true;
    });

    if (!created) {
      return res.status(404).send('Eğitim kaydı bulunamadı');
    }

    res.redirect(`/admin/registrations/${registrationId}`);
  } catch (error) {
    next(error);
  }
});

router.post('/registrations/:registrationId/installments/:installmentId/status', requireAdmin, async (req, res, next) => {
  try {
    const registrationId = Number(req.params.registrationId);
    const installmentId = Number(req.params.installmentId);
    const result = await prisma.educationInstallment.updateMany({
      where: {
        id: installmentId,
        registrationId
      },
      data: { status: normalizeInstallmentStatus(req.body.status) }
    });

    if (result.count === 0) {
      return res.status(404).send('Taksit bulunamadı');
    }

    res.redirect(`/admin/registrations/${registrationId}`);
  } catch (error) {
    next(error);
  }
});

router.get('/coupons', requireAdmin, async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    const isActive = String(req.query.isActive || '').trim();
    const discountType = String(req.query.discountType || '').trim();
    const productId = String(req.query.productId || '').trim();
    const startsFrom = String(req.query.startsFrom || '').trim();
    const startsTo = String(req.query.startsTo || '').trim();
    const expiresFrom = String(req.query.expiresFrom || '').trim();
    const expiresTo = String(req.query.expiresTo || '').trim();
    const startsFromDate = parseOptionalDate(startsFrom);
    const startsToDate = endOfDay(parseOptionalDate(startsTo));
    const expiresFromDate = parseOptionalDate(expiresFrom);
    const expiresToDate = endOfDay(parseOptionalDate(expiresTo));
    const where = {};

    if (q) {
      where.OR = [
        { code: { contains: q, mode: 'insensitive' } },
        { title: { contains: q, mode: 'insensitive' } }
      ];
    }

    if (isActive === 'true' || isActive === 'false') {
      where.isActive = isActive === 'true';
    }

    if (discountType === 'PERCENT' || discountType === 'AMOUNT') {
      where.discountType = discountType;
    }

    const selectedProductId = Number(productId);
    if (productId === 'all') {
      where.products = { none: {} };
    } else if (productId && Number.isInteger(selectedProductId)) {
      where.products = { some: { productId: selectedProductId } };
    }

    if (startsFromDate || startsToDate) {
      where.startsAt = {};
      if (startsFromDate) where.startsAt.gte = startsFromDate;
      if (startsToDate) where.startsAt.lte = startsToDate;
    }

    if (expiresFromDate || expiresToDate) {
      where.expiresAt = {};
      if (expiresFromDate) where.expiresAt.gte = expiresFromDate;
      if (expiresToDate) where.expiresAt.lte = expiresToDate;
    }

    const { coupons, totalCount, pagination, tableReady } = await safeCouponsList(req, where);
    const products = await prisma.product.findMany({
      orderBy: { title: 'asc' },
      select: { id: true, title: true }
    });

    res.render('admin/coupons/index', {
      coupons,
      totalCount,
      pagination,
      q,
      isActive,
      discountType,
      productId,
      startsFrom,
      startsTo,
      expiresFrom,
      expiresTo,
      products,
      warning: tableReady ? null : 'Kupon tablosu henüz oluşturulmadı. Migration çalıştırıldıktan sonra kuponlar burada görünecek.'
    });
  } catch (error) {
    next(error);
  }
});

router.get('/coupons/new', requireAdmin, async (req, res, next) => {
  try {
    await renderCouponForm(res, {
      coupon: null,
      selectedProductIds: [],
      action: '/admin/coupons',
      pageTitle: 'Yeni Kupon',
      submitLabel: 'Kaydet'
    });
  } catch (error) {
    next(error);
  }
});

router.post('/coupons', requireAdmin, async (req, res, next) => {
  try {
    const formError = validateCouponForm(req.body);
    const selectedProductIds = normalizeIdList(req.body.productIds);

    if (formError) {
      return renderCouponForm(res, {
        statusCode: 400,
        coupon: req.body,
        selectedProductIds,
        action: '/admin/coupons',
        pageTitle: 'Yeni Kupon',
        submitLabel: 'Kaydet',
        error: formError
      });
    }

    await prisma.$transaction(async (tx) => {
      const coupon = await tx.coupon.create({ data: buildCouponData(req.body) });
      await syncCouponProducts(tx, coupon.id, selectedProductIds);
    });

    res.redirect('/admin/coupons');
  } catch (error) {
    if (error.code === 'P2002') {
      return renderCouponForm(res, {
        statusCode: 400,
        coupon: req.body,
        selectedProductIds: normalizeIdList(req.body.productIds),
        action: '/admin/coupons',
        pageTitle: 'Yeni Kupon',
        submitLabel: 'Kaydet',
        error: 'Bu kupon kodu zaten kullanılıyor.'
      });
    }

    next(error);
  }
});

router.get('/coupons/:id/edit', requireAdmin, async (req, res, next) => {
  try {
    const coupon = await prisma.coupon.findUnique({
      where: { id: Number(req.params.id) },
      include: { products: true }
    });

    if (!coupon) {
      return res.status(404).send('Kupon bulunamadı');
    }

    return renderCouponForm(res, {
      coupon,
      selectedProductIds: coupon.products.map((item) => item.productId),
      action: `/admin/coupons/${coupon.id}`,
      pageTitle: 'Kuponu Düzenle',
      submitLabel: 'Güncelle'
    });
  } catch (error) {
    next(error);
  }
});

router.post('/coupons/:id', requireAdmin, async (req, res, next) => {
  try {
    const couponId = Number(req.params.id);
    const currentCoupon = await prisma.coupon.findUnique({ where: { id: couponId } });

    if (!currentCoupon) {
      return res.status(404).send('Kupon bulunamadı');
    }

    const selectedProductIds = normalizeIdList(req.body.productIds);
    const formError = validateCouponForm(req.body);

    if (formError) {
      return renderCouponForm(res, {
        statusCode: 400,
        coupon: { ...req.body, id: couponId },
        selectedProductIds,
        action: `/admin/coupons/${couponId}`,
        pageTitle: 'Kuponu Düzenle',
        submitLabel: 'Güncelle',
        error: formError
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const coupon = await tx.coupon.findUnique({
        where: { id: couponId },
        select: { id: true }
      });

      if (!coupon) {
        return false;
      }

      await tx.coupon.update({
        where: { id: couponId },
        data: buildCouponData(req.body)
      });
      await syncCouponProducts(tx, couponId, selectedProductIds);

      return true;
    });

    if (!updated) {
      return res.status(404).send('Kupon bulunamadı');
    }

    res.redirect('/admin/coupons');
  } catch (error) {
    if (error.code === 'P2002') {
      return renderCouponForm(res, {
        statusCode: 400,
        coupon: { ...req.body, id: Number(req.params.id) },
        selectedProductIds: normalizeIdList(req.body.productIds),
        action: `/admin/coupons/${req.params.id}`,
        pageTitle: 'Kuponu Düzenle',
        submitLabel: 'Güncelle',
        error: 'Bu kupon kodu zaten kullanılıyor.'
      });
    }

    next(error);
  }
});

router.post('/coupons/:id/status', requireAdmin, async (req, res, next) => {
  try {
    await prisma.coupon.update({
      where: { id: Number(req.params.id) },
      data: { isActive: req.body.isActive === 'true' }
    });

    res.redirect('/admin/coupons');
  } catch (error) {
    next(error);
  }
});

router.post('/coupons/:id/delete', requireAdmin, async (req, res, next) => {
  try {
    await prisma.coupon.delete({ where: { id: Number(req.params.id) } });
    res.redirect('/admin/coupons');
  } catch (error) {
    next(error);
  }
});

router.use((error,req,res,next) => {
  if(error && error.code === 'P2025'){
    return res.status(404).send('Kayıt bulunamadı');
  }

  return next(error);

})

module.exports = router;
module.exports.findProductVariantCandidates = findProductVariantCandidates;
