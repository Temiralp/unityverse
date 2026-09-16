// Word (.docx) dosyasini duz bir "blok" listesine cevirir:
//   { type: 'heading', level, text }
//   { type: 'paragraph', html, text, bold }
//   { type: 'list', ordered, items: [html] }
//   { type: 'table', html }
// Donusturucu (mammoth) yalnizca bu fonksiyon cagrildiginda yuklenir (lazy require);
// paket eksik/bozuksa sunucu ve public site etkilenmez, net bir sebep doner.
// Gorseller v1'de atlanir ve uyari olarak raporlanir.

const cheerio = require('cheerio');

const DOCX_MAX_BYTES = 5 * 1024 * 1024;
const ZIP_SIGNATURE = 'PK';
const BLOCK_SELECTOR = 'h1, h2, h3, h4, h5, h6, p, ul, ol, table';

function defaultLoadConverter() {
  // eslint-disable-next-line global-require
  return require('mammoth');
}

function isDocxBuffer(buffer) {
  return Buffer.isBuffer(buffer)
    && buffer.length >= 4
    && buffer.slice(0, 2).toString('latin1') === ZIP_SIGNATURE;
}

function plainText($, element) {
  return $(element).text().replace(/\s+/g, ' ').trim();
}

// Paragrafin tamami <strong> icindeyse "kalin satir" sayilir (Pille 2 baslik ipucu).
function isWhollyBold($, element) {
  const node = $(element);
  const text = plainText($, node);
  if (!text) return false;
  const boldText = node.find('strong, b').map((index, el) => plainText($, el)).get().join(' ');
  return boldText.replace(/\s+/g, ' ').trim() === text;
}

function listItems($, element) {
  return $(element).children('li').map((index, li) => $(li).html().trim()).get();
}

function htmlToBlocks(html) {
  const $ = cheerio.load(`<div id="uv-import-root">${html}</div>`, { decodeEntities: false });
  const root = $('#uv-import-root');
  const skippedImages = root.find('img').length;
  root.find('img').remove();

  const blocks = [];
  root.find(BLOCK_SELECTOR).each((index, element) => {
    // Ic ice elemanlar (tablo hucresindeki p, li icindeki p) tek basina blok sayilmaz.
    if ($(element).parents(BLOCK_SELECTOR).length > 0) return;

    const tag = element.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tag)) {
      const text = plainText($, element);
      if (text) blocks.push({ type: 'heading', level: Number(tag[1]), text });
      return;
    }
    if (tag === 'ul' || tag === 'ol') {
      const items = listItems($, element).filter((item) => item.replace(/<[^>]*>/g, '').trim());
      if (items.length) blocks.push({ type: 'list', ordered: tag === 'ol', items });
      return;
    }
    if (tag === 'table') {
      blocks.push({ type: 'table', html: $.html(element) });
      return;
    }
    const text = plainText($, element);
    if (!text) return;
    blocks.push({ type: 'paragraph', html: $(element).html().trim(), text, bold: isWhollyBold($, element) });
  });

  return { blocks, skippedImages };
}

async function docxToBlocks(buffer, { loadConverter = defaultLoadConverter } = {}) {
  if (!isDocxBuffer(buffer)) return { ok: false, reason: 'invalid-file' };
  if (buffer.length > DOCX_MAX_BYTES) return { ok: false, reason: 'too-large' };

  let converter;
  try {
    converter = loadConverter();
  } catch (error) {
    return { ok: false, reason: 'converter-unavailable' };
  }

  let result;
  try {
    result = await converter.convertToHtml({ buffer });
  } catch (error) {
    return { ok: false, reason: 'conversion-failed', message: String(error && error.message || error) };
  }

  const { blocks, skippedImages } = htmlToBlocks(result.value || '');
  // mammoth mesajlari belge icerigi tasimaz (ornek: "Unrecognised paragraph style"); guvenle raporlanir.
  const warnings = (result.messages || []).map((message) => String(message.message || message));
  if (skippedImages > 0) warnings.push(`${skippedImages} görsel atlandı (v1: görseller içe aktarılmaz).`);

  return { ok: true, blocks, warnings, skippedImages };
}

module.exports = {
  DOCX_MAX_BYTES,
  docxToBlocks,
  htmlToBlocks
};
