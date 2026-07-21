const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

require('dotenv').config();

const migrationPath = path.join(
  __dirname,
  '..',
  'prisma',
  'migrations',
  '20260721100000_sync_course_titles_and_duration',
  'migration.sql'
);

const migrationSql = fs.readFileSync(migrationPath, 'utf8');
const valuePattern = /^    \('((?:''|[^'])*)', '((?:''|[^'])*)'\)[,;]$/gm;
const titleUpdates = Array.from(migrationSql.matchAll(valuePattern), (match) => ({
  slug: match[1].replace(/''/g, "'"),
  title: match[2].replace(/''/g, "'")
}));

async function seedTemporaryProducts(client) {
  await client.query(`
    CREATE TEMPORARY TABLE "Product" (
      "id" SERIAL PRIMARY KEY,
      "slug" TEXT UNIQUE NOT NULL,
      "title" TEXT NOT NULL,
      "status" TEXT NOT NULL,
      "duration" TEXT,
      "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ON COMMIT DROP
  `);

  const values = [];
  const placeholders = titleUpdates.map((update, index) => {
    const offset = index * 4;
    values.push(update.slug, `Legacy title ${index + 1}`, 'PUBLISHED', null);
    return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`;
  });

  await client.query(
    `INSERT INTO "Product" ("slug", "title", "status", "duration") VALUES ${placeholders.join(', ')}`,
    values
  );
}

async function assertAppliedState(client) {
  const result = await client.query(`
    SELECT "slug", "title", "duration"
    FROM "Product"
    ORDER BY "slug"
  `);
  const productsBySlug = new Map(result.rows.map((product) => [product.slug, product]));

  assert.equal(productsBySlug.size, 164);
  for (const update of titleUpdates) {
    assert.equal(productsBySlug.get(update.slug)?.title, update.title, update.slug);
  }
  assert.equal(
    productsBySlug.get('unity-ile-oyun-gelistirme-yuz-yuze-egitimi-1481')?.duration,
    '8 ay'
  );
}

async function run() {
  assert.equal(titleUpdates.length, 164, 'Migration must contain 164 unique title rows.');
  assert.equal(new Set(titleUpdates.map((update) => update.slug)).size, 164);

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    await client.query('BEGIN');
    await seedTemporaryProducts(client);

    await client.query(migrationSql);
    await assertAppliedState(client);

    // Reapplying must be harmless when titles and duration already match.
    await client.query(migrationSql);
    await assertAppliedState(client);

    // A changed target status must stop the migration instead of being skipped.
    const guardedSlug = titleUpdates[0].slug;
    await client.query('SAVEPOINT invalid_target');
    await client.query('UPDATE "Product" SET "status" = $1 WHERE "slug" = $2', [
      'DRAFT',
      guardedSlug
    ]);

    await assert.rejects(
      () => client.query(migrationSql),
      (error) => error.message.includes('missing or non-published targets')
        && error.message.includes(guardedSlug)
    );
    await client.query('ROLLBACK TO SAVEPOINT invalid_target');

    console.log('Course title and duration migration tests passed.');
  } finally {
    await client.query('ROLLBACK').catch(() => {});
    await client.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
