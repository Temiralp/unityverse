const net = require('net');
const tls = require('tls');

const SMTP_TIMEOUT_MS = 20 * 1000;

function envValue(name) {
  return String(process.env[name] || '').trim();
}

function smtpPort() {
  const value = Number(envValue('SMTP_PORT') || 465);
  return Number.isInteger(value) && value > 0 ? value : 465;
}

function smtpSecure() {
  const value = envValue('SMTP_SECURE').toLowerCase();
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  return smtpPort() === 465;
}

function smtpStartTls() {
  const value = envValue('SMTP_STARTTLS').toLowerCase();
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  return !smtpSecure();
}

function emailAddress(value) {
  const address = String(value || '').trim();
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(address) ? address : '';
}

function emailList(value) {
  return String(value || '')
    .split(/[;,]/)
    .map((item) => emailAddress(item))
    .filter(Boolean);
}

function adminEmailRecipients() {
  return emailList(envValue('SMTP_TO') || envValue('SMTP_USER'));
}

function smtpConfig() {
  const host = envValue('SMTP_HOST');
  const user = emailAddress(envValue('SMTP_USER'));
  const pass = envValue('SMTP_PASS');
  const secure = smtpSecure();

  if (!host || !user || !pass) {
    return null;
  }

  return {
    host,
    port: smtpPort(),
    secure,
    startTls: !secure && smtpStartTls(),
    user,
    pass,
    from: emailAddress(envValue('SMTP_FROM')) || user,
    fromName: envValue('SMTP_FROM_NAME') || 'Unityverse Academy'
  };
}

function encodeHeader(value) {
  const text = String(value || '').replace(/[\r\n]+/g, ' ').trim();
  if (!/[^\x20-\x7E]/.test(text)) return text;

  return `=?UTF-8?B?${Buffer.from(text, 'utf8').toString('base64')}?=`;
}

