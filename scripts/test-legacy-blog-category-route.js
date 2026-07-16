#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');
const cheerio = require('cheerio');
const express = require('express');

const { blogCategoryByLegacyId } = require('../src/config/blog-categories');

const rootDir = path.resolve(__dirname, '..');

function successStoryPosts() {
  const posts = [];

  for (const entry of fs.readdirSync(path.join(rootDir, 'blog-detay'), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const html = fs.readFileSync(path.join(rootDir, 'blog-detay', entry.name, 'index.html'), 'utf8');
    const $ = cheerio.load(html);
    const categoryHref = $('ul.breadcrumb li a[href*="/blog/"]').last().attr('href') || '';

    if (!/\/blog\/10\/?/.test(categoryHref)) continue;
    posts.push({
      id: posts.length + 1,
      title: $('h1.modtitle').last().text().replace(/\s+/g, ' ').trim(),
      slug: entry.name,
      excerpt: $('meta[name="description"]').attr('content') || '',
      content: '',
      image: null,
      status: 'PUBLISHED',
      publishedAt: new Date(Date.UTC(2026, 0, 31 - posts.length)),
      createdAt: new Date(Date.UTC(2026, 0, 31 - posts.length))
    });
  }

  return posts.sort((left, right) => right.publishedAt - left.publishedAt);
}

function cardSlugs($) {
  const slugs = new Set();
  $('.products-list.ana_urunler a[href*="/blog-detay/"]').each((index, anchor) => {
    const match = String($(anchor).attr('href') || '').match(/\/blog-detay\/([^/]+)\/?/);
    if (match) slugs.add(decodeURIComponent(match[1]));
  });
  return [...slugs];
}

async function main() {
  const posts = successStoryPosts();
  assert.strictEqual(posts.length, 21);

  const category10 = { id: 110, ...blogCategoryByLegacyId(10), isActive: true };
  const category8 = { id: 108, ...blogCategoryByLegacyId(8), isActive: true };
  const fakePrisma = {
    blogCategory: {
      findFirst: async ({ where }) => {
        if (where.legacyId === 10) return category10;
        if (where.legacyId === 8) return category8;
        return null;
      }
    },
    blogPost: {
      findMany: async ({ where }) => {
        if (where.blogCategoryId === category10.id) return posts;
        if (where.blogCategoryId === category8.id) return [];
        return posts;
      },
      findFirst: async ({ where }) => {
        const post = posts.find((candidate) => candidate.slug === where.slug);
        return post ? { ...post, blogCategory: category10 } : null;
      }
    }
  };
  const dbPath = require.resolve('../src/db');
  require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: fakePrisma };
  const routePath = require.resolve('../src/routes/legacy-catalog');
  delete require.cache[routePath];
  const router = require('../src/routes/legacy-catalog');
  const app = express();
  app.use(router);
  app.use((req, res) => res.status(404).send('Not found'));
  const server = http.createServer(app);

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  async function get(pathname) {
    const response = await fetch(`${baseUrl}${pathname}`);
    const html = await response.text();
    assert.strictEqual(response.status, 200, `${pathname} returned ${response.status}`);
    return { $: cheerio.load(html), html };
  }

  async function getStatus(pathname) {
    const response = await fetch(`${baseUrl}${pathname}`, { redirect: 'manual' });
    return response.status;
  }

  try {
    const firstPage = await get('/blog/10/');
    assert.strictEqual(cardSlugs(firstPage.$).length, 12);
    assert.strictEqual(
      firstPage.$('link[rel="canonical"]').attr('href'),
      'https://unityverseacademy.com/blog/10/'
    );
    assert.strictEqual(
      firstPage.$('.box-pagination a[href="/blog/10/?pg=2&ps=12"]').length,
      2
    );

    const secondPage = await get('/blog/10/?pg=2&ps=12');
    assert.strictEqual(cardSlugs(secondPage.$).length, 9);
    assert.match(secondPage.$('h1.modtitle').first().text(), /BAŞARI HİKAYELERİ/i);
    assert.strictEqual(
      secondPage.$('link[rel="canonical"]').attr('href'),
      'https://unityverseacademy.com/blog/10/'
    );

    const search = await get('/blog/10/?blog_query=Burak');
    assert(cardSlugs(search.$).length > 0);
    assert(cardSlugs(search.$).every((slug) => posts.some((post) => post.slug === slug)));

    const emptyCategory = await get('/blog/8/');
    assert.strictEqual(cardSlugs(emptyCategory.$).length, 0);
    assert(emptyCategory.html.includes('Bu kategoride henüz yayınlanmış yazı bulunmuyor'));
    assert.strictEqual(await getStatus('/blog/7/'), 404);

    const detailPost = posts.find((post) => post.slug === 'mezunumuz-burak-yilmazin-basari-hikayesi-265');
    assert(detailPost);
    const detail = await get(`/blog-detay/${encodeURIComponent(detailPost.slug)}/`);
    assert.strictEqual(detail.$('ul.breadcrumb a[href="/blog/10/"]').text(), category10.name);
    assert.strictEqual(
      detail.$('link[rel="canonical"]').attr('href'),
      `https://unityverseacademy.com/blog-detay/${detailPost.slug}/`
    );

    console.log('Legacy blog category route integration tests passed with fake Prisma.');
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
