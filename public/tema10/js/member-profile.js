(function () {
  'use strict';

  function setText(selector, value) {
    var element = document.querySelector(selector);
    if (element) element.textContent = value || '-';
  }

  function showProfile(member) {
    var fullName = [member.name, member.surname].filter(Boolean).join(' ').trim() || member.email;
    setText('[data-member-name]', fullName);
    setText('[data-member-initial]', fullName.charAt(0).toUpperCase());
    setText('[data-member-first-name]', member.name);
    setText('[data-member-surname]', member.surname);
    setText('[data-member-email]', member.email);
    setText('[data-member-phone]', member.phone);
    document.querySelector('[data-member-loading]').hidden = true;
    document.querySelector('[data-member-profile]').hidden = false;
  }

  function showError() {
    document.querySelector('[data-member-loading]').hidden = true;
    document.querySelector('[data-member-error]').hidden = false;
  }

  fetch('/ajax/member/me', { credentials: 'same-origin' })
    .then(function (response) {
      if (!response.ok) throw new Error('Member request failed');
      return response.json();
    })
    .then(function (result) {
      if (!result || !result.authenticated || !result.member) {
        window.location.replace('/uye-girisi/');
        return;
      }

      showProfile(result.member);
    })
    .catch(showError);
}());
