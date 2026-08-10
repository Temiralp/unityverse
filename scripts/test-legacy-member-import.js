#!/usr/bin/env node

const assert = require('assert/strict');

const {
  buildLegacyMemberImport,
  buildLegacyOrderAudit,
  parseSemicolonCsv
} = require('../src/services/legacy-member-import');
const {
  executeImport,
  parseArguments,
  rejectionCounts
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
assert.equal(memberImport.members[0].name, 'Tam Ad');
assert.equal(memberImport.members[0].surname, null);
assert.equal(memberImport.members[0].mailList, true);
assert.equal(memberImport.members[0].smsList, false);
assert.equal(memberImport.members[0].status, 'ACTIVE');
assert.equal(memberImport.members[0].passwordHash, null);
assert.equal(memberImport.members[1].name, 'İki Satır');
assert.equal(memberImport.members[1].status, 'PASSIVE');
assert.deepStrictEqual(rejectionCounts(memberImport.rejectedRows), {
  duplicate_email: 1,
  missing_name: 1
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
  membersPath: 'members.csv',
  ordersPath: null
});
assert.deepStrictEqual(parseArguments([
  '--members', 'members.csv', '--orders', 'orders.csv', '--apply'
]), {
  apply: true,
  membersPath: 'members.csv',
  ordersPath: 'orders.csv'
});
assert.throws(() => parseArguments([]), /--members/);

async function testDatabaseImport() {
  const createdBatches = [];
  const prisma = {
    member: {
      findMany: async () => [{ email: 'FIRST@EXAMPLE.COM' }],
      createMany: async ({ data }) => {
        createdBatches.push(data);
        return { count: data.length };
      }
    },
    $transaction: async (operations) => Promise.all(operations)
  };

  const dryRun = await executeImport(prisma, memberImport.members, false);
  assert.deepStrictEqual(dryRun, { existingRows: 1, pendingRows: 1, createdRows: 0 });
  assert.equal(createdBatches.length, 0);

  const apply = await executeImport(prisma, memberImport.members, true);
  assert.deepStrictEqual(apply, { existingRows: 1, pendingRows: 1, createdRows: 1 });
  assert.equal(createdBatches.length, 1);
  assert.equal(createdBatches[0][0].email, 'second@example.com');
}

testDatabaseImport()
  .then(() => console.log('Legacy member import tests passed.'))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
