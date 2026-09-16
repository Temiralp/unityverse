// Admin "Word'den içe aktar" isteginin yanitini uretir: docx -> tab HTML + rapor.
// Route ince kalir; hata durumlari HTTP kodu ve Turkce mesajla burada eslenir.
// Hicbir sey kaydedilmez: sonuc yalnizca onizleme/editore yerlestirme icindir.

const { docxToBlocks } = require('./docx-to-blocks');
const { buildContentStructure, mapToCourseTabs } = require('./content-structure');
const { renderCourseTabs } = require('./course-tab-renderer');

const IMPORT_ERROR_MESSAGES = {
  'missing-file': 'Lütfen bir Word (.docx) dosyası seçin.',
  'invalid-file': 'Desteklenmeyen dosya: lütfen .docx (Word) kaynağını yükleyin. PDF okunamaz.',
  'too-large': 'Dosya 5 MB sınırını aşıyor.',
  'converter-unavailable': 'Dönüştürücü sunucuda yüklü değil. Yöneticiye bildirin (npm ci).',
  'conversion-failed': 'Dosya okunamadı; bozuk veya parola korumalı olabilir.'
};

const ERROR_STATUS = { 'converter-unavailable': 503 };

function failure(reason) {
  return {
    status: ERROR_STATUS[reason] || 400,
    body: { success: false, reason, message: IMPORT_ERROR_MESSAGES[reason] || IMPORT_ERROR_MESSAGES['conversion-failed'] }
  };
}

async function buildImportResponse(buffer, options = {}) {
  if (!buffer) return failure('missing-file');

  const converted = await docxToBlocks(buffer, options);
  if (!converted.ok) return failure(converted.reason);

  const structure = buildContentStructure(converted.blocks);
  const tabs = mapToCourseTabs(structure);

  return {
    status: 200,
    body: {
      success: true,
      report: tabs.report,
      warnings: [...converted.warnings, ...tabs.detection.warnings],
      detection: tabs.detection,
      panelCount: tabs.curriculum.panels.length,
      tabs: renderCourseTabs(tabs)
    }
  };
}

module.exports = { IMPORT_ERROR_MESSAGES, buildImportResponse };
