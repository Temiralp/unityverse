(function(window, document) {
  'use strict';

  function setCounterValue(counter, value) {
    counter.textContent = String(value);
  }

  function animateCounter(counter) {
    var target = Number(counter.dataset.count || 0);
    var duration = 1100;
    var startedAt = null;

    if (!Number.isFinite(target) || target <= 0) {
      setCounterValue(counter, 0);
      return;
    }

    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setCounterValue(counter, target);
      return;
    }

    function tick(timestamp) {
      if (!startedAt) {
        startedAt = timestamp;
      }

      var progress = Math.min((timestamp - startedAt) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);

      setCounterValue(counter, Math.floor(eased * target));

      if (progress < 1) {
        window.requestAnimationFrame(tick);
      } else {
        setCounterValue(counter, target);
      }
    }

    window.requestAnimationFrame(tick);
  }

  function animateCounters(root) {
    Array.prototype.forEach.call(root.querySelectorAll('[data-count]'), animateCounter);
  }

  function initCounters() {
    var roots = document.querySelectorAll('[data-counters]');

    if (!roots.length) return;

    if (!('IntersectionObserver' in window)) {
      Array.prototype.forEach.call(roots, animateCounters);
      return;
    }

    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (!entry.isIntersecting || entry.target.dataset.countersAnimated === 'true') return;

        entry.target.dataset.countersAnimated = 'true';
        animateCounters(entry.target);
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.35 });

    Array.prototype.forEach.call(roots, function(root) {
      observer.observe(root);
    });
  }

  document.addEventListener('DOMContentLoaded', function() {
    try {
      initCounters();
    } catch (error) {
      Array.prototype.forEach.call(document.querySelectorAll('[data-count]'), function(counter) {
        setCounterValue(counter, Number(counter.dataset.count || 0));
      });
    }
  });
})(window, document);
