const MEMBER_HEADERS = [
  'Adı Soyadı',
  'Mail Adresi',
  'Doğum Tarihi',
  'Cinsiyet',
  'Cep Telefonu',
  'TC Kimlik Numarası',
  'Mail Listesi',
  'Sms Listesi',
  'Şehir',
  'İlçe',
  'Adres',
  'Durumu'
];

const ORDER_HEADERS = ['S.K.', 'Üye Adı', 'Üye Cep Telefonu', 'Üye Mail Adresi'];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanCell(value) {
  return String(value ?? '').replace(/^\uFEFF/, '').trim();
}

function compactText(value) {
  return cleanCell(value).replace(/\s+/g, ' ');
}

function normalizeEmail(value) {
  return cleanCell(value).toLowerCase();
}

function splitLegacyFullName(value) {
  const parts = compactText(value).split(' ').filter(Boolean);

  if (parts.length <= 1) {
    return {
      name: parts[0] || '',
      surname: null
    };
  }

  return {
    name: parts.slice(0, -1).join(' '),
    surname: parts.at(-1)
  };
}

function parseSemicolonCsv(content) {
  const text = String(content ?? '');
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"') {
      quoted = true;
    } else if (character === ';') {
      row.push(field);
      field = '';
    } else if (character === '\n') {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }

  if (quoted) {
    throw new Error('CSV içində bağlanmamış dırnaq işarəsi var.');
  }

  if (field || row.length) {
    row.push(field.replace(/\r$/, ''));
    rows.push(row);
  }

  return rows;
}

function rowHasData(row) {
  return row.some((value) => cleanCell(value));
}

function findHeader(rows, expectedHeaders) {
  const headerIndex = rows.findIndex((row) => {
    const normalized = row.map(cleanCell);
    return expectedHeaders.every((header) => normalized.includes(header));
  });

  if (headerIndex === -1) {
    throw new Error(`CSV başlıqları uyğun deyil: ${expectedHeaders.join(', ')}`);
  }

  const header = rows[headerIndex].map(cleanCell);
  return {
    header,
    headerIndex,
    indexes: Object.fromEntries(expectedHeaders.map((name) => [name, header.indexOf(name)]))
  };
}

function legacyBoolean(value) {
  const normalized = cleanCell(value).toLocaleLowerCase('tr-TR');
  if (normalized === 'evet') return true;
  if (normalized === 'hayır') return false;
  return null;
}

function legacyStatus(value) {
  const normalized = cleanCell(value).toLocaleLowerCase('tr-TR');
  if (normalized === 'aktif') return 'ACTIVE';
  if (normalized === 'pasif') return 'PASSIVE';
  return null;
}

function memberRow(row, indexes, rowNumber) {
  const { name, surname } = splitLegacyFullName(row[indexes['Adı Soyadı']]);
  const email = normalizeEmail(row[indexes['Mail Adresi']]);
  const mailList = legacyBoolean(row[indexes['Mail Listesi']]);
  const smsList = legacyBoolean(row[indexes['Sms Listesi']]);
  const status = legacyStatus(row[indexes.Durumu]);
  const errors = [];

  if (!name) errors.push('missing_name');
  if (!email) errors.push('missing_email');
  else if (!EMAIL_PATTERN.test(email)) errors.push('invalid_email');
  if (mailList === null) errors.push('invalid_mail_list');
  if (smsList === null) errors.push('invalid_sms_list');
  if (!status) errors.push('invalid_status');

  if (errors.length) {
    return { error: { rowNumber, codes: errors } };
  }

  return {
    member: {
      name,
      surname,
      email,
      phone: cleanCell(row[indexes['Cep Telefonu']]) || null,
      gender: null,
      passwordHash: null,
      mailList,
      smsList,
      status
    }
  };
}

function buildLegacyMemberImport(content) {
  const rows = parseSemicolonCsv(content);
  const { headerIndex, indexes } = findHeader(rows, MEMBER_HEADERS);
  const sourceRows = rows
    .map((row, index) => ({ row, rowNumber: index + 1 }))
    .slice(headerIndex + 1)
    .filter((entry) => rowHasData(entry.row));
  const members = [];
  const rejectedRows = [];
  const seenEmails = new Set();

  sourceRows.forEach(({ row, rowNumber }) => {
    const parsed = memberRow(row, indexes, rowNumber);
    if (parsed.error) {
      rejectedRows.push(parsed.error);
      return;
    }

    if (seenEmails.has(parsed.member.email)) {
      rejectedRows.push({
        rowNumber,
        codes: ['duplicate_email']
      });
      return;
    }

    seenEmails.add(parsed.member.email);
    members.push(parsed.member);
  });

  return {
    members,
    rejectedRows,
    summary: {
      sourceRows: sourceRows.length,
      validRows: members.length,
      rejectedRows: rejectedRows.length
    }
  };
}

function buildLegacyOrderAudit(content, memberEmails) {
  const rows = parseSemicolonCsv(content);
  const { headerIndex, indexes } = findHeader(rows, ORDER_HEADERS);
  const sourceRows = rows.slice(headerIndex + 1).filter(rowHasData);
  const validEmails = new Set();
  let missingEmails = 0;
  let invalidEmails = 0;

  sourceRows.forEach((row) => {
    const email = normalizeEmail(row[indexes['Üye Mail Adresi']]);
    if (!email) {
      missingEmails += 1;
    } else if (!EMAIL_PATTERN.test(email)) {
      invalidEmails += 1;
    } else {
      validEmails.add(email);
    }
  });

  const knownEmails = new Set([...memberEmails].map(normalizeEmail));
  const matchingEmails = [...validEmails].filter((email) => knownEmails.has(email)).length;

  return {
    sourceRows: sourceRows.length,
    uniqueValidEmails: validEmails.size,
    matchingMemberEmails: matchingEmails,
    unmatchedMemberEmails: validEmails.size - matchingEmails,
    missingEmails,
    invalidEmails
  };
}

module.exports = {
  buildLegacyMemberImport,
  buildLegacyOrderAudit,
  normalizeEmail,
  parseSemicolonCsv,
  splitLegacyFullName
};
