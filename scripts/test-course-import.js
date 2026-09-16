#!/usr/bin/env node

// Word (.docx) -> kurs tab icerigi cevirici nuvesi (Cember 8a).
// Fixture: scripts/fixtures/course-import/sample-curriculum.docx (anonimlestirilmis;
// yapi: Heading1 x9, Heading2 x12, ListBullet x117, tablo x2 — gercek dosyayla ayni).

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');

const { docxToBlocks, DOCX_MAX_BYTES } = require('../src/services/course-import/docx-to-blocks');
const {
  buildContentStructure,
  mapToCourseTabs
} = require('../src/services/course-import/content-structure');
const {
  renderCurriculumAccordion,
  renderSectionsHtml
} = require('../src/services/course-import/course-tab-renderer');
const { normalizeCurriculumAccordionContent } = require('../src/services/product-content');

const root = path.resolve(__dirname, '..');
const fixturePath = path.join(root, 'scripts/fixtures/course-import/sample-curriculum.docx');
const fixture = fs.readFileSync(fixturePath);

function count(list, type) {
  return list.filter((block) => block.type === type).length;
}

(async () => {
  // 1) Girdi dogrulama: imza ve boyut (donusturucu cagrilmadan reddedilir)
  const notDocx = await docxToBlocks(Buffer.from('%PDF-1.7 fake'));
  assert.deepEqual(notDocx, { ok: false, reason: 'invalid-file' });
  const tooLarge = await docxToBlocks(Buffer.concat([Buffer.from('PK'), Buffer.alloc(DOCX_MAX_BYTES)]));
  assert.deepEqual(tooLarge, { ok: false, reason: 'too-large' });
  assert.equal(DOCX_MAX_BYTES, 5 * 1024 * 1024);

  // 2) Donusturucu yuklenemezse sunucu cokmez, net sebep doner (lazy require)
  const unavailable = await docxToBlocks(fixture, {
    loadConverter: () => { throw new Error('Cannot find module mammoth'); }
  });
  assert.deepEqual(unavailable, { ok: false, reason: 'converter-unavailable' });

  // 3) Fixture -> duz blok listesi
  const converted = await docxToBlocks(fixture);
  assert.equal(converted.ok, true);
  const { blocks } = converted;
  assert.equal(count(blocks, 'heading'), 21);
  assert.equal(blocks.filter((b) => b.type === 'heading' && b.level === 1).length, 9);
  assert.equal(blocks.filter((b) => b.type === 'heading' && b.level === 2).length, 12);
  assert.equal(count(blocks, 'table'), 2);
  const listItems = blocks.filter((b) => b.type === 'list').reduce((sum, b) => sum + b.items.length, 0);
  assert.equal(listItems, 117);
  assert.ok(count(blocks, 'paragraph') > 10);
  assert.equal(blocks.some((b) => b.type === 'image'), false, 'v1: gorseller atlanir');
  assert.equal(converted.warnings.length, 0);

  // 4) Yapi agaci: Pille 1 (stil tabanli)
  const structure = buildContentStructure(blocks);
  assert.equal(structure.detection.tier, 1);
  assert.equal(structure.detection.unclassified, 0);
  assert.equal(structure.sections.length, 9);
  const curriculumSection = structure.sections.find((s) => /Müfredat/i.test(s.title));
  assert.ok(curriculumSection);
  assert.equal(curriculumSection.children.length, 12);
  assert.equal(curriculumSection.children[0].blocks[0].type, 'list');
  assert.equal(curriculumSection.children[0].blocks[0].items.length, 5);

  // 5) Tab haritasi
  const tabs = mapToCourseTabs(structure);
  assert.equal(tabs.curriculum.panels.length, 12);
  assert.equal(tabs.curriculum.panels[0].blocks[0].items.length, 5);
  assert.equal(tabs.curriculum.source, 'section-keyword');
  assert.equal(tabs.overview.sections.length, 3, 'mufredattan onceki bolumler');
  assert.ok(tabs.overview.sections.some((s) => s.blocks.some((b) => b.type === 'table')));
  assert.equal(tabs.why.sections.length, 1, 'kazanim bolumu');
  assert.ok(tabs.report.includes('12'));

  // 6) Renderer: iskelet + mevcut normalizer ID/ARIA uretir, sanitize gecer
  const accordion = renderCurriculumAccordion(tabs.curriculum.panels);
  assert.equal((accordion.match(/class="panel panel-default"/g) || []).length, 12);
  assert.match(accordion, /<div class="panel-group">/);
  // sanitize data-toggle'i siler; kayit sirasinda normalizer data-toggle + ID + ARIA'yi uretir
  assert.match(accordion, /<h4 class="panel-title"><a href="#"><strong>[^<]+<\/strong><\/a><\/h4>/);
  assert.equal(accordion.includes('uv-curriculum-accordion'), false, 'ID normalizer tarafindan uretilir');
  const normalized = normalizeCurriculumAccordionContent(accordion);
  assert.equal((normalized.match(/id="uv-curriculum-accordion-1-panel-\d+"/g) || []).length, 12);
  assert.equal((normalized.match(/data-toggle="collapse"/g) || []).length, 12);
  assert.match(normalized, /aria-controls="uv-curriculum-accordion-1-panel-12"/);
  assert.match(normalized, /<ul>\s*<li>/);

  const overview = renderSectionsHtml(tabs.overview.sections);
  assert.equal((overview.match(/<h2>/g) || []).length, 3);
  assert.match(overview, /<table>/);
  assert.equal(overview.includes('<script'), false);

  // 7) Pille 2: stil yok, metin naxisi + kalin satirlar
  const plain = [
    { type: 'paragraph', html: 'Kurs Tanıtımı', bold: true },
    { type: 'paragraph', html: 'Bu kurs örnek bir açıklamadır.', bold: false },
    { type: 'paragraph', html: 'Modül 1 Temeller', bold: false },
    { type: 'paragraph', html: '• Birinci madde', bold: false },
    { type: 'paragraph', html: '- İkinci madde', bold: false },
    { type: 'paragraph', html: 'Modül 2 İleri Konular', bold: false },
    { type: 'paragraph', html: '1) Üçüncü madde', bold: false },
    { type: 'paragraph', html: '3. Hafta Uygulama', bold: false },
    { type: 'paragraph', html: 'Açıklama satırı', bold: false }
  ];
  const tier2 = buildContentStructure(plain);
  assert.equal(tier2.detection.tier, 2);
  const tier2Tabs = mapToCourseTabs(tier2);
  assert.equal(tier2Tabs.curriculum.source, 'pattern-headings');
  assert.equal(tier2Tabs.curriculum.panels.length, 3);
  assert.deepEqual(tier2Tabs.curriculum.panels[0].blocks[0].items, ['Birinci madde', 'İkinci madde']);
  assert.equal(tier2Tabs.curriculum.panels[2].title, '3. Hafta Uygulama');
  assert.ok(tier2.detection.warnings.length >= 1);

  // 8) Bos/tanimsiz girdi: hata degil, bos harita + uyari
  const empty = mapToCourseTabs(buildContentStructure([]));
  assert.equal(empty.curriculum.panels.length, 0);
  assert.equal(empty.curriculum.source, 'none');

  // 9) Sozlesme: bagimlilik exact, preview scripti ve sablon mevcut
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.dependencies.mammoth, '1.12.3');
  assert.equal(pkg.scripts['test:course-import'], 'node scripts/test-course-import.js');
  assert.ok(fs.existsSync(path.join(root, 'scripts/course-import-preview.js')));
  assert.ok(fs.existsSync(path.join(root, 'docs/kurs-icerik-sablonu/Kurs_Icerik_Sablonu.docx')));
  assert.ok(fs.existsSync(path.join(root, 'docs/kurs-icerik-sablonu/REHBER.md')));
  assert.equal(fs.readFileSync(path.join(root, 'docs/kurs-icerik-sablonu/Kurs_Icerik_Sablonu.docx')).slice(0, 2).toString(), 'PK');
  const readme = fs.readFileSync(path.join(root, 'scripts/fixtures/course-import/README.md'), 'utf8');
  assert.match(readme, /Heading1/);

  console.log('course import OK');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
