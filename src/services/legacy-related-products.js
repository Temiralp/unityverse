const RELATED_PRODUCT_CLASSES = ['related', 'titleLine', 'products-list'];
const PRODUCT_SIMILAR_URL_PATTERN = /ajax\/productsimilar/i;

function classNames(openingTag) {
  const match = String(openingTag || '').match(/\bclass\s*=\s*(["'])([\s\S]*?)\1/i);
  return match ? match[2].split(/\s+/).filter(Boolean) : [];
}

function isRelatedProductContainer(openingTag) {
  const classes = new Set(classNames(openingTag));
  return RELATED_PRODUCT_CLASSES.every((className) => classes.has(className));
}

function findBalancedDivEnd(source, startIndex) {
  const tagPattern = /<\/?div\b[^>]*>/gi;
  tagPattern.lastIndex = startIndex;
  let depth = 0;
  let match;

  while ((match = tagPattern.exec(source))) {
    if (/^<\/div/i.test(match[0])) {
      depth -= 1;
      if (depth === 0) return tagPattern.lastIndex;
    } else {
      depth += 1;
    }
  }

  return -1;
}

function isTargetRelatedProductBlock(block) {
  return /\bid\s*=\s*(["'])productsimilar\1/i.test(block)
    || /\bclass\s*=\s*(["'])[^"']*\breleate-products\b[^"']*\1/i.test(block);
}

function removeRelatedProductContainers(html) {
  let source = String(html || '');
  let searchFrom = 0;

  while (searchFrom < source.length) {
    const openingMatch = /<div\b[^>]*>/gi;
    openingMatch.lastIndex = searchFrom;
    const match = openingMatch.exec(source);
    if (!match) break;

    if (!isRelatedProductContainer(match[0])) {
      searchFrom = openingMatch.lastIndex;
      continue;
    }

    const blockEnd = findBalancedDivEnd(source, match.index);
    if (blockEnd < 0) break;

    const block = source.slice(match.index, blockEnd);
    if (!isTargetRelatedProductBlock(block)) {
      searchFrom = blockEnd;
      continue;
    }

    source = source.slice(0, match.index) + source.slice(blockEnd);
    searchFrom = match.index;
  }

  return source;
}

function findClosingParenthesis(source, openingIndex) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = openingIndex; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (lineComment) {
      if (char === '\n') lineComment = false;
      continue;
    }

    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false;
        index += 1;
      }
      continue;
    }

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === '/' && next === '/') {
      lineComment = true;
      index += 1;
      continue;
    }

    if (char === '/' && next === '*') {
      blockComment = true;
      index += 1;
      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }

    if (char === '(') depth += 1;
    if (char !== ')') continue;

    depth -= 1;
    if (depth === 0) return index;
  }

  return -1;
}

function removeProductSimilarAjaxCalls(scriptContent) {
  let source = String(scriptContent || '');
  let urlMatch = source.match(PRODUCT_SIMILAR_URL_PATTERN);

  while (urlMatch) {
    const urlIndex = urlMatch.index;
    const callStart = source.lastIndexOf('$.ajax', urlIndex);
    if (callStart < 0) break;

    const openingIndex = source.indexOf('(', callStart + '$.ajax'.length);
    if (openingIndex < 0 || openingIndex > urlIndex) break;

    const closingIndex = findClosingParenthesis(source, openingIndex);
    if (closingIndex < 0 || closingIndex < urlIndex) break;

    let statementEnd = closingIndex + 1;
    while (/[ \t]/.test(source[statementEnd] || '')) statementEnd += 1;
    if (source[statementEnd] === ';') statementEnd += 1;

    source = source.slice(0, callStart) + source.slice(statementEnd);
    urlMatch = source.match(PRODUCT_SIMILAR_URL_PATTERN);
  }

  return source;
}

function removeProductSimilarScripts(html) {
  return String(html || '').replace(
    /<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,
    (scriptTag) => {
      if (!PRODUCT_SIMILAR_URL_PATTERN.test(scriptTag)) return scriptTag;

      const openingEnd = scriptTag.indexOf('>') + 1;
      const closingStart = scriptTag.toLowerCase().lastIndexOf('</script');
      if (openingEnd <= 0 || closingStart < openingEnd) return scriptTag;

      const content = scriptTag.slice(openingEnd, closingStart);
      const transformed = removeProductSimilarAjaxCalls(content);
      return scriptTag.slice(0, openingEnd) + transformed + scriptTag.slice(closingStart);
    }
  );
}

function removeLegacyRelatedProducts(html) {
  const source = String(html || '');
  if (!source) return source;

  return removeProductSimilarScripts(removeRelatedProductContainers(source));
}

module.exports = {
  removeLegacyRelatedProducts
};
