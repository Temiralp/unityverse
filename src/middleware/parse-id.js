function parseIdParam(req, res, next, value, name) {
  const text = String(value || '');

  if (!/^[1-9]\d*$/.test(text)) {
    return res.status(404).send('Kayıt bulunamadı');
  }

  const id = Number(text);

  if (!Number.isSafeInteger(id)) {
    return res.status(404).send('Kayıt bulunamadı');
  }

  req.params[name] = id;
  return next();
}

module.exports = { parseIdParam };
