(function(window) {
  var components = window.UnityverseHome.Components;
  var utils = components.utils;

  components.process = function process(props) {
    return '<section class="uv-section uv-process" aria-labelledby="' + utils.escapeHtml(props.id) + '">' +
      '<div class="uv-shell">' +
        components.sectionHeader({
          eyebrow: props.eyebrow,
          title: props.title,
          description: props.description
        }).replace('<h2>', '<h2 id="' + utils.escapeHtml(props.id) + '">') +
        '<ol class="uv-process__list">' + utils.htmlList(props.steps, function(step) {
          return '<li>' +
            '<span>' + utils.escapeHtml(step.number) + '</span>' +
            '<div><h3>' + utils.escapeHtml(step.title) + '</h3><p>' + utils.escapeHtml(step.description) + '</p></div>' +
          '</li>';
        }) + '</ol>' +
      '</div>' +
    '</section>';
  };
})(window);
