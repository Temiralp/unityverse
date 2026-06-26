(function () {
  'use strict';

  function renderMemberProfileLink() {
    var loginItem = document.querySelector('[data-member-login]');
    var registerItem = document.querySelector('[data-member-register]');

    if (!loginItem || !registerItem) return;

    loginItem.innerHTML = '<a href="./uye/" class="top-link-wishlist" title="Profilim" aria-label="Profilim"><i class="fa fa-user-circle" aria-hidden="true"></i> <span>Profilim</span></a>';
    registerItem.hidden = true;
  }

  fetch('/ajax/member/me', { credentials: 'same-origin' })
    .then(function (response) {
      if (!response.ok) throw new Error('Member request failed');
      return response.json();
    })
    .then(function (result) {
      if (result && result.authenticated && result.member) renderMemberProfileLink();
    })
    .catch(function () {
      // Guests retain the normal login and registration links.
    });
}());
