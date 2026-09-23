// Cerez banner'i (uploads/f/uvcookie.js) her onay/degisiklikte POST /ajax/cookieselection yapar.
// Bu route eski sitede vardi, Node backend'e tasinmadi -> her onay sunucuda 404 uretiyordu.
//
// Kapsam (2026-09-23, Mimar karari): istek sessizce kabul edilir, HICBIR sey saklanmaz.
// Onay zaten tarayicidaki "uv_cookie" cerezinde tutulur (tek dogruluk kaynagi orasi).
// Yan etkisi olmadigi icin CSRF dogrulamasi gerekmez (banner zaten token gondermiyor) ve
// rate-limit eklenmez (rate-limit DB'ye yazardi; bu uc nokta DB'ye hic dokunmamali).
// KVKK icin sunucu tarafli onay kaydi istenirse ayri bir cember gerekir (tablo + saklama suresi).

const express = require('express');

const router = express.Router();

router.post('/cookieselection', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.status(200).json({ status: 'ok' });
});

module.exports = router;
