const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MEMBER_STATUSES = new Set(['ACTIVE', 'PASSIVE']);

function text(value) {
  return String(value ?? '').trim();
}

function normalizeMemberAdminForm(body = {}) {
  return {
    name: text(body.name),
    surname: text(body.surname) || null,
    email: text(body.email).toLowerCase(),
    phone: text(body.phone) || null,
    mailList: body.mailList === 'on',
    smsList: body.smsList === 'on',
    status: text(body.status)
  };
}

function validateMemberAdminForm(body) {
  const data = normalizeMemberAdminForm(body);

  if (!data.name) {
    return { data, error: 'Ad alanı zorunludur.' };
  }
  if (data.name.length > 200 || (data.surname && data.surname.length > 200)) {
    return { data, error: 'Ad ve soyad en fazla 200 karakter olabilir.' };
  }
  if (!data.email || !EMAIL_PATTERN.test(data.email) || data.email.length > 320) {
    return { data, error: 'Geçerli bir e-posta adresi giriniz.' };
  }
  if (data.phone) {
    const phoneDigits = data.phone.replace(/\D/g, '');
    if (phoneDigits.length < 10 || phoneDigits.length > 15 || data.phone.length > 50) {
      return { data, error: 'Telefon numarası 10 ile 15 rakam arasında olmalıdır.' };
    }
  }
  if (!MEMBER_STATUSES.has(data.status)) {
    return { data, error: 'Geçerli bir üye durumu seçiniz.' };
  }

  return { data, error: null };
}

module.exports = {
  normalizeMemberAdminForm,
  validateMemberAdminForm
};
