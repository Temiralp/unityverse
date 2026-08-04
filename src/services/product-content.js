const path = require('path');
const cheerio = require('cheerio');
const sanitizeHtml = require('sanitize-html');
const { youtubeVideo } = require('./youtube-embeds');

const PRODUCT_CONTENT_TAGS = [
  ...sanitizeHtml.defaults.allowedTags,
  'img',
  'iframe'
];

const PRODUCT_CONTENT_ATTRIBUTES = {
  '*': ['class', 'dir', 'style', 'title'],
  a: ['href', 'name', 'rel', 'target', 'title'],
  img: ['alt', 'class', 'height', 'loading', 'src', 'srcset', 'title', 'width'],
  iframe: ['allow', 'allowfullscreen', 'class', 'height', 'loading', 'referrerpolicy', 'src', 'title', 'width'],
  ol: ['reversed', 'start', 'type'],
  li: ['value'],
  table: ['border', 'cellpadding', 'cellspacing'],
  td: ['colspan', 'rowspan'],
  th: ['colspan', 'rowspan', 'scope']
};

const CSS_COLOR = /^(?:#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%]+\)|[a-z]+)$/i;
const CSS_LENGTH = /^(?:auto|0|\d+(?:\.\d+)?(?:px|em|rem|%))$/i;

function splitUrlSuffix(value) {
  const match = String(value || '').match(/^([^?#]*)([?#][\s\S]*)?$/);
  return {
    pathname: match ? match[1] : String(value || ''),
    suffix: match?.[2] || ''
  };
}

function normalizeLocalProductImagePath(value) {
  const source = String(value || '').trim();
  if (!source || /^(?:data:|https?:|\/\/|blob:)/i.test(source)) return source;

  const { pathname, suffix } = splitUrlSuffix(source.replace(/\\/g, '/'));
  const uploadMatch = pathname.match(/^(?:(?:\.\.?\/)+|\/)?(uploads\/.*)$/i);
  if (!uploadMatch) return source;

  let decodedUploadPath;
  try {
    decodedUploadPath = decodeURIComponent(`/${uploadMatch[1]}`);
  } catch (error) {
    return '';
  }

  const normalizedPath = path.posix.normalize(decodedUploadPath);
  if (!normalizedPath.startsWith('/uploads/')) return '';
  return `${normalizedPath}${suffix}`;
}

function isSafeDataImage(value) {
  return /^data:image\/(?:avif|gif|jpe?g|png|webp);base64,[a-z0-9+/=\s]+$/i.test(String(value || ''));
}

function normalizeProductImageSource(value) {
  const source = normalizeLocalProductImagePath(value);
  if (/^data:/i.test(source) && !isSafeDataImage(source)) return '';
  return source;
}

function sanitizeProductTabContent(value) {
  return sanitizeHtml(String(value || ''), {
    allowedTags: PRODUCT_CONTENT_TAGS,
    allowedAttributes: PRODUCT_CONTENT_ATTRIBUTES,
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedSchemesByTag: {
      img: ['http', 'https', 'data'],
      iframe: ['https']
    },
    allowedIframeHostnames: [
      'www.youtube.com',
      'youtube.com',
      'www.youtube-nocookie.com',
      'youtube-nocookie.com'
    ],
    allowProtocolRelative: false,
    allowedStyles: {
      '*': {
        'background-color': [CSS_COLOR],
        color: [CSS_COLOR],
        'font-family': [/^[\w\s,"'-]+$/],
        'font-size': [CSS_LENGTH],
        height: [CSS_LENGTH],
        'max-width': [CSS_LENGTH],
        'text-align': [/^(?:center|justify|left|right)$/],
        width: [CSS_LENGTH]
      }
    },
    transformTags: {
      a(tagName, attributes) {
        if (attributes.target === '_blank') {
          const rel = new Set(String(attributes.rel || '').split(/\s+/).filter(Boolean));
          rel.add('noopener');
          rel.add('noreferrer');
          attributes.rel = [...rel].join(' ');
        }
        return { tagName, attribs: attributes };
      },
      img(tagName, attributes) {
        const source = normalizeProductImageSource(attributes.src);
        if (source) attributes.src = source;
        else delete attributes.src;
        attributes.loading = attributes.loading || 'lazy';
        return { tagName, attribs: attributes };
      },
      iframe(tagName, attributes) {
        const video = youtubeVideo(attributes.src);
        if (video) attributes.src = video.embedUrl;
        else delete attributes.src;
        attributes.referrerpolicy = 'strict-origin-when-cross-origin';
        return { tagName, attribs: attributes };
      }
    }
  }).trim();
}

function normalizeCurriculumAccordionContent(value, options = {}) {
  const sanitized = sanitizeProductTabContent(value);
  if (!sanitized) return '';

  const $ = cheerio.load(`<div id="uv-product-tab-content">${sanitized}</div>`, {
    decodeEntities: false
  });
  const root = $('#uv-product-tab-content');
  const groupOffset = Number.isInteger(options.groupOffset) && options.groupOffset >= 0
    ? options.groupOffset
    : 0;
  let groupIndex = 0;

  root.find('.panel-group').each((unusedIndex, groupElement) => {
    const group = $(groupElement);
    const panels = group.find('.panel').filter((unusedPanelIndex, panelElement) => (
      $(panelElement).parents('.panel-group').first().get(0) === groupElement
    )).toArray();
    const structures = panels.map((panelElement) => {
      const panel = $(panelElement);
      return {
        panel,
        trigger: panel.find('.panel-heading .panel-title a').filter((unusedTriggerIndex, triggerElement) => (
          $(triggerElement).parents('.panel').first().get(0) === panelElement
        )).first(),
        collapse: panel.find('.panel-collapse').filter((unusedCollapseIndex, collapseElement) => (
          $(collapseElement).parents('.panel').first().get(0) === panelElement
        )).first()
      };
    }).filter(({ trigger, collapse }) => trigger.length && collapse.length);

    const pairedTriggers = new Set(structures.map(({ trigger }) => trigger.get(0)));
    const pairedCollapses = new Set(structures.map(({ collapse }) => collapse.get(0)));
    const unpairedTriggers = group.find('.panel-title a').filter((unusedTriggerIndex, triggerElement) => (
      $(triggerElement).parents('.panel-group').first().get(0) === groupElement
      && !pairedTriggers.has(triggerElement)
    )).toArray();
    const unpairedCollapses = group.find('.panel-collapse').filter((unusedCollapseIndex, collapseElement) => (
      $(collapseElement).parents('.panel-group').first().get(0) === groupElement
      && !pairedCollapses.has(collapseElement)
    )).toArray();

    if (unpairedTriggers.length && unpairedTriggers.length === unpairedCollapses.length) {
      unpairedTriggers.forEach((triggerElement, index) => {
        structures.push({
          trigger: $(triggerElement),
          collapse: $(unpairedCollapses[index])
        });
      });
    }

    if (!structures.length) return;

    groupIndex += 1;
    const groupId = `uv-curriculum-accordion-${groupOffset + groupIndex}`;
    group.attr('id', groupId);

    structures.forEach(({ trigger, collapse }, panelIndex) => {
      const position = panelIndex + 1;
      const triggerId = `${groupId}-trigger-${position}`;
      const panelId = `${groupId}-panel-${position}`;
      const isOpen = collapse.hasClass('in');
      const triggerClasses = String(trigger.attr('class') || '')
        .split(/\s+/)
        .filter((className) => className && className !== 'collapsed');
      if (!isOpen) triggerClasses.push('collapsed');

      trigger.removeAttr('class id data-toggle data-parent href role aria-controls aria-expanded target');
      trigger.attr({
        ...(triggerClasses.length ? { class: triggerClasses.join(' ') } : {}),
        id: triggerId,
        'data-toggle': 'collapse',
        'data-parent': `#${groupId}`,
        href: `#${panelId}`,
        role: 'button',
        'aria-controls': panelId,
        'aria-expanded': isOpen ? 'true' : 'false'
      });

      collapse.attr({
        id: panelId,
        role: 'region',
        'aria-labelledby': triggerId
      });
    });

    group.find('.panel-title a[href^="#"]').each((unusedTriggerIndex, triggerElement) => {
      const trigger = $(triggerElement);
      if (!/^#uv-curriculum-accordion-\d+-panel-\d+$/.test(trigger.attr('href') || '')) {
        trigger.removeAttr('href data-toggle data-parent role aria-controls aria-expanded');
      }
    });
  });

  return root.html().trim();
}

function hasMeaningfulProductTabContent(value) {
  const sanitized = sanitizeProductTabContent(value);
  if (!sanitized) return false;

  const $ = cheerio.load(`<div id="uv-product-tab-content">${sanitized}</div>`, {
    decodeEntities: false
  });
  const root = $('#uv-product-tab-content');
  const text = root.text().replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();

  return Boolean(text || root.find('img[src], iframe[src]').length);
}

module.exports = {
  hasMeaningfulProductTabContent,
  normalizeCurriculumAccordionContent,
  normalizeLocalProductImagePath,
  normalizeProductImageSource,
  sanitizeProductTabContent
};
