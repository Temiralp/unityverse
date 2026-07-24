const EXPLICIT_LEGACY_DURATIONS = Object.freeze({
  'a1-turkish-language-course-a1-turkce-kursu-1117': '136 saat',
  'after-effects-premier-pro-ozel-ders-canlionline-1121': '30 saat',
  'ayrik-matematik-discrete-mathematics-egitimi-ozel-ders-1431': '10 saat',
  'c-programlama-canli-online-ozel-ders-1109': '30 saat',
  'c-programlama-canli-online-ozel-ders-1447': '30 saat',
  'c-programlama-yuz-yuze-ozel-ders-1108': '30 saat',
  'demo-egitim-1573': '4 saat',
  'diferansiyel-denklemler-egitimi-ozel-ders-1434': '10 saat',
  'egitim-koclugu-ozel-ders-1439': '10 saat',
  'excel-kursu-temelden-ileri-seviyeye-1122': '10 saat',
  'fen-bilimleri-egitimi-ozel-ders-1430': '10 saat',
  'film-ve-animasyon-icin-storyboard-yuz-yuze-egitimi-ozel-ders-1287': '25 saat',
  'fizik-egitimi-ozel-ders-1429': '10 saat',
  'grafik-tasarim-atolyesi-1147': '1 ay',
  'grafik-tasarimin-altin-kurallari-yeni-baslayanlar-ve-profesyoneller-icin-1141': '4 saat',
  'herkes-icin-siber-guvenlik-atolyesi-1148': '1 ay',
  'insan-kaynaklari-egitimi-ozel-ders-1437': '10 saat',
  'it-danismanlik-hizmeti-ozel-ders-1435': '10 saat',
  'java-programlama-canli-online-ozel-ders-1111': '30 saat',
  'java-programlama-yuz-yuze-ozel-ders-1110': '30 saat',
  'java-yazilim-egitimi-yuz-yuze-1142': '80 saat',
  'kurumsal-iletisim-egitimi-ozel-ders-1436': '10 saat',
  'lineer-cebir-linear-algebra-egitimi-ozel-ders-1432': '10 saat',
  'marvelous-designer-ile-giysi-tasarimi-uzmanligi-canli-online-egitimi-552': '54 saat',
  'matematik-egitimi-ozel-ders-1428': '10 saat',
  'mikroservis-mimarisi-ile-dagitik-sistemler-gelistirme-egitimi-1532': '30 saat',
  'python-canli-online-ozel-ders-1106': '30 saat',
  'python-yuz-yuze-ozel-ders-1107': '30 saat',
  'renk-uyumu-canli-online-egitimi-639': '6 saat',
  'revit-egitimi-yuz-yuze-1581': '50 saat',
  'senaryo-yazma-canli-online-egitimi-587': '54 saat',
  'senaryo-yazma-yuz-yuze-egitimi-622': '54 saat',
  'sketchupta-mimari-ve-ic-mekân-modelleme-egitimi-uygulamali-online-1619': '20 saat',
  'sketchupta-mimari-ve-ic-mekân-modelleme-egitimi-uygulamali-yuz-yuze-1620': '20 saat',
  'turkce-egitimi-ozel-ders-1438': '10 saat',
  'veri-yapilari-egitimi-ozel-ders-1433': '10 saat',
  'video-tasarimi-canli-online-egitimi-1404': '10 saat',
  'yonetmenlik-ve-sinematografiye-giris-canli-online-egitimi-585': '20 saat',
  'yonetmenlik-ve-sinematografiye-giris-yuz-yuze-egitimi-620': '20 saat',
  'yonetmenlik-ve-sinematografiye-giris-yuz-yuze-ozel-ders-1056': '20 saat',
  'zbrush-ile-kuyumculuk-ve-taki-tasarimi-egitimi-online-1536': '3 ay / 66 saat',
  'دورة-اللغة-التركية-a1-a1-turkce-kursu-1118': '136 saat'
});

function normalizeWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeDuration(value) {
  const text = normalizeWhitespace(value).toLocaleLowerCase('tr-TR');
  const match = text.match(/^(\d+(?:[.,]\d+)?)\s*(saat(?:lik)?|ay(?:lık|lik)?|hafta(?:lık|lik)?|gün(?:lük|luk)?)$/iu);
  if (!match) return null;

  const amount = match[1].replace(',', '.');
  const rawUnit = match[2];
  let unit = 'saat';
  if (rawUnit.startsWith('ay')) unit = 'ay';
  else if (rawUnit.startsWith('hafta')) unit = 'hafta';
  else if (rawUnit.startsWith('gün')) unit = 'gün';

  return `${amount} ${unit}`;
}

function durationFromIdentity(title, slug) {
  const identity = `${normalizeWhitespace(title)} ${String(slug || '').replace(/[-_]+/g, ' ')}`;
  const matches = identity.matchAll(/(\d+(?:[.,]\d+)?)\s*(saat(?:lik)?|ay(?:lık|lik)?|hafta(?:lık|lik)?|gün(?:lük|luk)?)/giu);

  for (const match of matches) {
    const duration = normalizeDuration(`${match[1]} ${match[2]}`);
    if (duration) return duration;
  }

  return null;
}

function legacyDurationOptions($) {
  const options = [];

  $('.attr-detail.attr-size ul[name^="poptions1_"] li').each((_, element) => {
    const item = $(element);
    const duration = normalizeDuration(item.attr('data-bs-title') || item.text());
    if (duration && !options.includes(duration)) options.push(duration);
  });

  return options;
}

function selectLegacyCourseDuration({ title, slug, code, optionLabels = [] }) {
  const options = optionLabels.map(normalizeDuration).filter(Boolean);
  const codeDuration = durationFromIdentity(code, '');
  const identityDuration = durationFromIdentity(title, slug);

  if (codeDuration) return codeDuration;
  if (options.length === 1) return options[0];
  if (options.length > 1) {
    return options.includes(identityDuration) ? identityDuration : options[0];
  }

  return identityDuration || EXPLICIT_LEGACY_DURATIONS[slug] || null;
}

module.exports = {
  EXPLICIT_LEGACY_DURATIONS,
  durationFromIdentity,
  legacyDurationOptions,
  normalizeDuration,
  selectLegacyCourseDuration
};
