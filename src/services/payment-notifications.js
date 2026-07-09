const {
  adminEmailRecipients,
  emailAddress,
  sendTransactionalEmail
} = require('./mail');

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function textValue(value, fallback = '-') {
  const text = String(value == null ? '' : value).trim();
  return text || fallback;
}

function fullName(registration) {
  return [registration?.name, registration?.surname].filter(Boolean).join(' ').trim() || 'Öğrenci';
}

function formatMoney(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '-';

  return `${amount.toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })} TL`;
}

function formatKurus(value) {
  const text = String(value || '').trim();
  if (!/^\d+$/.test(text)) return '-';

  return formatMoney(Number(text) / 100);
}

function installmentLabel(value, fallback = 'Tek çekim') {
  const count = Number(String(value || '').trim());
  if (!Number.isInteger(count) || count <= 0) return fallback;
  if (count === 1) return 'Tek çekim';

  return `${count} taksit`;
}

function rows(items) {
  return items
    .filter((item) => item && item.value !== undefined && item.value !== null && String(item.value).trim() !== '')
    .map((item) => `
      <tr>
        <td style="padding:10px 0;color:#667085;font-size:14px;border-bottom:1px solid #EAECF0;">${escapeHtml(item.label)}</td>
        <td style="padding:10px 0;color:#101828;font-size:14px;font-weight:700;text-align:right;border-bottom:1px solid #EAECF0;">${escapeHtml(item.value)}</td>
      </tr>
    `)
    .join('');
}

function layout({ eyebrow, title, intro, rows: detailRows, footer }) {
  return `<!doctype html>
<html lang="tr">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:0;background:#F4F7FB;font-family:Arial,Helvetica,sans-serif;color:#101828;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(intro)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F4F7FB;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#FFFFFF;border:1px solid #EAECF0;border-radius:8px;overflow:hidden;">
            <tr>
              <td style="padding:28px 28px 18px;background:#0B075C;color:#FFFFFF;">
                <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;font-weight:700;color:#B9E6FE;">${escapeHtml(eyebrow)}</div>
                <h1 style="margin:10px 0 0;font-size:24px;line-height:1.3;font-weight:800;">${escapeHtml(title)}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:26px 28px;">
                <p style="margin:0 0 18px;font-size:16px;line-height:1.6;color:#344054;">${escapeHtml(intro)}</p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                  ${detailRows}
                </table>
                <p style="margin:22px 0 0;font-size:14px;line-height:1.6;color:#667085;">${escapeHtml(footer)}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function textMail({ title, intro, rows: detailRows, footer }) {
  const details = detailRows
    .map((item) => `${item.label}: ${item.value}`)
    .join('\n');

  return [title, '', intro, '', details, '', footer].filter(Boolean).join('\n');
}

async function deliverPair({ studentEmail, studentMail, adminMail, sendEmail }) {
  const delivery = sendEmail || sendTransactionalEmail;
  const results = [];

  if (studentEmail) {
    results.push(await delivery({
      to: studentEmail,
      subject: studentMail.subject,
      text: studentMail.text,
      html: studentMail.html
    }));
  }

  const adminRecipients = adminEmailRecipients();
  if (adminRecipients.length) {
    results.push(await delivery({
      to: adminRecipients,
      subject: adminMail.subject,
      text: adminMail.text,
      html: adminMail.html
    }));
  }

  return results;
}

async function notifySafely(scope, task) {
  try {
    return await task();
  } catch (error) {
    console.error(`[mail] ${scope} bildirimi gönderilemedi:`, error.message);
    return [{ status: 'failed', reason: error.message }];
  }
}

function cardPaymentMailData({ registration, payment }) {
  const studentName = fullName(registration);
  const courseTitle = textValue(registration.courseTitle);
  const installment = installmentLabel(payment.installmentCount, 'PayTR ödeme ekranında seçilen plan');
  const paidAmount = payment.totalAmount ? formatKurus(payment.totalAmount) : formatMoney(payment.amount);
  const courseAmount = payment.paymentAmount ? formatKurus(payment.paymentAmount) : formatMoney(registration.totalAmount);
  const paymentType = textValue(payment.paymentType || 'Kart');
  const merchantOid = textValue(payment.merchantOid);

  const studentRows = [
    { label: 'Öğrenci', value: studentName },
    { label: 'Eğitim', value: courseTitle },
    { label: 'Kayıt No', value: `#${registration.id}` },
    { label: 'Eğitim Tutarı', value: courseAmount },
    { label: 'Toplam Ödenen', value: paidAmount },
    { label: 'Ödeme Planı', value: installment },
    { label: 'Ödeme Yöntemi', value: paymentType }
  ];
  const adminRows = [
    ...studentRows,
    { label: 'E-posta', value: textValue(registration.email) },
    { label: 'Telefon', value: textValue(registration.phone) },
    { label: 'PayTR İşlem No', value: merchantOid }
  ];

  return {
    student: {
      subject: `Ödemeniz alındı | ${courseTitle}`,
      title: 'Ödemeniz alındı',
      intro: `${studentName}, ${courseTitle} eğitimi için kart ödemeniz başarıyla alınmıştır.`,
      footer: 'Eğitim danışmanlarımız kayıt sürecinizle ilgili gerekli bilgilendirmeleri sizinle paylaşacaktır.',
      rows: studentRows
    },
    admin: {
      subject: `Yeni kart ödemesi alındı | Kayıt #${registration.id}`,
      title: 'Yeni kart ödemesi alındı',
      intro: `${studentName} adlı öğrenci kartla ödeme yaptı. Kayıt sistemde ödenmiş olarak işaretlendi.`,
      footer: 'Bu bildirim PayTR callback sonrası otomatik oluşturulmuştur.',
      rows: adminRows
    }
  };
}

