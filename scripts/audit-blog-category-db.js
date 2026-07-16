#!/usr/bin/env node

const prisma = require('../src/db');

async function main() {
  const [totalPosts, publishedPosts, publishedWithoutCategory, categories, unmatchedPosts] = await Promise.all([
    prisma.blogPost.count(),
    prisma.blogPost.count({ where: { status: 'PUBLISHED' } }),
    prisma.blogPost.count({
      where: { status: 'PUBLISHED', blogCategoryId: null }
    }),
    prisma.blogCategory.findMany({
      orderBy: [{ legacyId: 'asc' }],
      include: {
        _count: {
          select: { posts: { where: { status: 'PUBLISHED' } } }
        }
      }
    }),
    prisma.blogPost.findMany({
      where: { status: 'PUBLISHED', blogCategoryId: null },
      select: { id: true, slug: true, title: true },
      orderBy: [{ id: 'asc' }]
    })
  ]);

  const result = {
    totalPosts,
    publishedPosts,
    publishedWithoutCategory,
    categories: categories.map((category) => ({
      legacyId: category.legacyId,
      name: category.name,
      isActive: category.isActive,
      publishedPosts: category._count.posts
    })),
    unmatchedPosts
  };

  console.log(JSON.stringify(result, null, 2));

  const legacyIds = categories.map((category) => category.legacyId);
  const expectedLegacyIds = Array.from({ length: 12 }, (_, index) => index + 1);
  const taxonomyIsComplete = JSON.stringify(legacyIds) === JSON.stringify(expectedLegacyIds);

  if (!taxonomyIsComplete || publishedWithoutCategory > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
