(function(window, document) {
  'use strict';

  function resizePaytrFrame() {
    var iframe = document.getElementById('paytriframe');

    if (!iframe || typeof window.iFrameResize !== 'function') return;

    window.iFrameResize({
      checkOrigin: ['https://www.paytr.com']
    }, '#paytriframe');
  }

  function allAgreementsAccepted(agreements) {
    return agreements.every(function(agreement) {
      return agreement.checked;
    });
  }

  function initPaymentGate() {
    var checkout = document.querySelector('[data-payment-checkout]');
    if (!checkout) {
      resizePaytrFrame();
      return;
    }

    var agreements = Array.prototype.slice.call(checkout.querySelectorAll('[data-payment-agreement]'));
    var frameShell = checkout.querySelector('[data-payment-frame-shell]');
    var iframe = checkout.querySelector('[data-payment-iframe]');
    var bankTransfer = checkout.querySelector('[data-bank-transfer]');
    var bankSubmit = checkout.querySelector('[data-bank-transfer-submit]');
    var summaryAmount = document.querySelector('[data-payment-summary-amount]');
    var methodButtons = Array.prototype.slice.call(checkout.querySelectorAll('[data-payment-method]'));
    var methodPanels = Array.prototype.slice.call(checkout.querySelectorAll('[data-payment-panel]'));

    if (!agreements.length) return;

    function syncAgreementInputs() {
      agreements.forEach(function(agreement) {
        var hidden = checkout.querySelector('[data-payment-agreement-hidden="' + agreement.name + '"]');
        if (hidden) hidden.value = agreement.checked ? '1' : '0';
      });
    }

    function updateAvailability() {
      var enabled = allAgreementsAccepted(agreements);

      if (frameShell && iframe) {
        frameShell.classList.toggle('is-disabled', !enabled);
        frameShell.setAttribute('aria-disabled', String(!enabled));
        iframe.tabIndex = enabled ? 0 : -1;
      }

      if (bankTransfer) {
        bankTransfer.classList.toggle('is-disabled', !enabled);
        bankTransfer.setAttribute('aria-disabled', String(!enabled));
      }

      if (bankSubmit) {
        bankSubmit.disabled = !enabled;
        bankSubmit.setAttribute('aria-disabled', String(!enabled));
      }

      syncAgreementInputs();
    }

    function activateMethod(method) {
      methodButtons.forEach(function(button) {
        var isActive = button.dataset.paymentMethod === method;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-selected', String(isActive));
      });

      methodPanels.forEach(function(panel) {
        var isActive = panel.dataset.paymentPanel === method;
        panel.classList.toggle('is-active', isActive);
        panel.hidden = !isActive;
      });

      if (summaryAmount) {
        var amount = method === 'bank'
          ? summaryAmount.dataset.bankAmount
          : summaryAmount.dataset.cardAmount;
        if (amount) summaryAmount.textContent = amount + ' TL';
      }
    }

    agreements.forEach(function(agreement) {
      agreement.addEventListener('change', updateAvailability);
    });

    methodButtons.forEach(function(button) {
      button.addEventListener('click', function() {
        activateMethod(button.dataset.paymentMethod);
      });
    });

    updateAvailability();
    resizePaytrFrame();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPaymentGate);
  } else {
    initPaymentGate();
  }
})(window, document);
