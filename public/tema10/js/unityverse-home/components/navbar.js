(function(window, document) {
  var components = window.UnityverseHome.Components;
  var utils = components.utils;

  function renderDropdown(items) {
    if (!items || !items.length) {
      return '';
    }

    return '<ul class="uv-navbar__dropdown">' + utils.htmlList(items, function(item) {
      return '<li><a href="' + utils.escapeHtml(item.href) + '">' + utils.escapeHtml(item.label) + '</a></li>';
    }) + '</ul>';
  }

  function renderMenuItem(item) {
    var hasDropdown = item.children && item.children.length;
    var trigger = hasDropdown
      ? '<button class="uv-navbar__menu-trigger" type="button" aria-expanded="false">' +
          '<span>' + utils.escapeHtml(item.label) + '</span>' +
          '<span class="uv-navbar__chevron" aria-hidden="true"></span>' +
        '</button>'
      : '<a href="' + utils.escapeHtml(item.href) + '">' + utils.escapeHtml(item.label) + '</a>';

    return '<li class="uv-navbar__menu-item' + (hasDropdown ? ' uv-navbar__menu-item--dropdown' : '') + '">' +
      trigger +
      renderDropdown(item.children) +
    '</li>';
  }

  function renderMainItem(item) {
    var icon = item.iconClass
      ? '<i class="' + utils.escapeHtml(item.iconClass) + '" aria-hidden="true"></i>'
      : '';

    return '<li class="uv-navbar__main-item' + (item.featured ? ' uv-navbar__main-item--featured' : '') + '">' +
      '<a href="' + utils.escapeHtml(item.href) + '">' +
        icon +
        '<span>' + utils.escapeHtml(item.label) + '</span>' +
      '</a>' +
    '</li>';
  }

  function renderMainMenu(items, label) {
    var groupedItems = [];
    var featuredItems = [];

    Array.prototype.forEach.call(items || [], function(item) {
      if (item.featured) {
        featuredItems.push(item);
        return;
      }

      groupedItems.push(item);
    });

    return '<ul class="uv-navbar__main-menu">' +
      '<li class="uv-navbar__menu-item uv-navbar__menu-item--dropdown uv-navbar__menu-item--more">' +
        '<button class="uv-navbar__menu-trigger uv-navbar__menu-trigger--more" type="button" aria-expanded="false">' +
          '<span>' + utils.escapeHtml(label) + '</span>' +
          '<span class="uv-navbar__chevron" aria-hidden="true"></span>' +
        '</button>' +
        renderDropdown(groupedItems) +
      '</li>' +
      utils.htmlList(featuredItems, renderMainItem) +
    '</ul>';
  }

  components.navbar = function navbar(props) {
    var questionAttrs = props.questionAction.modalTarget
      ? ' data-toggle="modal" data-target="' + utils.escapeHtml(props.questionAction.modalTarget) + '"'
      : '';

    return '<header class="uv-navbar" data-uv-navbar data-close-label="' + utils.escapeHtml(props.mobile.closeLabel) + '">' +
      '<div class="uv-shell uv-navbar__top">' +
        '<a class="uv-navbar__logo" href="' + utils.escapeHtml(props.logo.href) + '" aria-label="' + utils.escapeHtml(props.logo.ariaLabel) + '">' +
          '<img src="' + utils.escapeHtml(props.logo.src) + '" alt="' + utils.escapeHtml(props.logo.alt) + '" width="' + utils.escapeHtml(props.logo.width) + '" height="' + utils.escapeHtml(props.logo.height) + '" decoding="async" fetchpriority="high">' +
        '</a>' +
        '<div class="uv-navbar__actions">' +
          '<a class="uv-navbar__phone" href="' + utils.escapeHtml(props.phone.href) + '">' + utils.escapeHtml(props.phone.label) + '</a>' +
          '<a class="uv-navbar__link uv-navbar__question" href="' + utils.escapeHtml(props.questionAction.href) + '"' + questionAttrs + '>' + utils.escapeHtml(props.questionAction.label) + '</a>' +
          '<a class="uv-navbar__auth uv-navbar__auth--register" href="' + utils.escapeHtml(props.registerAction.href) + '">' +
            '<i class="' + utils.escapeHtml(props.registerAction.iconClass) + '" aria-hidden="true"></i>' +
            '<span>' + utils.escapeHtml(props.registerAction.label) + '</span>' +
          '</a>' +
          '<a class="uv-navbar__auth uv-navbar__auth--login" href="' + utils.escapeHtml(props.loginAction.href) + '">' +
            '<i class="' + utils.escapeHtml(props.loginAction.iconClass) + '" aria-hidden="true"></i>' +
            '<span>' + utils.escapeHtml(props.loginAction.label) + '</span>' +
          '</a>' +
          components.button(props.infoAction) +
          '<a class="uv-navbar__cart" href="' + utils.escapeHtml(props.cart.href) + '" aria-label="' + utils.escapeHtml(props.cart.ariaLabel) + '">' +
            '<span class="uv-navbar__cart-icon" aria-hidden="true"></span>' +
          '</a>' +
          '<button class="uv-navbar__toggle" type="button" aria-label="' + utils.escapeHtml(props.mobile.openLabel) + '" aria-controls="' + utils.escapeHtml(props.mobile.menuId) + '" aria-expanded="false" data-uv-navbar-toggle>' +
            '<span aria-hidden="true"></span>' +
            '<span aria-hidden="true"></span>' +
            '<span aria-hidden="true"></span>' +
          '</button>' +
        '</div>' +
      '</div>' +
      '<div class="uv-navbar__nav-row">' +
        '<nav class="uv-shell uv-navbar__nav" id="' + utils.escapeHtml(props.mobile.menuId) + '" aria-label="' + utils.escapeHtml(props.ariaLabel) + '">' +
          renderMainMenu(props.mainItems, props.mainMenuLabel) +
          '<ul class="uv-navbar__menu">' + utils.htmlList(props.items, renderMenuItem) + '</ul>' +
        '</nav>' +
      '</div>' +
    '</header>';
  };

  components.initNavbar = function initNavbar(root) {
    var navbar = root.querySelector('[data-uv-navbar]');
    var toggle = root.querySelector('[data-uv-navbar-toggle]');
    var nav = navbar ? navbar.querySelector('.uv-navbar__nav') : null;
    var dropdownTriggers = navbar ? navbar.querySelectorAll('.uv-navbar__menu-trigger') : [];
    var mobileNavQuery = window.matchMedia('(max-width: 1120px)');

    if (!navbar || !toggle || !nav) {
      return;
    }

    function closeDropdowns() {
      Array.prototype.forEach.call(dropdownTriggers, function(trigger) {
        trigger.setAttribute('aria-expanded', 'false');
        trigger.parentNode.classList.remove('uv-navbar__menu-item--expanded');
      });
    }

    function setMenuState(isOpen) {
      navbar.classList.toggle('uv-navbar--open', isOpen);
      toggle.setAttribute('aria-expanded', String(isOpen));
      toggle.setAttribute('aria-label', isOpen ? toggle.getAttribute('data-close-label') : toggle.getAttribute('data-open-label'));

      if (!isOpen) {
        closeDropdowns();
      }
    }

    toggle.setAttribute('data-open-label', toggle.getAttribute('aria-label'));
    toggle.setAttribute('data-close-label', navbar.dataset.closeLabel);

    toggle.addEventListener('click', function() {
      setMenuState(!navbar.classList.contains('uv-navbar--open'));
    });

    Array.prototype.forEach.call(dropdownTriggers, function(trigger) {
      var item = trigger.parentNode;

      trigger.addEventListener('click', function() {
        if (!mobileNavQuery.matches) {
          closeDropdowns();
          trigger.blur();
          return;
        }

        var isExpanded = trigger.getAttribute('aria-expanded') === 'true';
        trigger.setAttribute('aria-expanded', String(!isExpanded));
        item.classList.toggle('uv-navbar__menu-item--expanded', !isExpanded);
      });

      item.addEventListener('mouseenter', function() {
        if (!mobileNavQuery.matches) {
          closeDropdowns();
          trigger.setAttribute('aria-expanded', 'true');
        }
      });

      item.addEventListener('mouseleave', function() {
        if (!mobileNavQuery.matches) {
          trigger.setAttribute('aria-expanded', 'false');
        }
      });

      item.addEventListener('focusin', function() {
        if (!mobileNavQuery.matches) {
          closeDropdowns();
          trigger.setAttribute('aria-expanded', 'true');
        }
      });

      item.addEventListener('focusout', function(event) {
        if (!mobileNavQuery.matches && !item.contains(event.relatedTarget)) {
          trigger.setAttribute('aria-expanded', 'false');
        }
      });
    });

    document.addEventListener('keydown', function(event) {
      if (event.key === 'Escape') {
        setMenuState(false);
        closeDropdowns();
      }
    });

    window.addEventListener('scroll', function() {
      navbar.classList.toggle('uv-navbar--scrolled', window.scrollY > 8);
    }, { passive: true });

    nav.addEventListener('click', function(event) {
      if (event.target.closest('a')) {
        setMenuState(false);
      }
    });

    if (mobileNavQuery.addEventListener) {
      mobileNavQuery.addEventListener('change', closeDropdowns);
    } else if (mobileNavQuery.addListener) {
      mobileNavQuery.addListener(closeDropdowns);
    }
  };
})(window, document);
