#!/usr/bin/env node

// B5: Jodit kaynak <-> gorsel gecisinde YouTube iframe'i kaybolmamali (Jodit 4 varsayilan
// cleanHTML.denyTags = "script,iframe,object,embed"). Kurs editorunde iframe'e izin verilir;
// sunucu sanitize'i yalnizca YouTube host'larini kabul eder ve editorun ekledigi sandbox
// ozniteligini kaydederken atar.

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');

const { sanitizeProductTabContent } = require('../src/services/product-content');

const root = path.resolve(__dirname, '..');
const js = fs.readFileSync(path.join(root, 'public/tema10/js/admin-product-editor.js'), 'utf8');

// 1) Editor konfigurasyonu: iframe deny listesinde degil, script/object/embed hala yasak
assert.match(js, /cleanHTML: \{\s*denyTags: 'script,object,embed'\s*\}/);
assert.doesNotMatch(js, /denyTags: '[^']*iframe/);

// 2) Cache-bust
const view = fs.readFileSync(path.join(root, 'src/views/admin/products/form.ejs'), 'utf8');
assert.match(view, /admin-product-editor\.js\?v=20260917/);

// 3) Sunucu tarafi guvenlik korunuyor: YouTube iframe kalir, sandbox/script atilir, baska host silinir
const saved = sanitizeProductTabContent('<p>a</p><iframe src="https://www.youtube.com/embed/abc123" width="560" height="315" allowfullscreen="" sandbox="" title="V"></iframe><script>alert(1)</script>');
assert.match(saved, /<iframe[^>]*src="https:\/\/www\.youtube(-nocookie)?\.com\/embed\/abc123"/);
assert.equal(saved.includes('sandbox'), false, 'editor sandbox ozniteligi kayitta atilmali');
assert.equal(saved.includes('<script'), false);
const foreign = sanitizeProductTabContent('<iframe src="https://evil.example/x"></iframe>');
assert.equal(/src="https:\/\/evil/.test(foreign), false, 'yabanci host iframe src tasimamali');

console.log('admin editor iframe OK');
