(function(window, document) {
  'use strict';

  var FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(',');

  function initTabs(root) {
    var tabsRoot = root.querySelector('[data-tabs]');
    if (!tabsRoot) return;

    var tabs = Array.prototype.slice.call(tabsRoot.querySelectorAll('[role="tab"]'));
    var panels = Array.prototype.slice.call(tabsRoot.querySelectorAll('[role="tabpanel"]'));

    function activateTab(tab) {
      tabs.forEach(function(item) {
        var selected = item === tab;
        item.setAttribute('aria-selected', String(selected));
        item.tabIndex = selected ? 0 : -1;
      });

      panels.forEach(function(panel) {
        panel.hidden = panel.id !== tab.getAttribute('aria-controls');
      });
    }

    tabs.forEach(function(tab, index) {
      tab.addEventListener('click', function() {
        activateTab(tab);
      });

      tab.addEventListener('keydown', function(event) {
        var nextIndex = index;

        if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
        if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
        if (event.key === 'Home') nextIndex = 0;
        if (event.key === 'End') nextIndex = tabs.length - 1;

        if (nextIndex !== index) {
          event.preventDefault();
          activateTab(tabs[nextIndex]);
          tabs[nextIndex].focus();
        }
      });
    });
  }

  function initAccordions(root) {
    Array.prototype.forEach.call(root.querySelectorAll('[data-accordion]'), function(accordion) {
      accordion.addEventListener('click', function(event) {
        var trigger = event.target.closest('.uv-accordion__trigger');
        if (!trigger) return;

        var panel = document.getElementById(trigger.getAttribute('aria-controls'));
        var isExpanded = trigger.getAttribute('aria-expanded') === 'true';

        trigger.setAttribute('aria-expanded', String(!isExpanded));
        if (panel) panel.hidden = isExpanded;
      });
    });
  }

  function initLightbox(root) {
    var gallery = root.querySelector('[data-lightbox]');
    if (!gallery) return;

    var lightbox = document.createElement('div');
    lightbox.className = 'uv-lightbox';
    lightbox.setAttribute('role', 'dialog');
    lightbox.setAttribute('aria-modal', 'true');
    lightbox.setAttribute('aria-label', 'Galeri görseli');
    lightbox.innerHTML = '<button class="btn-secondary" type="button">Kapat</button><img alt="">';
    document.body.appendChild(lightbox);

    var image = lightbox.querySelector('img');
    var closeButton = lightbox.querySelector('button');
    var lastFocus = null;

    function closeLightbox() {
      lightbox.classList.remove('is-open');
      document.body.classList.remove('uv-modal-open');
      image.removeAttribute('src');

      if (lastFocus && typeof lastFocus.focus === 'function') {
        lastFocus.focus();
      }
    }

    gallery.addEventListener('click', function(event) {
      var button = event.target.closest('[data-lightbox-src]');
      if (!button) return;

      lastFocus = document.activeElement;
      image.src = button.dataset.lightboxSrc;
      lightbox.classList.add('is-open');
      document.body.classList.add('uv-modal-open');
      closeButton.focus();
    });

    closeButton.addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', function(event) {
      if (event.target === lightbox) closeLightbox();
    });

    document.addEventListener('keydown', function(event) {
      if (!lightbox.classList.contains('is-open')) return;

      if (event.key === 'Escape') {
        closeLightbox();
        return;
      }

      if (event.key === 'Tab') {
        event.preventDefault();
        closeButton.focus();
      }
    });
  }

  function initRelatedSlider(root) {
    var track = root.querySelector('[data-related-track]');
    var prev = root.querySelector('[data-related-prev]');
    var next = root.querySelector('[data-related-next]');

    if (!track || !prev || !next) return;

    function scrollByCard(direction) {
      var card = track.querySelector('.uv-course-card');
      var amount = card ? card.getBoundingClientRect().width + 16 : 320;
      track.scrollBy({ left: amount * direction, behavior: 'smooth' });
    }

    prev.addEventListener('click', function() {
      scrollByCard(-1);
    });

    next.addEventListener('click', function() {
      scrollByCard(1);
    });
  }

  function enrollmentReturnPath() {
    var url = new URL(window.location.href);
    url.searchParams.set('enroll', '1');
    return url.pathname + url.search;
  }

  function enrollmentLoginUrl() {
    return '/uye-girisi/?redirect=' + encodeURIComponent(enrollmentReturnPath());
  }

  function readJson(response) {
    return response.json().catch(function() {
      return {};
    });
  }

  function getFocusableElements(container) {
    return Array.prototype.slice.call(container.querySelectorAll(FOCUSABLE_SELECTOR))
      .filter(function(element) {
        return element.offsetParent !== null || element === document.activeElement;
      });
  }

  function initEnrollment(root) {
    var modal = root.querySelector('[data-enrollment-modal]');
    var triggers = Array.prototype.slice.call(root.querySelectorAll('[data-enroll-trigger]'));

    if (!modal || !triggers.length) return;

    var closeButtons = Array.prototype.slice.call(modal.querySelectorAll('[data-enrollment-close]'));
    var submitButton = modal.querySelector('[data-enrollment-submit]');
    var submitLabel = modal.querySelector('[data-enrollment-submit-label]');
    var statusNode = modal.querySelector('[data-enrollment-status]');
    var nameInput = modal.querySelector('[data-enrollment-member-name]');
    var emailInput = modal.querySelector('[data-enrollment-member-email]');
    var phoneInput = modal.querySelector('[data-enrollment-member-phone]');
    var websiteInput = modal.querySelector('[data-enrollment-website]');
    var productId = modal.dataset.productId;
    var lastFocus = null;
    var protection = null;
    var isSubmitting = false;

    function setStatus(message, type) {
      statusNode.textContent = message || '';
      statusNode.classList.toggle('is-error', type === 'error');
      statusNode.classList.toggle('is-success', type === 'success');
    }

    function setSubmitState(disabled, loading, label) {
      submitButton.disabled = disabled;
      submitButton.classList.toggle('is-loading', loading);
      submitButton.setAttribute('aria-busy', String(loading));
      submitLabel.textContent = label;
    }

    function closeModal() {
      if (isSubmitting) return;

      modal.hidden = true;
      document.body.classList.remove('uv-modal-open');
      protection = null;
      setStatus('', '');

      if (lastFocus && typeof lastFocus.focus === 'function') {
        lastFocus.focus();
      }
    }

    function redirectToLogin(loginUrl) {
      window.location.assign(loginUrl || enrollmentLoginUrl());
    }

    function loadProtection() {
      return Promise.all([
        fetch('/api/csrf-token', {
          credentials: 'same-origin',
          headers: { 'X-Requested-With': 'XMLHttpRequest' }
        }),
        fetch('/api/form-protection-token?scope=enrollment', {
          credentials: 'same-origin',
          headers: { 'X-Requested-With': 'XMLHttpRequest' }
        })
      ])
        .then(function(responses) {
          if (!responses[0].ok || !responses[1].ok) {
            throw new Error('Kayıt güvenlik bilgileri alınamadı.');
          }

          return Promise.all(responses.map(readJson));
        })
        .then(function(results) {
          if (!results[0].token || !results[1].token) {
            throw new Error('Kayıt güvenlik bilgileri eksik.');
          }

          protection = {
            csrfToken: results[0].token,
            formToken: results[1].token
          };

          return new Promise(function(resolve) {
            window.setTimeout(resolve, 2600);
          });
        });
    }

    function populateMember(member) {
      nameInput.value = [member.name, member.surname].filter(Boolean).join(' ');
      emailInput.value = member.email || '';
      phoneInput.value = member.phone || '';
    }

    function openModal(trigger) {
      lastFocus = trigger || document.activeElement;
      protection = null;
      setStatus('Üye bilgileriniz kontrol ediliyor.', '');
      setSubmitState(true, false, 'Hazırlanıyor...');

      fetch('/ajax/member/me', {
        credentials: 'same-origin',
        headers: { 'X-Requested-With': 'XMLHttpRequest' }
      })
        .then(function(response) {
          if (!response.ok) throw new Error('Üye bilgileri alınamadı.');
          return readJson(response);
        })
        .then(function(result) {
          if (!result.authenticated || !result.member) {
            redirectToLogin();
            return null;
          }

          populateMember(result.member);
          modal.hidden = false;
          document.body.classList.add('uv-modal-open');
          setStatus('Kayıt formu hazırlanıyor.', '');
          closeButtons[0].focus();

          return loadProtection();
        })
        .then(function(result) {
          if (result === null || modal.hidden) return;

          setStatus('', '');
          setSubmitState(false, false, 'Kaydı Tamamla');
        })
        .catch(function(error) {
          modal.hidden = false;
          document.body.classList.add('uv-modal-open');
          setStatus(error.message || 'Kayıt formu hazırlanamadı. Lütfen tekrar deneyin.', 'error');
          setSubmitState(true, false, 'Tekrar Deneyin');
          closeButtons[0].focus();
        });
    }

    function submitEnrollment() {
      if (!protection || isSubmitting) return;

      isSubmitting = true;
      setStatus('Kaydınız oluşturuluyor.', '');
      setSubmitState(true, true, 'Kaydediliyor...');

      fetch('/ajax/enroll', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: new URLSearchParams({
          productId: productId,
          _csrf: protection.csrfToken,
          _formToken: protection.formToken,
          website: websiteInput.value || ''
        })
      })
        .then(function(response) {
          return readJson(response).then(function(result) {
            return { response: response, result: result };
          });
        })
        .then(function(payload) {
          var response = payload.response;
          var result = payload.result;

          if (response.status === 401) {
            redirectToLogin(result.loginUrl);
            return;
          }

          if (response.status === 201) {
            setStatus('Kaydınız alındı. En kısa sürede sizinle iletişime geçilecek.', 'success');
            setSubmitState(true, false, 'Kayıt Alındı');
            return;
          }

          if (response.status === 409 && result.code === 'ALREADY_ENROLLED') {
            setStatus('Bu eğitime zaten kayıtlısınız.', 'error');
            setSubmitState(true, false, 'Kayıt Mevcut');
            return;
          }

          if (response.status === 403) {
            throw new Error('Güvenlik oturumunuz yenilendi. Pencereyi kapatıp tekrar deneyin.');
          }

          if (response.status === 429) {
            throw new Error(result.message || 'Çok fazla deneme yaptınız. Lütfen daha sonra tekrar deneyin.');
          }

          throw new Error(result.message || 'Kayıt tamamlanamadı. Lütfen tekrar deneyin.');
        })
        .catch(function(error) {
          setStatus(error.message || 'Bağlantı hatası oluştu. Lütfen tekrar deneyin.', 'error');
          setSubmitState(false, false, 'Tekrar Dene');
        })
        .finally(function() {
          isSubmitting = false;
        });
    }

    triggers.forEach(function(trigger) {
      trigger.addEventListener('click', function() {
        openModal(trigger);
      });
    });

    closeButtons.forEach(function(button) {
      button.addEventListener('click', closeModal);
    });

    submitButton.addEventListener('click', submitEnrollment);
    modal.addEventListener('click', function(event) {
      if (event.target === modal) closeModal();
    });

    document.addEventListener('keydown', function(event) {
      if (modal.hidden) return;

      if (event.key === 'Escape') {
        closeModal();
        return;
      }

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
    });

    if (new URLSearchParams(window.location.search).get('enroll') === '1') {
      var cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete('enroll');
      window.history.replaceState({}, '', cleanUrl.pathname + cleanUrl.search + cleanUrl.hash);
      openModal(triggers[0]);
    }
  }

  function initProductDetail() {
    var root = document.querySelector('[data-product-detail]');
    if (!root) return;

    try {
      initTabs(root);
      initAccordions(root);
      initLightbox(root);
      initRelatedSlider(root);
      initEnrollment(root);
    } catch (error) {
      if (window.console && typeof window.console.warn === 'function') {
        window.console.warn('Product detail interaction could not start.', error);
      }
    }
  }

  document.addEventListener('DOMContentLoaded', initProductDetail);
})(window, document);
