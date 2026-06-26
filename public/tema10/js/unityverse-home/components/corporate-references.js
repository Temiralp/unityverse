(function(window) {
  var components = window.UnityverseHome.Components;
  var utils = components.utils;

  components.corporateReferences = function corporateReferences(props) {
    function renderLogo(item, isDuplicate) {
      return '<a class="uv-reference-logo" href="' + utils.escapeHtml(item.href) + '" aria-label="' + utils.escapeHtml(item.ariaLabel) + '">' +
        '<span>' + utils.escapeHtml(item.name) + '</span>' +
      '</a>';
    }

    var logoItems = utils.htmlList(props.items, function(item) {
      return renderLogo(item, false);
    });
    var duplicateLogoItems = '<div class="uv-reference-marquee__duplicate" aria-hidden="true">' + utils.htmlList(props.items, function(item) {
      return renderLogo(item, true).replace('<a ', '<a tabindex="-1" ');
    }) + '</div>';

    return '<section class="uv-section uv-references" aria-labelledby="' + utils.escapeHtml(props.id) + '">' +
      '<div class="uv-shell">' +
        components.sectionHeader({
          eyebrow: props.eyebrow,
          title: props.title,
          description: props.description
        }).replace('<h2>', '<h2 id="' + utils.escapeHtml(props.id) + '">') +
      '</div>' +
      '<div class="uv-reference-marquee" aria-label="' + utils.escapeHtml(props.marqueeLabel) + '">' +
        '<div class="uv-reference-marquee__track"><div class="uv-reference-marquee__set">' + logoItems + '</div>' + duplicateLogoItems + '</div>' +
      '</div>' +
    '</section>';
  };
})(window);
