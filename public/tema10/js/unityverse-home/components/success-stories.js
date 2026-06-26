(function(window, document) {
  var components = window.UnityverseHome.Components;
  var utils = components.utils;

  components.successStories = function successStories(props) {
    return '<section class="uv-section uv-success-stories" aria-labelledby="' + utils.escapeHtml(props.id) + '">' +
      '<div class="uv-shell">' +
        '<div class="uv-slider-head">' +
          components.sectionHeader({
            eyebrow: props.eyebrow,
            title: props.title,
            description: props.description
          }).replace('<h2>', '<h2 id="' + utils.escapeHtml(props.id) + '">') +
          '<div class="uv-slider-controls">' +
            '<button type="button" data-uv-slider-prev aria-label="' + utils.escapeHtml(props.controls.prevLabel) + '"></button>' +
            '<button type="button" data-uv-slider-next aria-label="' + utils.escapeHtml(props.controls.nextLabel) + '"></button>' +
          '</div>' +
        '</div>' +
        '<div class="uv-slider" data-uv-slider data-autoplay="' + String(Boolean(props.autoplay.enabled)) + '" data-interval="' + utils.escapeHtml(props.autoplay.interval) + '">' +
          '<div class="uv-slider__track uv-success-stories__track">' + utils.htmlList(props.items, function(item) {
            return '<article class="uv-success-card">' +
              '<div class="uv-success-card__photo" aria-hidden="true">' + utils.escapeHtml(item.initials) + '</div>' +
              '<div class="uv-success-card__body">' +
                '<p class="uv-success-card__company">' + utils.escapeHtml(item.company) + '</p>' +
                '<h3>' + utils.escapeHtml(item.name) + '</h3>' +
                '<p>' + utils.escapeHtml(item.story) + '</p>' +
                '<a href="' + utils.escapeHtml(item.href) + '">' + utils.escapeHtml(props.labels.readMore) + '</a>' +
              '</div>' +
            '</article>';
          }) + '</div>' +
        '</div>' +
      '</div>' +
    '</section>';
  };

  components.initSliders = function initSliders(root) {
    var sliders = root.querySelectorAll('[data-uv-slider]');

    Array.prototype.forEach.call(sliders, function(slider) {
      var section = slider.closest('.uv-section');
      var track = slider.querySelector('.uv-slider__track');
      var prev = section ? section.querySelector('[data-uv-slider-prev]') : null;
      var next = section ? section.querySelector('[data-uv-slider-next]') : null;
      var autoplay = slider.getAttribute('data-autoplay') === 'true';
      var interval = Number(slider.getAttribute('data-interval')) || 4500;
      var timer = null;

      if (!track) {
        return;
      }

      function getStep() {
        var item = track.children[0];
        var styles = window.getComputedStyle(track);
        var gap = parseFloat(styles.columnGap || styles.gap) || 0;
        return item ? item.getBoundingClientRect().width + gap : track.clientWidth;
      }

      function move(direction) {
        track.scrollBy({
          left: getStep() * direction,
          behavior: 'smooth'
        });
      }

      function stop() {
        if (timer) {
          window.clearInterval(timer);
          timer = null;
        }
      }

      function start() {
        if (!autoplay || timer) {
          return;
        }

        timer = window.setInterval(function() {
          var maxScroll = track.scrollWidth - track.clientWidth - 4;

          if (track.scrollLeft >= maxScroll) {
            track.scrollTo({ left: 0, behavior: 'smooth' });
            return;
          }

          move(1);
        }, interval);
      }

      if (prev) {
        prev.addEventListener('click', function() {
          stop();
          move(-1);
          start();
        });
      }

      if (next) {
        next.addEventListener('click', function() {
          stop();
          move(1);
          start();
        });
      }

      slider.addEventListener('mouseenter', stop);
      slider.addEventListener('mouseleave', start);
      slider.addEventListener('focusin', stop);
      slider.addEventListener('focusout', start);
      slider.addEventListener('touchstart', stop, { passive: true });
      slider.addEventListener('touchend', start, { passive: true });

      start();
    });
  };
})(window, document);
