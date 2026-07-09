const net = require('net');

function normalizeIp(value) {
  return String(value || '').trim().replace(/^::ffff:/, '');
}

function parsePaytrAllowedIps(value) {
  const entries = String(value || '')
    .split(',')
    .map(normalizeIp)
    .filter(Boolean);

  const invalidIp = entries.find((ip) => net.isIP(ip) === 0);
  if (invalidIp) {
    throw new Error(`PAYTR_ALLOWED_IPS contains an invalid IP address: ${invalidIp}`);
  }

  return new Set(entries);
}

const allowedIps = parsePaytrAllowedIps(process.env.PAYTR_ALLOWED_IPS);

function requirePaytrCallbackIp(req, res, next) {
  if (allowedIps.size === 0) {
    return next();
  }

  const requestIp = normalizeIp(req.ip || req.socket?.remoteAddress);
  if (allowedIps.has(requestIp)) {
    return next();
  }

  console.warn('[paytr] callback rejected: IP is not allowed', { requestIp });
  res.type('text/plain');
  return res.status(403).send('PAYTR notification failed: IP not allowed');
}

module.exports = {
  normalizeIp,
  parsePaytrAllowedIps,
  requirePaytrCallbackIp
};