(function initializeBlogDetailGalleries() {
  'use strict';

  function start() {
    if (typeof window.Swiper !== 'function') return;

    var reduceMotion = window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    document.querySelectorAll('[data-blog-gallery-slider]').forEach(function setup(slider) {
      if (slider.swiper) return;

      var gallery = slider.closest('.uv-blog-gallery');
      var slideCount = slider.querySelectorAll('.swiper-slide').length;
      if (!gallery || slideCount < 2) return;

      var nextButton = gallery.querySelector('.uv-blog-gallery__nav--next');
      var previousButton = gallery.querySelector('.uv-blog-gallery__nav--prev');
      var pagination = gallery.querySelector('.uv-blog-gallery__pagination');

      new window.Swiper(slider, {
        slidesPerView: 1,
        spaceBetween: 16,
        speed: reduceMotion ? 0 : 650,
        loop: slideCount > 3,
        watchOverflow: true,
        centerInsufficientSlides: true,
        observer: true,
        observeParents: true,
        autoplay: reduceMotion ? false : {
          delay: 3500,
          disableOnInteraction: false,
          pauseOnMouseEnter: true
        },
        navigation: {
          nextEl: nextButton,
          prevEl: previousButton
        },
        pagination: {
          el: pagination,
          clickable: true
        },
        keyboard: {
          enabled: true,
          onlyInViewport: true
        },
        a11y: {
          enabled: true,
          prevSlideMessage: 'Önceki görsel',
          nextSlideMessage: 'Sonraki görsel',
          firstSlideMessage: 'İlk görsel',
          lastSlideMessage: 'Son görsel',
          paginationBulletMessage: '{{index}}. görsele git'
        },
        breakpoints: {
          640: {
            slidesPerView: 2,
            spaceBetween: 18
          },
          1024: {
            slidesPerView: 3,
            spaceBetween: 22
          }
        }
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
}());
