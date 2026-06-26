(function(window) {
  var components = window.UnityverseHome.Components;
  var utils = components.utils;

  components.hero = function hero(props) {
    return '<section class="uv-hero" aria-labelledby="uv-hero-title">' +
      '<div class="uv-shell uv-hero__grid">' +
        '<div class="uv-hero__copy">' +
          '<p class="uv-eyebrow">' + utils.escapeHtml(props.eyebrow) + '</p>' +
          '<h1 id="uv-hero-title">' + utils.escapeHtml(props.title) + '</h1>' +
          '<p class="uv-hero__lead">' + utils.escapeHtml(props.lead) + '</p>' +
          '<div class="uv-hero__actions">' + utils.htmlList(props.actions, components.button) + '</div>' +
          '<p class="uv-hero__proof">' + utils.escapeHtml(props.socialProof) + '</p>' +
        '</div>' +
        '<div class="uv-hero__visual" aria-label="' + utils.escapeHtml(props.visual.ariaLabel) + '">' +
          '<div class="uv-hero__placeholder" aria-hidden="true">' +
            '<span class="uv-hero__shape uv-hero__shape--primary"></span>' +
            '<span class="uv-hero__shape uv-hero__shape--accent"></span>' +
            '<span class="uv-hero__shape uv-hero__shape--line"></span>' +
            '<div class="uv-hero__screen">' +
              utils.htmlList(props.visual.lines, function(line) {
                return '<span>' + utils.escapeHtml(line) + '</span>';
              }) +
            '</div>' +
          '</div>' +
          '<div class="uv-hero__panel">' +
            '<span>' + utils.escapeHtml(props.visual.kicker) + '</span>' +
            '<strong>' + utils.escapeHtml(props.visual.title) + '</strong>' +
            '<small>' + utils.escapeHtml(props.visual.caption) + '</small>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</section>';
  };
})(window);
