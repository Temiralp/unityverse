(function(window) {
  var namespace = window.UnityverseHome = window.UnityverseHome || {};
  namespace.Components = namespace.Components || {};

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function attrs(attributes) {
    return Object.keys(attributes || {}).reduce(function(output, key) {
      var value = attributes[key];

      if (value === false || value == null) {
        return output;
      }

      if (value === true) {
        return output + ' ' + key;
      }

      return output + ' ' + key + '="' + escapeHtml(value) + '"';
    }, '');
  }

  function htmlList(items, renderer) {
    return (items || []).map(renderer).join('');
  }

  namespace.Components.utils = {
    attrs: attrs,
    escapeHtml: escapeHtml,
    htmlList: htmlList
  };
})(window);
