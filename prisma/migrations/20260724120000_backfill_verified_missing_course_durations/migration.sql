-- Backfill only course durations verified from legacy course content,
-- exact duration variants, or a complete curriculum total.
-- Existing admin-entered duration values are intentionally preserved.
WITH verified_duration(slug, duration) AS (
  VALUES
    ('a1-turkish-language-course-a1-turkce-kursu-1117', '136 saat'),
    ('after-effects-premier-pro-ozel-ders-canlionline-1121', '30 saat'),
    ('ayrik-matematik-discrete-mathematics-egitimi-ozel-ders-1431', '10 saat'),
    ('c-programlama-canli-online-ozel-ders-1109', '30 saat'),
    ('c-programlama-canli-online-ozel-ders-1447', '30 saat'),
    ('c-programlama-yuz-yuze-ozel-ders-1108', '30 saat'),
    ('demo-egitim-1573', '4 saat'),
    ('diferansiyel-denklemler-egitimi-ozel-ders-1434', '10 saat'),
    ('egitim-koclugu-ozel-ders-1439', '10 saat'),
    ('excel-kursu-temelden-ileri-seviyeye-1122', '10 saat'),
    ('fen-bilimleri-egitimi-ozel-ders-1430', '10 saat'),
    ('film-ve-animasyon-icin-storyboard-yuz-yuze-egitimi-ozel-ders-1287', '25 saat'),
    ('fizik-egitimi-ozel-ders-1429', '10 saat'),
    ('insan-kaynaklari-egitimi-ozel-ders-1437', '10 saat'),
    ('it-danismanlik-hizmeti-ozel-ders-1435', '10 saat'),
    ('java-programlama-canli-online-ozel-ders-1111', '30 saat'),
    ('java-programlama-yuz-yuze-ozel-ders-1110', '30 saat'),
    ('java-yazilim-egitimi-yuz-yuze-1142', '80 saat'),
    ('kurumsal-iletisim-egitimi-ozel-ders-1436', '10 saat'),
    ('lineer-cebir-linear-algebra-egitimi-ozel-ders-1432', '10 saat'),
    ('matematik-egitimi-ozel-ders-1428', '10 saat'),
    ('mikroservis-mimarisi-ile-dagitik-sistemler-gelistirme-egitimi-1532', '30 saat'),
    ('python-canli-online-ozel-ders-1106', '30 saat'),
    ('python-yuz-yuze-ozel-ders-1107', '30 saat'),
    ('renk-uyumu-canli-online-egitimi-639', '6 saat'),
    ('revit-egitimi-yuz-yuze-1581', '50 saat'),
    ('turkce-egitimi-ozel-ders-1438', '10 saat'),
    ('veri-yapilari-egitimi-ozel-ders-1433', '10 saat'),
    ('video-tasarimi-canli-online-egitimi-1404', '10 saat'),
    ('دورة-اللغة-التركية-a1-a1-turkce-kursu-1118', '136 saat')
)
UPDATE "Product" AS product
SET "duration" = verified_duration.duration,
    "updatedAt" = CURRENT_TIMESTAMP
FROM verified_duration
WHERE product.slug = verified_duration.slug
  AND (
    product."duration" IS NULL
    OR BTRIM(product."duration") = ''
    OR LOWER(BTRIM(product."duration")) = 'eğitim'
  );
