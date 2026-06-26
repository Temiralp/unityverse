(function(window) {
  var components = window.UnityverseHome.Components;
  var utils = components.utils;

  components.cta = function cta(props) {
    return '<section class="uv-section uv-cta" aria-labelledby="' + utils.escapeHtml(props.id) + '">' +
      '<div class="uv-shell uv-cta__inner">' +
        '<div>' +
          '<p class="uv-eyebrow">' + utils.escapeHtml(props.eyebrow) + '</p>' +
          '<h2 id="' + utils.escapeHtml(props.id) + '">' + utils.escapeHtml(props.title) + '</h2>' +
          '<p>' + utils.escapeHtml(props.description) + '</p>' +
        '</div>' +
        '<div class="uv-cta__actions">' + utils.htmlList(props.actions, components.button) + '</div>' +
      '</div>' +
    '</section>';
  };
})(window);
