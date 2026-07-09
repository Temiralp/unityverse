(function(window) {
  var components = window.UnityverseHome.Components;
  var utils = components.utils;

  components.valueGrid = function valueGrid(props) {
    return '<section class="uv-section uv-values" aria-labelledby="' + utils.escapeHtml(props.id) + '">' +
      '<div class="uv-shell">' +
        components.sectionHeader({
          eyebrow: props.eyebrow,
          title: props.title,
          description: props.description
        }).replace('<h2>', '<h2 id="' + utils.escapeHtml(props.id) + '">') +
        '<div class="uv-value-grid">' + utils.htmlList(props.items, function(item) {
          return '<article class="uv-value-card">' +
            '<span aria-hidden="true">' + utils.escapeHtml(item.icon) + '</span>' +
            '<h3>' + utils.escapeHtml(item.title) + '</h3>' +
            '<p>' + utils.escapeHtml(item.description) + '</p>' +
          '</article>';
        }) + '</div>' +
      '</div>' +
    '</section>';
  };
})(window);
