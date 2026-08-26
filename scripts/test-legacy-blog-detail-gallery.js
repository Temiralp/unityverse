#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');
const cheerio = require('cheerio');
const express = require('express');

const lootjamSlug = 'dijital-oyun-tasarimi-bolumu-bilgiyi-ticarilestirme-merkezi-is-birligiyle-lootjam-gerceklestirdi-314';
const posts = [
  {
    id: 1,
    slug: lootjamSlug,
    title: 'Açık Galeri Testi',
    excerpt: 'Galeri testi',
    image: '/uploads/blog/hero.jpg',
    content: `<p>Giriş metni</p>
      <div class="lj-gallery">
        <h2>Etkinlikten Kareler</h2>
        <div class="lj-track">
          <div class="lj-slide"><img src="/uploads/blog/one.jpg" alt="Bir"></div>
          <div class="lj-slide"><img src="/uploads/blog/two.jpg" alt="İki"></div>
          <div class="lj-slide"><img src="/uploads/blog/three.jpg" alt="Üç"></div>
        </div>
      </div>
      <p>Sonuç metni</p>
      <img src="/uploads/blog/standalone.jpg">`,
    status: 'PUBLISHED',
    publishedAt: new Date('2026-07-16T00:00:00.000Z'),
    createdAt: new Date('2026-07-16T00:00:00.000Z'),
    blogCategory: null
  },
  {
    id: 2,
    slug: 'automatic-gallery',
    title: 'Otomatik Galeri Testi',
    excerpt: '',
    image: '/uploads/blog/hero-two.jpg',
    content: `<p>Metin korunur</p>
      <div><img src="/uploads/blog/a.jpg"></div>
      <div><img src="/uploads/blog/b.jpg"></div>
      <p>Galeri sonrası</p>`,
    status: 'PUBLISHED',
    publishedAt: new Date('2026-07-15T00:00:00.000Z'),
    createdAt: new Date('2026-07-15T00:00:00.000Z'),
    blogCategory: null
  },
  {
    id: 3,
    slug: 'single-image',
    title: 'Tek Görsel Testi',
    excerpt: '',
    image: '/uploads/blog/hero-three.jpg',
    content: '<p>Metin</p><img src="/uploads/blog/single.jpg">',
    status: 'PUBLISHED',
    publishedAt: new Date('2026-07-14T00:00:00.000Z'),
    createdAt: new Date('2026-07-14T00:00:00.000Z'),
    blogCategory: null
  }
];

async function main() {
  const fakePrisma = {
    blogPost: {
      findFirst: async ({ where }) => posts.find((post) => (
        post.slug === where.slug && post.status === where.status
      )) || null
    }
  };
  const dbPath = require.resolve('../src/db');
  require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: fakePrisma };
  const routePath = require.resolve('../src/routes/legacy-catalog');
  delete require.cache[routePath];

  const app = express();
  app.use(require('../src/middleware/legacy-redirects')());
  app.use(require('../src/routes/legacy-catalog'));
  const server = http.createServer(app);

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  async function get(slug) {
    const response = await fetch(`${baseUrl}/blog-detay/${slug}/`);
    const html = await response.text();
    assert.strictEqual(response.status, 200);
    return { $: cheerio.load(html), html };
  }

  try {
    const explicit = await get(lootjamSlug);
    assert.strictEqual(explicit.$('.uv-blog-detail-hero__image[width="1600"][height="720"]').length, 1);
    assert.strictEqual(
      explicit.$('link[rel="canonical"]').attr('href'),
      `https://unityverseacademy.com/blog-detay/${lootjamSlug}/`
    );
    assert.strictEqual(explicit.$('.uv-blog-gallery').length, 1);
    assert.strictEqual(explicit.$('.uv-blog-gallery .swiper-slide').length, 3);
    assert.strictEqual(explicit.$('.uv-blog-gallery__title').text().trim(), 'Etkinlikten Kareler');
    assert.strictEqual(explicit.$('.lj-gallery, .lj-slider, .lj-track, .lj-slide').length, 0);
    assert.strictEqual(explicit.$('.uv-blog-content-image[src="/uploads/blog/standalone.jpg"]').length, 1);
    assert.match(explicit.$('.blog-icerik').text(), /Giriş metni/);
    assert.match(explicit.$('.blog-icerik').text(), /Sonuç metni/);
    assert.strictEqual(
      explicit.$('link[href="/public/tema10/css/blog-detail-gallery.css?v=1.0.1"]').length,
      1
    );
    assert.strictEqual(explicit.$('script[src*="blog-detail-gallery.js"]').length, 1);

    const automatic = await get('automatic-gallery');
    assert.strictEqual(automatic.$('.uv-blog-gallery').length, 1);
    assert.strictEqual(automatic.$('.uv-blog-gallery .swiper-slide').length, 2);
    assert.match(automatic.$('.blog-icerik').text(), /Metin korunur/);
    assert.match(automatic.$('.blog-icerik').text(), /Galeri sonrası/);

    const single = await get('single-image');
    assert.strictEqual(single.$('.uv-blog-gallery').length, 0);
    assert.strictEqual(single.$('.uv-blog-content-image[src="/uploads/blog/single.jpg"]').length, 1);
    assert.strictEqual(single.$('.uv-blog-content-image').attr('loading'), 'lazy');

    const missing = await fetch(`${baseUrl}/blog-detay/missing-post/`, { redirect: 'manual' });
    assert.strictEqual(missing.status, 404);
    assert.strictEqual(missing.headers.get('location'), null);

    const galleryCss = fs.readFileSync(
      path.join(__dirname, '../public/tema10/css/blog-detail-gallery.css'),
      'utf8'
    );
    assert.match(
      galleryCss,
      /\.uv-blog-detail-hero__image\s*\{[^}]*object-fit:\s*contain;/s
    );

    console.log('Legacy blog detail hero and gallery tests passed.');
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    delete require.cache[routePath];
    delete require.cache[dbPath];
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
