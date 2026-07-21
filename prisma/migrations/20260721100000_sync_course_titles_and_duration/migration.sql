-- Reproduce the approved SEO H1 title changes using stable product slugs.
-- The temporary table and validation block make this migration deterministic:
-- it stops if the audited set is incomplete or a target is no longer PUBLISHED.

CREATE TEMPORARY TABLE "_CourseTitleUpdate" (
    "slug" TEXT PRIMARY KEY,
    "newTitle" TEXT NOT NULL
) ON COMMIT DROP;

INSERT INTO "_CourseTitleUpdate" ("slug", "newTitle") VALUES
    -- Oyun Eğitimleri (24 published products / 23 source rows)
    ('unity-ile-oyun-gelistirme-canli-online-egitimi-staj-garantili-17', 'Unity ile Oyun Geliştirme Kursu – Online Canlı Eğitim (Staj Garantili)'),
    ('unity-ile-oyun-gelistirme-yuz-yuze-egitimi-staj-garantili-598', 'Unity Oyun Geliştirme Kursu – Yüz Yüze Sınıf Eğitimi (Staj Garantili)'),
    ('unity-ile-oyun-gelistirme-yuz-yuze-egitimi-1481', 'Unity ile 2D & 3D Oyun Geliştirme Kursu – Yüz Yüze Eğitim'),
    ('unity-ile-oyun-gelistirme-yuz-yuze-ozel-ders-1045', 'Unity Oyun Geliştirme Özel Ders – Birebir Yüz Yüze Eğitim'),
    ('unity-ile-oyun-gelistirme-online-ozel-ders-1256', 'Unity Oyun Geliştirme Özel Ders – Birebir Online Canlı Eğitim'),
    ('unity-ile-oyun-gelistirme-canli-online-egitimi-1478', 'Unity ile Oyun Geliştirme Kursu – Canlı Online Eğitim'),
    ('unreal-engine-ile-sanal-gerceklik-yuz-yuze-egitim-654', 'Unreal Engine 5 ile VR / Sanal Gerçeklik Geliştirme Kursu – Yüz Yüze'),
    ('unreal-engine-ile-sanal-gerceklik-online-canli-egitim-653', 'Unreal Engine 5 ile VR / Sanal Gerçeklik Geliştirme Kursu – Online Canlı'),
    ('unreal-engine-ile-oyun-gelistirme-150-saatlik-kapsamli-blueprintmufredati-online-1028', 'Unreal Engine 5 Blueprint ile Kodsuz Oyun Geliştirme Kursu – 150 Saat Online'),
    ('unreal-engine-ile-sanal-gerceklik-vr-ozel-ders-online-canli-egitim-1029', 'Unreal Engine 5 VR Geliştirme Özel Ders – Birebir Online Eğitim'),
    ('unreal-engine-5-gorsellestirme-ve-animasyon-yuz-yuze-egitim-1032', 'Unreal Engine 5 ile Mimari Görselleştirme ve Sinematik Animasyon Kursu – Yüz Yüze'),
    ('cocuk-ve-gencler-icin-unity-ile-oyun-gelistirme-yuz-yuze-egitimi-1042', 'Çocuklar İçin Unity ile Oyun Geliştirme ve Kodlama Kursu – Yüz Yüze (7-17 Yaş)'),
    ('cocuklar-icin-unity-ile-oyun-gelistirme-yuz-yuze-egitimi-1042', 'Çocuklar İçin Unity ile Oyun Geliştirme ve Kodlama Kursu – Yüz Yüze (7-17 Yaş)'),
    ('unreal-engine-ile-sanal-gerceklik-ozel-ders-online-canli-egitim-1044', 'Unreal Engine 5 Sanal Gerçeklik (VR/AR) Özel Ders – Online Canlı'),
    ('unreal-engine-ile-oyun-gelistirme-ozel-ders-online-canli-egitim-100-saat-1303', 'Unreal Engine 5 ile Oyun Geliştirme Özel Ders – 100 Saat Online Blueprint & C++'),
    ('unreal-engine-ile-metaverse-gelistirme-yuz-yuze-egitim-850', 'Unreal Engine 5 ile Metaverse & Sanal Dünya Geliştirme Kursu – Yüz Yüze'),
    ('unreal-engine-ile-metaverse-gelistirme-online-canli-egitim-851', 'Unreal Engine 5 ile Metaverse & Sanal Dünya Geliştirme Kursu – Online Canlı'),
    ('unreal-engine-ile-oyun-gelistirme-150-saatlik-kapsamli-blueprintmufredati-yuz-yuze-egitim-1116', 'Unreal Engine 5 Blueprint ile Kodsuz Oyun Geliştirme Kursu – 150 Saat Yüz Yüze'),
    ('cocuklar-icin-unity-ile-oyun-gelistirme-canli-online-egitimi-1380', 'Çocuklar İçin Unity ile Oyun Geliştirme ve Kodlama Kursu – Online Canlı (7-17 Yaş)'),
    ('unreal-engine-ile-sanal-gerceklik-vr-ozel-ders-yuz-yuze-egitim-1337', 'Unreal Engine 5 VR Geliştirme Özel Ders – Birebir Yüz Yüze Eğitim'),
    ('unity-ile-oyun-gelistirme-yuz-yuze-ozel-ders-1361', 'Unity C# ile Oyun Geliştirme Özel Ders – Birebir Yüz Yüze Eğitim'),
    ('yapay-zeka-destekli-unity-ile-oyun-gelistirme-egitimi-yuz-yuze-1680', 'Yapay Zeka (AI) Destekli Unity ile Oyun Geliştirme Kursu – Yüz Yüze'),
    ('yapay-zeka-destekli-unity-ile-oyun-gelistirme-egitimi-online-1682', 'Yapay Zeka (AI) Destekli Unity ile Oyun Geliştirme Kursu – Online Canlı'),
    ('cocuklar-icin-minecraft-ile-kodlama-egitimi-1689', 'Çocuklar İçin Minecraft Education ile Kodlama ve Programlama Kursu (8-14 Yaş)'),

    -- 3D Modelleme (25 published products)
    ('blender-3b-oyun-modelleme-canli-online-egitim-2', 'Blender 3D Oyun Modelleme Kursu – Online Canlı (Karakter & Çevre Asset)'),
    ('blender-ile-3d-modelleme-yuzyuze-ozel-ders-1242', 'Blender ile 3D Modelleme Özel Ders – Birebir Yüz Yüze (Sıfırdan İleri Seviye)'),
    ('blender-ile-3d-modelleme-ve-animasyon-egitimi-yuz-yuze-591', 'Blender ile 3D Modelleme & Animasyon Kursu – Yüz Yüze (Modelleme, Rigging, Render)'),
    ('blender-ile-3d-modelleme-online-ozel-ders-1105', 'Blender ile 3D Modelleme Özel Ders – Birebir Online Canlı'),
    ('blender-ve-marvelous-designer-onlinecanli-egitimi-993', 'Blender & Marvelous Designer Kursu – Online Canlı (3D Karakter & Giysi Modelleme)'),
    ('profesyonel-3b-modelleme-dijital-sanat-programi-online-1', 'Profesyonel 3D Modelleme & Dijital Sanat Kursu – Kapsamlı Online (3D Generalist Programı)'),
    ('profesyonel-3b-modelleme-dijital-sanat-programi-yuz-yuze-1492', 'Profesyonel 3D Modelleme & Dijital Sanat Kursu – Kapsamlı Yüz Yüze (3D Generalist)'),
    ('substance-3d-painter-canli-online-40-saat-ozel-ders-1445', 'Substance 3D Painter Özel Ders – 40 Saat Birebir Online (PBR Doku Kaplama)'),
    ('substance-3d-painter-yuz-yuze-egitimi-619', 'Substance 3D Painter Doku Kaplama Kursu – Yüz Yüze (PBR & Materyal Tasarım)'),
    ('substance-3d-painter-canli-online-egitimi-556', 'Substance 3D Painter Doku Kaplama Kursu – Canlı Online (PBR & Materyal)'),
    ('maya-ile-modelleme-ve-animasyon-canli-online-ozel-ders-1047', 'Autodesk Maya 3D Modelleme & Animasyon Özel Ders – Birebir Online (Rigging & Render)'),
    ('zbrush-ile-organik-modelleme-yuz-yuze-egitimi-590', 'ZBrush ile Organik & Karakter Modelleme Kursu – Yüz Yüze (Dijital Sculpting)'),
    ('zbrush-ile-organik-modelleme-canli-online-ozel-ders-1052', 'ZBrush Organik Modelleme Özel Ders – Birebir Online (Sculpting & Karakter)'),
    ('marvelous-designer-ile-giysi-tasarimi-yuz-yuze-egitimi-600', 'Marvelous Designer ile Dijital Giysi & Kumaş Tasarımı Kursu – Yüz Yüze'),
    ('marvelous-designer-ile-giysi-tasarimi-uzmanligi-canli-online-egitimi-552', 'Marvelous Designer Giysi Tasarımı Uzmanlık Kursu – Online Canlı (Kumaş Simülasyonu)'),
    ('3ds-max-canli-online-egitimi-566', '3ds Max ile 3D Modelleme Kursu – Online Canlı (Mimari Görselleştirme & V-Ray)'),
    ('3ds-max-yuz-yuze-egitimi-615', '3ds Max ile 3D Modelleme Kursu – Yüz Yüze (Mimari & İç Mekan V-Ray Render)'),
    ('aranan-3d-artist-olma-yuz-yuze-kampi-1100', 'Sıfırdan 3D Artist Olma Bootcamp – Yüz Yüze Yoğun Kamp (Modelleme, Sculpting, Texturing)'),
    ('zbrush-ile-kuyumculuk-ve-taki-tasarimi-egitimi-online-1536', 'ZBrush ile 3D Kuyumculuk & Takı Tasarımı Kursu – Online (Dijital Mücevher & 3D Baskı)'),
    ('36-saat-kapsamli-zbrush-modelleme-egitimi-yuz-yuze-1539', 'ZBrush Kapsamlı Sculpting Kursu – 36 Saat Yüz Yüze (Organik & Hard Surface)'),
    ('36-saat-kapsamli-zbrush-modelleme-egitimi-online-1540', 'ZBrush Kapsamlı Sculpting Kursu – 36 Saat Online (Organik & Hard Surface)'),
    ('blender-ile-3d-modelleme-ve-animasyon-egitimi-online-1594', 'Blender ile 3D Modelleme & Animasyon Kursu – Canlı Online (Rigging, Texturing, Render)'),
    ('zbrush-ile-organik-modelleme-online-egitimi-1528', 'ZBrush ile Organik & Karakter Modelleme Kursu – Online Canlı (Dijital Sculpting)'),
    ('zbrush-ile-organik-modelleme-canli-yuz-yuze-ozel-ders-1533', 'ZBrush Organik Modelleme Özel Ders – Birebir Yüz Yüze (Sculpting & Anatomi)'),
    ('zbrush-ile-kuyumculuk-ve-taki-tasarimi-egitimi-yuz-yuze-1535', 'ZBrush ile 3D Kuyumculuk & Takı Tasarımı Kursu – Yüz Yüze (Dijital Mücevher & Prototip)'),

    -- Grafik Tasarım (39 published products)
    ('grafik-tasarim-ve-video-efekt-uzmanligi-canli-online-egitimi-staj-garantili-564', 'Grafik Tasarım Kursu & Video Efekt Uzmanlığı – Online Canlı (Staj Garantili)'),
    ('grafik-tasarim-ve-video-efekt-uzmanligi-yuz-yuze-egitimi-staj-garantili-613', 'Grafik Tasarım Kursu & Video Efekt Uzmanlığı – Yüz Yüze (Staj Garantili)'),
    ('grafik-tasarim-ve-video-efekt-uzmanligi-canli-online-egitimi-1484', 'Grafik Tasarım Kursu & Video Efekt Uzmanlığı – Canlı Online'),
    ('grafik-tasarim-ve-video-efekt-uzmanligi-yuz-yuze-egitimi-1489', 'Grafik Tasarım Kursu & Video Efekt Uzmanlığı – Yüz Yüze'),
    ('cocuklar-icin-grafik-tasarim-ve-video-efekt-canli-online-egitimi-1041', 'Çocuklar İçin Grafik Tasarım Kursu & Video Efekt – Online Canlı (10-17 Yaş)'),
    ('cocuklar-icin-grafik-tasarim-ve-video-efekt-yuz-yuze-egitimi-1043', 'Çocuklar İçin Grafik Tasarım Kursu & Video Efekt – Yüz Yüze (10-17 Yaş)'),
    ('grafik-tasarim-atolyesi-1147', 'Grafik Tasarım Kursu Atölyesi – Uygulamalı Tasarım Workshop'),
    ('adobe-photoshop-ve-adobe-illustrator-yuz-yuze-egitimi-1002', 'Adobe Photoshop & Illustrator Grafik Tasarım Kursu – Yüz Yüze'),
    ('adobe-photoshop-yuz-yuze-egitim-783', 'Adobe Photoshop Kursu – Yüz Yüze Grafik Tasarım Eğitimi'),
    ('adobe-illustrator-onlinecanli-ozel-ders-835', 'Adobe Illustrator Özel Ders – Birebir Online Grafik Tasarım Kursu'),
    ('adobe-illustrator-yuz-yuze-ozel-ders-1393', 'Adobe Illustrator Özel Ders – Birebir Yüz Yüze Grafik Tasarım Kursu'),
    ('adobe-photoshop-ve-adobe-illustrator-onlinecanli-egitim-1001', 'Adobe Photoshop & Illustrator Grafik Tasarım Kursu – Online Canlı'),
    ('adobe-photoshop-onlinecanli-egitim-779', 'Adobe Photoshop Kursu – Online Canlı Grafik Tasarım Eğitimi'),
    ('adobe-premiere-pro-ile-video-kurgu-ozel-ders-online-1077', 'Adobe Premiere Pro Video Kurgu Özel Ders – Birebir Online'),
    ('adobe-premiere-pro-ile-video-kurgu-ozel-ders-yuz-yuze-1388', 'Adobe Premiere Pro Video Kurgu Özel Ders – Birebir Yüz Yüze'),
    ('after-effects-ile-dijital-produksiyon-ve-kurgu-uzmanligi-canli-online-egitim-3', 'After Effects ile Motion Graphics & Dijital Prodüksiyon Kursu – Online Canlı'),
    ('after-effects-uzmanligi-canlionline-ozel-ders-1120', 'After Effects Uzmanlığı Özel Ders – Birebir Online (Motion Graphics & VFX)'),
    ('after-effects-premier-pro-ozel-ders-yuz-yuze-egitimi-1402', 'After Effects & Premiere Pro Özel Ders – Birebir Yüz Yüze (Kurgu & VFX)'),
    ('after-effects-uzmanligi-yuz-yuze-ozel-ders-1398', 'After Effects Uzmanlığı Özel Ders – Birebir Yüz Yüze (VFX & Compositing)'),
    ('after-effects-ve-premiere-pro-ile-video-kurgu-egitimi-1464', 'After Effects & Premiere Pro ile Video Kurgu Kursu – Komple Paket'),
    ('after-effects-premier-pro-ozel-ders-canlionline-1121', 'After Effects & Premiere Pro Özel Ders – Birebir Online (Kurgu & Motion)'),
    ('desinatorluk-yuz-yuze-egitimi-612', 'Desinatörlük & Tekstil Desen Tasarım Kursu – Yüz Yüze'),
    ('desinatorluk-egitimi-ozel-ders-1412', 'Desinatörlük & Tekstil Desen Tasarım Özel Ders – Birebir'),
    ('desinatorluk-canli-online-egitimi-563', 'Desinatörlük & Tekstil Desen Tasarım Kursu – Online Canlı'),
    ('cinema-4d-egitimi-canli-egitim-1134', 'Cinema 4D ile 3D Grafik Tasarım Kursu – Online Canlı (Motion & Render)'),
    ('cinema-4d-egitimi-canli-ozel-egitim-1135', 'Cinema 4D Özel Ders – Birebir Online (3D Motion & Render)'),
    ('cinema-4d-yuz-yuze-egitimi-1140', 'Cinema 4D ile 3D Grafik Tasarım Kursu – Yüz Yüze (Motion & Render)'),
    ('video-tasarimi-yuz-yuze-egitimi-981', 'Video Tasarım Kursu – Yüz Yüze (Kurgu, Efekt & Sosyal Medya İçerik)'),
    ('video-tasarimi-canli-online-egitimi-1404', 'Video Tasarım Kursu – Online Canlı (Kurgu, Efekt & Sosyal Medya İçerik)'),
    ('renk-uyumu-canli-online-egitimi-639', 'Renk Teorisi & Uyumu Kursu – Online Canlı (Grafik Tasarım Kursu Tamamlayıcı)'),
    ('uiux-tasarim-egitimi-canli-online-egitimi-1514', 'UI/UX Tasarım Kursu – Figma & Kullanıcı Deneyimi Online Canlı'),
    ('clo3d-ozel-ders-20-saat-1527', 'CLO3D ile 3D Moda Tasarım Özel Ders – 20 Saat Birebir'),
    ('grafik-tasarimin-altin-kurallari-yeni-baslayanlar-ve-profesyoneller-icin-1141', 'Grafik Tasarım Kursu: Altın Kurallar – Başlangıçtan Profesyonele'),
    ('adobe-illustrator-yuz-yuze-egitim-1567', 'Adobe Illustrator Grafik Tasarım Kursu – Yüz Yüze (Vektörel Tasarım)'),
    ('adobe-premiere-pro-ile-video-kurgu-ozel-ders-yuz-yuze-1604', 'Adobe Premiere Pro Video Montaj Özel Ders – Birebir Yüz Yüze'),
    ('desinatorluk-egitimi-20-saat-1626', 'Desinatörlük & Desen Tasarım Kursu – 20 Saatlik Yoğun Program'),
    ('3-aylik-yapay-zeka-destekli-grafik-tasarim-ve-video-kurgu-egitimi-yuz-yuze-1684', 'AI Destekli Grafik Tasarım Kursu & Video Kurgu – 3 Aylık Yüz Yüze (Midjourney & Adobe)'),
    ('3-aylik-yapay-zeka-destekli-grafik-tasarim-ve-video-kurgu-egitimi-online-1686', 'AI Destekli Grafik Tasarım Kursu & Video Kurgu – 3 Aylık Online (Midjourney & Adobe)'),
    ('adobe-indesign-egitimi-16-saat-1691', 'Adobe InDesign Grafik Tasarım Kursu – 16 Saat (Sayfa Düzeni & Yayın Tasarımı)'),

    -- Yazılım Eğitimleri (76 published products)
    ('yazilim-uzmanligi-canli-online-egitim-staj-garantili-668', 'Full Stack Yazılım Uzmanlığı Kursu – Online Canlı (Staj Garantili)'),
    ('yazilim-uzmanligi-yuz-yuze-egitimi-staj-garantili-669', 'Full Stack Yazılım Uzmanlığı Kursu – Yüz Yüze (Staj Garantili)'),
    ('yazilim-uzmaligi-yuz-yuze-egitim-staj-garantili-1457', 'Yazılım Geliştirici Yetiştirme Programı – Yüz Yüze (Staj Garantili)'),
    ('yazilim-uzmanligi-canli-online-egitim-1468', 'Online Yazılım Kursu - Canlı Eğitim'),
    ('yazilim-uzmanligi-60-saat-ozel-ders-yuz-yuze-egitimi-1243', 'Yazılım Uzmanlığı Özel Ders – 60 Saat Birebir Yüz Yüze'),
    ('yazilim-uzmanligi-canli-online-50-saat-ozel-ders-1244', 'Yazılım Uzmanlığı Özel Ders – 50 Saat Birebir Online'),
    ('yazilim-uzmanligi-yuz-yuze-egitim-1473', 'Yazılım Uzmanlığı Kursu – Yüz Yüze Sınıf Eğitimi'),
    ('yazilim-egitimi-ozel-ders-online-canli-egitim-1112', 'Yazılım Programlama Özel Ders – Birebir Online Canlı'),
    ('yazilim-egitimi-ozel-ders-yuz-yuze-egitimi-1345', 'Yazılım Programlama Özel Ders – Birebir Yüz Yüze'),
    ('yazilim-test-otomasyonu-egitimi-yuz-yuze-ozel-ders-1038', 'Yazılım Test Otomasyon Kursu – Selenium & SDET Özel Ders Yüz Yüze'),
    ('yazilim-test-otomasyonu-egitimi-onlinecanli-ozel-ders-1037', 'Yazılım Test Otomasyon Kursu – Selenium & SDET Özel Ders Online'),
    ('yazilim-test-otomasyonu-egitimi-canli-online-egitimi-staj-garantili-7', 'Yazılım Test Otomasyon Kursu – Online Canlı (Staj Garantili) QA & SDET'),
    ('yazilim-test-otomasyonu-canli-online-egitimi-1454', 'Yazılım Test Otomasyon Kursu – Canlı Online (Selenium & QA)'),
    ('full-stack-development-canli-online-egitim-1059', 'Full Stack Web Geliştirme Kursu – Canlı Online (React & Node.js)'),
    ('full-stack-development-yuz-yuze-egitim-staj-garantili-1060', 'Full Stack Web Geliştirme Kursu – Yüz Yüze (Staj Garantili)'),
    ('aranan-programci-olma-kampi-yuz-yuze-kursu-staj-garantili-672', 'Sıfırdan Yazılımcı Olma Bootcamp – Yüz Yüze (Staj Garantili)'),
    ('aranan-programci-olma-kampi-yuz-yuze-kursu-1498', 'Sıfırdan Yazılımcı Olma Bootcamp – Yüz Yüze Kamp'),
    ('aranan-programci-olma-canli-online-kamp-kursu-staj-garantili-555', 'Sıfırdan Yazılımcı Olma Bootcamp – Online Canlı (Staj Garantili)'),
    ('aranan-programci-olma-egitimi-ozel-ders-80-saat-yuz-yuze-egitimi-1341', 'Sıfırdan Programcı Olma Özel Ders – 80 Saat Birebir Yüz Yüze'),
    ('aranan-programci-olma-kampi-online-kursu-1501', 'Sıfırdan Yazılımcı Olma Bootcamp – Online Kamp'),
    ('aranan-programci-olma-egitimi-ozel-ders-80-saat-online-canli-egitim-1292', 'Sıfırdan Programcı Olma Özel Ders – 80 Saat Birebir Online'),
    ('c-programlama-canli-online-egitimi-10', 'C# (C Sharp) Programlama Kursu – Canlı Online Eğitim'),
    ('c-programlama-yuz-yuze-egitimi-596', 'C# (C Sharp) Programlama Kursu – Yüz Yüze Eğitim'),
    ('c-programlama-yuz-yuze-ozel-ders-1108', 'C# (C Sharp) Programlama Özel Ders – Birebir Yüz Yüze'),
    ('c-programlama-canli-online-ozel-ders-1109', 'C# (C Sharp) Programlama Özel Ders – Birebir Online Canlı'),
    ('c-ile-temel-programlama-online-2-ay-1426', 'C# ile Sıfırdan Temel Programlama Kursu – 2 Aylık Online'),
    ('flutter-ile-mobil-uygulama-gelistirme-canli-online-egitimi-557', 'Flutter & Dart ile Cross-Platform Mobil Uygulama Geliştirme Kursu – Online'),
    ('flutter-ile-mobil-uygulama-gelistirme-online-ozel-ders-40-saat-1296', 'Flutter Mobil Uygulama Geliştirme Özel Ders – 40 Saat Online'),
    ('flutter-ile-mobil-uygulama-gelistirme-yuz-yuze-ozel-ders-1080', 'Flutter Mobil Uygulama Geliştirme Özel Ders – Birebir Yüz Yüze'),
    ('flutter-ile-mobil-uygulama-gelistirme-yuz-yuze-egitimi-606', 'Flutter & Dart ile Cross-Platform Mobil Uygulama Geliştirme Kursu – Yüz Yüze'),
    ('java-yazilim-egitimi-online-819', 'Java Programlama Kursu – Sıfırdan İleri Seviye Online Eğitim'),
    ('java-programlama-yuz-yuze-ozel-ders-1110', 'Java Programlama Özel Ders – Birebir Yüz Yüze Eğitim'),
    ('java-yazilim-egitimi-yuz-yuze-1142', 'Java Programlama Kursu – Yüz Yüze Sınıf Eğitimi'),
    ('java-yazilim-egitimi-yuz-yuze-821', 'Java Programlama Kursu – Kapsamlı Yüz Yüze Eğitim'),
    ('java-programlama-canli-online-ozel-ders-1111', 'Java Programlama Özel Ders – Birebir Online Canlı'),
    ('sql-ile-veri-tabani-yonetimi-egitimi-yuz-yuze-1424', 'SQL Veritabanı Yönetimi Kursu – Yüz Yüze (MySQL, PostgreSQL, MSSQL)'),
    ('sql-ile-veri-tabani-yonetimi-canli-online-egitimi-1039', 'SQL Veritabanı Yönetimi Kursu – Canlı Online (MySQL, PostgreSQL)'),
    ('web-programlama-ve-tasarim-onlinecanli-egitim-776', 'Web Programlama ve Tasarım Kursu – HTML, CSS, JavaScript Online Canlı'),
    ('web-programlama-ve-tasarim-yuz-yuze-egitim-1299', 'Web Programlama ve Tasarım Kursu – HTML, CSS, JavaScript Yüz Yüze'),
    ('siber-guvenlik-uzmanligi-ve-etichal-hacking-canli-online-egitimi-1093', 'Siber Güvenlik Uzmanlığı & Ethical Hacking Kursu – Online Canlı (CEH)'),
    ('herkes-icin-siber-guvenlik-atolyesi-1148', 'Herkes İçin Temel Siber Güvenlik Farkındalık Atölyesi'),
    ('2024-python-bootcamp-sifirdan-python-yuz-yuze-egitimi-594', 'Python Bootcamp – Sıfırdan İleri Seviye Yüz Yüze (Veri Bilimi & Otomasyon)'),
    ('python-50-saat-ozel-egitim-yuz-yuze-egitimi-1348', 'Python Programlama Özel Ders – 50 Saat Birebir Yüz Yüze'),
    ('python-canli-online-ozel-ders-1106', 'Python Programlama Özel Ders – Birebir Online Canlı'),
    ('python-yuz-yuze-ozel-ders-1107', 'Python Programlama Özel Ders – Birebir Yüz Yüze'),
    ('2026-python-bootcamp-sifirdan-python-canli-online-egitimi-8', 'Python Bootcamp 2026 – Sıfırdan İleri Seviye Online Canlı (AI & Veri Bilimi)'),
    ('python-ile-yapay-zeka-makine-ogrenimi-kursu-1115', 'Python ile Yapay Zeka ve Makine Öğrenimi (ML) Kursu – Deep Learning & AI'),
    ('python-50-saat-ozel-egitim-online-canli-egitim-1241', 'Python Programlama Özel Ders – 50 Saat Birebir Online Canlı'),
    ('react-native-ile-mobil-uygulama-gelistirme-ozel-ders-online-canli-egitim-1349', 'React Native Mobil Uygulama Geliştirme Özel Ders – Birebir Online'),
    ('react-native-ile-mobil-uygulama-gelistirme-ozel-ders-yuz-yuze-egitimi-1252', 'React Native Mobil Uygulama Geliştirme Özel Ders – Birebir Yüz Yüze'),
    ('front-end-development-yuz-yuze-egitimi-1019', 'Frontend Web Geliştirme Kursu – React, HTML, CSS, JS Yüz Yüze'),
    ('front-end-development-onlinecanli-egitimi-982', 'Frontend Web Geliştirme Kursu – React, HTML, CSS, JS Online Canlı'),
    ('back-end-development-yuz-yuze-egitimi-1010', 'Backend Web Geliştirme Kursu – Node.js, .NET, API Yüz Yüze'),
    ('back-end-development-onlinecanli-egitimi-986', 'Backend Web Geliştirme Kursu – Node.js, .NET, API Online Canlı'),
    ('siber-guvenlik-uzmanligi-ve-etichal-hacking-canli-online-egitimi-ozel-ders-1384', 'Siber Güvenlik & Ethical Hacking Özel Ders – Birebir Online (Pentest & CEH)'),
    ('siber-guvenlik-uzmanligi-ve-etichal-hacking-yuz-yuze-egitimi-1092', 'Siber Güvenlik Uzmanlığı & Ethical Hacking Kursu – Yüz Yüze (CEH & Pentest)'),
    ('siber-guvenlik-egitimi-1462', 'Siber Güvenlik Temelleri Kursu – Ağ Güvenliği & Tehdit Analizi'),
    ('c-programlama-canli-online-ozel-ders-1447', 'C++ Programlama Özel Ders – Birebir Online Canlı (Sistem & Oyun Geliştirme)'),
    ('cocuklar-icin-yuz-yuze-yazilim-kursu-1113', 'Çocuklar İçin Yazılım ve Kodlama Kursu – Yüz Yüze (7-17 Yaş)'),
    ('cocuklar-icin-yazilim-ozel-ders-40-saat-1494', 'Çocuklar İçin Yazılım Özel Ders – 40 Saat Birebir (7-17 Yaş)'),
    ('cocuklar-icin-canli-online-yazilim-kursu-1114', 'Çocuklar İçin Yazılım ve Kodlama Kursu – Online Canlı (7-17 Yaş)'),
    ('yazilim-test-otomasyonu-egitimi-canli-online-egitimi-staj-garantili-1565', 'Yazılım Test Otomasyon Kursu – Online Canlı Staj Garantili (Selenium & CI/CD)'),
    ('cocuklar-icin-yazilim-uzmanligi-egitimi-canli-online-1587', 'Çocuklar İçin Yazılım Uzmanlığı Programı – Kapsamlı Online Canlı (10-17 Yaş)'),
    ('mobil-uygulama-gelistirme-egitimi-20-saat-1593', 'Mobil Uygulama Geliştirme Kursu – 20 Saat Hızlandırılmış Eğitim'),
    ('yazilim-test-otomasyonu-ozel-ders-1608', 'Yazılım Test Otomasyon Özel Ders – Birebir (Selenium, API & CI/CD)'),
    ('sql-ile-veri-tabani-yonetimi-egitimi-canli-online-ozel-ders-20-saat-1611', 'SQL Veritabanı Yönetimi Özel Ders – 20 Saat Birebir Online'),
    ('power-bi-ile-veri-analitigi-ve-kariyer-bootcampi-1643', 'Power BI ile Veri Analitiği Bootcamp – Dashboard & İş Zekası Kursu'),
    ('sql-ile-veri-tabani-yonetimi-egitimi-yuz-yuze-ozel-ders-30-saat-1645', 'SQL Veritabanı Yönetimi Özel Ders – 30 Saat Birebir Yüz Yüze'),
    ('it-temelli-siber-guvenlik-uzmanligi-egitimi-soc-siem-web-guvenligi-ethical-hacking-online-1646', 'IT Temelli Siber Güvenlik Uzmanlığı Kursu – SOC, SIEM & Ethical Hacking Online'),
    ('prompt-muhendisligi-ve-uretken-yapay-zekâ-ile-is-akislari-no-code-n8n-otomasyon-crmdestek-senaryolari-dokuman-asistani-rag-yaklasimi-1649', 'Prompt Mühendisliği & Üretken AI Otomasyon Kursu – n8n, RAG, No-Code İş Akışları'),
    ('sifirdan-uzmanliga-it-ve-sistem-yonetimi-egitimi-1653', 'Sıfırdan IT ve Sistem Yönetimi Uzmanlığı Kursu – Windows Server, Linux & Network'),
    ('sifirdan-uzmanliga-it-ve-sistem-yonetimi-egitimi-online-1654', 'Sıfırdan IT ve Sistem Yönetimi Uzmanlığı Kursu – Online (Windows Server & Linux)'),
    ('netcad-3d-modelleme-egitimi-ozel-ders-1655', 'Netcad 3D Modelleme ve CBS Özel Ders – Birebir (Harita & Mühendislik)'),
    ('3-aylik-yapay-zeka-destekli-yazilim-ve-proje-gelistirme-egitimi-yuz-yuze-1676', 'AI Destekli Yazılım & Proje Geliştirme Kursu – 3 Aylık Yüz Yüze (Copilot & ChatGPT)'),
    ('3-aylik-yapay-zeka-destekli-yazilim-ve-proje-gelistirme-egitimi-online-1678', 'AI Destekli Yazılım & Proje Geliştirme Kursu – 3 Aylık Online (Copilot & ChatGPT)'),
    ('mikroservis-mimarisi-ile-dagitik-sistemler-gelistirme-egitimi-1532', 'Mikroservis Mimarisi & Dağıtık Sistemler Kursu – Docker, Kubernetes & API Gateway');

