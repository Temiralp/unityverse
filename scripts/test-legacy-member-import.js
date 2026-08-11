#!/usr/bin/env node

const assert = require('assert/strict');

const {
  buildLegacyMemberImport,
  buildLegacyOrderAudit,
  parseSemicolonCsv,
  splitLegacyFullName
} = require('../src/services/legacy-member-import');
const {
  assertApplySafety,
  assertDatabaseApplySafety,
  executeImport,
  parseArguments,
  rejectionCounts,
  sha256
} = require('./import-legacy-members');

const memberHeaders = [
  'Adı Soyadı', 'Mail Adresi', 'Doğum Tarihi', 'Cinsiyet', 'Cep Telefonu',
  'TC Kimlik Numarası', 'Mail Listesi', 'Sms Listesi', 'Şehir', 'İlçe', 'Adres', 'Durumu'
].join(';');
const memberCsv = [
  'Üyeler',
  '',
  memberHeaders,
  'Tam Ad;FIRST@example.com;;;0500 000 00 00;;Evet;Hayır;;;;Aktif',
  '"İki\nSatır";second@example.com;;;;;Hayır;Evet;;;;Pasif',
  'Tekrar;FIRST@example.com;;;;;Evet;Evet;;;;Aktif',
  ';missing@example.com;;;;;Evet;Hayır;;;;Aktif'
].join('\r\n');

const parsedRows = parseSemicolonCsv('"noktalı;değer";"iki""tırnak"\r\n');
assert.deepStrictEqual(parsedRows, [['noktalı;değer', 'iki"tırnak']]);

const memberImport = buildLegacyMemberImport(memberCsv);
assert.deepStrictEqual(memberImport.summary, {
  sourceRows: 4,
  validRows: 2,
  rejectedRows: 2
});
assert.equal(memberImport.members[0].email, 'first@example.com');
assert.equal(memberImport.members[0].name, 'Tam');
assert.equal(memberImport.members[0].surname, 'Ad');
assert.equal(memberImport.members[0].mailList, true);
assert.equal(memberImport.members[0].smsList, false);
assert.equal(memberImport.members[0].status, 'ACTIVE');
assert.equal(memberImport.members[0].passwordHash, null);
assert.equal(memberImport.members[1].name, 'İki');
assert.equal(memberImport.members[1].surname, 'Satır');
assert.equal(memberImport.members[1].status, 'PASSIVE');
assert.deepStrictEqual(rejectionCounts(memberImport.rejectedRows), {
  duplicate_email: 1,
  missing_name: 1
});
assert.deepStrictEqual(splitLegacyFullName('Mehmet Ali Demir'), {
  name: 'Mehmet Ali',
  surname: 'Demir'
});
assert.deepStrictEqual(splitLegacyFullName('Madonna'), {
  name: 'Madonna',
  surname: null
});
assert.deepStrictEqual(splitLegacyFullName('  '), {
  name: '',
  surname: null
});

const orderCsv = [
  'Siparişler',
  '',
  'S.K.;Üye Adı;Üye Cep Telefonu;Üye Mail Adresi',
  '1;Bir;;first@example.com',
  '2;İki;;order-only@example.com',
  '3;İki Tekrar;;order-only@example.com',
  '4;Eksik;;'
].join('\n');
const orderAudit = buildLegacyOrderAudit(
  orderCsv,
  memberImport.members.map((member) => member.email)
);
assert.deepStrictEqual(orderAudit, {
  sourceRows: 4,
  uniqueValidEmails: 2,
  matchingMemberEmails: 1,
  unmatchedMemberEmails: 1,
  missingEmails: 1,
  invalidEmails: 0
});

assert.deepStrictEqual(parseArguments(['--members', 'members.csv']), {
  apply: false,
  expectedExistingRows: null,
  expectedMembersSha256: null,
  expectedPendingRows: null,
  expectedRejectedRows: null,
  expectedSourceRows: null,
  expectedValidRows: null,
  membersPath: 'members.csv',
  ordersPath: null
});
assert.deepStrictEqual(parseArguments([
  '--members', 'members.csv',
  '--orders', 'orders.csv',
  '--expected-members-sha256', 'A'.repeat(64),
  '--expected-source-rows', '4',
  '--expected-valid-rows', '2',
  '--expected-rejected-rows', '2',
  '--expected-existing-rows', '1',
  '--expected-pending-rows', '1',
  '--apply'
]), {
  apply: true,
  expectedExistingRows: 1,
  expectedMembersSha256: 'a'.repeat(64),
  expectedPendingRows: 1,
  expectedRejectedRows: 2,
  expectedSourceRows: 4,
  expectedValidRows: 2,
  membersPath: 'members.csv',
  ordersPath: 'orders.csv'
});
assert.throws(() => parseArguments([]), /--members/);
assert.throws(
  () => parseArguments(['--members', 'members.csv', '--expected-valid-rows', '-1']),
  /müsbət tam ədəd/
);

