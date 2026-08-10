#!/usr/bin/env node

require('dotenv').config();

const fs = require('fs');
const path = require('path');

const {
  buildLegacyMemberImport,
  buildLegacyOrderAudit,
  normalizeEmail
} = require('../src/services/legacy-member-import');

const DATABASE_BATCH_SIZE = 400;

function parseArguments(argv) {
  const options = { apply: false, membersPath: null, ordersPath: null };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--apply') {
      options.apply = true;
    } else if (argument === '--members') {
      options.membersPath = argv[index + 1] || null;
      index += 1;
    } else if (argument === '--orders') {
      options.ordersPath = argv[index + 1] || null;
      index += 1;
    } else {
      throw new Error(`Bilinməyən parametr: ${argument}`);
    }
  }

  if (!options.membersPath) {
    throw new Error('İstifadə: --members <üzvlər.csv> [--orders <sifarişlər.csv>] [--apply]');
  }

  return options;
}

function batches(items, size = DATABASE_BATCH_SIZE) {
  const result = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

function rejectionCounts(rejectedRows) {
  const counts = {};
  rejectedRows.forEach((row) => {
    row.codes.forEach((code) => {
      counts[code] = (counts[code] || 0) + 1;
    });
  });
  return counts;
}

async function existingMemberEmails(prisma, emails) {
  const existing = new Set();

  for (const batch of batches(emails)) {
    const members = await prisma.member.findMany({
      where: { email: { in: batch, mode: 'insensitive' } },
      select: { email: true }
    });
    members.forEach((member) => existing.add(normalizeEmail(member.email)));
  }

  return existing;
}

async function executeImport(prisma, members, apply) {
  const existingEmails = await existingMemberEmails(prisma, members.map((member) => member.email));
  const pendingMembers = members.filter((member) => !existingEmails.has(member.email));
  let createdRows = 0;

  if (apply && pendingMembers.length) {
    const operations = batches(pendingMembers).map((batch) => prisma.member.createMany({
      data: batch,
      skipDuplicates: true
    }));
    const results = await prisma.$transaction(operations);
    createdRows = results.reduce((total, result) => total + result.count, 0);
  }

  return {
    existingRows: existingEmails.size,
    pendingRows: pendingMembers.length,
    createdRows
  };
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const membersPath = path.resolve(options.membersPath);
  const memberImport = buildLegacyMemberImport(fs.readFileSync(membersPath, 'utf8'));
  const report = {
    mode: options.apply ? 'apply' : 'dry-run',
    members: {
      ...memberImport.summary,
      rejectionCounts: rejectionCounts(memberImport.rejectedRows)
    }
  };

  if (options.ordersPath) {
    report.orders = buildLegacyOrderAudit(
      fs.readFileSync(path.resolve(options.ordersPath), 'utf8'),
      memberImport.members.map((member) => member.email)
    );
  }

  const prisma = require('../src/db');
  try {
    report.database = await executeImport(prisma, memberImport.members, options.apply);
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  batches,
  executeImport,
  existingMemberEmails,
  parseArguments,
  rejectionCounts
};
