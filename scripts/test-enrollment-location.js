#!/usr/bin/env node

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const datasetPath = path.join(root, 'src/data/locations/v1.json');
const locationsPath = path.join(root, 'src/services/locations.js');
const apiRoutesPath = path.join(root, 'src/routes/api.js');
const locationRoutesPath = path.join(root, 'src/routes/locations.js');
const enrollmentRoutesPath = path.join(root, 'src/routes/enrollments.js');
const serverPath = path.join(root, 'src/server.js');
const catalogRoutesPath = path.join(root, 'src/routes/catalog.js');
const legacyAssetsPath = path.join(root, 'src/services/legacy-assets.js');
const controllerPath = path.join(root, 'public/tema10/js/enrollment-location.js');
const managedViewPath = path.join(root, 'src/views/catalog/product.ejs');
const managedScriptPath = path.join(root, 'public/tema10/js/product-detail.js');
const managedCssPath = path.join(root, 'public/tema10/css/product-detail.css');
const legacyScriptPath = path.join(root, 'public/tema10/js/scripts.js');
const legacyCssPath = path.join(root, 'public/tema10/css/home2.css');

[
  datasetPath,
  locationsPath,
  apiRoutesPath,
  locationRoutesPath,
  enrollmentRoutesPath,
  serverPath,
  catalogRoutesPath,
  legacyAssetsPath,
  controllerPath,
  managedViewPath,
  managedScriptPath,
  managedCssPath,
  legacyScriptPath,
  legacyCssPath
].forEach((file) => {
  assert.equal(fs.existsSync(file), true, `Missing enrollment location file: ${path.relative(root, file)}`);
});

const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));
const {
  LocationDataError,
  LocationSelectionError,
  createLocationService
} = require(locationsPath);

function country(code) {
  return dataset.countries.find((item) => item.code === code);
}

function chain(countryCode, excludedSubdivisionCode = null) {
  const selectedCountry = country(countryCode);
  assert(selectedCountry, `${countryCode} country is missing from the canonical dataset`);

  const subdivision = selectedCountry.subdivisions.find((item) => (
    item.code !== excludedSubdivisionCode && Array.isArray(item.localities) && item.localities.length > 0
  ));
  assert(subdivision, `${countryCode} has no subdivision with a locality`);

  return {
    country: selectedCountry,
    subdivision,
    locality: subdivision.localities[0]
  };
}

function expectSelectionError(callback, field) {
  assert.throws(callback, (error) => {
    assert(error instanceof LocationSelectionError);
    assert.equal(error.field, field);
    return true;
  });
}

function serviceContractTests() {
  assert.equal(dataset.version, 'v1');
  assert(Array.isArray(dataset.countries));
  assert(dataset.countries.length >= 190, 'Worldwide country coverage is unexpectedly incomplete');
  assert.equal(typeof LocationDataError, 'function');
  assert.equal(typeof LocationSelectionError, 'function');

  const service = createLocationService(dataset);
  const countries = service.listCountries();
  assert(countries.some((item) => item.code === 'TR'));
  assert(countries.some((item) => item.code === 'AZ'));

  const turkey = chain('TR');
  const azerbaijan = chain('AZ');
  const otherTurkishSubdivision = chain('TR', turkey.subdivision.code);

  assert(service.listSubdivisions('TR').some((item) => item.code === turkey.subdivision.code));
  assert(service.listSubdivisions('AZ').some((item) => item.code === azerbaijan.subdivision.code));
  assert(service.listLocalities('TR', turkey.subdivision.code).some((item) => (
    String(item.code) === String(turkey.locality.code)
  )));

  const resolvedTurkey = service.resolveHierarchy({
    country: turkey.country.code,
    city: turkey.subdivision.code,
    district: turkey.locality.code
  });
  assert.deepEqual(resolvedTurkey, {
    country: { code: turkey.country.code, name: turkey.country.name },
    subdivision: { code: turkey.subdivision.code, name: turkey.subdivision.name },
    locality: { code: turkey.locality.code, name: turkey.locality.name }
  });

  const resolvedAzerbaijan = service.resolveHierarchy({
    country: azerbaijan.country.code,
    city: azerbaijan.subdivision.code,
    district: azerbaijan.locality.code
  });
  assert.equal(resolvedAzerbaijan.country.code, 'AZ');
  assert.equal(resolvedAzerbaijan.subdivision.code, azerbaijan.subdivision.code);
  assert.equal(String(resolvedAzerbaijan.locality.code), String(azerbaijan.locality.code));

  expectSelectionError(() => service.resolveHierarchy({ country: '', city: '', district: '' }), 'country');
  expectSelectionError(() => service.resolveHierarchy({
    country: 'XX',
    city: turkey.subdivision.code,
    district: turkey.locality.code
  }), 'country');
  expectSelectionError(() => service.resolveHierarchy({
    country: 'TR',
    city: azerbaijan.subdivision.code,
    district: azerbaijan.locality.code
  }), 'city');
  expectSelectionError(() => service.resolveHierarchy({
    country: 'TR',
    city: turkey.subdivision.code,
    district: otherTurkishSubdivision.locality.code
  }), 'district');
  expectSelectionError(() => service.resolveHierarchy({
    country: 'TR',
    city: turkey.subdivision.code,
    district: ''
  }), 'district');
  expectSelectionError(() => service.resolveHierarchy({
    country: ['TR'],
    city: turkey.subdivision.code,
    district: turkey.locality.code
  }), 'country');
  expectSelectionError(() => service.resolveHierarchy({
    country: 'TR',
    city: { code: turkey.subdivision.code },
    district: turkey.locality.code
  }), 'city');
  expectSelectionError(() => service.resolveHierarchy({
    country: 'TR',
    city: turkey.subdivision.code,
    district: [turkey.locality.code]
  }), 'district');
}