function addressHeader(address, name = '') {
  const safeAddress = emailAddress(address);
  if (!safeAddress) return '';

  const safeName = String(name || '').replace(/["\r\n]/g, '').trim();
  return safeName ? `"${encodeHeader(safeName)}" <${safeAddress}>` : safeAddress;
}

function normalizeRecipients(value) {
  const recipients = Array.isArray(value)
    ? value.flatMap((item) => emailList(item))
    : emailList(value);

  return [...new Set(recipients)];
}

function dotStuff(value) {
  return String(value || '').replace(/\r?\n/g, '\r\n').replace(/^\./gm, '..');
}

function mailData({ from, fromName, to, subject, text, html }) {
  const boundary = `uv-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const headers = [
    `From: ${addressHeader(from, fromName)}`,
    `To: ${to.map((address) => addressHeader(address)).join(', ')}`,
    `Subject: ${encodeHeader(subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    'X-Mailer: Unityverse Academy'
  ];

  return [
    headers.join('\r\n'),
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    dotStuff(text),
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    dotStuff(html),
    `--${boundary}--`,
    ''
  ].join('\r\n');
}

function createSmtpClient(config) {
  const connect = config.secure ? tls.connect : net.connect;
  return connect({
    host: config.host,
    port: config.port,
    servername: config.host
  });
}

function smtpSocketErrorHandler(done) {
  return (error) => done(error);
}

function smtpLineReader(socket, done) {
  let buffer = '';
  let pendingLines = [];
  let waiter = null;

  const completeResponse = () => {
    const finalLine = pendingLines[pendingLines.length - 1] || '';
    if (!/^\d{3}\s/.test(finalLine) || !waiter) return;

    const currentWaiter = waiter;
    const lines = pendingLines;
    const code = Number(finalLine.slice(0, 3));
    pendingLines = [];
    waiter = null;
    currentWaiter.resolve({ code, lines });
  };

  const onData = (chunk) => {
    buffer += chunk.toString('utf8');
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line) continue;
      pendingLines.push(line);
      completeResponse();
    }
  };

  socket.on('data', onData);

  return {
    wait() {
      if (waiter) {
        return Promise.reject(new Error('SMTP yanıtı bekleme sırası bozuldu.'));
      }

      return new Promise((resolve, reject) => {
        waiter = { resolve, reject };
        completeResponse();
      });
    },
    detach() {
      socket.off('data', onData);
      if (waiter) {
        waiter.reject(new Error('SMTP bağlantısı TLS için yeniden başlatıldı.'));
        waiter = null;
      }
    },
    reject(error) {
      if (!waiter) return;
      waiter.reject(error);
      waiter = null;
    }
  };
}

function assertSmtpResponse(response, expectedCodes) {
  if (expectedCodes.includes(response.code)) return;

  const message = response.lines[response.lines.length - 1] || `SMTP ${response.code}`;
  throw new Error(`SMTP yanıtı başarısız: ${message}`);
}

async function smtpCommand(socket, reader, command, expectedCodes = [250]) {
  socket.write(`${command}\r\n`);
  const response = await reader.wait();
  assertSmtpResponse(response, expectedCodes);
  return response;
}

function upgradeToTls(socket, config, done) {
  return tls.connect({
    socket,
    host: config.host,
    servername: config.host
  }).on('error', smtpSocketErrorHandler(done));
}

function sendSmtpMail(config, message) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let socket = createSmtpClient(config);
    let reader = null;

    const done = (error) => {
      if (settled) return;
      settled = true;
      if (reader) reader.reject(error || new Error('SMTP bağlantısı kapatıldı.'));
      if (socket) socket.destroy();
      if (error) reject(error);
      else resolve();
    };

    socket.setTimeout(SMTP_TIMEOUT_MS, () => {
      done(new Error('SMTP bağlantısı zaman aşımına uğradı.'));
    });

    socket.on('error', smtpSocketErrorHandler(done));
    reader = smtpLineReader(socket, done);

    (async () => {
      let greeting = await reader.wait();
      assertSmtpResponse(greeting, [220]);

      await smtpCommand(socket, reader, `EHLO ${config.host}`);

      if (config.startTls) {
        await smtpCommand(socket, reader, 'STARTTLS', [220]);
        reader.detach();
        socket.removeAllListeners('error');
        socket = upgradeToTls(socket, config, done);
        socket.setTimeout(SMTP_TIMEOUT_MS, () => {
          done(new Error('SMTP bağlantısı zaman aşımına uğradı.'));
        });
        reader = smtpLineReader(socket, done);
        await new Promise((resolveTls, rejectTls) => {
          socket.once('secureConnect', resolveTls);
          socket.once('error', rejectTls);
        });
        await smtpCommand(socket, reader, `EHLO ${config.host}`);
      }

      await smtpCommand(socket, reader, 'AUTH LOGIN', [334]);
      await smtpCommand(socket, reader, Buffer.from(config.user, 'utf8').toString('base64'), [334]);
      await smtpCommand(socket, reader, Buffer.from(config.pass, 'utf8').toString('base64'), [235]);
      await smtpCommand(socket, reader, `MAIL FROM:<${config.from}>`);

      for (const recipient of message.to) {
        await smtpCommand(socket, reader, `RCPT TO:<${recipient}>`, [250, 251]);
      }

      await smtpCommand(socket, reader, 'DATA', [354]);
      await smtpCommand(
        socket,
        reader,
        `${mailData({ ...message, from: config.from, fromName: config.fromName })}\r\n.`,
        [250]
      );
      await smtpCommand(socket, reader, 'QUIT', [221]);
      done();
    })().catch(done);
  });
}

async function sendTransactionalEmail({ to, subject, text, html }) {
  const config = smtpConfig();
  const recipients = normalizeRecipients(to);

  if (!config || !recipients.length) {
    const reason = !config ? 'SMTP yapılandırması eksik.' : 'Geçerli alıcı yok.';
    console.warn(`[mail] gönderim atlandı: ${reason}`);
    return {
      status: 'skipped',
      reason
    };
  }

  await sendSmtpMail(config, {
    to: recipients,
    subject,
    text,
    html
  });

  return {
    status: 'sent',
    recipients
  };
}

module.exports = {
  adminEmailRecipients,
  emailAddress,
  sendTransactionalEmail,
  smtpConfig
};
