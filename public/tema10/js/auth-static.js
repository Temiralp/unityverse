(function () {
  'use strict';

  function activateRegisterTab() {
    var params = new URLSearchParams(window.location.search);
    var shouldOpenRegister = params.get('tab') === 'register' || window.location.hash === '#uye-ol';

    if (!shouldOpenRegister) return;

    var registerTab = document.querySelector('[data-tab="tabs2"]');
    var loginTab = document.querySelector('[data-tab="tabs1"]');
    var registerPanel = document.getElementById('tabs2');
    var loginPanel = document.getElementById('tabs1');

    if (registerTab && typeof registerTab.click === 'function') {
      registerTab.click();
    }

    if (registerTab && loginTab && registerPanel && loginPanel) {
      loginTab.classList.remove('active');
      registerTab.classList.add('active');
      loginPanel.classList.remove('active');
      registerPanel.classList.add('active');
    }
  }

  try {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', activateRegisterTab);
    } else {
      activateRegisterTab();
    }
  } catch (error) {
    window.console && window.console.warn && window.console.warn('Auth tab modülü başlatılamadı.', error);
  }
}());
