(function(window) {
  var components = window.UnityverseHome.Components;
  var utils = components.utils;

  components.button = function button(props) {
    var className = props.variant ? 'uv-button uv-button--' + props.variant : 'uv-button';
    var icon = props.icon ? '<span class="uv-button__icon" aria-hidden="true">' + utils.escapeHtml(props.icon) + '</span>' : '';

    return '<a' + utils.attrs({
      class: className,
      href: props.href,
      'aria-label': props.ariaLabel || props.label
    }) + '>' + icon + '<span>' + utils.escapeHtml(props.label) + '</span></a>';
  };
})(window);
