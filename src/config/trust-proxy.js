function parseTrustProxy(value) {
  const normalized = String(value || '').trim();

  if (!normalized || normalized.toLowerCase() === 'false') {
    return false;
  }

  const proxies = normalized
    .split(',')
    .map((proxy) => proxy.trim())
    .filter(Boolean);

  if (!proxies.length) {
    return false;
  }

  if (proxies.some((proxy) => proxy === '*' || proxy.toLowerCase() === 'true')) {
    throw new Error('TRUST_PROXY must list explicit proxy IP addresses or CIDR ranges.');
  }

  return proxies;
}

module.exports = { parseTrustProxy };
