(function(window, document) {
  'use strict';

  var FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(',');

  function readInstructors() {
    var node = document.querySelector('[data-instructors-json]');

    if (!node) return [];

    try {
      return JSON.parse(node.textContent || '[]');
    } catch (error) {
      return [];
    }
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, '&#096;');
  }

  function renderList(items, emptyText) {
    if (!items || !items.length) {
      return '<p>' + escapeHtml(emptyText) + '</p>';
    }

    return '<ul>' + items.map(function(item) {
      return '<li>' + escapeHtml(item) + '</li>';
    }).join('') + '</ul>';
  }

  function renderActions(instructor) {
    var actions = [];

    if (instructor.cvUrl) {
      actions.push('<a class="btn-primary" href="' + escapeAttr(instructor.cvUrl) + '" target="_blank" rel="noopener">CV / Profil</a>');
    }

    if (instructor.linkedin) {
      actions.push('<a class="btn-secondary" href="' + escapeAttr(instructor.linkedin) + '" target="_blank" rel="noopener">LinkedIn</a>');
    }

    return actions.length ? '<div class="uv-instructor-modal__actions">' + actions.join('') + '</div>' : '';
  }

  function renderModalContent(instructor) {
    var bio = instructor.bio || 'Detaylı bilgi için CV / Profil bağlantısını inceleyebilirsiniz.';
    var expertise = instructor.expertise ? [instructor.expertise] : [];

    return [
      '<img src="' + escapeAttr(instructor.photo) + '" alt="' + escapeAttr(instructor.name) + '" width="180" height="180" loading="lazy">',
      '<div class="uv-instructor-modal__summary">',
      '<p class="uv-founder-card__role">' + escapeHtml(instructor.title || 'Eğitmen') + '</p>',
      '<h2 id="instructor-modal-title">' + escapeHtml(instructor.name) + '</h2>',
      '<p>' + escapeHtml(bio) + '</p>',
      '<h3>Uzmanlık Alanları</h3>',
      renderList(expertise, 'Uzmanlık bilgisi için CV / Profil bağlantısını inceleyebilirsiniz.'),
      '<h3>Verdiği Eğitimler</h3>',
      renderList(instructor.courses, 'Verdiği eğitimler için CV / Profil bağlantısını inceleyebilirsiniz.'),
      renderActions(instructor),
      '</div>'
    ].join('');
  }

  function getFocusableElements(container) {
    return Array.prototype.slice.call(container.querySelectorAll(FOCUSABLE_SELECTOR))
      .filter(function(element) {
        return element.offsetParent !== null || element === document.activeElement;
      });
  }

  function focusFirstElement(modal) {
    var focusable = getFocusableElements(modal);
    var first = focusable[0];

    if (first && typeof first.focus === 'function') {
      first.focus();
    }
  }

  function trapFocus(event, modal) {
    if (event.key !== 'Tab') return;

    var focusable = getFocusableElements(modal);
    var first = focusable[0];
    var last = focusable[focusable.length - 1];

    if (!first || !last) return;

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function createModalController(modal, content, closeButton, instructors) {
    var lastFocus = null;

    function open(index) {
      var instructor = instructors[index];

      if (!instructor) return;

      lastFocus = document.activeElement;
      content.innerHTML = renderModalContent(instructor);
      modal.hidden = false;
      document.body.classList.add('uv-modal-open');
      focusFirstElement(modal);
    }

    function close() {
      modal.hidden = true;
      content.innerHTML = '';
      document.body.classList.remove('uv-modal-open');

      if (lastFocus && typeof lastFocus.focus === 'function') {
        lastFocus.focus();
      }
    }

    function onKeydown(event) {
      if (modal.hidden) return;

      if (event.key === 'Escape') {
        close();
        return;
      }

      trapFocus(event, modal);
    }

    closeButton.addEventListener('click', close);
    modal.addEventListener('click', function(event) {
      if (event.target === modal) {
        close();
      }
    });
    document.addEventListener('keydown', onKeydown);

    return {
      open: open,
      close: close
    };
  }

  function initInstructorsPage() {
    var page = document.querySelector('[data-instructors-page]');
    var modal = document.querySelector('[data-instructor-modal]');
    var content = document.querySelector('[data-modal-content]');
    var closeButton = document.querySelector('[data-modal-close]');
    var instructors = readInstructors();

    if (!page || !modal || !content || !closeButton || !instructors.length) return;

    var controller = createModalController(modal, content, closeButton, instructors);

    page.addEventListener('click', function(event) {
      var trigger = event.target.closest('[data-instructor-index]');

      if (!trigger) return;

      controller.open(Number(trigger.dataset.instructorIndex));
    });
  }

  document.addEventListener('DOMContentLoaded', function() {
    try {
      initInstructorsPage();
    } catch (error) {
      window.console && window.console.warn && window.console.warn('Instructor modal could not be initialized.');
    }
  });
})(window, document);
