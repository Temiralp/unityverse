#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const { PrismaClient } = require('@prisma/client');

const ROOT_DIR = path.resolve(__dirname, '..');
const BLOG_DIR = path.join(ROOT_DIR, 'blog-detay');

function normalizeWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function slugFromFile(filePath) {
  const relative = path.relative(BLOG_DIR, filePath);
  const parts = relative.split(path.sep).filter(Boolean);

  return parts[0];
}

function parsePublishedAt(value) {
  const raw = normalizeWhitespace(value);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2}):(\d{2}))?$/);

  if (!match) {
    return null;
  }

  const [, year, month, day, hour = '00', minute = '00', second = '00'] = match;
  const date = new Date(Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  ));

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function parseImageVersionDate(value) {
  const match = String(value || '').match(/[?&]v=(\d{9,10})(?:&|$)/);
  if (!match) return null;

  const date = new Date(Number(match[1]) * 1000);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function cleanContentHtml(html) {
  const $ = cheerio.load(`<article id="blog-content-root">${html || ''}</article>`, {
    decodeEntities: false,
  });
  const root = $('#blog-content-root');

  root.find('script, style, link, meta, noscript, iframe, form').remove();
  root.find('*').each((_, element) => {
    const attribs = element.attribs || {};

    Object.keys(attribs).forEach((name) => {
      const lowerName = name.toLowerCase();

      if (lowerName === 'style' || lowerName.startsWith('on')) {
        $(element).removeAttr(name);
      }
    });
  });

  root.find('a[href^="javascript:"]').removeAttr('href');
  root.find('img').each((_, image) => {
    if (!$(image).attr('loading')) {
      $(image).attr('loading', 'lazy');
    }
  });

  return root.html().trim();
}

function parseBlogFile(filePath) {
  const absolutePath = path.resolve(filePath);
  const html = fs.readFileSync(absolutePath, 'utf8');
  const $ = cheerio.load(html, { decodeEntities: false });
  const title = normalizeWhitespace($('.article-info h1.modtitle').first().text())
    || normalizeWhitespace($('meta[name="title"]').attr('content'));
  const excerpt = normalizeWhitespace($('meta[name="description"]').attr('content')) || null;
  const image = $('.category-derc .banners img[src]').first().attr('src') || null;
  const rawPublishedAt = normalizeWhitespace($('.article-sub-title .article-date').first().text());
  const categoryLink = $('ul.breadcrumb li a[href*="/blog/"]').last();
  const category = normalizeWhitespace(categoryLink.text()) || null;
  const categoryHref = categoryLink.attr('href') || '';
  const categoryIdMatch = categoryHref.match(/\/blog\/(\d+)\/?/);
  const legacyCategoryId = categoryIdMatch ? Number.parseInt(categoryIdMatch[1], 10) : null;
  const contentSource = $('.blog-icerik > .col-md-12').first();
  const content = cleanContentHtml(contentSource.html() || '');

  if (!title) {
    throw new Error('Blog title could not be parsed.');
  }

  if (!content || !normalizeWhitespace(cheerio.load(content).text())) {
    throw new Error('Blog content could not be parsed.');
  }

  return {
    sourceFile: path.relative(ROOT_DIR, absolutePath),
    title,
    slug: slugFromFile(absolutePath),
    excerpt,
    content,
    image,
    status: 'PUBLISHED',
    publishedAt: parsePublishedAt(rawPublishedAt) || parseImageVersionDate(image),
    meta: {
      rawPublishedAt: rawPublishedAt || null,
      category,
      legacyCategoryId,
    },
  };
}

function findBlogFiles() {
  const results = [];

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name === 'index.html') {
        results.push(fullPath);
      }
    }
  }

  walk(BLOG_DIR);

  return results.sort((a, b) => a.localeCompare(b));
}

