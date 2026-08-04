const IMAGE_MIME_TYPES = new Set([
  'image/avif',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp'
]);

function startsWith(buffer, signature) {
  if (!Buffer.isBuffer(buffer) || buffer.length < signature.length) return false;
  return signature.every((byte, index) => buffer[index] === byte);
}

function isAvif(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 16 || buffer.toString('ascii', 4, 8) !== 'ftyp') {
    return false;
  }

  const boxSize = buffer.readUInt32BE(0);
  if (boxSize < 16 || boxSize > buffer.length) return false;

  for (let offset = 8; offset + 4 <= boxSize; offset += 4) {
    const brand = buffer.toString('ascii', offset, offset + 4);
    if (brand === 'avif' || brand === 'avis') return true;
  }

  return false;
}

function detectImageMimeType(buffer) {
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';

  const header = Buffer.isBuffer(buffer) ? buffer.toString('ascii', 0, 12) : '';
  if (header.startsWith('GIF87a') || header.startsWith('GIF89a')) return 'image/gif';
  if (header.startsWith('RIFF') && header.slice(8, 12) === 'WEBP') return 'image/webp';
  if (isAvif(buffer)) return 'image/avif';

  return null;
}

function hasMatchingImageSignature(buffer, declaredMimeType) {
  const mimeType = String(declaredMimeType || '').toLowerCase();
  return IMAGE_MIME_TYPES.has(mimeType) && detectImageMimeType(buffer) === mimeType;
}

module.exports = {
  detectImageMimeType,
  hasMatchingImageSignature
};
