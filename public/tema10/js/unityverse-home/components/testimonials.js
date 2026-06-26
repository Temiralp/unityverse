(function(window) {
  var components = window.UnityverseHome.Components;
  var utils = components.utils;

  components.testimonials = function testimonials(props) {
    return '<section class="uv-section uv-testimonials" aria-labelledby="' + utils.escapeHtml(props.id) + '">' +
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
        '<div class="uv-slider__track uv-testimonial-grid">' + utils.htmlList(props.items, function(item) {
          var stars = '';
          for (var index = 0; index < item.rating; index += 1) {
            stars += '<span aria-hidden="true">' + utils.escapeHtml(props.labels.starSymbol) + '</span>';
          }

          return '<figure class="uv-testimonial">' +
            '<div class="uv-testimonial__rating" aria-label="' + utils.escapeHtml(item.rating + ' ' + props.labels.ratingSuffix) + '">' + stars + '</div>' +
            '<blockquote>' + utils.escapeHtml(item.text) + '</blockquote>' +
            '<figcaption><strong>' + utils.escapeHtml(item.name) + '</strong><span>' + utils.escapeHtml(item.course) + '</span></figcaption>' +
          '</figure>';
        }) + '</div>' +
        '</div>' +
      '</div>' +
    '</section>';
  };
})(window);
