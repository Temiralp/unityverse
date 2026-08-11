(function(root, factory) {
  'use strict';

  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.UnityverseEnrollmentLocations = api;
})(typeof window !== 'undefined' ? window : null, function(window) {
  'use strict';

  var COUNTRY_ENDPOINT = '/api/locations/countries';
  var SUBDIVISION_ENDPOINT = '/api/locations/subdivisions';
  var LOCALITY_ENDPOINT = '/api/locations/localities';
  var responseCache = new Map();

  function fetchItems(url, fetcher) {
    if (!responseCache.has(url)) {
      responseCache.set(url, fetcher(url, {
        credentials: 'same-origin',
        headers: { 'X-Requested-With': 'XMLHttpRequest' }
      }).then(function(response) {
        if (!response.ok) throw new Error('Konum bilgileri alınamadı.');
        return response.json();
      }).then(function(result) {
        if (!result || !Array.isArray(result.items)) {
          throw new Error('Konum bilgileri geçersiz.');
        }
        return result.items;
      }).catch(function(error) {
        responseCache.delete(url);
        throw error;
      }));
    }

    return responseCache.get(url);
  }

  function replaceOptions(select, items, placeholder, documentRef) {
    while (select.firstChild) select.removeChild(select.firstChild);

    var placeholderOption = documentRef.createElement('option');
    placeholderOption.value = '';
    placeholderOption.textContent = placeholder;
    select.appendChild(placeholderOption);

    items.forEach(function(item) {
      var option = documentRef.createElement('option');
      option.value = String(item.code || '');
      option.textContent = String(item.name || '');
      select.appendChild(option);
    });
  }

  function createEnrollmentLocationController(options) {
    var form = options.form;
    var fetcher = options.fetcher;
    var documentRef = options.documentRef;
    var country = form.querySelector('[data-enrollment-country]');
    var subdivision = form.querySelector('[data-enrollment-subdivision]');
    var locality = form.querySelector('[data-enrollment-locality]');
    var status = form.querySelector('[data-enrollment-location-status]');
    var subdivisionRequest = 0;
    var localityRequest = 0;

    if (!country || !subdivision || !locality) return null;

    function announce(message, isError) {
      if (!status) return;
      status.textContent = message || '';
      status.classList.toggle('is-error', Boolean(isError));
    }

    function resetSubdivision() {
      subdivisionRequest += 1;
      localityRequest += 1;
      replaceOptions(subdivision, [], 'Önce ülke seçiniz', documentRef);
      replaceOptions(locality, [], 'Önce il / bölge seçiniz', documentRef);
      subdivision.disabled = true;
      locality.disabled = true;
      subdivision.removeAttribute('aria-busy');
      locality.removeAttribute('aria-busy');
    }

    function resetLocality() {
      localityRequest += 1;
      replaceOptions(locality, [], 'Önce il / bölge seçiniz', documentRef);
      locality.disabled = true;
      locality.removeAttribute('aria-busy');
    }

    function loadCountries() {
      country.disabled = true;
      country.setAttribute('aria-busy', 'true');
      announce('Ülkeler yükleniyor.', false);

      return fetchItems(COUNTRY_ENDPOINT, fetcher).then(function(items) {
        replaceOptions(country, items, 'Ülke seçiniz', documentRef);
        country.disabled = false;
        announce('', false);
      }).catch(function() {
        replaceOptions(country, [], 'Ülkeler yüklenemedi', documentRef);
        announce('Konum bilgileri yüklenemedi. Lütfen pencereyi kapatıp tekrar deneyin.', true);
      }).finally(function() {
        country.removeAttribute('aria-busy');
      });
    }

    function loadSubdivisions() {
      var countryCode = String(country.value || '');
      var requestId = ++subdivisionRequest;
      resetLocality();

      if (!countryCode) {
        resetSubdivision();
        announce('', false);
        return Promise.resolve();
      }

      replaceOptions(subdivision, [], 'İl / bölge yükleniyor', documentRef);
      subdivision.disabled = true;
      subdivision.setAttribute('aria-busy', 'true');
      announce('İl / bölge bilgileri yükleniyor.', false);

      var url = SUBDIVISION_ENDPOINT + '?country=' + encodeURIComponent(countryCode);
      return fetchItems(url, fetcher).then(function(items) {
        if (requestId !== subdivisionRequest || country.value !== countryCode) return;
        replaceOptions(subdivision, items, 'İl / bölge seçiniz', documentRef);
        subdivision.disabled = false;
        announce('', false);
      }).catch(function() {
        if (requestId !== subdivisionRequest) return;
        replaceOptions(subdivision, [], 'İl / bölge yüklenemedi', documentRef);
        announce('İl / bölge bilgileri yüklenemedi. Lütfen tekrar deneyin.', true);
      }).finally(function() {
        if (requestId === subdivisionRequest) subdivision.removeAttribute('aria-busy');
      });
    }

    function loadLocalities() {
      var countryCode = String(country.value || '');
      var subdivisionCode = String(subdivision.value || '');
      var requestId = ++localityRequest;

      if (!countryCode || !subdivisionCode) {
        resetLocality();
        announce('', false);
        return Promise.resolve();
      }

      replaceOptions(locality, [], 'İlçe / şehir yükleniyor', documentRef);
      locality.disabled = true;
      locality.setAttribute('aria-busy', 'true');
      announce('İlçe / şehir bilgileri yükleniyor.', false);

      var url = LOCALITY_ENDPOINT
        + '?country=' + encodeURIComponent(countryCode)
        + '&subdivision=' + encodeURIComponent(subdivisionCode);
      return fetchItems(url, fetcher).then(function(items) {
        if (
          requestId !== localityRequest
          || country.value !== countryCode
          || subdivision.value !== subdivisionCode
        ) return;

        replaceOptions(locality, items, 'İlçe / şehir seçiniz', documentRef);
        locality.disabled = false;
        announce('', false);
      }).catch(function() {
        if (requestId !== localityRequest) return;
        replaceOptions(locality, [], 'İlçe / şehir yüklenemedi', documentRef);
        announce('İlçe / şehir bilgileri yüklenemedi. Lütfen tekrar deneyin.', true);
      }).finally(function() {
        if (requestId === localityRequest) locality.removeAttribute('aria-busy');
      });
    }

    resetSubdivision();
    country.addEventListener('change', loadSubdivisions);
    subdivision.addEventListener('change', loadLocalities);

    return {
      ready: loadCountries(),
      loadSubdivisions: loadSubdivisions,
      loadLocalities: loadLocalities
    };
  }

  function init(form) {
    if (!form || !window || typeof window.fetch !== 'function') return null;
    return createEnrollmentLocationController({
      form: form,
      fetcher: window.fetch.bind(window),
      documentRef: window.document
    });
  }

  return {
    createEnrollmentLocationController: createEnrollmentLocationController,
    init: init
  };
});