function parseArgs(argv) {
  const args = {
    dryRun: false,
    file: null,
    limit: null,
    jsonOut: null,
    help: false,
    all: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--dry-run') {
      args.dryRun = true;
    } else if (arg === '--file') {
      args.file = argv[++i];
    } else if (arg === '--limit') {
      args.limit = Number(argv[++i]);
    } else if (arg === '--json-out') {
      args.jsonOut = argv[++i];
    } else if (arg === '--all') {
      args.all = true;
    } else if (arg === '--help') {
      args.help = true;
    }
  }

  return args;
}

function previewBlog(post) {
  return {
    sourceFile: post.sourceFile,
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    image: post.image,
    status: post.status,
    publishedAt: post.publishedAt,
    category: post.meta.category,
    contentLength: post.content.length,
    contentExcerpt: normalizeWhitespace(post.content).slice(0, 500),
  };
}

function summarize(posts, errors) {
  const withoutDate = posts.filter((post) => !post.publishedAt);

  return {
    totalParsed: posts.length,
    published: posts.filter((post) => post.status === 'PUBLISHED').length,
    withoutDate: withoutDate.length,
    errors: errors.length,
    samplePosts: posts.slice(0, 3).map(previewBlog),
    errorSamples: errors.slice(0, 5),
  };
}

function printHelp() {
  console.log(`
Usage:
  node scripts/migrate-blog.js --dry-run
  node scripts/migrate-blog.js --file blog-detay/example/index.html --dry-run
  node scripts/migrate-blog.js --limit 5 --dry-run
  node scripts/migrate-blog.js --dry-run --json-out scripts/blog-dry-run.json
  node scripts/migrate-blog.js --limit 5
  node scripts/migrate-blog.js --all

Notes:
  --dry-run parses static blog HTML only.
  Write mode uses Prisma upsert by slug and never deletes existing records.
`);
}

async function writePosts(posts) {
  const prisma = new PrismaClient();
  const result = {
    created: 0,
    updated: 0,
    failed: 0,
    failures: [],
  };

  try {
    for (const post of posts) {
      try {
        const existing = await prisma.blogPost.findUnique({
          where: { slug: post.slug },
          select: { id: true },
        });
        const data = {
          title: post.title,
          excerpt: post.excerpt,
          content: post.content,
          image: post.image,
          status: post.status,
          publishedAt: post.publishedAt ? new Date(post.publishedAt) : null,
          ...(post.meta.legacyCategoryId
            ? { blogCategory: { connect: { legacyId: post.meta.legacyCategoryId } } }
            : {}),
        };

        await prisma.blogPost.upsert({
          where: { slug: post.slug },
          create: {
            slug: post.slug,
            ...data,
          },
          update: data,
        });

        if (existing) {
          result.updated += 1;
        } else {
          result.created += 1;
        }
      } catch (error) {
        result.failed += 1;
        result.failures.push({
          sourceFile: post.sourceFile,
          slug: post.slug,
          message: error.message,
        });
      }
    }
  } finally {
    await prisma.$disconnect();
  }

  return result;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  if (!args.dryRun && !args.file && !args.limit && !args.all) {
    throw new Error('Safety guard: write mode requires --file, --limit, or explicit --all.');
  }

  const files = args.file
    ? [path.resolve(ROOT_DIR, args.file)]
    : findBlogFiles().slice(0, args.limit || (args.all ? undefined : 3));
  const posts = [];
  const errors = [];

  for (const file of files) {
    try {
      posts.push(parseBlogFile(file));
    } catch (error) {
      errors.push({
        sourceFile: path.relative(ROOT_DIR, file),
        message: error.message,
      });
    }
  }

  const output = {
    generatedAt: new Date().toISOString(),
    dryRun: args.dryRun,
    summary: summarize(posts, errors),
  };

  if (!args.dryRun) {
    output.write = await writePosts(posts);
  }

  if (args.jsonOut) {
    fs.writeFileSync(path.resolve(ROOT_DIR, args.jsonOut), `${JSON.stringify({
      ...output,
      posts,
      errors,
    }, null, 2)}\n`);
  }

  console.log(JSON.stringify(output, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = {
  parseBlogFile,
  cleanContentHtml,
};
