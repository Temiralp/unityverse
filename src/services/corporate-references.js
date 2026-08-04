const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');

const CORPORATE_REFERENCE_UPLOAD_DIRECTORY = path.resolve(
  __dirname,
  '../../uploads/corporate-references'
);
const CORPORATE_REFERENCE_IMAGE_MAX_SIZE = 2 * 1024 * 1024;
const CORPORATE_REFERENCE_IMAGE_EXTENSIONS = Object.freeze({
  'image/avif': '.avif',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp'
});

function normalizeCorporateReferenceName(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function validateCorporateReferenceForm(body, hasLogo) {
  const name = normalizeCorporateReferenceName(body && body.name);

  if (!name) return 'Kurum adı zorunludur.';
  if (name.length > 120) return 'Kurum adı en fazla 120 karakter olabilir.';
  if (!hasLogo) return 'Logo görseli zorunludur.';

  return null;
}

function corporateReferenceData(body) {
  return {
    name: normalizeCorporateReferenceName(body && body.name),
    isActive: Boolean(body && body.isActive)
  };
}

function normalizeCorporateReferenceOrder(value) {
  const rawValues = Array.isArray(value) ? value : String(value || '').split(',');
  const ids = rawValues
    .map((entry) => Number(String(entry).trim()))
    .filter((entry) => Number.isInteger(entry) && entry > 0);

  return [...new Set(ids)];
}

async function saveCorporateReferenceLogo(file) {
  if (!file) return null;

  const extension = CORPORATE_REFERENCE_IMAGE_EXTENSIONS[file.mimetype];
  if (!extension) throw new Error('Desteklenmeyen kurumsal referans logo formatı.');

  await fs.mkdir(CORPORATE_REFERENCE_UPLOAD_DIRECTORY, { recursive: true });
  const fileName = `${crypto.randomUUID()}${extension}`;
  await fs.writeFile(path.join(CORPORATE_REFERENCE_UPLOAD_DIRECTORY, fileName), file.buffer, {
    flag: 'wx'
  });

  return `/uploads/corporate-references/${fileName}`;
}

function corporateReferenceLogoFilePath(logoPath) {
  const normalized = String(logoPath || '').replace(/\\/g, '/');
  const prefix = '/uploads/corporate-references/';
  if (!normalized.startsWith(prefix)) return null;

  const fileName = path.basename(normalized);
  const absolutePath = path.resolve(CORPORATE_REFERENCE_UPLOAD_DIRECTORY, fileName);
  if (!absolutePath.startsWith(`${CORPORATE_REFERENCE_UPLOAD_DIRECTORY}${path.sep}`)) return null;
  return absolutePath;
}

function isSafeCorporateReferenceLogoPath(logoPath) {
  return /^\/uploads\/corporate-references\/[a-z0-9][a-z0-9._-]*\.(?:avif|jpe?g|png|webp)$/i
    .test(String(logoPath || ''));
}

async function deleteCorporateReferenceLogo(logoPath) {
  const filePath = corporateReferenceLogoFilePath(logoPath);
  if (!filePath) return;

  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

module.exports = {
  CORPORATE_REFERENCE_IMAGE_EXTENSIONS,
  CORPORATE_REFERENCE_IMAGE_MAX_SIZE,
  corporateReferenceData,
  corporateReferenceLogoFilePath,
  deleteCorporateReferenceLogo,
  isSafeCorporateReferenceLogoPath,
  normalizeCorporateReferenceName,
  normalizeCorporateReferenceOrder,
  saveCorporateReferenceLogo,
  validateCorporateReferenceForm
};
