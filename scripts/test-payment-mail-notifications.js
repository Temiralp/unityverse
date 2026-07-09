require('dotenv').config();

const assert = require('assert/strict');

const {
  installmentLabel,
  sendBankTransferEmails,
  sendCardPaymentEmails
} = require('../src/services/payment-notifications');

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

  const registration = {
    id: 42,
    courseTitle: 'Unreal Engine ile Metaverse Geliştirme Yüz Yüze Eğitim',
    name: 'Test',
    surname: 'Öğrenci',
    email: 'student@example.test',
    phone: '+90 500 000 00 00',
    totalAmount: '69000.00'
  };

  await sendCardPaymentEmails({
    registration,
    payment: {
      amount: '69000.00',
      merchantOid: 'UVR42T1780000000000Xabcdef123456',
      paymentAmount: '6900000',
      totalAmount: '6900000',
      paymentType: 'card',
      installmentCount: 6
    }
  }, { sendEmail });

  await sendBankTransferEmails({
    registration,
    bankTransfer: {
      accountName: 'Unityverse Academy',
      bankName: 'Test Bank',
      iban: 'TR000000000000000000000000',
      branch: '',
      reference: 'UV-42',
      amount: '69.000,00'
    }
  }, { sendEmail });

  assert.equal(sent.length, 4);
  assert.equal(sent[0].to, 'student@example.test');
  assert.deepEqual(sent[1].to, ['info@unityverseacademy.com']);
  assert.match(sent[0].subject, /Ödemeniz alındı/);
  assert.match(sent[0].text, /6 taksit/);
  assert.match(sent[0].text, /69\.000,00 TL/);
  assert.match(sent[1].text, /Yeni kart ödemesi alındı/);
  assert.match(sent[2].subject, /Havale\/EFT/);
  assert.match(sent[2].text, /UV-42/);
  assert.match(sent[3].text, /Banka hareketi kontrol edilmelidir/);
  assert.equal(installmentLabel(1), 'Tek çekim');
  assert.equal(installmentLabel(9), '9 taksit');

  console.log(JSON.stringify({
    status: 'ok',
    sentMessages: sent.length,
    studentMessages: sent.filter((message) => message.to === 'student@example.test').length,
    adminMessages: sent.filter((message) => Array.isArray(message.to)).length
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
