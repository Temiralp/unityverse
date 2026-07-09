require('dotenv').config();

const assert = require('assert/strict');

const { leadMailData, sendLeadNotificationEmail } = require('../src/services/lead-notifications');

async function main() {
  process.env.SMTP_TO = 'info@unityverseacademy.com';

  const sent = [];
  const sendEmail = async (message) => {
    sent.push(message);
    return {
      status: 'sent',
      recipients: Array.isArray(message.to) ? message.to : [message.to]
    };
  };

  const lead = {
    id: 77,
    source: '/sendCustomForm',
    name: 'Test Ziyaretçi',
    email: 'ziyaretci@example.test',
    phone: '05000000000',
    message: 'Yazılım Eğitimleri'
  };
  const data = {
    form_id: '1',
    ad_soyad: 'Test Ziyaretçi',
    eposta: 'ziyaretci@example.test',
    telefon: '05000000000',
    egitim: 'Yazılım Eğitimleri',
    mesaj: 'Kurs hakkında bilgi almak istiyorum.',
    kvkk: 'on'
  };

  const result = await sendLeadNotificationEmail({ lead, data }, { sendEmail });

  assert.equal(result.status, 'sent');
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].to, ['info@unityverseacademy.com']);
  assert.match(sent[0].subject, /Yeni bilgi talebi \| Test Ziyaretçi/);
  assert.match(sent[0].text, /Yazılım Eğitimleri/);
  assert.match(sent[0].text, /Kurs hakkında bilgi almak istiyorum\./);
  assert.match(sent[0].text, /#77/);
  assert.match(sent[0].html, /Yeni bilgi talebi alındı/);
  assert.match(sent[0].html, /ziyaretci@example\.test/);
  assert.match(sent[0].html, /05000000000/);

  const mailData = leadMailData({ lead: { name: '' }, data: {} });
  assert.equal(mailData.subject, 'Yeni bilgi talebi | Ziyaretçi');

  process.env.SMTP_TO = '';
  process.env.SMTP_USER = '';
  const skipped = await sendLeadNotificationEmail({ lead, data }, { sendEmail });
  assert.equal(skipped.status, 'skipped');
  assert.equal(sent.length, 1);

  process.env.SMTP_TO = 'info@unityverseacademy.com';
  const failing = await sendLeadNotificationEmail({ lead, data }, {
    sendEmail: async () => {
      throw new Error('SMTP kapalı');
    }
  });
  assert.equal(failing.status, 'failed');

  console.log('OK: bilgi talebi mail bildirimi testleri geçti.');
}

main().catch((error) => {
  console.error('TEST FAILED:', error.message);
  process.exit(1);
});
