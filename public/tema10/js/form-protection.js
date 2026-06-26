(function(window, document) {
  'use strict';

  var tokenPromises = {};
  var csrfTokenPromise = null;
  var protectedPaths = [
    { pattern: /\/ajax\/(?:sendCustomForm|askme)(?:\?|$)/, scope: 'lead' },
    { pattern: /\/ajax\/member\/(?:register|signin)(?:\?|$)/, scope: 'member' },
    { pattern: /\/ajax\/enroll(?:\?|$)/, scope: 'enrollment' }
  ];

  function absolutePath(url) {
    try {
      return new URL(url, window.location.href).pathname;
    } catch (error) {
      return String(url || '');
    }
  }

  function scopeForUrl(url) {
    var path = absolutePath(url);
    var match = protectedPaths.find(function(item) {
      return item.pattern.test(path);
    });

    return match ? match.scope : null;
  }

  function isSameOrigin(url) {
    try {
      return new URL(url, window.location.href).origin === window.location.origin;
    } catch (error) {
      return false;
    }
  }

  function isMutatingMethod(method) {
    return ['POST', 'PUT', 'PATCH', 'DELETE'].indexOf(String(method || 'GET').toUpperCase()) !== -1;
  }

  function addStylesheet() {
    if (document.querySelector('link[data-form-protection-style]')) return;

    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/public/tema10/css/form-protection.css';
    link.setAttribute('data-form-protection-style', '');
    document.head.appendChild(link);
  }

  function createTrap(scope, form) {
    if (form.querySelector('[data-form-trap="' + scope + '"]')) return;

    var trap = document.createElement('div');
    var input = document.createElement('input');

    trap.className = 'uv-form-trap';
    trap.setAttribute('aria-hidden', 'true');
    trap.setAttribute('data-form-trap', scope);
    input.type = 'text';
    input.name = 'website';
    input.tabIndex = -1;
    input.autocomplete = 'off';
    input.setAttribute('aria-hidden', 'true');
    trap.appendChild(input);
    form.appendChild(trap);
  }

  function createCsrfInput(form, token) {
    if (String(form.getAttribute('method') || '').toLowerCase() === 'get') {
      return;
    }

    var input = form.querySelector('input[name="_csrf"]');

    if (!input) {
      input = document.createElement('input');
      input.type = 'hidden';
      input.name = '_csrf';
      form.appendChild(input);
    }

    input.value = token;
  }

  function injectCsrfInputs(root, token) {
    var forms = root && root.querySelectorAll
      ? root.querySelectorAll('form')
      : [];

    Array.prototype.forEach.call(forms, function(form) {
      createCsrfInput(form, token);
    });
  }

  function prepareForms() {
    var leadForms = document.querySelectorAll(
      '[data-contact-form], form[id^="custom_form_"]'
    );
    var memberForms = document.querySelectorAll(
      '#registerForm, form[onsubmit*="signin"]'
    );

    Array.prototype.forEach.call(leadForms, function(form) {
      createTrap('lead', form);
    });
    Array.prototype.forEach.call(memberForms, function(form) {
      createTrap('member', form);
    });

    if (document.getElementById('ask_name') && !document.querySelector('[data-form-trap="lead"]')) {
      createTrap('lead', document.body);
    }

    if (leadForms.length || document.getElementById('ask_name')) {
      loadToken('lead').catch(function() {});
    }

    if (memberForms.length) {
      loadToken('member').catch(function() {});
    }

    loadCsrfToken()
      .then(function(token) {
        injectCsrfInputs(document, token);
      })
      .catch(function() {});
  }

  function loadToken(scope) {
    if (!tokenPromises[scope]) {
      tokenPromises[scope] = fetch('/api/form-protection-token?scope=' + encodeURIComponent(scope), {
        credentials: 'same-origin',
        headers: {
          'X-Requested-With': 'XMLHttpRequest'
        }
      })
        .then(function(response) {
          if (!response.ok) throw new Error('Form protection token could not be loaded.');
          return response.json();
        })
        .then(function(result) {
          if (!result.token) throw new Error('Form protection token is missing.');
          return result.token;
        });
    }

    return tokenPromises[scope];
  }

  function requestCsrfToken() {
    return fetch('/api/csrf-token', {
        credentials: 'same-origin',
        headers: {
          'X-Requested-With': 'XMLHttpRequest'
        }
      })
        .then(function(response) {
          if (!response.ok) throw new Error('CSRF token could not be loaded.');
          return response.json();
        })
        .then(function(result) {
          if (!result.token) throw new Error('CSRF token is missing.');
          return result.token;
        });
  }

  function loadCsrfToken() {
    if (!csrfTokenPromise) {
      csrfTokenPromise = requestCsrfToken();
    }

    return csrfTokenPromise;
  }

  function refreshCsrfToken() {
    csrfTokenPromise = null;
    return loadCsrfToken().then(function(token) {
      injectCsrfInputs(document, token);
      return token;
    });
  }

  function trapValue(scope) {
    var traps = document.querySelectorAll('[data-form-trap="' + scope + '"] input[name="website"]');
    var value = '';

    Array.prototype.some.call(traps, function(input) {
      value = String(input.value || '').trim();
      return Boolean(value);
    });

    return value;
  }

  function memberRedirect() {
    var redirect = new URLSearchParams(window.location.search).get('redirect');

    if (!redirect || redirect.charAt(0) !== '/' || redirect.indexOf('//') === 0) {
      return '';
    }

    return redirect;
  }

  function addProtection(data, scope, token) {
    var protection = {
      _formToken: token,
      website: trapValue(scope)
    };
    var redirect = scope === 'member' ? memberRedirect() : '';

    if (redirect) {
      protection.redirect = redirect;
    }

    if (window.FormData && data instanceof window.FormData) {
      data.set('_formToken', token);
      data.set('website', protection.website);
      if (redirect) data.set('redirect', redirect);
      return data;
    }

    if (window.URLSearchParams && data instanceof window.URLSearchParams) {
      data.set('_formToken', token);
      data.set('website', protection.website);
      if (redirect) data.set('redirect', redirect);
      return data;
    }

    if (typeof data === 'string') {
      try {
        var parsed = JSON.parse(data);
        parsed._formToken = token;
        parsed.website = protection.website;
        if (redirect) parsed.redirect = redirect;
        return JSON.stringify(parsed);
      } catch (error) {
        var params = new URLSearchParams(data);
        params.set('_formToken', token);
        params.set('website', protection.website);
        if (redirect) params.set('redirect', redirect);
        return params.toString();
      }
    }

    return Object.assign({}, data || {}, protection);
  }

  function addCsrf(data, token) {
    if (window.FormData && data instanceof window.FormData) {
      data.set('_csrf', token);
      return data;
    }

    if (window.URLSearchParams && data instanceof window.URLSearchParams) {
      data.set('_csrf', token);
      return data;
    }

    if (typeof data === 'string') {
      try {
        var parsed = JSON.parse(data);
        parsed._csrf = token;
        return JSON.stringify(parsed);
      } catch (error) {
        var params = new URLSearchParams(data);
        params.set('_csrf', token);
        return params.toString();
      }
    }

    return Object.assign({}, data || {}, { _csrf: token });
  }

  function protectedFetch(url, options, data, scope) {
    var requestOptions = Object.assign({}, options || {});
    var originalData = data;

    function execute(retried) {
      return Promise.all([
        scope ? loadToken(scope) : Promise.resolve(null),
        loadCsrfToken()
      ]).then(function(tokens) {
        var requestData = originalData;

        if (scope) {
          requestData = addProtection(requestData, scope, tokens[0]);
        }
        requestData = addCsrf(requestData, tokens[1]);

        return fetch(url, Object.assign({}, requestOptions, {
          body: requestData,
          credentials: requestOptions.credentials || 'same-origin'
        }));
      }).then(function(response) {
        if (response.status !== 403 || retried) {
          return response;
        }

        return response.clone().json()
          .catch(function() {
            return {};
          })
          .then(function(result) {
            if (result.code !== 'CSRF_TOKEN_INVALID') {
              return response;
            }

            return refreshCsrfToken().then(function() {
              return execute(true);
            });
          });
      });
    }

    return execute(false);
  }

  function installJqueryGuard() {
    if (!window.jQuery || window.jQuery.ajax.__formProtectionWrapped) return;

    var $ = window.jQuery;
    var originalAjax = $.ajax;

    function protectedAjax(url, options) {
      var settings = typeof url === 'object'
        ? Object.assign({}, url)
        : Object.assign({}, options || {}, { url: url });
      var scope = scopeForUrl(settings.url);
      var needsCsrf = isSameOrigin(settings.url) && isMutatingMethod(settings.type || settings.method);

      if (!scope && !needsCsrf) {
        return originalAjax.apply($, arguments);
      }

      var deferred = $.Deferred();
      var activeRequest = null;
      var originalData = settings.data;
      var successCallback = settings.success;
      var errorCallback = settings.error;
      var completeCallback = settings.complete;
      var requestSettings = Object.assign({}, settings);
      delete requestSettings.success;
      delete requestSettings.error;
      delete requestSettings.complete;

      function execute(retried) {
        Promise.all([
          scope ? loadToken(scope) : Promise.resolve(null),
          needsCsrf ? loadCsrfToken() : Promise.resolve(null)
        ]).then(function(tokens) {
          requestSettings.data = originalData;
          if (scope) {
            requestSettings.data = addProtection(requestSettings.data, scope, tokens[0]);
          }
          if (needsCsrf) {
            requestSettings.data = addCsrf(requestSettings.data, tokens[1]);
          }

          activeRequest = originalAjax.call($, requestSettings);
          activeRequest.done(function(data, textStatus, jqXHR) {
            if (typeof successCallback === 'function') {
              successCallback.call(requestSettings.context || requestSettings, data, textStatus, jqXHR);
            }
            if (typeof completeCallback === 'function') {
              completeCallback.call(requestSettings.context || requestSettings, jqXHR, textStatus);
            }
            deferred.resolve.apply(deferred, arguments);
          });
          activeRequest.fail(function(jqXHR, textStatus, errorThrown) {
            var response = jqXHR && jqXHR.responseJSON;
            var csrfFailed = jqXHR
              && jqXHR.status === 403
              && response
              && response.code === 'CSRF_TOKEN_INVALID';

            if (csrfFailed && needsCsrf && !retried) {
              refreshCsrfToken()
                .then(function() {
                  execute(true);
                })
                .catch(function(error) {
                  deferred.reject(jqXHR, 'error', error);
                });
              return;
            }

            if (typeof errorCallback === 'function') {
              errorCallback.call(requestSettings.context || requestSettings, jqXHR, textStatus, errorThrown);
            }
            if (typeof completeCallback === 'function') {
              completeCallback.call(requestSettings.context || requestSettings, jqXHR, textStatus);
            }
            deferred.reject.apply(deferred, arguments);
          });
        }).catch(function(error) {
          deferred.reject(null, 'error', error);
        });
      }

      execute(false);

      var promise = deferred.promise();
      promise.abort = function() {
        if (activeRequest && typeof activeRequest.abort === 'function') {
          activeRequest.abort();
        }
      };
      return promise;
    }

    protectedAjax.__formProtectionWrapped = true;
    $.ajax = protectedAjax;
  }

  window.UnityverseFormProtection = {
    addProtection: function(data, scope) {
      return Promise.all([loadToken(scope), loadCsrfToken()]).then(function(tokens) {
        return addCsrf(addProtection(data, scope, tokens[0]), tokens[1]);
      });
    },
    addCsrf: function(data) {
      return loadCsrfToken().then(function(token) {
        return addCsrf(data, token);
      });
    },
    refreshCsrf: function(data) {
      return refreshCsrfToken().then(function(token) {
        return addCsrf(data, token);
      });
    },
    fetch: protectedFetch,
    prepareForms: prepareForms
  };

  addStylesheet();
  installJqueryGuard();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', prepareForms);
  } else {
    prepareForms();
  }

  if (window.MutationObserver) {
    new MutationObserver(function(mutations) {
      loadCsrfToken()
        .then(function(token) {
          mutations.forEach(function(mutation) {
            Array.prototype.forEach.call(mutation.addedNodes || [], function(node) {
              if (!node || node.nodeType !== 1) return;
              if (node.matches && node.matches('form')) createCsrfInput(node, token);
              injectCsrfInputs(node, token);
            });
          });
        })
        .catch(function() {});
    }).observe(document.documentElement, { childList: true, subtree: true });
  }
})(window, document);
