const { verifyFormToken } = require('../security/form-protection');

function text(value) {
  return String(value || '').trim();
}

function isLikelyBot(data, scope) {
  if (text(data.website)) {
    return true;
  }

  return !verifyFormToken(text(data._formToken), scope).valid;
}

function silentSuccess(scope, res) {
  if (scope === 'member') {
    return res.json({
      status: 'success',
      message: 'İşleminiz başarıyla tamamlandı.',
      param: {
        login_callback_url: '/uye/'
      }
    });
  }

  return res.json({
    status: 'success',
    message: 'Form başarıyla gönderildi.'
  });
}

module.exports = {
  isLikelyBot,
  silentSuccess
};
