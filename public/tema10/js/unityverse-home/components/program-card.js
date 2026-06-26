(function(window) {
  var components = window.UnityverseHome.Components;
  var utils = components.utils;

  components.programCard = function programCard(props) {
    return '<article class="uv-program-card">' +
      '<a class="uv-program-card__image" href="' + utils.escapeHtml(props.href) + '">' +
        '<img src="' + utils.escapeHtml(props.image) + '" alt="' + utils.escapeHtml(props.alt) + '" loading="lazy" decoding="async">' +
      '</a>' +
      '<div class="uv-program-card__body">' +
        '<div class="uv-program-card__meta">' + utils.htmlList(props.badges, function(badge) {
          return '<span>' + utils.escapeHtml(badge) + '</span>';
        }) + '</div>' +
        '<h3><a href="' + utils.escapeHtml(props.href) + '">' + utils.escapeHtml(props.title) + '</a></h3>' +
        '<p>' + utils.escapeHtml(props.description) + '</p>' +
        '<ul>' + utils.htmlList(props.features, function(feature) {
          return '<li>' + utils.escapeHtml(feature) + '</li>';
        }) + '</ul>' +
        components.button(props.action) +
      '</div>' +
    '</article>';
  };
})(window);
