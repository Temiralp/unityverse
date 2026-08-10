(function(document, window) {
  'use strict';

  var FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(',');

  function getFocusable(container) {
    return Array.prototype.filter.call(container.querySelectorAll(FOCUSABLE_SELECTOR), function(element) {
      return element.offsetParent !== null || element === document.activeElement;
    });
  }

  function initFooter(root) {
    var toggles = root.querySelectorAll('.uv-footer__toggle');
    var desktopQuery = window.matchMedia('(min-width: 992px)');

    function syncFooterState() {
      Array.prototype.forEach.call(toggles, function(toggle) {
        toggle.setAttribute('aria-expanded', String(desktopQuery.matches));
      });
    }

    Array.prototype.forEach.call(toggles, function(toggle) {
      toggle.addEventListener('click', function() {
        if (desktopQuery.matches) return;

        var expanded = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', String(!expanded));
      });
    });

    syncFooterState();

    if (desktopQuery.addEventListener) {
      desktopQuery.addEventListener('change', syncFooterState);
    } else if (desktopQuery.addListener) {
      desktopQuery.addListener(syncFooterState);
    }
  }

  function syncMemberState() {
    if (!window.fetch) return;

    fetch('/ajax/member/me', { credentials: 'same-origin' })
      .then(function(response) {
        if (!response.ok) throw new Error('Member request failed');
        return response.json();
      })
      .then(function(result) {
        if (result && result.authenticated && result.member) {
          document.body.classList.add('member-logged-in');
          document.body.setAttribute('data-member-profile-url', '/uye/');
          return;
        }

        document.body.classList.remove('member-logged-in');
        document.body.removeAttribute('data-member-profile-url');
      })
      .catch(function() {
        document.body.classList.remove('member-logged-in');
      });
  }

  function initNavbar(navbar) {
    var toggle = navbar.querySelector('[data-navbar-toggle]');
    var drawer = navbar.querySelector('[data-navbar-drawer]');
    var closeButtons = navbar.querySelectorAll('[data-navbar-close]');
    var backdrop = navbar.querySelector('[data-navbar-backdrop]');
    var dropdownTriggers = navbar.querySelectorAll('.uv-navbar__menu-trigger');
    var mobileQuery = window.matchMedia(
      navbar.getAttribute('data-navbar-mobile-query') || '(max-width: 1120px)'
    );
    var previousFocus = null;

    if (!toggle || !drawer) return;

    toggle.dataset.openLabel = toggle.getAttribute('aria-label') || 'Menüyü aç';
    toggle.dataset.closeLabel = navbar.dataset.closeLabel || 'Menüyü kapat';

    function closeDropdowns() {
      Array.prototype.forEach.call(dropdownTriggers, function(trigger) {
        trigger.setAttribute('aria-expanded', 'false');
        trigger.parentNode.classList.remove('uv-navbar__menu-item--expanded');
      });
    }

    function syncDrawerAvailability(isOpen) {
      if (!navbar.hasAttribute('data-navbar-manage-drawer')) return;

      var isHidden = mobileQuery.matches && !isOpen;
      drawer.setAttribute('aria-hidden', String(isHidden));

      if ('inert' in drawer) {
        drawer.inert = isHidden;
      }
    }

    function syncNativeDetails(isOpen) {
      if (!navbar.hasAttribute('data-navbar-open-details')) return;

      Array.prototype.forEach.call(drawer.querySelectorAll('details'), function(details) {
        details.open = isOpen && mobileQuery.matches;
      });
    }

    function setMenuState(isOpen, shouldRestoreFocus) {
      navbar.classList.toggle('uv-navbar--open', isOpen);
      toggle.setAttribute('aria-expanded', String(isOpen));
      toggle.setAttribute('aria-label', isOpen ? toggle.dataset.closeLabel : toggle.dataset.openLabel);
      syncDrawerAvailability(isOpen);
      syncNativeDetails(isOpen);

      if (navbar.hasAttribute('data-navbar-lock-scroll')) {
        document.body.classList.toggle('uv-navbar-scroll-lock', isOpen && mobileQuery.matches);
      }

      if (isOpen) {
        previousFocus = document.activeElement;

        if (navbar.hasAttribute('data-navbar-focus-drawer')) {
          window.requestAnimationFrame(function() {
            var firstDrawerControl = getFocusable(drawer)[0];
            if (firstDrawerControl) firstDrawerControl.focus();
          });
        }

        return;
      }

      closeDropdowns();

      if (shouldRestoreFocus && previousFocus && typeof previousFocus.focus === 'function') {
        previousFocus.focus();
      }
    }

    function trapFocus(event) {
      if (!mobileQuery.matches || !navbar.classList.contains('uv-navbar--open') || event.key !== 'Tab') {
        return;
      }

      var focusRoot = navbar.hasAttribute('data-navbar-trap-drawer') ? drawer : navbar;
      var focusable = getFocusable(focusRoot);
      var first = focusable[0];
      var last = focusable[focusable.length - 1];

      if (!first || !last) {
        event.preventDefault();
        toggle.focus();
        return;
      }

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    toggle.addEventListener('click', function() {
      var isOpen = !navbar.classList.contains('uv-navbar--open');
      setMenuState(isOpen, false);
    });

    Array.prototype.forEach.call(closeButtons, function(closeButton) {
      closeButton.addEventListener('click', function() {
        setMenuState(false, true);
      });
    });

    if (backdrop) {
      backdrop.addEventListener('click', function() {
        setMenuState(false, true);
      });
    }

    Array.prototype.forEach.call(dropdownTriggers, function(trigger) {
      var item = trigger.parentNode;

      trigger.addEventListener('click', function() {
        if (!mobileQuery.matches) {
          closeDropdowns();
          trigger.blur();
          return;
        }

        var isExpanded = trigger.getAttribute('aria-expanded') === 'true';
        trigger.setAttribute('aria-expanded', String(!isExpanded));
        item.classList.toggle('uv-navbar__menu-item--expanded', !isExpanded);
      });

      item.addEventListener('mouseenter', function() {
        if (!mobileQuery.matches) {
          closeDropdowns();
          trigger.setAttribute('aria-expanded', 'true');
        }
      });

      item.addEventListener('mouseleave', function() {
        if (!mobileQuery.matches) {
          trigger.setAttribute('aria-expanded', 'false');
        }
      });

      item.addEventListener('focusin', function() {
        if (!mobileQuery.matches) {
          closeDropdowns();
          trigger.setAttribute('aria-expanded', 'true');
        }
      });

      item.addEventListener('focusout', function(event) {
        if (!mobileQuery.matches && !item.contains(event.relatedTarget)) {
          trigger.setAttribute('aria-expanded', 'false');
        }
      });
    });

    drawer.addEventListener('click', function(event) {
      if (event.target.closest('a')) {
        setMenuState(false, false);
      }
    });

    document.addEventListener('keydown', function(event) {
      if (event.key === 'Escape' && navbar.classList.contains('uv-navbar--open')) {
        setMenuState(false, true);
      }

      trapFocus(event);
    });

    window.addEventListener('scroll', function() {
      navbar.classList.toggle('uv-navbar--scrolled', window.scrollY > 8);
    }, { passive: true });

    function handleViewportChange() {
      setMenuState(false, false);
      closeDropdowns();
    }

    setMenuState(false, false);

    if (mobileQuery.addEventListener) {
      mobileQuery.addEventListener('change', handleViewportChange);
    } else if (mobileQuery.addListener) {
      mobileQuery.addListener(handleViewportChange);
    }
  }

  document.addEventListener('DOMContentLoaded', function() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-navbar]'), initNavbar);
    initFooter(document);
    syncMemberState();
  });
})(document, window);