function backendIntegrationContracts() {
  const enrollmentSource = fs.readFileSync(enrollmentRoutesPath, 'utf8');
  const apiRouteSource = fs.readFileSync(apiRoutesPath, 'utf8');
  const locationRouteSource = fs.readFileSync(locationRoutesPath, 'utf8');
  const serverSource = fs.readFileSync(serverPath, 'utf8');

  assert.match(enrollmentSource, /getLocationService/);
  assert.match(enrollmentSource, /resolveHierarchy\s*\(/);
  assert.match(enrollmentSource, /LocationSelectionError/);
  assert.match(enrollmentSource, /REGISTRATION_PROFILE_INVALID/);
  assert.match(enrollmentSource, /errors\s*:\s*\{[\s\S]*\[error\.field\]/);
  assert.match(enrollmentSource, /country\s*:\s*location\.country\.name/);
  assert.match(enrollmentSource, /city\s*:\s*location\.subdivision\.name/);
  assert.match(enrollmentSource, /district\s*:\s*location\.locality\.name/);
  assert.match(enrollmentSource, /countryCode\s*:\s*location\.country\.code/);
  assert.match(enrollmentSource, /subdivisionCode\s*:\s*location\.subdivision\.code/);
  assert.match(enrollmentSource, /localityCode\s*:\s*location\.locality\.code/);

  assert.match(locationRouteSource, /router\.get\(['"]\/countries['"]/);
  assert.match(locationRouteSource, /router\.get\(['"]\/subdivisions['"]/);
  assert.match(locationRouteSource, /router\.get\(['"]\/localities['"]/);
  assert.match(locationRouteSource, /router\.get\(['"]\/dataset\/v1\.json['"]/);
  assert.match(locationRouteSource, /sendFile\(DATASET_PATH\)/);
  assert.match(locationRouteSource, /version\s*:\s*locationService\.version/);
  assert.match(locationRouteSource, /items/);
  assert.match(apiRouteSource, /require\(['"]\.\/locations['"]\)/);
  assert.match(apiRouteSource, /router\.use\(['"]\/locations['"],\s*locationRoutes\s*\)/);
  assert.match(serverSource, /require\(['"]\.\/routes\/api['"]\)/);
  assert.match(serverSource, /app\.use\(['"]\/api['"],\s*apiRoutes\s*\)/);
}

function formLocationContracts(source, label) {
  const controllerHooks = {
    country: 'country',
    city: 'subdivision',
    district: 'locality'
  };

  ['country', 'city', 'district'].forEach((field) => {
    assert.match(source, new RegExp(`name=["']${field}["']`), `${label} is missing ${field} select`);
    assert.match(
      source,
      new RegExp(`data-enrollment-${controllerHooks[field]}`),
      `${label} is missing ${field} controller hook`
    );
    assert.match(source, new RegExp(`data-enrollment-error=["']${field}["']`), `${label} is missing ${field} error hook`);
  });

  const countrySelect = source.match(/<select[^>]*name=["']country["'][^>]*>/)?.[0] || '';
  const citySelect = source.match(/<select[^>]*name=["']city["'][^>]*>/)?.[0] || '';
  const districtSelect = source.match(/<select[^>]*name=["']district["'][^>]*>/)?.[0] || '';
  assert(countrySelect, `${label} country must be a select`);
  assert.match(citySelect, /disabled/, `${label} city must start disabled`);
  assert.match(districtSelect, /disabled/, `${label} district must start disabled`);
  assert.match(source, /<option value=["']["']>[^<]*(?:Ülke|Ölkə|Country)[^<]*<\/option>/i);
  assert.match(source, /Vazgeç/);
  assert.match(source, /\/api\/locations\/dataset\/v1\.json/);
}

function frontendContracts() {
  const controller = fs.readFileSync(controllerPath, 'utf8');
  const managedView = fs.readFileSync(managedViewPath, 'utf8');
  const managedScript = fs.readFileSync(managedScriptPath, 'utf8');
  const managedCss = fs.readFileSync(managedCssPath, 'utf8');
  const legacyScript = fs.readFileSync(legacyScriptPath, 'utf8');
  const legacyCss = fs.readFileSync(legacyCssPath, 'utf8');

  formLocationContracts(managedView, 'managed enrollment form');
  formLocationContracts(legacyScript, 'legacy enrollment form');

  assert.match(managedView, /uv-enrollment-modal__close[^>]*data-enrollment-close/);
  assert((managedView.match(/data-enrollment-close/g) || []).length >= 2, 'Managed modal needs X and Vazgeç close controls');
  assert.match(legacyScript, /uv-legacy-profile-completion__close/);
  assert.match(legacyScript, /uv-legacy-profile-completion__cancel/);

  assert.match(controller, /api\/locations\/countries/);
  assert.match(controller, /api\/locations\/subdivisions/);
  assert.match(controller, /api\/locations\/localities/);
  assert.match(controller, /data-enrollment-country/);
  assert.match(controller, /data-enrollment-subdivision/);
  assert.match(controller, /data-enrollment-locality/);
  assert.match(controller, /UnityverseEnrollmentLocations/);
  assert.match(controller, /createEnrollmentLocationController/);
  assert.match(controller, /\.disabled\s*=\s*true/);
  assert.match(controller, /\.value\s*=\s*['"]["']/);
  assert.match(controller, /aria-busy/);
  assert.match(controller, /addEventListener\(['"]change['"]/);

  assert.match(managedScript, /UnityverseEnrollmentLocation/);
  assert.match(legacyScript, /UnityverseEnrollmentLocation/);
  assert.match(managedScript, /event\.key\s*===\s*['"]Escape['"]/);
  assert.match(legacyScript, /event\.key\s*===\s*['"]Escape['"]/);
  assert.match(managedScript, /closeButtons\.forEach[\s\S]*addEventListener\(['"]click['"],\s*closeModal\)/);
  assert.match(legacyScript, /profileCompletion\.close\.addEventListener\(['"]click['"],\s*closeProfileCompletion\)/);
  assert.match(legacyScript, /profileCompletion\.cancel\.addEventListener\(['"]click['"],\s*closeProfileCompletion\)/);

  const managedEnrollment = managedScript.slice(
    managedScript.indexOf('function initEnrollment'),
    managedScript.indexOf('function initProductDetail')
  );
  const legacyEnrollment = legacyScript.slice(
    legacyScript.indexOf('function ensureProfileCompletion'),
    legacyScript.indexOf('function openProfileCompletion')
  );
  assert.doesNotMatch(managedEnrollment, /event\.target\s*===\s*modal/);
  assert.doesNotMatch(legacyEnrollment, /event\.target\s*===\s*modal/);

  assert.match(managedCss, /@media \(max-width: 640px\)[\s\S]*\.uv-enrollment-member\s*\{[\s\S]*grid-template-columns:\s*1fr/);
  assert.match(legacyCss, /@media \(max-width:\s*640px\)[\s\S]*\.uv-legacy-profile-completion__form\s*\{[\s\S]*grid-template-columns:\s*1fr/);
}

function assetWiringTests() {
  const catalogSource = fs.readFileSync(catalogRoutesPath, 'utf8');
  const locationAssetIndex = catalogSource.indexOf('/public/tema10/js/enrollment-location.js');
  const managedAssetIndex = catalogSource.indexOf('/public/tema10/js/product-detail.js');
  assert(locationAssetIndex >= 0, 'Managed product page must load the shared location controller');
  assert(
    locationAssetIndex < managedAssetIndex,
    'Managed product page must load the location controller before product-detail.js'
  );

  const { ensureLegacyAssetVersions } = require(legacyAssetsPath);
  const legacyCatalogHtml = [
    '<html><head></head><body>',
    '<div class="legacy-course-catalog"></div>',
    '<script src="/public/tema10/js/scripts.js?v=old"></script>',
    '</body></html>'
  ].join('');
  const updatedHtml = ensureLegacyAssetVersions(legacyCatalogHtml);
  const legacyLocationIndex = updatedHtml.indexOf('/public/tema10/js/enrollment-location.js');
  const legacyScriptsIndex = updatedHtml.indexOf('/public/tema10/js/scripts.js');
  assert(legacyLocationIndex >= 0, 'Legacy catalog response must inject the shared location controller');
  assert(
    legacyLocationIndex < legacyScriptsIndex,
    'Legacy catalog response must load the location controller before scripts.js'
  );
  assert.equal(
    updatedHtml.match(/public\/tema10\/js\/enrollment-location\.js/g)?.length,
    1,
    'Legacy asset injection must be idempotent'
  );
  assert.equal(ensureLegacyAssetVersions(updatedHtml), updatedHtml);

  const legacyProductHtml = [
    '<html><head></head><body>',
    '<div id="product_details_content"></div>',
    '<script src="/public/tema10/js/scripts.js?v=old"></script>',
    '</body></html>'
  ].join('');
  const updatedProductHtml = ensureLegacyAssetVersions(legacyProductHtml);
  assert.match(updatedProductHtml, /public\/tema10\/js\/enrollment-location\.js/);
  assert.equal(ensureLegacyAssetVersions(updatedProductHtml), updatedProductHtml);
}

async function invokeLocationRoute(routePath, query) {
  const router = require(locationRoutesPath);
  const layer = router.stack.find((candidate) => (
    candidate.route?.path === routePath && candidate.route.methods?.get
  ));
  assert(layer, `Missing GET ${routePath} route`);

  const response = { status: 200, headers: {}, body: null, file: null };
  const res = {
    status(statusCode) {
      response.status = statusCode;
      return this;
    },
    set(name, value) {
      if (name && typeof name === 'object') {
        Object.entries(name).forEach(([headerName, headerValue]) => {
          response.headers[String(headerName).toLowerCase()] = String(headerValue);
        });
        return this;
      }
      response.headers[String(name).toLowerCase()] = String(value);
      return this;
    },
    json(body) {
      response.body = body;
      return this;
    },
    sendFile(file) {
      response.file = file;
      return this;
    }
  };
  await layer.route.stack[0].handle({ query }, res, (error) => {
    if (error) throw error;
  });
  return response;
}

async function apiRouteBehaviorTests() {
  const countries = await invokeLocationRoute('/countries', {});
  assert.equal(countries.status, 200);
  assert.equal(countries.headers['cache-control'], 'private, max-age=300');
  assert.equal(countries.body.version, 'v1');
  assert(Array.isArray(countries.body.items));

  const downloadableDataset = await invokeLocationRoute('/dataset/v1.json', {});
  assert.equal(downloadableDataset.status, 200);
  assert.equal(downloadableDataset.file, datasetPath);
  assert.equal(downloadableDataset.headers['cache-control'], 'private, max-age=300');
  assert.match(downloadableDataset.headers['content-disposition'], /unityverse-locations-v1\.json/);

  const turkey = chain('TR');
  const validSubdivisions = await invokeLocationRoute('/subdivisions', { country: 'TR' });
  assert.equal(validSubdivisions.status, 200);
  assert(validSubdivisions.body.items.some((item) => item.code === turkey.subdivision.code));

  const validLocalities = await invokeLocationRoute('/localities', {
    country: 'TR',
    subdivision: turkey.subdivision.code
  });
  assert.equal(validLocalities.status, 200);
  assert(validLocalities.body.items.some((item) => String(item.code) === String(turkey.locality.code)));

  const rejectedQueries = [
    ['/countries', { extra: '1' }],
    ['/subdivisions', {}],
    ['/subdivisions', { country: 'TR', extra: '1' }],
    ['/subdivisions', { country: ['TR', 'AZ'] }],
    ['/localities', { country: 'TR' }],
    ['/localities', { country: 'TR', subdivision: turkey.subdivision.code, extra: '1' }],
    ['/localities', { country: 'TR', subdivision: [turkey.subdivision.code, 'OTHER'] }]
  ];
  for (const [routePath, query] of rejectedQueries) {
    const response = await invokeLocationRoute(routePath, query);
    assert.equal(response.status, 400, `${routePath} must reject malformed query shape`);
  }

  const unknownCountry = await invokeLocationRoute('/subdivisions', { country: 'XX' });
  assert.equal(unknownCountry.status, 404);
}

function fakeSelect(initialValue = '') {
  const listeners = new Map();
  const attributes = new Map();

  return {
    value: initialValue,
    disabled: false,
    children: [],
    get firstChild() {
      return this.children[0] || null;
    },
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    removeChild(child) {
      const index = this.children.indexOf(child);
      if (index >= 0) this.children.splice(index, 1);
      if (this.children.length === 0) this.value = '';
      return child;
    },
    setAttribute(name, value) {
      attributes.set(name, String(value));
    },
    removeAttribute(name) {
      attributes.delete(name);
    },
    getAttribute(name) {
      return attributes.get(name) || null;
    },
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    async dispatch(type) {
      const listener = listeners.get(type);
      if (listener) await listener({ type, target: this });
    }
  };
}

async function controllerBehaviorTests() {
  const { createEnrollmentLocationController, init } = require(controllerPath);
  assert.equal(typeof createEnrollmentLocationController, 'function');
  assert.equal(typeof init, 'function');

  const countrySelect = fakeSelect();
  const subdivisionSelect = fakeSelect();
  const localitySelect = fakeSelect();
  const statusClasses = new Set();
  const status = {
    textContent: '',
    classList: {
      toggle(name, enabled) {
        if (enabled) statusClasses.add(name);
        else statusClasses.delete(name);
      }
    }
  };
  const controls = {
    '[data-enrollment-country]': countrySelect,
    '[data-enrollment-subdivision]': subdivisionSelect,
    '[data-enrollment-locality]': localitySelect,
    '[data-enrollment-location-status]': status
  };
  const requests = [];
  const responses = {
    '/api/locations/countries': [
      { code: 'TR', name: 'Türkiye' },
      { code: 'AZ', name: 'Azərbaycan' }
    ],
    '/api/locations/subdivisions?country=TR': [
      { code: '34', name: 'İstanbul' },
      { code: '06', name: 'Ankara' }
    ],
    '/api/locations/localities?country=TR&subdivision=34': [
      { code: '3401', name: 'Kadıköy' }
    ]
  };
  const fetcher = async (url, options) => {
    requests.push({ url, options });
    assert(Object.hasOwn(responses, url), `Unexpected location endpoint: ${url}`);
    return {
      ok: true,
      async json() {
        return { version: 'v1', items: responses[url] };
      }
    };
  };
  const documentRef = {
    createElement(tagName) {
      assert.equal(tagName, 'option');
      return { value: '', textContent: '' };
    }
  };
  const form = {
    querySelector(selector) {
      return controls[selector] || null;
    }
  };

  const controller = createEnrollmentLocationController({ form, fetcher, documentRef });
  assert(controller, 'Controller must initialize when all three location selects exist');
  assert.equal(subdivisionSelect.disabled, true);
  assert.equal(localitySelect.disabled, true);

  await controller.ready;
  assert.equal(countrySelect.disabled, false);
  assert.deepEqual(countrySelect.children.map((option) => option.value), ['', 'TR', 'AZ']);
  assert.equal(countrySelect.getAttribute('aria-busy'), null);
  assert.equal(requests[0].url, '/api/locations/countries');
  assert.equal(requests[0].options.credentials, 'same-origin');

  countrySelect.value = 'TR';
  await countrySelect.dispatch('change');
  assert.equal(subdivisionSelect.disabled, false);
  assert.equal(localitySelect.disabled, true);
  assert.deepEqual(subdivisionSelect.children.map((option) => option.value), ['', '34', '06']);
  assert.deepEqual(localitySelect.children.map((option) => option.value), ['']);

  subdivisionSelect.value = '34';
  await subdivisionSelect.dispatch('change');
  assert.equal(localitySelect.disabled, false);
  assert.deepEqual(localitySelect.children.map((option) => option.value), ['', '3401']);

  countrySelect.value = '';
  await countrySelect.dispatch('change');
  assert.equal(subdivisionSelect.disabled, true);
  assert.equal(localitySelect.disabled, true);
  assert.equal(subdivisionSelect.value, '');
  assert.equal(localitySelect.value, '');
  assert.deepEqual(subdivisionSelect.children.map((option) => option.value), ['']);
  assert.deepEqual(localitySelect.children.map((option) => option.value), ['']);
  assert.equal(status.textContent, '');
  assert.equal(statusClasses.has('is-error'), false);
}

async function main() {
  serviceContractTests();
  backendIntegrationContracts();
  frontendContracts();
  assetWiringTests();
  await apiRouteBehaviorTests();
  await controllerBehaviorTests();

  console.log('Enrollment location hierarchy and modal contract tests passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
