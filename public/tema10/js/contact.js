(function(document) {
  'use strict';

  function validEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function validPhone(value) {
    return /^[0-9+\s()-]{7,}$/.test(value);
  }

  document.addEventListener('DOMContentLoaded', function() {
    var form = document.querySelector('[data-contact-form]');
    if (!form) return;

    var status = form.querySelector('[data-form-status]');
    var spinner = form.querySelector('[data-spinner]');
    var label = form.querySelector('[data-submit-label]');

    function setStatus(message) {
      status.textContent = message;
    }

    function setLoading(isLoading) {
      spinner.hidden = !isLoading;
      label.textContent = isLoading ? 'Gönderiliyor' : 'Gönder';
      form.setAttribute('aria-busy', String(isLoading));
      form.querySelector('button[type="submit"]').disabled = isLoading;
    }

    form.addEventListener('submit', async function(event) {
      event.preventDefault();

      try {
        var data = new FormData(form);
        var name = String(data.get('name') || '').trim();
        var email = String(data.get('email') || '').trim();
        var phone = String(data.get('phone') || '').trim();
        var message = String(data.get('message') || '').trim();
        var kvkk = data.get('kvkk');
        var honeypot = String(data.get('website') || '').trim();

        if (honeypot) return;
        if (!name || !email || !phone || !message) {
          setStatus('Lütfen zorunlu alanları doldurun.');
          return;
        }
        if (!validEmail(email)) {
          setStatus('Geçerli bir Email giriniz.');
          return;
        }
        if (!validPhone(phone)) {
          setStatus('Geçerli bir telefon giriniz.');
          return;
        }
        if (!kvkk) {
          setStatus('KVKK onayı gereklidir.');
          return;
        }

        setLoading(true);

        var response = await fetch(form.action, {
          method: 'POST',
          body: data,
          headers: { 'X-Requested-With': 'XMLHttpRequest' }
        });
        var result = {};

        try {
          result = await response.json();
        } catch (parseError) {
          throw new Error('Form yanıtı okunamadı.');
        }

        if (!response.ok || result.status !== 'success') {
          throw new Error(result.message || 'Form gönderilemedi.');
        }

        form.reset();
        setStatus(result.message || 'Form başarıyla gönderildi.');
      } catch (error) {
        setStatus(error.message || 'Beklenmeyen bir hata oluştu.');
      } finally {
        setLoading(false);
      }
    });
  });
})(document);
