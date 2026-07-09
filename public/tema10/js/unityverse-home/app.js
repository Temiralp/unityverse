(function(window, document) {
  var namespace = window.UnityverseHome || {};
  var components = namespace.Components || {};
  var data = namespace.data;

  function renderHome(root, content) {
    root.innerHTML = [
      components.navbar(content.navbar),
      components.hero(content.hero),
      components.valueGrid(content.values),
      components.courseGrid(content.courses),
      components.process(content.process),
      components.successStories(content.successStories),
      components.testimonials(content.testimonials),
      components.corporateReferences(content.corporateReferences),
      components.cta(content.cta),
      components.footer(content.footer)
    ].join('');
  }

  function init() {
    var root = document.getElementById('unityverse-home-root');

    if (!root || !data) {
      return;
    }

    renderHome(root, data);
    components.initNavbar(root);
    components.initSliders(root);
    components.initFooter(root);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window, document);
