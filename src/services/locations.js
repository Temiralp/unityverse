const fs = require('fs');
const path = require('path');

const DATASET_VERSION = 'v1';
const DATASET_PATH = path.join(__dirname, '..', 'data', 'locations', `${DATASET_VERSION}.json`);
const MAX_COUNTRIES = 300;
const MAX_SUBDIVISIONS_PER_COUNTRY = 1_000;
const MAX_LOCALITIES_PER_SUBDIVISION = 25_000;
const MAX_TOTAL_LOCALITIES = 500_000;

class LocationDataError extends Error {
  constructor(message) {
    super(message);
    this.name = 'LocationDataError';
  }
}

class LocationSelectionError extends Error {
  constructor(field, message) {
    super(message);
    this.name = 'LocationSelectionError';
    this.field = field;
  }
}

function requiredText(value, label, maxLength = 100) {
  const result = String(value == null ? '' : value).trim();
  if (!result || result.length > maxLength) {
    throw new LocationDataError(`${label} boş olamaz ve ${maxLength} karakteri geçemez.`);
  }
  return result;
}

function normalizedCode(value) {
  if (typeof value !== 'string') return '';
  return String(value == null ? '' : value).trim().toUpperCase();
}

function validateCode(value, label, pattern = /^[A-Z0-9][A-Z0-9._-]{0,31}$/) {
  const code = normalizedCode(requiredText(value, label, 32));
  if (!pattern.test(code)) {
    throw new LocationDataError(`${label} geçersiz.`);
  }
  return code;
}

function assertArray(value, label, maxLength) {
  if (!Array.isArray(value) || value.length === 0 || value.length > maxLength) {
    throw new LocationDataError(`${label} boş olamaz ve ${maxLength} kaydı geçemez.`);
  }
}

function assertUnique(map, key, label) {
  if (map.has(key)) {
    throw new LocationDataError(`${label} benzersiz olmalıdır.`);
  }
}

function validateMetadata(dataset) {
  if (dataset.version !== DATASET_VERSION) {
    throw new LocationDataError(`Konum dataset version değeri ${DATASET_VERSION} olmalıdır.`);
  }

  requiredText(dataset.source, 'Konum dataset source değeri', 2_048);
  requiredText(dataset.license, 'Konum dataset license değeri', 200);
  requiredText(dataset.sourceRelease, 'Konum dataset sourceRelease değeri', 200);

  const commit = requiredText(dataset.sourceCommit, 'Konum dataset sourceCommit değeri', 64);
  if (!/^[a-f0-9]{40}$/i.test(commit)) {
    throw new LocationDataError('Konum dataset sourceCommit değeri geçersiz.');
  }

  const sha256 = requiredText(dataset.sourceSha256, 'Konum dataset sourceSha256 değeri', 64);
  if (!/^[a-f0-9]{64}$/i.test(sha256)) {
    throw new LocationDataError('Konum dataset sourceSha256 değeri geçersiz.');
  }
}