DO $$
DECLARE
    invalid_targets TEXT;
BEGIN
    IF (SELECT COUNT(*) FROM "_CourseTitleUpdate") <> 164 THEN
        RAISE EXCEPTION 'Course title migration expected 164 unique slugs.';
    END IF;

    SELECT STRING_AGG(update_row."slug", ', ' ORDER BY update_row."slug")
    INTO invalid_targets
    FROM "_CourseTitleUpdate" update_row
    LEFT JOIN "Product" product ON product."slug" = update_row."slug"
    WHERE product."id" IS NULL OR product."status"::TEXT <> 'PUBLISHED';

    IF invalid_targets IS NOT NULL THEN
        RAISE EXCEPTION 'Course title migration has missing or non-published targets: %', invalid_targets;
    END IF;
END $$;

UPDATE "Product" product
SET
    "title" = update_row."newTitle",
    "updatedAt" = CURRENT_TIMESTAMP
FROM "_CourseTitleUpdate" update_row
WHERE product."slug" = update_row."slug"
  AND product."status"::TEXT = 'PUBLISHED'
  AND product."title" IS DISTINCT FROM update_row."newTitle";

DO $$
DECLARE
    target_count INTEGER;
    target_duration TEXT;
BEGIN
    SELECT COUNT(*), MAX("duration")
    INTO target_count, target_duration
    FROM "Product"
    WHERE "slug" = 'unity-ile-oyun-gelistirme-yuz-yuze-egitimi-1481'
      AND "status"::TEXT = 'PUBLISHED';

    IF target_count <> 1 THEN
        RAISE EXCEPTION 'Duration migration expected one published target product.';
    END IF;

    IF target_duration IS NOT NULL AND target_duration <> '8 ay' THEN
        RAISE EXCEPTION 'Duration migration found unexpected value: %', target_duration;
    END IF;
END $$;

UPDATE "Product"
SET
    "duration" = '8 ay',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" = 'unity-ile-oyun-gelistirme-yuz-yuze-egitimi-1481'
  AND "status"::TEXT = 'PUBLISHED'
  AND "duration" IS DISTINCT FROM '8 ay';

DROP TABLE "_CourseTitleUpdate";
