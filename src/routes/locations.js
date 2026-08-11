const express = require('express');

const {
  DATASET_PATH,
  LocationDataError,
  getLocationService
} = require('../services/locations');

const router = express.Router();

function hasOnlyQueryKeys(req, expectedKeys) {
  const keys = Object.keys(req.query || {});
  return keys.length === expectedKeys.length
    && expectedKeys.every((key) => keys.includes(key));
}

function queryCode(value, pattern) {
  if (typeof value !== 'string') return null;
  const code = value.trim();
  return pattern.test(code) ? code : null;
}

function locationResponse(res, locationService, items) {
  res.set('Cache-Control', 'private, max-age=300');
  return res.json({
    version: locationService.version,
    items
  });
}

function locationDataUnavailable(error, res, next) {
  if (!(error instanceof LocationDataError)) return next(error);

  console.error('[locations] Dataset configuration error:', error.message);
  return res.status(503).json({
    status: 'failure',
    code: 'LOCATION_DATA_UNAVAILABLE',
    message: 'Konum bilgileri şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.'
  });
}

router.get('/countries', (req, res, next) => {
  if (!hasOnlyQueryKeys(req, [])) {
    return res.status(400).json({ status: 'failure', message: 'Geçersiz sorgu parametresi.' });
  }

  try {
    const locationService = getLocationService();
    return locationResponse(res, locationService, locationService.listCountries());
  } catch (error) {
    return locationDataUnavailable(error, res, next);
  }
});

router.get('/dataset/v1.json', (req, res) => {
  if (!hasOnlyQueryKeys(req, [])) {
    return res.status(400).json({ status: 'failure', message: 'Geçersiz sorgu parametresi.' });
  }

  res.set({
    'Cache-Control': 'private, max-age=300',
    'Content-Disposition': 'attachment; filename="unityverse-locations-v1.json"'
  });
  return res.sendFile(DATASET_PATH);
});

router.get('/subdivisions', (req, res, next) => {
  const country = queryCode(req.query.country, /^[A-Z]{2}$/);
  if (!hasOnlyQueryKeys(req, ['country']) || !country) {
    return res.status(400).json({
      status: 'failure',
      message: 'Geçerli bir ülke kodu giriniz.'
    });
  }

  try {
    const locationService = getLocationService();
    const items = locationService.listSubdivisions(country);
    if (!items) {
      return res.status(404).json({
        status: 'failure',
        message: 'Ülke bulunamadı.'
      });
    }
    return locationResponse(res, locationService, items);
  } catch (error) {
    return locationDataUnavailable(error, res, next);
  }
});

router.get('/localities', (req, res, next) => {
  const country = queryCode(req.query.country, /^[A-Z]{2}$/);
  const subdivision = queryCode(req.query.subdivision, /^[A-Z0-9][A-Z0-9._-]{0,31}$/);
  if (!hasOnlyQueryKeys(req, ['country', 'subdivision']) || !country || !subdivision) {
    return res.status(400).json({
      status: 'failure',
      message: 'Geçerli ülke ve şehir kodları giriniz.'
    });
  }

  try {
    const locationService = getLocationService();
    const items = locationService.listLocalities(country, subdivision);
    if (!items) {
      return res.status(404).json({
        status: 'failure',
        message: 'Ülke veya şehir bulunamadı.'
      });
    }
    return locationResponse(res, locationService, items);
  } catch (error) {
    return locationDataUnavailable(error, res, next);
  }
});

module.exports = router;
