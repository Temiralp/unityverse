(function(document) {
  'use strict';

  function animateCounter(counter) {
    var target = Number(counter.dataset.count || 0);
    var current = 0;
    var steps = 36;
    var increment = target / steps;

    function tick() {
      current += increment;

      if (current >= target) {
        counter.textContent = String(target);
        return;
      }

      counter.textContent = String(Math.floor(current));
      window.requestAnimationFrame(tick);
    }

    tick();
  }

  document.addEventListener('DOMContentLoaded', function() {
    var root = document.querySelector('[data-counters]');
    if (!root) return;

    if (!('IntersectionObserver' in window)) {
      Array.prototype.forEach.call(root.querySelectorAll('[data-count]'), animateCounter);
      return;
    }

    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (!entry.isIntersecting) return;

        Array.prototype.forEach.call(entry.target.querySelectorAll('[data-count]'), animateCounter);
        observer.disconnect();
      });
    }, { threshold: 0.35 });

    observer.observe(root);
  });
})(document);
