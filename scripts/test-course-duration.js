const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const {
  durationUpdateForImport,
  parseCourseFile
} = require('./migrate-courses');
const {
  EXPLICIT_LEGACY_DURATIONS,
  durationFromIdentity,
  legacyDurationOptions,
  normalizeDuration,
  selectLegacyCourseDuration
} = require('../src/services/course-duration');

const root = path.resolve(__dirname, '..');
const verifiedMissingDurations = Object.freeze({
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
  'insan-kaynaklari-egitimi-ozel-ders-1437': '10 saat',
  'it-danismanlik-hizmeti-ozel-ders-1435': '10 saat',
  'java-programlama-canli-online-ozel-ders-1111': '30 saat',
  'java-programlama-yuz-yuze-ozel-ders-1110': '30 saat',
  'java-yazilim-egitimi-yuz-yuze-1142': '80 saat',
  'kurumsal-iletisim-egitimi-ozel-ders-1436': '10 saat',
  'lineer-cebir-linear-algebra-egitimi-ozel-ders-1432': '10 saat',
  'matematik-egitimi-ozel-ders-1428': '10 saat',
  'mikroservis-mimarisi-ile-dagitik-sistemler-gelistirme-egitimi-1532': '30 saat',
  'python-canli-online-ozel-ders-1106': '30 saat',
  'python-yuz-yuze-ozel-ders-1107': '30 saat',
  'renk-uyumu-canli-online-egitimi-639': '6 saat',
  'revit-egitimi-yuz-yuze-1581': '50 saat',
  'turkce-egitimi-ozel-ders-1438': '10 saat',
  'veri-yapilari-egitimi-ozel-ders-1433': '10 saat',
  'video-tasarimi-canli-online-egitimi-1404': '10 saat',
  'دورة-اللغة-التركية-a1-a1-turkce-kursu-1118': '136 saat'
});
const unknownDurationSlugs = Object.freeze([
  'ispanyolca-egitimi-ozel-ders-1441',
  'ingilizce-egitimi-ozel-ders-1442',
  'almanca-egitimi-ozel-ders-1440',
  'ses-tasarimi-yuz-yuze-egitimi-651',
  'ses-tasarimi-canli-online-egitimi-652',
  'proje-yonetimi-egitimi-1126',
  'lumion-egitimi-1130',
  'film-muzigi-teknikleri-yuz-yuze-egitimi-648',
  'film-muzigi-teknikleri-canli-online-egitimi-647',
  'dijital-oyun-muzigi-teknikleri-yuz-yuze-egitimi-649',
  'dijital-oyun-muzigi-teknikleri-canli-online-egitimi-650',
  'adobe-illustrator-yuz-yuze-egitim-1567'
]);
const verifiedDurationMigration = path.join(
  root,
  'prisma',
  'migrations',
  '20260724120000_backfill_verified_missing_course_durations',
  'migration.sql'
);

assert.equal(normalizeDuration('50 SAAT'), '50 saat');
assert.equal(normalizeDuration('3 Aylık'), '3 ay');
assert.equal(normalizeDuration('Eğitim'), null);
assert.equal(durationFromIdentity('Python Eğitimi 8 Ay', 'python-egitimi-1'), '8 ay');
assert.equal(durationFromIdentity('Python Eğitimi', 'python-egitimi-30-saat-1'), '30 saat');
assert.deepEqual(durationUpdateForImport(null, '10 saat'), { duration: '10 saat' });
assert.deepEqual(durationUpdateForImport('', '10 saat'), { duration: '10 saat' });
assert.deepEqual(durationUpdateForImport('Eğitim', '10 saat'), { duration: '10 saat' });
assert.deepEqual(durationUpdateForImport('12 saat', '10 saat'), {});
assert.deepEqual(durationUpdateForImport('Admin özel süresi', '10 saat'), {});
assert.deepEqual(durationUpdateForImport(null, null), {});

const $ = cheerio.load(`
  <div class="attr-detail attr-size">
    <ul name="poptions1_1">
      <li data-bs-title="8 AY">8 AY</li>
      <li data-bs-title="4 ay">4 ay</li>
    </ul>
  </div>
`);
assert.deepEqual(legacyDurationOptions($), ['8 ay', '4 ay']);
assert.equal(selectLegacyCourseDuration({
  title: 'Yazılım Uzmanlığı Eğitimi',
  slug: 'yazilim-uzmanligi-1',
  optionLabels: ['8 ay', '4 ay']
}), '8 ay');
assert.equal(selectLegacyCourseDuration({
  title: 'Yazılım Uzmanlığı Eğitimi 4 ay',
  slug: 'yazilim-uzmanligi-4-ay-2',
  optionLabels: ['8 ay', '4 ay']
}), '4 ay');
assert.equal(selectLegacyCourseDuration({
  title: 'ZBrush Özel Ders 24 saat',
  slug: 'zbrush-ozel-ders-24-saat-3',
  code: 'CS001-24 SAAT',
  optionLabels: ['30 saat']
}), '24 saat');
assert.equal(selectLegacyCourseDuration({
  title: 'Süresi Belirtilmemiş Eğitim',
  slug: 'suresi-belirtilmemis-egitim-3'
}), null);

function parse(slug) {
  return parseCourseFile(path.join(root, 'urun', slug, 'index.html'));
}

assert.equal(parse('yazilim-uzmanligi-yuz-yuze-egitim-1473').duration, '8 ay');
assert.equal(parse('yazilim-uzmanligi-canli-online-egitim-1468').duration, '8 ay');
assert.equal(parse('3ds-max-canli-online-egitimi-566').duration, '50 saat');
assert.equal(parse('zbrush-ile-organik-modelleme-canli-online-ozel-ders-24-saat-1297').duration, '24 saat');
assert.equal(parse('senaryo-yazma-canli-online-egitimi-587').duration, '54 saat');
assert.equal(parse('zbrush-ile-kuyumculuk-ve-taki-tasarimi-egitimi-online-1536').duration, '3 ay / 66 saat');

assert.equal(Object.keys(verifiedMissingDurations).length, 30);
Object.entries(verifiedMissingDurations).forEach(([slug, duration]) => {
  assert.equal(EXPLICIT_LEGACY_DURATIONS[slug], duration, `${slug} import eşlemesi`);
  assert.equal(parse(slug).duration, duration, `${slug} legacy import süresi`);
});

unknownDurationSlugs.forEach((slug) => {
  assert.equal(EXPLICIT_LEGACY_DURATIONS[slug], undefined, `${slug} eşlenmemeli`);
  assert.equal(parse(slug).duration, null, `${slug} NULL kalmalı`);
});

const migrationSql = fs.readFileSync(verifiedDurationMigration, 'utf8');
assert.equal((migrationSql.match(/^\s+\('/gm) || []).length, 30);
Object.entries(verifiedMissingDurations).forEach(([slug, duration]) => {
  assert.match(
    migrationSql,
    new RegExp(`\\('${slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}', '${duration}'\\)`),
    `${slug} migration eşlemesi`
  );
});
unknownDurationSlugs.forEach((slug) => {
  assert.doesNotMatch(migrationSql, new RegExp(slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});
assert.match(migrationSql, /product\."duration" IS NULL/);
assert.match(migrationSql, /BTRIM\(product\."duration"\) = ''/);
assert.match(migrationSql, /LOWER\(BTRIM\(product\."duration"\)\) = 'eğitim'/);

console.log('Course duration tests passed.');
