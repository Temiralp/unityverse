const cheerio = require('cheerio');

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
  'youtu.be',
  'www.youtu.be'
]);

const SAFE_QUERY_PARAMETERS = new Set([
  'autoplay',
  'controls',
  'end',
  'index',
  'list',
  'loop',
  'mute',
  'playlist',
  'rel',
  'start'
]);

const VIDEO_REPLACEMENTS = new Map([
  ['8SrtxJcFt4s', 'kV0emc-Kl58'],
  ['5l6sGjPf7Wo', 'bIqCsYUJXv4']
]);

function parseUrl(value) {
  const input = String(value || '').trim();
  if (!input) return null;

  try {
    return new URL(input.startsWith('//') ? `https:${input}` : input);
  } catch (error) {
    return null;
  }
}

function validVideoId(value) {
  const id = String(value || '').trim();
  return /^[a-zA-Z0-9_-]{6,64}$/.test(id) ? id : null;
}

function pageOrigin(value) {
  const url = parseUrl(value);
  if (!url || !['http:', 'https:'].includes(url.protocol)) return null;
  return url.origin;
}

function embedUrlWithOrigin(embedUrl, value) {
  const origin = pageOrigin(value);
  if (!origin) return embedUrl;

  const url = new URL(embedUrl);
  url.searchParams.set('origin', origin);
  return url.toString();
}

function youtubeVideo(value) {
  const url = parseUrl(value);
  if (!url || url.protocol !== 'https:' || !YOUTUBE_HOSTS.has(url.hostname.toLowerCase())) {
    return null;
  }

  const parts = url.pathname.split('/').filter(Boolean);
  let id = null;

  if (url.hostname.toLowerCase().endsWith('youtu.be')) {
    id = parts[0];
  } else if (parts[0] === 'embed' || parts[0] === 'shorts') {
    id = parts[1];
  } else if (url.pathname === '/watch') {
    id = url.searchParams.get('v');
  }

  id = validVideoId(id);
  if (!id) return null;
  id = VIDEO_REPLACEMENTS.get(id) || id;

  const query = new URLSearchParams();
  url.searchParams.forEach((parameterValue, parameterName) => {
    if (SAFE_QUERY_PARAMETERS.has(parameterName)) {
      query.append(parameterName, parameterValue);
    }
  });

  return {
    id,
    embedUrl: `https://www.youtube-nocookie.com/embed/${id}${query.size ? `?${query}` : ''}`
  };
}

function loadFragment(html) {
  return cheerio.load(`<div data-youtube-content-root>${String(html || '')}</div>`, {
    decodeEntities: false
  });
}

function rootHtml($) {
  return $('[data-youtube-content-root]').html() || '';
}

function normalizeYoutubeEmbeds(html, origin) {
  const content = String(html || '');
  if (!/<iframe\b/i.test(content)) return content;

  const $ = loadFragment(content);
  let changed = false;

  $('iframe').each((_, iframe) => {
    const element = $(iframe);
    const video = youtubeVideo(element.attr('src'));
    if (!video) return;

    changed = true;
    element.attr({
      src: embedUrlWithOrigin(video.embedUrl, origin),
      title: element.attr('title') || 'YouTube video player',
      loading: element.attr('loading') || 'lazy',
      referrerpolicy: 'strict-origin-when-cross-origin',
      allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
      allowfullscreen: ''
    });
    element.removeAttr('width height frameborder style');
    element.addClass('uv-legacy-youtube-iframe');

    if (!element.parent().hasClass('uv-legacy-youtube-embed')) {
      element.wrap('<span class="uv-legacy-youtube-embed"></span>');
    }
  });

  return changed ? rootHtml($) : content;
}

function normalizeYoutubeEmbedsForEditor(html, origin) {
  const content = String(html || '');
  if (!/<iframe\b/i.test(content)) return content;

  const $ = loadFragment(content);
  let changed = false;

  $('iframe').each((_, iframe) => {
    const element = $(iframe);
    const video = youtubeVideo(element.attr('src'));
    if (!video) return;

    changed = true;
    element.attr({
      src: embedUrlWithOrigin(video.embedUrl, origin),
      title: element.attr('title') || 'YouTube video player',
      loading: element.attr('loading') || 'lazy',
      referrerpolicy: 'strict-origin-when-cross-origin',
      allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
      allowfullscreen: ''
    });
  });

  return changed ? rootHtml($) : content;
}

function youtubeEmbeds(html, origin) {
  const $ = loadFragment(normalizeYoutubeEmbeds(html, origin));
  const embeds = [];

  $('iframe').each((_, iframe) => {
    const element = $(iframe);
    const video = youtubeVideo(element.attr('src'));
    if (!video) return;

    const wrapper = element.parent().hasClass('uv-legacy-youtube-embed')
      ? element.parent()
      : element;

    embeds.push({
      id: video.id,
      html: $.html(wrapper)
    });
  });

  return embeds;
}

function fallbackTabHtml(aggregateContent, sourceTabId) {
  const content = String(aggregateContent || '');
  if (!content || !sourceTabId) return '';

  const $ = loadFragment(content);
  const section = $(`[data-source-tab="${sourceTabId}"]`).first();
  return section.length ? section.html() || '' : '';
}

function prepareLegacyTabContent(tabHtml, aggregateContent, sourceTabId, origin) {
  const normalized = normalizeYoutubeEmbeds(tabHtml, origin);
  const existingIds = new Set(youtubeEmbeds(normalized, origin).map((embed) => embed.id));
  const missingEmbeds = youtubeEmbeds(fallbackTabHtml(aggregateContent, sourceTabId), origin)
    .filter((embed) => !existingIds.has(embed.id));

  if (!missingEmbeds.length) return normalized;

  return `${normalized}\n<div class="uv-legacy-youtube-list">${missingEmbeds.map((embed) => embed.html).join('')}</div>`;
}

module.exports = {
  normalizeYoutubeEmbeds,
  normalizeYoutubeEmbedsForEditor,
  prepareLegacyTabContent,
  youtubeVideo
};
