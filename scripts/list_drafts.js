require('dotenv').config();
const prisma = require('../src/db');

async function main() {
  const drafts = await prisma.product.findMany({
    where: { status: 'DRAFT' },
    select: { id: true, title: true, slug: true },
    orderBy: { id: 'asc' }
  });

  console.log(`=== TOTAL DRAFT COURSES IN DB: ${drafts.length} ===\n`);
  drafts.forEach((d, i) => {
    console.log(`${i + 1}. [ID: ${d.id}] ${d.title} (${d.slug})`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
