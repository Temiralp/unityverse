(function(window) {
  var components = window.UnityverseHome.Components;
  var utils = components.utils;

  function renderSkeletons(count) {
    var items = [];

    for (var index = 0; index < count; index += 1) {
      items.push(components.courseCard({ isSkeleton: true }));
    }

    return items.join('');
  }

  components.courseGrid = function courseGrid(props) {
    var content = props.loading
      ? renderSkeletons(props.skeletonCount)
      : utils.htmlList(props.items, function(item) {
          return components.courseCard({
            image: item.image,
            title: item.title,
            category: item.category,
            isStajGarantili: item.isStajGarantili,
            format: item.format,
            price: item.price,
            ctaText: item.ctaText,
            href: item.href,
            alt: item.alt,
            badgeText: props.labels.stajBadge,
            quickViewText: props.labels.quickView
          });
        });

    return '<section class="uv-section uv-courses" aria-labelledby="' + utils.escapeHtml(props.id) + '" aria-busy="' + String(Boolean(props.loading)) + '">' +
      '<div class="uv-shell">' +
        components.sectionHeader({
          eyebrow: props.eyebrow,
          title: props.title,
          description: props.description
        }).replace('<h2>', '<h2 id="' + utils.escapeHtml(props.id) + '">') +
        '<div class="uv-course-grid">' + content + '</div>' +
      '</div>' +
    '</section>';
  };
})(window);