const memberCsvSha256 = sha256(Buffer.from(memberCsv));
const safeApplyOptions = parseArguments([
  '--members', 'members.csv',
  '--expected-members-sha256', memberCsvSha256,
  '--expected-source-rows', '4',
  '--expected-valid-rows', '2',
  '--expected-rejected-rows', '2',
  '--expected-existing-rows', '1',
  '--expected-pending-rows', '1',
  '--apply'
]);

assert.doesNotThrow(() => assertApplySafety(safeApplyOptions, memberImport, memberCsvSha256));
assert.throws(
  () => assertApplySafety({ ...safeApplyOptions, expectedValidRows: 3 }, memberImport, memberCsvSha256),
  /etibarlı sətir/
);
assert.throws(
  () => assertApplySafety({ ...safeApplyOptions, expectedMembersSha256: '0'.repeat(64) }, memberImport, memberCsvSha256),
  /CSV SHA-256/
);
assert.throws(
  () => assertApplySafety(parseArguments(['--members', 'members.csv', '--apply']), memberImport, memberCsvSha256),
  /təhlükəsizlik parametrləri çatışmır/
);
assert.doesNotThrow(() => assertDatabaseApplySafety(
  { expectedExistingRows: 1, expectedPendingRows: 1 },
  { existingRows: 1, pendingRows: 1 }
));
assert.throws(
  () => assertDatabaseApplySafety(
    { expectedExistingRows: 1, expectedPendingRows: 1 },
    { existingRows: 2, pendingRows: 0 }
  ),
  /Database import planı dry-run ilə uyğun deyil/
);

async function testDatabaseImport() {
  const createdBatches = [];
  const storedEmails = new Set(['first@example.com']);
  const memberStore = {
    findMany: async ({ where }) => where.email.in
      .filter((email) => storedEmails.has(email))
      .map((email) => ({ email })),
    createMany: async ({ data }) => {
      createdBatches.push(data);
      let count = 0;
      data.forEach((member) => {
        if (!storedEmails.has(member.email)) {
          storedEmails.add(member.email);
          count += 1;
        }
      });
      return { count };
    }
  };
  const prisma = {
    member: memberStore,
    $transaction: async (callback) => callback({ member: memberStore })
  };

  const dryRun = await executeImport(prisma, memberImport.members, false);
  assert.deepStrictEqual(dryRun, { existingRows: 1, pendingRows: 1, createdRows: 0 });
  assert.equal(createdBatches.length, 0);

  await assert.rejects(
    () => executeImport(prisma, memberImport.members, true, {
      expectedExistingRows: 0,
      expectedPendingRows: 2
    }),
    /Database import planı dry-run ilə uyğun deyil/
  );
  assert.equal(createdBatches.length, 0);

  const apply = await executeImport(prisma, memberImport.members, true, {
    expectedExistingRows: 1,
    expectedPendingRows: 1
  });
  assert.deepStrictEqual(apply, { existingRows: 1, pendingRows: 1, createdRows: 1 });
  assert.equal(createdBatches.length, 1);
  assert.equal(createdBatches[0][0].email, 'second@example.com');

  const rerun = await executeImport(prisma, memberImport.members, false);
  assert.deepStrictEqual(rerun, { existingRows: 2, pendingRows: 0, createdRows: 0 });

  const rollbackEmails = new Set(['first@example.com']);
  const rollbackMemberStore = {
    findMany: async ({ where }) => where.email.in
      .filter((email) => rollbackEmails.has(email))
      .map((email) => ({ email })),
    createMany: async ({ data }) => {
      data.forEach((member) => rollbackEmails.add(member.email));
      return { count: 0 };
    }
  };
  const rollbackPrisma = {
    member: rollbackMemberStore,
    async $transaction(callback) {
      const snapshot = new Set(rollbackEmails);
      try {
        return await callback({ member: rollbackMemberStore });
      } catch (error) {
        rollbackEmails.clear();
        snapshot.forEach((email) => rollbackEmails.add(email));
        throw error;
      }
    }
  };

  await assert.rejects(
    () => executeImport(rollbackPrisma, memberImport.members, true, {
      expectedExistingRows: 1,
      expectedPendingRows: 1
    }),
    /Import nəticəsi gözlənilən sayla uyğun deyil/
  );
  assert.deepStrictEqual([...rollbackEmails], ['first@example.com']);
}

testDatabaseImport()
  .then(() => console.log('Legacy member import tests passed.'))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
