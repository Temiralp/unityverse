#!/usr/bin/env node

// Admin kurs formu: "Word'den içe aktar" (Cember 8b) — route/view/JS/CSS sozlesmesi ve
// buildImportResponse servisinin fixture ile entegrasyonu.

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');

const { buildImportResponse, IMPORT_ERROR_MESSAGES } = require('../src/services/course-import/import-response');

const root = path.resolve(__dirname, '..');
const fixture = fs.readFileSync(path.join(root, 'scripts/fixtures/course-import/sample-curriculum.docx'));

(async () => {
  // 1) Servis: fixture -> basarili yanit
  const ok = await buildImportResponse(fixture);
  assert.equal(ok.status, 200);
  assert.equal(ok.body.success, true);
  assert.match(ok.body.report, /12 modül paneli/);
  assert.ok(Array.isArray(ok.body.warnings));
  assert.deepEqual(Object.keys(ok.body.tabs).sort(), ['curriculum', 'extra', 'overview', 'why']);
  assert.equal((ok.body.tabs.curriculum.match(/class="panel panel-default"/g) || []).length, 12);
  assert.match(ok.body.tabs.overview, /<h2>/);
  assert.equal(ok.body.tabs.curriculum.includes('<script'), false);
  assert.equal(ok.body.detection.tier, 1);

  // 2) Servis: hatali dosya -> 400 + Turkce mesaj; dosya yok -> 400
  const pdf = await buildImportResponse(Buffer.from('%PDF-1.7 x'));
  assert.equal(pdf.status, 400);
  assert.equal(pdf.body.success, false);
  assert.equal(pdf.body.message, IMPORT_ERROR_MESSAGES['invalid-file']);
  assert.match(pdf.body.message, /\.docx/);
  const missing = await buildImportResponse(null);
  assert.equal(missing.status, 400);
  assert.match(missing.body.message, /dosya/i);
  const unavailable = await buildImportResponse(fixture, { loadConverter: () => { throw new Error('x'); } });
  assert.equal(unavailable.status, 503);
  assert.equal(unavailable.body.message, IMPORT_ERROR_MESSAGES['converter-unavailable']);

  // 3) Route sozlesmesi (admin.js)
  const routes = fs.readFileSync(path.join(root, 'src/routes/admin.js'), 'utf8');
  assert.match(routes, /require\('\.\.\/services\/course-import\/import-response'\)/);
  assert.match(routes, /router\.post\('\/products\/import-content', requireAdmin, handleContentImportUpload, requireMultipartCsrf/);
  assert.match(routes, /req\.path === '\/products\/import-content'/, 'multipart CSRF listesine eklenmeli');
  assert.match(routes, /const CONTENT_IMPORT_MAX_SIZE = 5 \* 1024 \* 1024/);
  assert.match(routes, /contentFile/);
  assert.match(routes, /buildImportResponse\(req\.file && req\.file\.buffer\)/);

  // 4) View sozlesmesi
  const view = fs.readFileSync(path.join(root, 'src/views/admin/products/form.ejs'), 'utf8');
  assert.match(view, /<button type="button" class="button button-secondary" data-content-import-open>Word'den içe aktar<\/button>/);
  assert.match(view, /<input type="file" accept="\.docx,application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document" data-content-import-file hidden>/);
  assert.match(view, /<dialog class="content-import-modal" data-content-import-dialog/);
  assert.match(view, /data-content-import-report/);
  assert.match(view, /data-content-import-warnings/);
  // Bolumler EJS dongusuyle uretilir: anahtarlar ve sistem tab hedefleri sablonda tanimli olmali
  ['overview', 'curriculum', 'why', 'extra'].forEach((key) => {
    assert.ok(view.includes(`['${key}', `), key);
  });
  assert.match(view, /data-content-import-section="<%= key %>"/);
  assert.match(view, /data-content-import-preview="<%= key %>"/);
  assert.match(view, /data-content-import-target="<%= systemKey %>"/);
  ['OVERVIEW', 'CURRICULUM', 'WHY'].forEach((systemKey) => {
    assert.ok(view.includes(`'${systemKey}']`), systemKey);
  });
  assert.match(view, /data-content-import-extra-target/);
  assert.match(view, /data-content-import-mode/);
  assert.match(view, /data-content-import-place-all/);
  assert.match(view, /admin-product-editor\.js\?v=2026091[6-9]/);
  assert.match(view, /data-content-import-status/);

  // 5) JS sozlesmesi
  const js = fs.readFileSync(path.join(root, 'public/tema10/js/admin-product-editor.js'), 'utf8');
  assert.match(js, /\/admin\/products\/import-content/);
  assert.match(js, /formData\.append\('_csrf'/);
  assert.match(js, /formData\.append\('contentFile'/);
  assert.match(js, /credentials: 'same-origin'/);
  assert.match(js, /data-system-key="' \+ systemKey \+ '"/);
  assert.match(js, /editor\.value = mode === .append. \? editor\.value \+ html : html/);
  assert.match(js, /mode === 'append'/);
  assert.match(js, /showModal/);
  assert.match(js, /içe aktarma başarısız/);

  // 6) CSS + cache-bust
  const css = fs.readFileSync(path.join(root, 'admin.css'), 'utf8');
  assert.match(css, /\.content-import-modal \{/);
  assert.match(css, /\.content-import-preview \{/);
  const header = fs.readFileSync(path.join(root, 'src/views/admin/partials/header.ejs'), 'utf8');
  assert.match(header, /admin\.css\?v=2026091[6-9]/);

  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts['test:admin-content-import'], 'node scripts/test-admin-content-import.js');

  console.log('admin content import OK');
})().catch((error) => { console.error(error); process.exit(1); });
