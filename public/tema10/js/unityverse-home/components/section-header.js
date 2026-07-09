(function(window) {
  var components = window.UnityverseHome.Components;
  var utils = components.utils;

  components.sectionHeader = function sectionHeader(props) {
    return '<div class="uv-section-header">' +
      (props.eyebrow ? '<p class="uv-eyebrow">' + utils.escapeHtml(props.eyebrow) + '</p>' : '') +
      '<h2>' + utils.escapeHtml(props.title) + '</h2>' +
      (props.description ? '<p>' + utils.escapeHtml(props.description) + '</p>' : '') +
    '</div>';
  };
})(window);
