#!/usr/bin/env node

const assert = require('assert');
const cheerio = require('cheerio');

const baseUrl = String(process.env.BLOG_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');

async function get(pathname) {
  const response = await fetch(`${baseUrl}${pathname}`, { redirect: 'manual' });
  assert.strictEqual(response.status, 200, `${pathname} returned ${response.status}`);
  const html = await response.text();
  const $ = cheerio.load(html);
  return { $, html };
}

function cardSlugs($) {
  const slugs = new Set();
  $('.products-list.ana_urunler a[href*="/blog-detay/"]').each((index, anchor) => {
    const match = String($(anchor).attr('href') || '').match(/\/blog-detay\/([^/]+)\/?/);
    if (match) slugs.add(decodeURIComponent(match[1]));
  });
  return [...slugs];
}

(async () => {
  const root = await get('/blog/');
  assert(cardSlugs(root.$).length > 0, 'Global blog listing is empty');

  const firstPage = await get('/blog/10/');
  assert.strictEqual(cardSlugs(firstPage.$).length, 12);
  assert.match(firstPage.$('h1.modtitle').first().text(), /BAŞARI HİKAYELERİ/i);
  assert.strictEqual(
    firstPage.$('link[rel="canonical"]').attr('href'),
    'https://unityverseacademy.com/blog/10/'
  );
  assert(firstPage.html.includes('Mezunumuz Burak Yılmaz'));
  assert(!firstPage.html.includes("Elon Musk Twitter'ın Kontrolünü Ele Geçirdi"));

  const secondPage = await get('/blog/10/?pg=2&ps=12');
  assert.strictEqual(cardSlugs(secondPage.$).length, 9);
  assert.match(secondPage.$('h1.modtitle').first().text(), /BAŞARI HİKAYELERİ/i);
  assert.strictEqual(
    secondPage.$('link[rel="canonical"]').attr('href'),
    'https://unityverseacademy.com/blog/10/'
  );
  assert(secondPage.html.includes('Arda Bıçkın'));
  assert(!secondPage.html.includes("Elon Musk Twitter'ın Kontrolünü Ele Geçirdi"));

  const emptyCategory = await get('/blog/8/');
  assert.strictEqual(cardSlugs(emptyCategory.$).length, 0);
  assert(emptyCategory.html.includes('Bu kategoride henüz yayınlanmış yazı bulunmuyor'));

  const search = await get('/blog/10/?blog_query=Burak');
  assert(cardSlugs(search.$).length > 0);
  assert(!search.html.includes("Elon Musk Twitter'ın Kontrolünü Ele Geçirdi"));

  const detail = await get('/blog-detay/mezunumuz-burak-yilmazin-basari-hikayesi-265/');
  assert(detail.$('ul.breadcrumb a[href="/blog/10/"]').length > 0);

  console.log(`Blog category browser smoke tests passed against ${baseUrl}.`);
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
