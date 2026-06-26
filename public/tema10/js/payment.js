(function(window, document) {
  'use strict';

  function initPaytrFrame() {
    var iframe = document.getElementById('paytriframe');

    if (!iframe || typeof window.iFrameResize !== 'function') return;

    window.iFrameResize({
      checkOrigin: ['https://www.paytr.com']
    }, '#paytriframe');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPaytrFrame);
  } else {
    initPaytrFrame();
  }
})(window, document);
