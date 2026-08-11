(function () {
  'use strict';

  const toggle = document.querySelector('[data-admin-nav-toggle]');
  const menu = document.querySelector('[data-admin-menu]');
  const brand = document.querySelector('[data-admin-brand]');

  if (!toggle || !menu || typeof window.matchMedia !== 'function') return;

  const compactViewport = window.matchMedia('(max-width: 1180px)');

  function setMenuOpen(isOpen, restoreFocus) {
    const shouldOpen = compactViewport.matches && isOpen;

    menu.hidden = compactViewport.matches && !shouldOpen;
    toggle.hidden = !compactViewport.matches;
    toggle.setAttribute('aria-expanded', String(shouldOpen));
    toggle.setAttribute('aria-label', shouldOpen ? 'Admin menüsünü kapat' : 'Admin menüsünü aç');

    if (restoreFocus && compactViewport.matches) {
      toggle.focus();
    }
  }

  function syncViewport() {
    const focusIsInsideMenu = menu.contains(document.activeElement);
    const focusIsOnToggle = document.activeElement === toggle;

    setMenuOpen(false, compactViewport.matches && focusIsInsideMenu);

    if (!compactViewport.matches && focusIsOnToggle && brand) {
      brand.focus();
    }
  }

  toggle.addEventListener('click', function () {
    const isOpen = toggle.getAttribute('aria-expanded') === 'true';
    setMenuOpen(!isOpen, false);
  });

  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape' || toggle.getAttribute('aria-expanded') !== 'true') return;

    setMenuOpen(false, true);
  });

  if (typeof compactViewport.addEventListener === 'function') {
    compactViewport.addEventListener('change', syncViewport);
  } else if (typeof compactViewport.addListener === 'function') {
    compactViewport.addListener(syncViewport);
  }

  syncViewport();
}());
