(function () {
  'use strict';

  var STYLE_ID = 'uv-course-overview-styles';
  var OVERVIEW_CLASS = 'uv-course-overview';
  var PROSE_HEADING_MIN_LENGTH = 160;
  var ORPHAN_TEXT_MIN_LENGTH = 40;
  var INLINE_TEXT_TAGS = { B: true, EM: true, SPAN: true, STRONG: true };
  var TEXT_CONTAINER_TAGS = {
    A: true,
    BLOCKQUOTE: true,
    BUTTON: true,
    FIGCAPTION: true,
    H1: true,
    H2: true,
    H3: true,
    H4: true,
    H5: true,
    H6: true,
    LI: true,
    P: true,
    TD: true,
    TH: true
  };

  function normalizedText(value) {
    return String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;

    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '.', OVERVIEW_CLASS, '{container-type:inline-size;width:100%;max-width:none;margin:0;padding:clamp(18px,3vw,36px);color:#2f3441;text-align:left;overflow-wrap:anywhere;}',
      '.', OVERVIEW_CLASS, ' *{box-sizing:border-box;max-width:100%;}',
      '.', OVERVIEW_CLASS, ' h1,.', OVERVIEW_CLASS, ' h2,.', OVERVIEW_CLASS, ' h3,.', OVERVIEW_CLASS, ' h4,.', OVERVIEW_CLASS, ' h5,.', OVERVIEW_CLASS, ' h6{clear:both;max-width:860px;margin:clamp(26px,4vw,44px) 0 14px;color:#11145d;font-family:inherit;font-weight:700;line-height:1.3;text-align:left!important;}',
      '.', OVERVIEW_CLASS, ' h1:first-child,.', OVERVIEW_CLASS, ' h2:first-child,.', OVERVIEW_CLASS, ' h3:first-child{margin-top:0;}',
      '.', OVERVIEW_CLASS, ' h1{font-size:clamp(23px,2.6vw,30px);}',
      '.', OVERVIEW_CLASS, ' h2{font-size:clamp(20px,2.2vw,26px);}',
      '.', OVERVIEW_CLASS, ' h3{font-size:clamp(18px,1.8vw,22px);}',
      '.', OVERVIEW_CLASS, ' h4,.', OVERVIEW_CLASS, ' h5,.', OVERVIEW_CLASS, ' h6{font-size:clamp(16px,1.5vw,19px);}',
      '.', OVERVIEW_CLASS, ' .uv-overview-prose-heading{max-width:860px;margin:0 0 18px!important;color:#2f3441!important;font-size:clamp(14.5px,1.2vw,16.5px)!important;font-weight:500!important;line-height:1.72!important;text-align:left!important;}',
      '.', OVERVIEW_CLASS, ' .uv-overview-prose-heading *{font-size:inherit!important;font-weight:inherit!important;line-height:inherit!important;text-align:inherit!important;}',
      '.', OVERVIEW_CLASS, ' .uv-overview-prose-heading strong,.', OVERVIEW_CLASS, ' .uv-overview-prose-heading b{font-weight:700!important;}',
      '.', OVERVIEW_CLASS, ' p,.', OVERVIEW_CLASS, ' li{font-size:clamp(14.5px,1.2vw,16.5px);line-height:1.72;text-align:left!important;}',
      '.', OVERVIEW_CLASS, ' p{max-width:860px;margin:0 0 16px;}',
      '.', OVERVIEW_CLASS, ' .uv-overview-orphan-text-block{display:block;width:min(100%,860px);margin-left:0!important;margin-right:auto!important;}',
      '.', OVERVIEW_CLASS, ' ul,.', OVERVIEW_CLASS, ' ol{max-width:860px;margin:12px 0 20px;padding-left:clamp(22px,4vw,36px);text-align:left!important;}',
      '.', OVERVIEW_CLASS, ' ul+ul,.', OVERVIEW_CLASS, ' ol+ol{margin-top:-12px;}',
      '.', OVERVIEW_CLASS, ' li+li{margin-top:7px;}',
      '.', OVERVIEW_CLASS, ' a{word-break:break-word;}',
      '.', OVERVIEW_CLASS, ' br+br{display:none;}',
      '.', OVERVIEW_CLASS, ' .uv-overview-empty{display:none!important;}',
      '.', OVERVIEW_CLASS, ' .uv-overview-image{display:block;float:none!important;width:auto!important;max-width:min(100%,600px)!important;max-height:min(72vh,720px);height:auto!important;margin:22px auto;border-radius:12px;object-fit:contain;}',
      '.', OVERVIEW_CLASS, ' a.uv-overview-image-link{display:block;width:max-content;max-width:100%;margin:22px auto;}',
      '.', OVERVIEW_CLASS, ' a.uv-overview-image-link .uv-overview-image{margin:0;}',
      '.', OVERVIEW_CLASS, ' .uv-overview-centered-media{position:relative;left:calc(50cqw - 50%);}',
      '.', OVERVIEW_CLASS, ' .uv-overview-gallery-block{clear:both;margin:clamp(30px,5vw,56px) 0;}',
      '.', OVERVIEW_CLASS, ' .uv-overview-gallery-title{max-width:none;margin:0 0 18px;text-align:center!important;}',
      '.', OVERVIEW_CLASS, ' .uv-overview-gallery{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:clamp(12px,2vw,22px);align-items:stretch;}',
      '.', OVERVIEW_CLASS, ' .uv-overview-gallery-item{display:flex;align-items:center;justify-content:center;min-width:0;margin:0;padding:10px;overflow:hidden;border:1px solid #e6e8f0;border-radius:14px;background:#f8f9fc;}',
      '.', OVERVIEW_CLASS, ' .uv-overview-gallery-item>a{display:flex;width:100%;height:100%;margin:0;align-items:center;justify-content:center;}',
      '.', OVERVIEW_CLASS, ' .uv-overview-gallery-item .uv-overview-centered-media{position:static;left:auto;}',
      '.', OVERVIEW_CLASS, ' .uv-overview-gallery-item .uv-overview-image{width:100%!important;height:clamp(220px,32vw,440px)!important;margin:0;object-fit:contain;border-radius:9px;}',
      '.', OVERVIEW_CLASS, ' .uv-overview-table{width:100%;margin:24px 0;overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid #e6e8f0;border-radius:10px;}',
      '.', OVERVIEW_CLASS, ' .uv-overview-table table{width:100%!important;min-width:640px;margin:0;border-collapse:collapse;}',
      '.', OVERVIEW_CLASS, ' .uv-overview-table th,.', OVERVIEW_CLASS, ' .uv-overview-table td{padding:10px 12px;vertical-align:top;}',
      '.', OVERVIEW_CLASS, ' .uv-overview-embed{position:relative;width:100%;margin:26px auto;padding-top:56.25%;overflow:hidden;border-radius:12px;background:#111;}',
      '.', OVERVIEW_CLASS, ' .uv-overview-embed iframe{position:absolute;inset:0;width:100%!important;height:100%!important;border:0;}',
      '@media (max-width:767px){.', OVERVIEW_CLASS, '{padding:18px 12px;}.', OVERVIEW_CLASS, ' .uv-overview-gallery{grid-template-columns:1fr;}.', OVERVIEW_CLASS, ' .uv-overview-gallery-item .uv-overview-image{height:auto!important;max-height:520px;}.', OVERVIEW_CLASS, ' h1,.', OVERVIEW_CLASS, ' h2,.', OVERVIEW_CLASS, ' h3,.', OVERVIEW_CLASS, ' h4,.', OVERVIEW_CLASS, ' h5,.', OVERVIEW_CLASS, ' h6{text-align:left;}.', OVERVIEW_CLASS, ' p,.', OVERVIEW_CLASS, ' li{line-height:1.65;}}'
    ].join('');

    document.head.appendChild(style);
  }

  function normalizeImages(overview) {
    Array.prototype.forEach.call(overview.querySelectorAll('img'), function (image) {
      image.classList.add('uv-overview-image');
      image.loading = image.loading || 'lazy';
      image.decoding = image.decoding || 'async';

      var link = image.parentElement;
      if (link && link.tagName === 'A') {
        link.classList.add('uv-overview-image-link');
        link.classList.add('uv-overview-centered-media');
        return;
      }

      image.classList.add('uv-overview-centered-media');
    });
  }

  function normalizeProseHeadings(overview) {
    Array.prototype.forEach.call(
      overview.querySelectorAll('h1,h2,h3,h4,h5,h6'),
      function (heading) {
        if (normalizedText(heading.textContent).length < PROSE_HEADING_MIN_LENGTH) return;
        heading.classList.add('uv-overview-prose-heading');
      }
    );
  }

  function normalizeOrphanTextBlocks(overview) {
    Array.prototype.forEach.call(
      overview.querySelectorAll('span,strong,b,em'),
      function (element) {
        if (normalizedText(element.textContent).length < ORPHAN_TEXT_MIN_LENGTH) return;
        if (element.querySelector('img,iframe,video,table')) return;

        var ancestor = element.parentElement;
        while (ancestor && ancestor !== overview) {
          if (INLINE_TEXT_TAGS[ancestor.tagName] || TEXT_CONTAINER_TAGS[ancestor.tagName]) return;
          ancestor = ancestor.parentElement;
        }

        element.classList.add('uv-overview-orphan-text-block');
      }
    );
  }

  function normalizeTables(overview) {
    Array.prototype.forEach.call(overview.querySelectorAll('table'), function (table) {
      if (table.parentElement && table.parentElement.classList.contains('uv-overview-table')) return;

      var wrapper = document.createElement('div');
      wrapper.className = 'uv-overview-table';
      table.parentNode.insertBefore(wrapper, table);
      wrapper.appendChild(table);
    });
  }

  function normalizeEmbeds(overview) {
    Array.prototype.forEach.call(overview.querySelectorAll('iframe'), function (iframe) {
      if (iframe.closest('.uv-legacy-youtube-embed, .uv-overview-embed')) return;

      var wrapper = document.createElement('div');
      wrapper.className = 'uv-overview-embed';
      iframe.parentNode.insertBefore(wrapper, iframe);
      wrapper.appendChild(iframe);
    });
  }

  function collapseRepeatedBreaks(overview) {
    Array.prototype.forEach.call(overview.querySelectorAll('br'), function (lineBreak) {
      var previous = lineBreak.previousSibling;
      while (previous && previous.nodeType === 3 && !normalizedText(previous.nodeValue)) {
        previous = previous.previousSibling;
      }

      if (previous && previous.nodeType === 1 && previous.tagName === 'BR') {
        lineBreak.remove();
      }
    });
  }

  function normalizeGalleryBlocks(overview) {
    var galleryLabel = /(eğitimimizden|kursumuzdan|dersimizden|atölyemizden).*(kareler|görseller)|galeri|fotoğraflar/i;
    var candidates = Array.prototype.slice.call(
      overview.querySelectorAll('h1,h2,h3,h4,h5,h6,p,div')
    ).reverse();

    candidates.forEach(function (container) {
      if (!container.isConnected || container.classList.contains('uv-overview-gallery-block')) return;

      var images = Array.prototype.slice.call(container.querySelectorAll('img'));
      var label = normalizedText(container.textContent);
      if (images.length < 3 || label.length > 180 || !galleryLabel.test(label)) return;

      var block = document.createElement('section');
      block.className = 'uv-overview-gallery-block';

      if (label) {
        var title = document.createElement('h3');
        title.className = 'uv-overview-gallery-title';
        title.textContent = label;
        block.appendChild(title);
      }

      var gallery = document.createElement('div');
      gallery.className = 'uv-overview-gallery';

      images.forEach(function (image) {
        var item = document.createElement('figure');
        var movable = image;
        var link = image.parentElement;

        item.className = 'uv-overview-gallery-item';
        if (link && link.tagName === 'A' && link.querySelectorAll('img').length === 1) {
          movable = link;
        }

        item.appendChild(movable);
        gallery.appendChild(item);
      });

      block.appendChild(gallery);
      container.parentNode.insertBefore(block, container);
      container.remove();
    });
  }

  function markEmptyLayoutNodes(overview) {
    Array.prototype.forEach.call(
      overview.querySelectorAll('p,div,h1,h2,h3,h4,h5,h6,span'),
      function (element) {
        if (element.classList.contains('uv-overview-gallery-item')) return;
        if (element.querySelector('img,iframe,video,table')) return;
        if (!normalizedText(element.textContent)) element.classList.add('uv-overview-empty');
      }
    );
  }

  function enhanceCourseOverview() {
    var overview = document.querySelector('[data-course-overview]');
    if (!overview) return;
    if (overview.dataset.courseOverviewReady === 'true') return;

    overview.dataset.courseOverviewReady = 'true';
    overview.classList.add(OVERVIEW_CLASS);
    installStyles();
    normalizeProseHeadings(overview);
    normalizeOrphanTextBlocks(overview);
    normalizeImages(overview);
    normalizeTables(overview);
    normalizeEmbeds(overview);
    collapseRepeatedBreaks(overview);
    normalizeGalleryBlocks(overview);
    markEmptyLayoutNodes(overview);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', enhanceCourseOverview);
  } else {
    enhanceCourseOverview();
  }
})();