function bankTransferMailData({ registration, bankTransfer }) {
  const studentName = fullName(registration);
  const courseTitle = textValue(registration.courseTitle);
  const reference = textValue(bankTransfer.reference);
  const amount = bankTransfer.amount ? `${bankTransfer.amount} TL` : formatMoney(registration.totalAmount);

  const studentRows = [
    { label: 'Öğrenci', value: studentName },
    { label: 'Eğitim', value: courseTitle },
    { label: 'Kayıt No', value: `#${registration.id}` },
    { label: 'Ödenecek Tutar', value: amount },
    { label: 'Ödeme Planı', value: 'Havale/EFT toplam ödeme' },
    { label: 'Açıklama', value: reference },
    { label: 'Hesap Sahibi', value: textValue(bankTransfer.accountName) },
    { label: 'Banka', value: textValue(bankTransfer.bankName, 'Danışman tarafından paylaşılacaktır') },
    { label: 'IBAN', value: textValue(bankTransfer.iban, 'Danışman tarafından paylaşılacaktır') },
    { label: 'Şube', value: textValue(bankTransfer.branch, '') }
  ];
  const adminRows = [
    ...studentRows,
    { label: 'E-posta', value: textValue(registration.email) },
    { label: 'Telefon', value: textValue(registration.phone) }
  ];

  return {
    student: {
      subject: `Havale/EFT bilgileriniz | ${courseTitle}`,
      title: 'Havale/EFT bildiriminiz alındı',
      intro: `${studentName}, ${courseTitle} eğitimi için Havale/EFT bildiriminiz alınmıştır. Ödeme açıklamasına ${reference} yazmanız gerekir.`,
      footer: 'Ödemeniz banka hesabında kontrol edildikten sonra kaydınıza işlenecektir.',
      rows: studentRows
    },
    admin: {
      subject: `Yeni Havale/EFT bildirimi | Kayıt #${registration.id}`,
      title: 'Yeni Havale/EFT bildirimi',
      intro: `${studentName} adlı öğrenci Havale/EFT ödeme yöntemini seçti. Banka hareketi kontrol edilmelidir.`,
      footer: 'Bu bildirim ödeme sayfasındaki Havale/EFT formu sonrası otomatik oluşturulmuştur.',
      rows: adminRows
    }
  };
}

function renderMail(mail) {
  const detailRows = rows(mail.rows);

  return {
    subject: mail.subject,
    text: textMail(mail),
    html: layout({
      eyebrow: 'Unityverse Academy',
      title: mail.title,
      intro: mail.intro,
      rows: detailRows,
      footer: mail.footer
    })
  };
}

async function sendCardPaymentEmails(payload, options = {}) {
  return notifySafely('kart ödeme', async () => {
    const data = cardPaymentMailData(payload);
    return deliverPair({
      studentEmail: emailAddress(payload.registration?.email),
      studentMail: renderMail(data.student),
      adminMail: renderMail(data.admin),
      sendEmail: options.sendEmail
    });
  });
}

async function sendBankTransferEmails(payload, options = {}) {
  return notifySafely('havale/EFT', async () => {
    const data = bankTransferMailData(payload);
    return deliverPair({
      studentEmail: emailAddress(payload.registration?.email),
      studentMail: renderMail(data.student),
      adminMail: renderMail(data.admin),
      sendEmail: options.sendEmail
    });
  });
}

module.exports = {
  bankTransferMailData,
  cardPaymentMailData,
  formatKurus,
  formatMoney,
  installmentLabel,
  renderMail,
  sendBankTransferEmails,
  sendCardPaymentEmails
};
