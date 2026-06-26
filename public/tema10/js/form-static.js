(function(window, document) {
  'use strict';

  var STATUS_SELECTOR = '[data-lead-form-status]';

  function getActiveForm() {
    return document.querySelector('form[id^="custom_form_"]');
  }

  function serializeForm(formId) {
    var form = document.getElementById(formId);
    var data = {};

    if (!form) return '{}';

    Array.prototype.forEach.call(form.elements, function(field) {
      if (!field.name || field.disabled) return;
      if ((field.type === 'checkbox' || field.type === 'radio') && !field.checked) return;

      var value = String(field.value || '').trim();

      if (Object.prototype.hasOwnProperty.call(data, field.name)) {
        if (!Array.isArray(data[field.name])) data[field.name] = [data[field.name]];
        data[field.name].push(value);
        return;
      }

      data[field.name] = value;
    });

    return JSON.stringify(data);
  }

  function setStatus(message, type) {
    var status = document.querySelector(STATUS_SELECTOR);

    if (!status) return;

    status.textContent = message || '';
    status.classList.toggle('is-success', type === 'success');
    status.classList.toggle('is-error', type === 'error');
  }

  function setLoading(form, isLoading) {
    var submit = form ? form.querySelector('[type="submit"]') : null;

    if (form) form.setAttribute('aria-busy', String(isLoading));
    if (submit) {
      submit.disabled = isLoading;
      submit.value = isLoading ? 'Gönderiliyor' : 'Gönder';
    }
  }

  window.getJsonDataFromForm = function(formId) {
    return serializeForm(formId);
  };

  window._success = function(selector, message) {
    setStatus(message || 'Başarılı bir şekilde gönderildi.', 'success');
    return false;
  };

  window._error = function(selector, message) {
    setStatus(message || 'Beklenmeyen bir hata oluştu.', 'error');
    return false;
  };

  window.postForm = function() {
    var form = getActiveForm();
    var formId = form ? form.id : '';
    var endpoint = ((window.site_url || '/') + 'ajax/sendCustomForm').replace(/\/{2,}/g, '/');

    if (!form) return false;

    setStatus('', null);
    setLoading(form, true);

    window.UnityverseFormProtection
      .fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'X-Requested-With': 'XMLHttpRequest'
          }
        }, window.getJsonDataFromForm(formId), 'lead')
      .then(function(response) {
        return response.json().then(function(result) {
          return {
            ok: response.ok,
            result: result
          };
        });
      })
      .then(function(payload) {
        if (payload.ok && payload.result.status === 'success') {
          form.reset();
          window._success('', 'Başarılı bir şekilde gönderildi.');
          return;
        }

        window._error('', payload.result.message || 'Form gönderilemedi.');
      })
      .catch(function() {
        window._error('', 'Beklenmeyen bir hata oluştu.\nLütfen yöneticiye bildiriniz');
      })
      .finally(function() {
        setLoading(form, false);
      });

    return false;
  };
})(window, document);
