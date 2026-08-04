(function initializeCorporateReferenceSliders() {
  'use strict';

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  document.querySelectorAll('[data-corporate-reference-slider]').forEach((slider) => {
    const track = slider.querySelector('[data-corporate-reference-track]');
    const items = Array.from(slider.querySelectorAll('[data-corporate-reference-item]'));
    const previous = slider.querySelector('[data-corporate-reference-previous]');
    const next = slider.querySelector('[data-corporate-reference-next]');
    const interval = Number(slider.dataset.autoplay) || 3000;
    let index = 0;
    let timer = null;
    let paused = false;

    if (!track || !items.length || !previous || !next) return;

    function visibleCount() {
      const itemWidth = items[0].getBoundingClientRect().width;
      const viewportWidth = track.parentElement.getBoundingClientRect().width;
      return Math.max(1, Math.round(viewportWidth / Math.max(1, itemWidth)));
    }

    function maximumIndex() {
      return Math.max(0, items.length - visibleCount());
    }

    function render() {
      index = Math.min(index, maximumIndex());
      const itemWidth = items[0].getBoundingClientRect().width;
      track.style.transform = `translate3d(${-index * itemWidth}px, 0, 0)`;
      const hasOverflow = maximumIndex() > 0;
      previous.hidden = !hasOverflow;
      next.hidden = !hasOverflow;
    }

    function move(direction) {
      const max = maximumIndex();
      if (!max) return;
      index = direction > 0
        ? (index >= max ? 0 : index + 1)
        : (index <= 0 ? max : index - 1);
      render();
    }

    function stop() {
      if (timer) window.clearInterval(timer);
      timer = null;
    }

    function start() {
      stop();
      if (paused || reducedMotion.matches || maximumIndex() === 0) return;
      timer = window.setInterval(() => move(1), interval);
    }

    previous.addEventListener('click', () => {
      move(-1);
      start();
    });
    next.addEventListener('click', () => {
      move(1);
      start();
    });
    slider.addEventListener('mouseenter', () => {
      paused = true;
      stop();
    });
    slider.addEventListener('mouseleave', () => {
      paused = false;
      start();
    });
    slider.addEventListener('focusin', () => {
      paused = true;
      stop();
    });
    slider.addEventListener('focusout', (event) => {
      if (slider.contains(event.relatedTarget)) return;
      paused = false;
      start();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stop();
      else start();
    });
    window.addEventListener('resize', render);
    reducedMotion.addEventListener('change', start);

    render();
    start();
  });
}());
