(function () {
  'use strict';

  function renderMemberProfileLink(member) {
    var loginItem = document.querySelector('[data-member-login]');
    var registerItem = document.querySelector('[data-member-register]');
    var profileUrl = '/uye/';
    var fullName = [member && member.name, member && member.surname].filter(Boolean).join(' ').trim();

    document.body.classList.add('member-logged-in');
    document.body.setAttribute('data-member-profile-url', profileUrl);

    Array.prototype.forEach.call(document.querySelectorAll('.uv-header-profile-button'), function(button) {
      button.setAttribute('aria-label', 'Profilim');
      button.setAttribute('title', 'Profilim');
    });

    if (loginItem) {
      loginItem.innerHTML = '<a href="' + profileUrl + '" class="top-link-wishlist" title="Profilim" aria-label="Profilim"><i class="fa fa-user-circle" aria-hidden="true"></i> <span>Profilim</span></a>';
    }

    if (registerItem) {
      registerItem.hidden = true;
    }

    if (fullName) {
      Array.prototype.forEach.call(document.querySelectorAll('.users-tools__profile span'), function(label) {
        label.textContent = fullName;
      });
    }
  }

  fetch('/ajax/member/me', { credentials: 'same-origin' })
    .then(function (response) {
      if (!response.ok) throw new Error('Member request failed');
      return response.json();
    })
    .then(function (result) {
      if (result && result.authenticated && result.member) renderMemberProfileLink(result.member);
    })
    .catch(function () {
      // Guests retain the normal login and registration links.
    });
}());
