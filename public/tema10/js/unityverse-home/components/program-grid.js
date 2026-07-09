(function(window) {
  var components = window.UnityverseHome.Components;
  var utils = components.utils;

  components.programGrid = function programGrid(props) {
    return '<section class="uv-section uv-programs" aria-labelledby="' + utils.escapeHtml(props.id) + '">' +
      '<div class="uv-shell">' +
        components.sectionHeader({
          eyebrow: props.eyebrow,
          title: props.title,
          description: props.description
        }).replace('<h2>', '<h2 id="' + utils.escapeHtml(props.id) + '">') +
        '<div class="uv-program-grid">' + utils.htmlList(props.items, components.programCard) + '</div>' +
      '</div>' +
    '</section>';
  };
})(window);
