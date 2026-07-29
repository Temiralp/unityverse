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

  function initCouponSection() {
    var section = document.querySelector('[data-coupon-section]');
    if (!section) return;

    var registrationId = section.dataset.registrationId;
    var inputGroup = section.querySelector('[data-coupon-input-group]');
    var input = section.querySelector('[data-coupon-input]');
    var applyBtn = section.querySelector('[data-coupon-apply]');
    var removeBtn = section.querySelector('[data-coupon-remove]');
    var appliedBox = section.querySelector('[data-coupon-applied]');
    var messageEl = section.querySelector('[data-coupon-message]');
    var summaryAmount = document.querySelector('[data-payment-summary-amount]');

    if (!input || !applyBtn) return;

    function showMessage(text, isError) {
      if (!messageEl) return;
      messageEl.textContent = text;
      messageEl.className = 'uv-coupon-message ' + (isError ? 'is-error' : 'is-success');
      messageEl.style.display = text ? 'block' : 'none';
    }

    function updatePrices(newTotal, bankTransferAmount) {
      if (summaryAmount) {
        summaryAmount.dataset.cardAmount = newTotal;
        if (bankTransferAmount) summaryAmount.dataset.bankAmount = bankTransferAmount;

        var activeMethod = document.querySelector('[data-payment-method].is-active');
        var method = activeMethod ? activeMethod.dataset.paymentMethod : 'card';
        summaryAmount.textContent = (method === 'bank' ? bankTransferAmount : newTotal) + ' TL';
      }
    }

    function showApplied(code, discount) {
      if (appliedBox) {
        var codeEl = appliedBox.querySelector('[data-coupon-applied-code]') || appliedBox.querySelector('strong');
        var discountEl = appliedBox.querySelector('[data-coupon-applied-discount]') || appliedBox.querySelector('span');
        if (codeEl) codeEl.textContent = code;
        if (discountEl) discountEl.textContent = '-' + discount + ' TL indirim';
        appliedBox.style.display = '';
      }
      if (inputGroup) inputGroup.style.display = 'none';
    }

    function showInput() {
      if (appliedBox) appliedBox.style.display = 'none';
      if (inputGroup) inputGroup.style.display = '';
      if (input) input.value = '';
      showMessage('', false);
    }

    applyBtn.addEventListener('click', function() {
      var code = input.value.trim();
      if (!code) {
        showMessage('Kupon kodu giriniz.', true);
        return;
      }

      applyBtn.disabled = true;
      applyBtn.textContent = 'Kontrol ediliyor...';
      showMessage('', false);

      fetch('/odeme/' + registrationId + '/coupon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code })
      })
        .then(function(res) { return res.json(); })
        .then(function(data) {
          applyBtn.disabled = false;
          applyBtn.textContent = 'Uygula';

          if (data.success) {
            showMessage(data.message, false);
            showApplied(data.couponCode, data.discount);
            updatePrices(data.newTotal, data.bankTransferAmount);

            // Reload page to get fresh PayTR token with new amount
            setTimeout(function() { window.location.reload(); }, 1500);
          } else {
            showMessage(data.message, true);
          }
        })
        .catch(function() {
          applyBtn.disabled = false;
          applyBtn.textContent = 'Uygula';
          showMessage('Bir hata oluştu. Lütfen tekrar deneyin.', true);
        });
    });

    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        applyBtn.click();
      }
    });

    if (removeBtn) {
      removeBtn.addEventListener('click', function() {
        removeBtn.disabled = true;
        removeBtn.textContent = 'Kaldırılıyor...';

        fetch('/odeme/' + registrationId + '/coupon/remove', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })
          .then(function(res) { return res.json(); })
          .then(function(data) {
            removeBtn.disabled = false;
            removeBtn.textContent = 'Kaldır';

            if (data.success) {
              showMessage(data.message, false);
              showInput();
              updatePrices(data.newTotal, data.bankTransferAmount);

              // Reload page to get fresh PayTR token with original amount
              setTimeout(function() { window.location.reload(); }, 1500);
            } else {
              showMessage(data.message, true);
            }
          })
          .catch(function() {
            removeBtn.disabled = false;
            removeBtn.textContent = 'Kaldır';
            showMessage('Bir hata oluştu. Lütfen tekrar deneyin.', true);
          });
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      initPaymentGate();
      initCouponSection();
    });
  } else {
    initPaymentGate();
    initCouponSection();
  }
})(window, document);
