const { adminEmailRecipients, sendTransactionalEmail } = require('./mail');
const { renderMail } = require('./payment-notifications');

const subjectBySource = Object.freeze({
  '/sendHomepageInfoForm': 'Ana sayfa formundan yeni bilgi talebi',
  '/sendInformationPageForm': 'Bilgi Al sayfasından yeni bilgi talebi'
});

function leadMailData({ lead, data }) {
  const payload = data || {};
  const name = String(lead?.name || '').trim() || 'Ziyaretçi';
  const subjectPrefix = subjectBySource[lead?.source] || 'Yeni bilgi talebi';

  return {
    subject: `${subjectPrefix} | ${name}`,
    title: 'Yeni bilgi talebi alındı',
    intro: `${name} web sitesindeki bilgi al formunu doldurdu. En kısa sürede iletişime geçilmelidir.`,
    footer: 'Bu bildirim bilgi al formu gönderimi sonrası otomatik oluşturulmuştur.',
    rows: [
      { label: 'Ad Soyad', value: lead?.name },
      { label: 'E-posta', value: lead?.email },
      { label: 'Telefon', value: lead?.phone },
      { label: 'İlgilendiği Eğitim', value: payload.egitim },
      { label: 'Mesaj', value: payload.mesaj || payload.message || payload.note || payload.not },
      { label: 'Kaynak', value: lead?.source },
      { label: 'Talep No', value: lead?.id ? `#${lead.id}` : null }
    ]
  };
}

async function sendLeadNotificationEmail(payload, options = {}) {
  try {
    const recipients = adminEmailRecipients();
    if (!recipients.length) {
      console.warn('[mail] bilgi talebi bildirimi atlandı: geçerli alıcı yok.');
      return { status: 'skipped', reason: 'Geçerli alıcı yok.' };
    }

    const mail = renderMail(leadMailData(payload));
    const delivery = options.sendEmail || sendTransactionalEmail;

    return await delivery({
      to: recipients,
      subject: mail.subject,
      text: mail.text,
      html: mail.html
    });
  } catch (error) {
    console.error('[mail] bilgi talebi bildirimi gönderilemedi:', error.message);
    return { status: 'failed', reason: error.message };
  }
}

module.exports = {
  leadMailData,
  sendLeadNotificationEmail
};
