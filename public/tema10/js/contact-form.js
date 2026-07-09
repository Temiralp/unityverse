(function(document) {
  'use strict';

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var PHONE_RE = /^[0-9+\s()-]{7,}$/;

  function getValue(form, name) {
    var field = form.elements[name];
    return field ? String(field.value || '').trim() : '';
  }

  function getField(form, name) {
    return form.elements[name] || null;
  }

  function getErrorNode(form, name) {
    return form.querySelector('[data-error-for="' + name + '"]');
  }

  function setFieldError(form, name, message) {
    var field = getField(form, name);
    var errorNode = getErrorNode(form, name);
    var hasError = Boolean(message);

    if (field) {
      field.setAttribute('aria-invalid', String(hasError));
    }

    if (errorNode) {
      errorNode.textContent = message || '';
    }
  }

  function clearErrors(form) {
    ['name', 'email', 'phone', 'konu', 'message', 'kvkk'].forEach(function(name) {
      setFieldError(form, name, '');
    });
  }

  function validateForm(form) {
    var errors = {};
    var name = getValue(form, 'name');
    var email = getValue(form, 'email');
    var phone = getValue(form, 'phone');
    var subject = getValue(form, 'konu');
    var message = getValue(form, 'message');
    var kvkk = getField(form, 'kvkk');

    if (!name) {
      errors.name = 'Ad Soyad alanı zorunludur.';
    }

    if (!email) {
      errors.email = 'Email alanı zorunludur.';
    } else if (!EMAIL_RE.test(email)) {
      errors.email = 'Geçerli bir email adresi giriniz.';
    }

    if (!phone) {
      errors.phone = 'Telefon alanı zorunludur.';
    } else if (!PHONE_RE.test(phone)) {
      errors.phone = 'Geçerli bir telefon numarası giriniz.';
    }

    if (!subject) {
      errors.konu = 'Lütfen bir konu seçiniz.';
    }

    if (!message) {
      errors.message = 'Mesaj alanı zorunludur.';
    }

    if (!kvkk || !kvkk.checked) {
      errors.kvkk = 'KVKK onayı zorunludur.';
    }

    clearErrors(form);
    Object.keys(errors).forEach(function(name) {
      setFieldError(form, name, errors[name]);
    });

    return {
      isValid: Object.keys(errors).length === 0,
      firstInvalid: Object.keys(errors)[0] || null
    };
  }

  function setStatus(statusNode, message, type) {
    if (!statusNode) return;

    statusNode.textContent = message || '';
    statusNode.classList.toggle('is-error', type === 'error');
    statusNode.classList.toggle('is-success', type === 'success');
  }

  function setLoading(form, isLoading) {
    var button = form.querySelector('button[type="submit"]');
    var spinner = form.querySelector('[data-spinner]');
    var label = form.querySelector('[data-submit-label]');

    form.setAttribute('aria-busy', String(isLoading));

    if (button) {
      button.disabled = isLoading;
    }

    if (spinner) {
      spinner.hidden = !isLoading;
    }

    if (label) {
      label.textContent = isLoading ? 'Gönderiliyor' : 'Gönder';
    }
  }

  function focusFirstInvalid(form, name) {
    var field = name ? getField(form, name) : null;

    if (field && typeof field.focus === 'function') {
      field.focus();
    }
  }

  async function submitForm(form, statusNode) {
    var data = new URLSearchParams(new FormData(form));
    var response = await window.UnityverseFormProtection.fetch(form.action, {
      method: 'POST',
      headers: {
        'X-Requested-With': 'XMLHttpRequest'
      }
    }, data, 'lead');
    var result = {};

    try {
      result = await response.json();
    } catch (error) {
      throw new Error('Form yanıtı okunamadı.');
    }

    if (!response.ok || result.status !== 'success') {
      throw new Error(result.message || 'Form gönderilemedi.');
    }

    form.reset();
    clearErrors(form);
    setStatus(statusNode, result.message || 'Form başarıyla gönderildi.', 'success');
  }

  function bindForm(form) {
    var statusNode = form.querySelector('[data-form-status]');

    ['name', 'email', 'phone', 'konu', 'message', 'kvkk'].forEach(function(name) {
      var field = getField(form, name);

      if (!field) return;

      field.addEventListener('input', function() {
        setFieldError(form, name, '');
      });
      field.addEventListener('change', function() {
        setFieldError(form, name, '');
      });
    });

    form.addEventListener('submit', async function(event) {
      event.preventDefault();
      setStatus(statusNode, '', null);

      try {
        var validation = validateForm(form);

        if (!validation.isValid) {
          setStatus(statusNode, 'Lütfen işaretli alanları kontrol edin.', 'error');
          focusFirstInvalid(form, validation.firstInvalid);
          return;
        }

        setLoading(form, true);
        await submitForm(form, statusNode);
      } catch (error) {
        setStatus(statusNode, error.message || 'Beklenmeyen bir hata oluştu.', 'error');
      } finally {
        setLoading(form, false);
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function() {
    var form = document.querySelector('[data-contact-form]');

    if (!form) return;

    try {
      bindForm(form);
    } catch (error) {
      var statusNode = form.querySelector('[data-form-status]');
      setStatus(statusNode, 'Form hazırlanırken bir hata oluştu.', 'error');
    }
  });
})(document);