function createLocationService(dataset) {
  if (!dataset || Array.isArray(dataset) || typeof dataset !== 'object') {
    throw new LocationDataError('Konum dataset kökü geçerli bir nesne olmalıdır.');
  }

  validateMetadata(dataset);
  assertArray(dataset.countries, 'Konum dataset countries listesi', MAX_COUNTRIES);

  const countryByCode = new Map();
  let totalLocalities = 0;

  const countries = dataset.countries.map((countryValue, countryIndex) => {
    const locationLabel = `countries[${countryIndex}]`;
    const code = validateCode(countryValue?.code, `${locationLabel}.code`, /^[A-Z]{2}$/);
    const name = requiredText(countryValue?.name, `${locationLabel}.name`);

    assertUnique(countryByCode, code, `${locationLabel}.code`);
    assertArray(
      countryValue?.subdivisions,
      `${locationLabel}.subdivisions`,
      MAX_SUBDIVISIONS_PER_COUNTRY
    );

    const subdivisionByCode = new Map();
    const subdivisions = countryValue.subdivisions.map((subdivisionValue, subdivisionIndex) => {
      const subdivisionLabel = `${locationLabel}.subdivisions[${subdivisionIndex}]`;
      const subdivisionCode = validateCode(subdivisionValue?.code, `${subdivisionLabel}.code`);
      const subdivisionName = requiredText(subdivisionValue?.name, `${subdivisionLabel}.name`);

      assertUnique(subdivisionByCode, subdivisionCode, `${subdivisionLabel}.code`);
      assertArray(
        subdivisionValue?.localities,
        `${subdivisionLabel}.localities`,
        MAX_LOCALITIES_PER_SUBDIVISION
      );

      const localityByCode = new Map();
      const localities = subdivisionValue.localities.map((localityValue, localityIndex) => {
        const localityLabel = `${subdivisionLabel}.localities[${localityIndex}]`;
        const localityCode = validateCode(localityValue?.code, `${localityLabel}.code`);
        const localityName = requiredText(localityValue?.name, `${localityLabel}.name`);

        assertUnique(localityByCode, localityCode, `${localityLabel}.code`);

        const locality = Object.freeze({ code: localityCode, name: localityName });
        localityByCode.set(localityCode, locality);
        totalLocalities += 1;
        if (totalLocalities > MAX_TOTAL_LOCALITIES) {
          throw new LocationDataError(`Konum dataset ${MAX_TOTAL_LOCALITIES} locality sınırını geçemez.`);
        }
        return locality;
      });

      const subdivision = Object.freeze({
        code: subdivisionCode,
        name: subdivisionName,
        localities: Object.freeze(localities),
        localityByCode
      });
      subdivisionByCode.set(subdivisionCode, subdivision);
      return subdivision;
    });

    const country = Object.freeze({
      code,
      name,
      subdivisions: Object.freeze(subdivisions),
      subdivisionByCode
    });
    countryByCode.set(code, country);
    return country;
  });

  const publicCountries = Object.freeze(countries.map(({ code, name }) => Object.freeze({ code, name })));

  function findCountry(countryCode) {
    return countryByCode.get(normalizedCode(countryCode)) || null;
  }

  function findSubdivision(country, subdivisionCode) {
    return country?.subdivisionByCode.get(normalizedCode(subdivisionCode)) || null;
  }

  function findLocality(subdivision, localityCode) {
    return subdivision?.localityByCode.get(normalizedCode(localityCode)) || null;
  }

  function publicItems(items) {
    return items.map(({ code, name }) => ({ code, name }));
  }

  return Object.freeze({
    version: DATASET_VERSION,
    listCountries() {
      return publicItems(publicCountries);
    },
    listSubdivisions(countryCode) {
      const country = findCountry(countryCode);
      return country ? publicItems(country.subdivisions) : null;
    },
    listLocalities(countryCode, subdivisionCode) {
      const country = findCountry(countryCode);
      if (!country) return null;
      const subdivision = findSubdivision(country, subdivisionCode);
      return subdivision ? publicItems(subdivision.localities) : null;
    },
    resolveHierarchy(selection = {}) {
      const country = findCountry(selection.country);
      if (!country) {
        throw new LocationSelectionError('country', 'Geçerli bir ülke seçiniz.');
      }

      const subdivision = findSubdivision(country, selection.city);
      if (!subdivision) {
        throw new LocationSelectionError('city', 'Seçilen ülkeye bağlı geçerli bir şehir seçiniz.');
      }

      const locality = findLocality(subdivision, selection.district);
      if (!locality) {
        throw new LocationSelectionError('district', 'Seçilen şehre bağlı geçerli bir ilçe / rayon seçiniz.');
      }

      return {
        country: { code: country.code, name: country.name },
        subdivision: { code: subdivision.code, name: subdivision.name },
        locality: { code: locality.code, name: locality.name }
      };
    }
  });
}

let cachedLocationService;

function getLocationService() {
  if (cachedLocationService) return cachedLocationService;

  let dataset;
  try {
    dataset = JSON.parse(fs.readFileSync(DATASET_PATH, 'utf8'));
  } catch (error) {
    throw new LocationDataError(`Konum dataset okunamadı: ${error.message}`);
  }

  cachedLocationService = createLocationService(dataset);
  return cachedLocationService;
}

module.exports = {
  DATASET_PATH,
  DATASET_VERSION,
  LocationDataError,
  LocationSelectionError,
  createLocationService,
  getLocationService
};
