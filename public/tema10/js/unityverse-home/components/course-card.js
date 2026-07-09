(function(window) {
  var components = window.UnityverseHome.Components;
  var utils = components.utils;

  components.courseCard = function courseCard(props) {
    if (props.isSkeleton) {
      return '<article class="uv-course-card uv-course-card--skeleton" aria-hidden="true">' +
        '<div class="uv-course-card__image"></div>' +
        '<div class="uv-course-card__body">' +
          '<span></span><strong></strong><p></p><small></small><em></em>' +
        '</div>' +
      '</article>';
    }

    if (window.UnityverseCourses && typeof window.UnityverseCourses.createCourseCard === 'function') {
      return window.UnityverseCourses.createCourseCard({
        title: props.title,
        slug: props.slug,
        summary: props.summary,
        image: props.image,
        href: props.href,
        category: props.category,
        format: props.format,
        price: props.price,
        isStajGarantili: props.isStajGarantili
      });
    }

    return '';
  };
})(window);
