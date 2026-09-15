// Admin şifre değiştirme formu: istemci tarafı ön kontrol.
// Sunucu (src/services/admin-password.js) aynı politikayı yeniden doğrular; burası yalnızca
// anında geri bildirim ve eşleşmeyen şifrelerde butonu pasif tutmak içindir.
(function () {
  'use strict';

  var MIN_LENGTH = 10;

  function policyMessage(password) {
    if (!password) return '';
    if (password.length < MIN_LENGTH) return 'Yeni şifre en az ' + MIN_LENGTH + ' karakter olmalıdır.';
    if (!/\p{Lu}/u.test(password)) return 'Yeni şifre en az bir büyük harf içermelidir.';
    if (!/\p{Ll}/u.test(password)) return 'Yeni şifre en az bir küçük harf içermelidir.';
    if (!/\p{Nd}/u.test(password)) return 'Yeni şifre en az bir rakam içermelidir.';
    if (!/[^\p{L}\p{Nd}]/u.test(password)) return 'Yeni şifre en az bir özel karakter içermelidir.';
    return '';
  }

  function showHint(element, message) {
    if (!element) return;
    element.textContent = message;
    element.hidden = !message;
  }

  function initForm(form) {
    var current = form.querySelector('input[name="currentPassword"]');
    var next = form.querySelector('input[name="newPassword"]');
    var confirm = form.querySelector('input[name="newPasswordConfirm"]');
    var submit = form.querySelector('[data-change-password-submit]');
    var policyHint = form.querySelector('[data-password-policy-hint]');
    var matchHint = form.querySelector('[data-password-match-hint]');
    if (!current || !next || !confirm || !submit) return;

    function refresh() {
      var policyError = policyMessage(next.value);
      var mismatch = confirm.value !== '' && next.value !== confirm.value;

      showHint(policyHint, policyError);
      showHint(matchHint, mismatch ? 'Yeni şifreler eşleşmiyor.' : '');

      submit.disabled = !current.value
        || !next.value
        || !confirm.value
        || !!policyError
        || next.value !== confirm.value;
    }

    [current, next, confirm].forEach(function (input) {
      input.addEventListener('input', refresh);
    });
    refresh();
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-change-password-form]').forEach(initForm);
  });
}());
