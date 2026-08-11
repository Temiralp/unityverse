#!/usr/bin/env node

require('dotenv').config();

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const {
  buildLegacyMemberImport,
  buildLegacyOrderAudit,
  normalizeEmail
} = require('../src/services/legacy-member-import');

const DATABASE_BATCH_SIZE = 400;
const DATABASE_TRANSACTION_MAX_WAIT_MS = 10_000;
const DATABASE_TRANSACTION_TIMEOUT_MS = 120_000;

function parseArguments(argv) {
  const options = {
    apply: false,
    expectedExistingRows: null,
    expectedMembersSha256: null,
    expectedPendingRows: null,
    expectedRejectedRows: null,
    expectedSourceRows: null,
    expectedValidRows: null,
    membersPath: null,
    ordersPath: null
  };

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
    } else if (argument === '--expected-members-sha256') {
      options.expectedMembersSha256 = String(argv[index + 1] || '').toLowerCase();
      index += 1;
    } else if (argument === '--expected-existing-rows') {
      options.expectedExistingRows = parseExpectedCount(argv[index + 1], argument);
      index += 1;
    } else if (argument === '--expected-pending-rows') {
      options.expectedPendingRows = parseExpectedCount(argv[index + 1], argument);
      index += 1;
    } else if (argument === '--expected-source-rows') {
      options.expectedSourceRows = parseExpectedCount(argv[index + 1], argument);
      index += 1;
    } else if (argument === '--expected-valid-rows') {
      options.expectedValidRows = parseExpectedCount(argv[index + 1], argument);
      index += 1;
    } else if (argument === '--expected-rejected-rows') {
      options.expectedRejectedRows = parseExpectedCount(argv[index + 1], argument);
      index += 1;
    } else {
      throw new Error(`Bilinməyən parametr: ${argument}`);
    }
  }

  if (!options.membersPath) {
    throw new Error(
      'İstifadə: --members <üzvlər.csv> [--orders <sifarişlər.csv>] '
      + '[--apply --expected-members-sha256 <sha256> --expected-source-rows <say> '
      + '--expected-valid-rows <say> --expected-rejected-rows <say> '
      + '--expected-existing-rows <say> --expected-pending-rows <say>]'
    );
  }

  return options;
}

function parseExpectedCount(value, argument) {
  const count = Number(value);
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new Error(`${argument} üçün sıfır və ya müsbət tam ədəd verilməlidir.`);
  }
  return count;
}

function sha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function assertApplySafety(options, memberImport, membersSha256) {
  if (!options.apply) return;

  const requiredOptions = [
    ['--expected-members-sha256', options.expectedMembersSha256],
    ['--expected-source-rows', options.expectedSourceRows],
    ['--expected-valid-rows', options.expectedValidRows],
    ['--expected-rejected-rows', options.expectedRejectedRows],
    ['--expected-existing-rows', options.expectedExistingRows],
    ['--expected-pending-rows', options.expectedPendingRows]
  ];
  const missingOptions = requiredOptions
    .filter(([, value]) => value === null || value === '')
    .map(([name]) => name);

  if (missingOptions.length) {
    throw new Error(`--apply üçün təhlükəsizlik parametrləri çatışmır: ${missingOptions.join(', ')}`);
  }
  if (!/^[a-f0-9]{64}$/.test(options.expectedMembersSha256)) {
    throw new Error('--expected-members-sha256 etibarlı SHA-256 olmalıdır.');
  }

  const checks = [
    ['CSV SHA-256', membersSha256, options.expectedMembersSha256],
    ['mənbə sətri', memberImport.summary.sourceRows, options.expectedSourceRows],
    ['etibarlı sətir', memberImport.summary.validRows, options.expectedValidRows],
    ['reject edilmiş sətir', memberImport.summary.rejectedRows, options.expectedRejectedRows]
  ];
  const mismatches = checks
    .filter(([, actual, expected]) => actual !== expected)
    .map(([label, actual, expected]) => `${label}: gözlənilən=${expected}, faktiki=${actual}`);

  if (mismatches.length) {
    throw new Error(`Import təhlükəsizlik yoxlaması keçmədi: ${mismatches.join('; ')}`);
  }
}

function assertDatabaseApplySafety(expectedDatabase, actualDatabase) {
  const checks = [
    ['mövcud üzv', actualDatabase.existingRows, expectedDatabase.expectedExistingRows],
    ['əlavə ediləcək üzv', actualDatabase.pendingRows, expectedDatabase.expectedPendingRows]
  ];
  const mismatches = checks
    .filter(([, actual, expected]) => actual !== expected)
    .map(([label, actual, expected]) => `${label}: gözlənilən=${expected}, faktiki=${actual}`);

  if (mismatches.length) {
    throw new Error(`Database import planı dry-run ilə uyğun deyil: ${mismatches.join('; ')}`);
  }
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

async function databaseImportPlan(prisma, members) {
  const existingEmails = await existingMemberEmails(prisma, members.map((member) => member.email));
  const pendingMembers = members.filter((member) => !existingEmails.has(member.email));

  return {
    existingRows: existingEmails.size,
    pendingMembers,
    pendingRows: pendingMembers.length
  };
}

async function executeImport(prisma, members, apply, expectedDatabase = {}) {
  if (!apply) {
    const plan = await databaseImportPlan(prisma, members);
    return {
      existingRows: plan.existingRows,
      pendingRows: plan.pendingRows,
      createdRows: 0
    };
  }

  return prisma.$transaction(async (transaction) => {
    const plan = await databaseImportPlan(transaction, members);
    const databasePlan = {
      existingRows: plan.existingRows,
      pendingRows: plan.pendingRows
    };

    assertDatabaseApplySafety(expectedDatabase, databasePlan);

    let createdRows = 0;
    for (const batch of batches(plan.pendingMembers)) {
      const result = await transaction.member.createMany({
        data: batch,
        skipDuplicates: true
      });
      createdRows += result.count;
    }

    if (createdRows !== plan.pendingRows) {
      throw new Error(
        `Import nəticəsi gözlənilən sayla uyğun deyil: gözlənilən=${plan.pendingRows}, yaradılan=${createdRows}`
      );
    }

    return {
      ...databasePlan,
      createdRows
    };
  }, {
    maxWait: DATABASE_TRANSACTION_MAX_WAIT_MS,
    timeout: DATABASE_TRANSACTION_TIMEOUT_MS
  });
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const membersPath = path.resolve(options.membersPath);
  const membersContent = fs.readFileSync(membersPath);
  const membersSha256 = sha256(membersContent);
  const memberImport = buildLegacyMemberImport(membersContent.toString('utf8'));

  assertApplySafety(options, memberImport, membersSha256);

  const report = {
    mode: options.apply ? 'apply' : 'dry-run',
    members: {
      ...memberImport.summary,
      sha256: membersSha256,
      rejectionCounts: rejectionCounts(memberImport.rejectedRows),
      rejections: memberImport.rejectedRows.map(({ rowNumber, codes }) => ({ rowNumber, codes }))
    }
  };

  if (options.ordersPath) {
    const ordersContent = fs.readFileSync(path.resolve(options.ordersPath));
    report.orders = buildLegacyOrderAudit(
      ordersContent.toString('utf8'),
      memberImport.members.map((member) => member.email)
    );
    report.orders.sha256 = sha256(ordersContent);
  }

  const prisma = require('../src/db');
  try {
    report.database = await executeImport(prisma, memberImport.members, options.apply, options);
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
  assertApplySafety,
  assertDatabaseApplySafety,
  batches,
  executeImport,
  existingMemberEmails,
  parseArguments,
  rejectionCounts,
  sha256
};
