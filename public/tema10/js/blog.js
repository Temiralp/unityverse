(function () {
  'use strict';

  function fallbackCopy(text) {
    var input = document.createElement('textarea');
    input.value = text;
    input.setAttribute('readonly', '');
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    document.body.appendChild(input);
    input.select();

    try {
      document.execCommand('copy');
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(error);
    } finally {
      document.body.removeChild(input);
    }
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }

    return fallbackCopy(text);
  }

  function initShareCopy() {
    var button = document.querySelector('[data-copy-url]');
    var status = document.querySelector('[data-copy-status]');

    if (!button) return;

    button.addEventListener('click', function () {
      var url = button.getAttribute('data-copy-url');
      if (!url) return;

      button.disabled = true;

      copyText(url)
        .then(function () {
          if (status) status.textContent = 'Bağlantı kopyalandı.';
        })
        .catch(function () {
          if (status) status.textContent = 'Bağlantı kopyalanamadı.';
        })
        .finally(function () {
          window.setTimeout(function () {
            button.disabled = false;
          }, 600);
        });
    });
  }

  function initContentImages() {
    var images = document.querySelectorAll('.uv-blog-content img');

    images.forEach(function (image) {
      if (!image.hasAttribute('loading')) image.setAttribute('loading', 'lazy');
      if (!image.hasAttribute('decoding')) image.setAttribute('decoding', 'async');
    });
  }

  try {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        initShareCopy();
        initContentImages();
      });
    } else {
      initShareCopy();
      initContentImages();
    }
  } catch (error) {
    window.console && window.console.warn && window.console.warn('Blog paylaşım modülü başlatılamadı.', error);
  }
}());
