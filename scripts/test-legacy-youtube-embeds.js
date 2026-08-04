#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cheerio = require('cheerio');
const {
  normalizeYoutubeEmbeds,
  normalizeYoutubeEmbedsForEditor,
  prepareLegacyTabContent,
  youtubeVideo
} = require('../src/services/youtube-embeds');

const legacyHomeCss = fs.readFileSync(path.resolve(
  __dirname,
  '../public/tema10/css/home2.css'
), 'utf8');
assert.match(
  legacyHomeCss,
  /\.producttab \.uv-legacy-youtube-embed\s*\{[^}]*\bdisplay:\s*block\s*;/s
);

const parsed = youtubeVideo('//www.youtube.com/embed/mDgKrvo5cA4?start=12&unsafe=value');
assert.deepEqual(parsed, {
  id: 'mDgKrvo5cA4',
  embedUrl: 'https://www.youtube-nocookie.com/embed/mDgKrvo5cA4?start=12'
});

assert.equal(youtubeVideo('https://example.com/embed/mDgKrvo5cA4'), null);
assert.equal(
  youtubeVideo('https://www.youtube.com/embed/8SrtxJcFt4s').id,
  'kV0emc-Kl58'
);
assert.equal(
  youtubeVideo('https://www.youtube.com/embed/5l6sGjPf7Wo').id,
  'bIqCsYUJXv4'
);

const normalized = normalizeYoutubeEmbeds(
  '<p>Tanıtım</p><iframe width="560" height="314" src="https://www.youtube.com/embed/Pdu7BUdAsk4"></iframe>',
  'http://localhost:8000'
);
assert.match(normalized, /uv-legacy-youtube-embed/);
assert.match(normalized, /https:\/\/www\.youtube-nocookie\.com\/embed\/Pdu7BUdAsk4/);
assert.match(normalized, /loading="lazy"/);
assert.match(normalized, /origin=http%3A%2F%2Flocalhost%3A8000/);
assert.doesNotMatch(normalized, /width="560"|height="314"/);

const editorNormalized = normalizeYoutubeEmbedsForEditor(
  '<iframe width="640" height="360" src="https://www.youtube.com/embed/Pdu7BUdAsk4"></iframe>',
  'http://localhost:8000'
);
assert.match(editorNormalized, /youtube-nocookie\.com\/embed\/Pdu7BUdAsk4/);
assert.match(editorNormalized, /origin=http%3A%2F%2Flocalhost%3A8000/);
assert.match(editorNormalized, /referrerpolicy="strict-origin-when-cross-origin"/);
assert.match(editorNormalized, /width="640"/);
assert.match(editorNormalized, /height="360"/);

const invalidOrigin = normalizeYoutubeEmbeds(
  '<iframe src="https://www.youtube.com/embed/Pdu7BUdAsk4"></iframe>',
  'javascript:alert(1)'
);
assert.doesNotMatch(invalidOrigin, /origin=/);

const aggregate = [
  '<section data-source-tab="tab-info">',
  '<h2>Eğitime İlk Bakış</h2>',
  '<iframe src="https://www.youtube.com/embed/mDgKrvo5cA4"></iframe>',
  '<iframe src="https://www.youtube.com/embed/Pdu7BUdAsk4"></iframe>',
  '</section>'
].join('');

const restored = prepareLegacyTabContent(
  '<p>Mevcut içerik</p><iframe src="https://www.youtube.com/embed/mDgKrvo5cA4"></iframe>',
  aggregate,
  'tab-info'
);
assert.equal((restored.match(/mDgKrvo5cA4/g) || []).length, 1);
assert.equal((restored.match(/Pdu7BUdAsk4/g) || []).length, 1);
assert.match(restored, /uv-legacy-youtube-list/);

const untouched = '<p>Video içermeyen metin</p>';
assert.equal(prepareLegacyTabContent(untouched, '', 'tab-info'), untouched);

const legacyCoursePath = path.resolve(
  __dirname,
  '../urun/python-ozel-online-ders-egitimi-20-saat-1664/index.html'
);
const legacyPage = cheerio.load(fs.readFileSync(legacyCoursePath, 'utf8'), {
  decodeEntities: false
});
const legacyOverview = legacyPage('#tab-info').html() || '';
const normalizedLegacyOverview = normalizeYoutubeEmbeds(legacyOverview);
assert.equal((normalizedLegacyOverview.match(/uv-legacy-youtube-iframe/g) || []).length, 2);
assert.equal((normalizedLegacyOverview.match(/youtube-nocookie\.com\/embed/g) || []).length, 2);

const product391Path = path.resolve(
  __dirname,
  '../urun/yapay-zeka-destekli-unity-ile-oyun-gelistirme-egitimi-yuz-yuze-1680/index.html'
);
const product391Page = cheerio.load(fs.readFileSync(product391Path, 'utf8'), {
  decodeEntities: false
});
const normalizedProduct391Overview = cheerio.load(
  normalizeYoutubeEmbeds(product391Page('#tab-info').html() || ''),
  { decodeEntities: false },
  false
);
assert.deepEqual(
  normalizedProduct391Overview('.uv-legacy-youtube-iframe').map((_, iframe) => (
    youtubeVideo(normalizedProduct391Overview(iframe).attr('src')).id
  )).get(),
  ['k6RE1r92Jdc', 'K39IhT_0lHg', 'Pdu7BUdAsk4', 'mDgKrvo5cA4']
);
assert.equal(normalizedProduct391Overview('.uv-legacy-youtube-embed').length, 4);

const legacyProductDirectory = path.resolve(__dirname, '../urun');
const unavailableVideoIds = new Set(['8SrtxJcFt4s', '5l6sGjPf7Wo']);
let catalogEmbedCount = 0;

fs.readdirSync(legacyProductDirectory, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .forEach((entry) => {
    const productFile = path.join(legacyProductDirectory, entry.name, 'index.html');
    if (!fs.existsSync(productFile)) return;

    const productPage = cheerio.load(fs.readFileSync(productFile, 'utf8'), {
      decodeEntities: false
    });

    productPage('iframe[src]').each((_, iframe) => {
      const src = String(productPage(iframe).attr('src') || '');
      if (!/youtu(?:be\.com|\.be)|youtube(?:-nocookie)?\.com/i.test(src)) return;

      catalogEmbedCount += 1;
      assert.match(src, /^https:\/\//, `${productFile}: YouTube iframe HTTPS kullanmalıdır.`);

      const video = youtubeVideo(src);
      assert.ok(video, `${productFile}: YouTube iframe URL'si geçersiz: ${src}`);
      assert.equal(
        [...unavailableVideoIds].some((videoId) => src.includes(videoId)),
        false,
        `${productFile}: kullanılamayan YouTube videosu bulundu: ${src}`
      );
    });
  });

assert.equal(catalogEmbedCount, 612);

console.log('Legacy YouTube embed tests passed.');
