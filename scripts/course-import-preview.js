#!/usr/bin/env node

// Word (.docx) -> kurs tab icerigi onizleme (CLI). Admin arayuzu (Cember 8b) gelene kadar
// gercek dosyalarla el testi icin. Hicbir sey kaydetmez.
// Kullanim: node scripts/course-import-preview.js <dosya.docx> [--html]

const fs = require('fs');
const path = require('path');

const { docxToBlocks } = require('../src/services/course-import/docx-to-blocks');
const { buildContentStructure, mapToCourseTabs } = require('../src/services/course-import/content-structure');
const { renderCourseTabs } = require('../src/services/course-import/course-tab-renderer');

const REASONS = {
  'invalid-file': 'Desteklenmeyen dosya: lütfen .docx (Word) kaynağını yükleyin.',
  'too-large': 'Dosya 5 MB sınırını aşıyor.',
  'converter-unavailable': 'Dönüştürücü yüklü değil (npm ci çalıştırın).',
  'conversion-failed': 'Dosya okunamadı.'
};

async function main() {
  const [file, flag] = process.argv.slice(2);
  if (!file) {
    console.error('Kullanım: node scripts/course-import-preview.js <dosya.docx> [--html]');
    process.exit(2);
  }

  const converted = await docxToBlocks(fs.readFileSync(path.resolve(file)));
  if (!converted.ok) {
    console.error(`HATA: ${REASONS[converted.reason] || converted.reason}${converted.message ? ` (${converted.message})` : ''}`);
    process.exit(1);
  }

  const tabs = mapToCourseTabs(buildContentStructure(converted.blocks));
  console.log(`Rapor: ${tabs.report}`);
  [...converted.warnings, ...tabs.detection.warnings].forEach((warning) => console.log(`Uyarı: ${warning}`));
  tabs.curriculum.panels.forEach((panel, index) => {
    const items = panel.blocks.filter((b) => b.type === 'list').reduce((sum, b) => sum + b.items.length, 0);
    console.log(`  Panel ${index + 1}: ${panel.title} (${items} madde, ${panel.blocks.length} blok)`);
  });

  if (flag === '--html') {
    const html = renderCourseTabs(tabs);
    Object.entries(html).forEach(([tab, value]) => {
      console.log(`\n===== ${tab} (${value.length} karakter) =====\n${value}`);
    });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
