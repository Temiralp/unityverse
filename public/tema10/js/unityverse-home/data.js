(function(window) {
  window.UnityverseHome = window.UnityverseHome || {};

  window.UnityverseHome.data = {
    navbar: {
      ariaLabel: 'Ana navigasyon',
      logo: {
        href: './',
        src: './uploads/p/o/M8NILhl4t7HF-313.jpg',
        alt: 'Unityverse Academy',
        ariaLabel: 'Unityverse Academy ana sayfa',
        width: 156,
        height: 51
      },
      mainMenuLabel: 'Menü',
      mainItems: [
        {
          label: 'Eğitimlerimiz',
          href: './tum-urunler/'
        },
        {
          label: 'Kurumsal Eğitimler',
          href: './os/KURUMSAL-EGITIMLER-10/'
        },
        {
          label: 'Hakkımızda',
          href: './sayfa/hakkimizda-25/'
        },
        {
          label: 'Eğitmenler',
          href: './sayfa/egitmenler-10/'
        },
        {
          label: 'Bilgi/Randevu Al',
          href: './form/hemen-bilgi-al-1/'
        },
        {
          label: 'İletişim',
          href: './sayfa/iletisim-5/'
        },
        {
          label: 'Blog',
          href: './blog/'
        },
        {
          label: 'Yazılım Çözümleri',
          href: './os/yazilim-cozumleri-20/'
        },
        {
          label: 'Tüm Kurslarımız',
          href: './tum-urunler/',
          iconClass: 'fa fa-bars',
          featured: true
        }
      ],
      items: [
        {
          label: 'Oyun Geliştirme',
          href: './kategori/oyun-gelistirme-egitimleri-244/',
          children: [
            {
              label: 'Unity Eğitimleri',
              href: './kategori/oyun-gelistirme-egitimleri-244/'
            },
            {
              label: 'Unreal Engine',
              href: './kategori/oyun-gelistirme-263/'
            },
            {
              label: 'Çocuk ve Gençler',
              href: './urun/cocuk-ve-gencler-icin-unity-ile-oyun-gelistirme-canli-online-egitimi-8-ay-1382/'
            }
          ]
        },
        {
          label: 'Yazılım',
          href: './kategori/yazilim-egitimleri-245/',
          children: [
            {
              label: 'Yazılım Test Otomasyonu',
              href: './urun/yazilim-test-otomasyonu-egitimi-canli-online-egitimi-staj-garantili-7/'
            },
            {
              label: 'Full Stack Development',
              href: './urun/full-stack-development-canli-online-egitim-1563/'
            },
            {
              label: 'Python Bootcamp',
              href: './urun/2026-python-bootcamp-sifirdan-python-canli-online-egitimi-8/'
            }
          ]
        },
        {
          label: 'Grafik-Tasarım',
          href: './kategori/grafik-tasarim-egitimleri-246/',
          children: [
            {
              label: 'Grafik Tasarım',
              href: './kategori/grafik-tasarim-egitimleri-246/'
            },
            {
              label: 'UI/UX Tasarım',
              href: './urun/uiux-tasarim-egitimi-canli-online-egitimi-4-ay-1515/'
            },
            {
              label: 'Video Efekt',
              href: './urun/grafik-tasarim-ve-video-efekt-uzmanligi-yuz-yuze-egitimi-staj-garantili-613/'
            }
          ]
        },
        {
          label: '3D Modelleme',
          href: './kategori/3d-modelleme-egitimleri-247/',
          children: [
            {
              label: 'Blender',
              href: './urun/blender-ile-3d-modelleme-ve-animasyon-egitimi-online-1594/'
            },
            {
              label: 'ZBrush',
              href: './urun/zbrush-ile-organik-modelleme-online-egitimi-1528/'
            },
            {
              label: '3ds Max',
              href: './urun/3ds-max-yuz-yuze-egitimi-615/'
            }
          ]
        },
        {
          label: 'Animasyon',
          href: './kategori/animasyon-egitimleri-248/',
          children: [
            {
              label: '2B Animasyon',
              href: './urun/2b-cizgi-film-ve-animasyon-yuz-yuze-egitimi-614/'
            },
            {
              label: 'After Effects',
              href: './urun/after-effects-ile-dijital-produksiyon-ve-kurgu-uzmanligi-canli-online-egitim-3/'
            },
            {
              label: 'StoryBoard',
              href: './urun/film-ve-animasyon-icin-storyboard-yuz-yuze-egitimi-ozel-ders-1287/'
            }
          ]
        }
      ],
      phone: {
        label: '0 212 807 28 28',
        href: 'tel:+902128072828'
      },
      questionAction: {
        label: 'Bize Sorun',
        href: '#bize_sorun',
        modalTarget: '#bize_sorun'
      },
      registerAction: {
        label: 'Üye Ol',
        href: './uye-ol/',
        iconClass: 'fa fa-user-plus'
      },
      loginAction: {
        label: 'Giriş Yap',
        href: './uye-girisi/',
        iconClass: 'fa fa-sign-in'
      },
      infoAction: {
        label: 'Bilgi Al',
        href: './form/hemen-bilgi-al-1/',
        variant: 'primary',
        icon: '+'
      },
      cart: {
        href: './uye/sepet/',
        ariaLabel: 'Sepete git'
      },
      mobile: {
        menuId: 'uv-navbar-menu',
        openLabel: 'Menüyü aç',
        closeLabel: 'Menüyü kapat'
      }
    },
    hero: {
      eyebrow: 'Staj Garantili Yazılım, Oyun ve Tasarım Eğitimleri',
      title: 'Staj Garantili Eğitimlerle Geleceğini Kodla',
      lead: 'Yazılım, oyun geliştirme ve tasarım kurslarıyla sadece eğitim alma; portfolyo, mentorluk ve sektör bağlantılı staj süreciyle iş hayatına hazırlan.',
      actions: [
        {
          label: 'Ücretsiz Bilgi Al',
          href: './form/hemen-bilgi-al-1/',
          variant: 'primary',
          icon: '+'
        },
        {
          label: 'Eğitimleri Keşfet',
          href: '#uv-programs',
          variant: 'secondary',
          icon: '>'
        }
      ],
      socialProof: '500+ mezun; Lufthansa, Eczacıbaşı, LC Waikiki gibi şirketlerde kariyer yolculuğuna başladı.',
      visual: {
        ariaLabel: 'Kod, oyun ve tasarım eğitimlerini temsil eden abstrakt illüstrasyon alanı',
        lines: ['const future = buildCareer();', 'Unity.Play();', 'design.render();'],
        kicker: 'Kariyer rotası',
        title: 'Eğitim + Portfolyo + Staj',
        caption: 'Sektör odaklı öğrenme akışı'
      }
    },
    values: {
      id: 'uv-values',
      eyebrow: 'Neden Unityverse',
      title: 'Sadece ders değil, kariyer hazırlığı',
      description: 'Her eğitim; pratik üretim, mentorluk, portfolyo ve iş dünyasına geçiş adımlarını birlikte ele alır.',
      items: [
        {
          icon: '{}',
          title: 'Uygulamalı müfredat',
          description: 'Dersler gerçek proje çıktıları ve sektör senaryoları üzerinden ilerler.'
        },
        {
          icon: '[]',
          title: 'Portfolyo odağı',
          description: 'Öğrenciler eğitim sonunda gösterebilecekleri somut işler üretir.'
        },
        {
          icon: '<>',
          title: 'Mentor desteği',
          description: 'Kariyer değişimi yapan öğrenciler için adım adım rehberlik sağlanır.'
        },
        {
          icon: '++',
          title: 'Staj garantisi',
          description: 'Seçili programlarda eğitim sonrası deneyim kazanmayı destekleyen staj süreci bulunur.'
        }
      ]
    },
    courses: {
      id: 'uv-programs',
      eyebrow: 'Popüler eğitimler',
      title: 'Kariyer hedeflerine göre kurs seç',
      description: 'Staj garantili ve uygulamalı eğitimleri format, kategori ve hedeflerine göre hızlıca incele.',
      loading: false,
      skeletonCount: 4,
      labels: {
        stajBadge: 'Staj Garantili',
        quickView: 'Hızlı Bakış'
      },
      items: [
        {
          image: './uploads/p/p/s/yazilim-test-otomasyonu-canli-online-egitimi-staj-garantili_1.jpg',
          title: 'Yazılım Test Otomasyonu Eğitimi',
          category: 'Yazılım',
          isStajGarantili: true,
          format: 'Online',
          price: 'Bilgi Al',
          ctaText: 'Detaya Git',
          href: './urun/yazilim-test-otomasyonu-egitimi-canli-online-egitimi-staj-garantili-7/',
          alt: 'Yazılım test otomasyonu eğitimi'
        },
        {
          image: './uploads/p/p/s/unity-ile-oyun-gelistirme-canli-online-egitimi-staj-garantili_1.jpeg',
          title: 'Unity ile Oyun Geliştirme',
          category: 'Oyun Geliştirme',
          isStajGarantili: true,
          format: 'Online',
          price: 'Bilgi Al',
          ctaText: 'Detaya Git',
          href: './urun/unity-ile-oyun-gelistirme-canli-online-egitimi-staj-garantili-17/',
          alt: 'Unity oyun geliştirme eğitimi'
        },
        {
          image: './uploads/p/p/s/grafik-tasarim-ve-video-efekt-uzmanligi-yuz-yuze-egitimi-staj-garantili_1.jpg',
          title: 'Grafik Tasarım ve Video Efekt Uzmanlığı',
          category: 'Grafik-Tasarım',
          isStajGarantili: true,
          format: 'Yüz Yüze',
          price: 'Bilgi Al',
          ctaText: 'Detaya Git',
          href: './urun/grafik-tasarim-ve-video-efekt-uzmanligi-yuz-yuze-egitimi-staj-garantili-613/',
          alt: 'Grafik tasarım ve video efekt eğitimi'
        },
        {
          image: './uploads/p/p/s/blender-ile-3d-modelleme-ve-animasyon-egitimi-online_1.jpg',
          title: 'Blender ile 3D Modelleme ve Animasyon',
          category: '3D Modelleme',
          isStajGarantili: false,
          format: 'Online',
          price: 'Bilgi Al',
          ctaText: 'Detaya Git',
          href: './urun/blender-ile-3d-modelleme-ve-animasyon-egitimi-online-1594/',
          alt: '3D modelleme ve animasyon eğitimi'
        }
      ]
    },
    programs: {
      id: 'uv-programs',
      eyebrow: 'Popüler eğitim alanları',
      title: 'Yazılım, oyun ve tasarım için net öğrenme yolları',
      description: 'Başlangıç seviyesinden uzmanlığa uzanan, canlı ve uygulamalı kurs seçenekleri.',
      items: [
        {
          title: 'Yazılım Test Otomasyonu',
          description: 'QA kariyerine Selenium, test süreçleri ve otomasyon pratikleriyle hazırlan.',
          href: './urun/yazilim-test-otomasyonu-egitimi-canli-online-egitimi-staj-garantili-7/',
          image: './uploads/p/p/s/yazilim-test-otomasyonu-canli-online-egitimi-staj-garantili_1.jpg',
          alt: 'Yazılım test otomasyonu eğitimi',
          badges: ['Staj Garantili', 'Canlı Online'],
          features: ['Test senaryosu yazımı', 'Otomasyon pratiği', 'Kariyer hazırlığı'],
          action: {
            label: 'Detaya Git',
            href: './urun/yazilim-test-otomasyonu-egitimi-canli-online-egitimi-staj-garantili-7/',
            variant: 'card',
            icon: '>'
          }
        },
        {
          title: 'Unity Oyun Geliştirme',
          description: 'C# ve Unity ile oynanabilir prototipler, mekanikler ve portfolyo projeleri üret.',
          href: './urun/unity-ile-oyun-gelistirme-canli-online-egitimi-staj-garantili-17/',
          image: './uploads/p/p/s/unity-ile-oyun-gelistirme-canli-online-egitimi-staj-garantili_1.jpeg',
          alt: 'Unity oyun geliştirme eğitimi',
          badges: ['Staj Garantili', 'Oyun'],
          features: ['Unity temelleri', 'C# oyun mekaniği', 'Proje geliştirme'],
          action: {
            label: 'Detaya Git',
            href: './urun/unity-ile-oyun-gelistirme-canli-online-egitimi-staj-garantili-17/',
            variant: 'card',
            icon: '>'
          }
        },
        {
          title: 'Grafik Tasarım ve Video Efekt',
          description: 'Marka, sosyal medya, motion ve post-prodüksiyon becerilerini tek programda geliştir.',
          href: './urun/grafik-tasarim-ve-video-efekt-uzmanligi-yuz-yuze-egitimi-staj-garantili-613/',
          image: './uploads/p/p/s/grafik-tasarim-ve-video-efekt-uzmanligi-yuz-yuze-egitimi-staj-garantili_1.jpg',
          alt: 'Grafik tasarım ve video efekt eğitimi',
          badges: ['Staj Garantili', 'Tasarım'],
          features: ['Adobe araçları', 'Video kurgu', 'Tasarım portfolyosu'],
          action: {
            label: 'Detaya Git',
            href: './urun/grafik-tasarim-ve-video-efekt-uzmanligi-yuz-yuze-egitimi-staj-garantili-613/',
            variant: 'card',
            icon: '>'
          }
        },
        {
          title: '3D Modelleme ve Animasyon',
          description: 'Blender, karakter, obje ve oyun dünyası için 3D üretim becerileri kazan.',
          href: './urun/blender-ile-3d-modelleme-ve-animasyon-egitimi-online-1594/',
          image: './uploads/p/p/s/blender-ile-3d-modelleme-ve-animasyon-egitimi-online_1.jpg',
          alt: '3D modelleme ve animasyon eğitimi',
          badges: ['3D', 'Portfolyo'],
          features: ['Modelleme', 'Render', 'Animasyon temelleri'],
          action: {
            label: 'Detaya Git',
            href: './urun/blender-ile-3d-modelleme-ve-animasyon-egitimi-online-1594/',
            variant: 'card',
            icon: '>'
          }
        }
      ]
    },
    process: {
      id: 'uv-process',
      eyebrow: 'Öğrenme modeli',
      title: 'Kayıttan portfolyoya sade bir süreç',
      description: 'Öğrencinin hedefi netleşir, doğru eğitim seçilir ve çıktı odaklı ilerleme takip edilir.',
      steps: [
        {
          number: '01',
          title: 'Hedef analizi',
          description: 'Kariyer beklentisi, seviye ve zaman planı birlikte değerlendirilir.'
        },
        {
          number: '02',
          title: 'Canlı eğitim',
          description: 'Dersler mentor eşliğinde uygulama ve proje üzerinden yürütülür.'
        },
        {
          number: '03',
          title: 'Portfolyo üretimi',
          description: 'Öğrenci, başvuru sürecinde gösterebileceği çalışmalar hazırlar.'
        },
        {
          number: '04',
          title: 'Staj ve kariyer adımı',
          description: 'Seçili programlarda staj garantisi ve kariyer yönlendirmesi devreye girer.'
        }
      ]
    },
    successStories: {
      id: 'uv-success-stories',
      eyebrow: 'Mezun hikayeleri',
      title: 'Eğitimden işe uzanan gerçek yolculuklar',
      description: 'Unityverse mezunları yazılım, oyun ve tasarım alanlarında portfolyolarını kariyer fırsatlarına dönüştürüyor.',
      labels: {
        readMore: 'Devamı'
      },
      controls: {
        prevLabel: 'Önceki mezun hikayesi',
        nextLabel: 'Sonraki mezun hikayesi'
      },
      autoplay: {
        enabled: true,
        interval: 5200
      },
      items: [
        {
          name: 'Fatih Yılmaz',
          initials: 'FY',
          company: 'Lufthansa',
          story: 'Yazılım eğitimi sonrası proje pratiği ve mentorlukla kurumsal yazılım ekibinde görev almaya başladı.',
          href: './blog-detay/fatih-yilmazin-yazilim-yolculugu-ve-lufthansadaki-basarisi-91/'
        },
        {
          name: 'Buse Şahinoğlu',
          initials: 'BŞ',
          company: 'Eczacıbaşı',
          story: '3D tasarım odağındaki portfolyosunu geliştirerek yaratıcı üretim alanında profesyonel sürece geçti.',
          href: './blog-detay/basari-hikâyesi-buse-sahinoglunun-eczacibasindaki-3d-tasarim-yolculugu-107/'
        },
        {
          name: 'Melike Çetin',
          initials: 'MÇ',
          company: 'LC Waikiki',
          story: 'Tasarım eğitimindeki uygulamalı çalışmalarını tekstil ve desen tasarımı kariyerine taşıdı.',
          href: './blog-detay/basari-hikâyesi-melike-cetinin-lc-waikikideki-doku-kaplama-ve-desen-tasarimi-yolculugu-105/'
        },
        {
          name: 'Enes Buğra Cengiz',
          initials: 'EC',
          company: 'Finalizer',
          story: 'Full stack eğitim sürecinde geliştirdiği projelerle yazılım geliştirici kariyerine adım attı.',
          href: './blog-detay/enes-bugra-cengizin-full-stack-developer-yolculugu-93/'
        }
      ]
    },
    testimonials: {
      id: 'uv-testimonials',
      eyebrow: 'Öğrenci deneyimi',
      title: 'Kariyer değişimi için güven veren yapı',
      description: 'Gençler ve aileler için anlaşılır, takip edilebilir ve sonuç odaklı bir eğitim deneyimi.',
      labels: {
        starSymbol: '*',
        ratingSuffix: 'yıldız'
      },
      controls: {
        prevLabel: 'Önceki öğrenci yorumu',
        nextLabel: 'Sonraki öğrenci yorumu'
      },
      autoplay: {
        enabled: true,
        interval: 4800
      },
      items: [
        {
          name: 'A** S**',
          rating: 5,
          text: 'Dersler ezberden çok uygulama mantığıyla ilerlediği için kendi projemi çıkarmaya başladım.',
          course: 'Unity ile Oyun Geliştirme'
        },
        {
          name: 'E** E**',
          rating: 5,
          text: 'Staj hedefi ve portfolyo planı en baştan net olduğu için hangi beceriyi neden öğrendiğimi biliyordum.',
          course: 'Yazılım Test Otomasyonu'
        },
        {
          name: 'K** A**',
          rating: 5,
          text: 'Profesyonel yaklaşım, takip edilebilir eğitim planı ve ilgi süreci çok güven verdi.',
          course: 'Grafik Tasarım ve Video Efekt'
        },
        {
          name: 'B** O**',
          rating: 5,
          text: 'Konu anlatımı ve uygulamalar sayesinde kısa sürede üretim yapabildiğimi gördüm.',
          course: '3D Modelleme ve Animasyon'
        }
      ]
    },
    corporateReferences: {
      id: 'uv-corporate-references',
      eyebrow: 'Kurumsal referanslar',
      title: 'Mezunlarımızın kariyer yolculuğunda görünen markalar',
      description: 'Eğitim, portfolyo ve staj odaklı süreç; öğrencilerin farklı sektörlerde fırsat yakalamasını destekler.',
      marqueeLabel: 'Partner ve referans şirket logoları',
      items: [
        {
          name: 'Lufthansa',
          href: './blog-detay/fatih-yilmazin-yazilim-yolculugu-ve-lufthansadaki-basarisi-91/',
          ariaLabel: 'Lufthansa başarı hikayesi'
        },
        {
          name: 'Eczacıbaşı',
          href: './blog-detay/basari-hikâyesi-buse-sahinoglunun-eczacibasindaki-3d-tasarim-yolculugu-107/',
          ariaLabel: 'Eczacıbaşı başarı hikayesi'
        },
        {
          name: 'LC Waikiki',
          href: './blog-detay/basari-hikâyesi-melike-cetinin-lc-waikikideki-doku-kaplama-ve-desen-tasarimi-yolculugu-105/',
          ariaLabel: 'LC Waikiki başarı hikayesi'
        },
        {
          name: 'Finalizer',
          href: './blog-detay/enes-bugra-cengizin-full-stack-developer-yolculugu-93/',
          ariaLabel: 'Finalizer başarı hikayesi'
        },
        {
          name: 'Testinium',
          href: './blog-detay/arda-bickinnin-yazilim-test-otomasyonu-egitimi-ve-testiniumdaki-staj-sureci-89/',
          ariaLabel: 'Testinium başarı hikayesi'
        },
        {
          name: 'AYES Çelik',
          href: './blog-detay/suat-erizin-ayes-celikteki-yazilim-gelistirici-ve-kalite-kontrol-gorevi-97/',
          ariaLabel: 'AYES Çelik başarı hikayesi'
        }
      ]
    },
    cta: {
      id: 'uv-contact',
      eyebrow: 'Başlangıç adımı',
      title: 'Doğru kursu birlikte seçelim',
      description: 'Eğitim danışmanları; hedef, seviye, program süresi ve staj garantili seçenekler hakkında bilgi verir.',
      actions: [
        {
          label: 'Hemen Bilgi Al',
          href: './form/hemen-bilgi-al-1/',
          variant: 'primary',
          icon: '+'
        },
        {
          label: 'WhatsApp',
          href: 'https://wa.me/+905454228887?text=Bilgi almak istiyorum...',
          variant: 'secondary',
          icon: '>'
        }
      ]
    },
    footer: {
      columns: [
        {
          title: 'Bilgilendirme',
          items: [
            {
              label: 'Hakkımızda',
              href: './sayfa/hakkimizda-25/'
            },
            {
              label: 'KVKK Aydınlatma Metni',
              href: './sayfa/kisisel-verilerin-korunmasi-hakkinda-aydinlatma-bildirimi-29/'
            },
            {
              label: 'Mesafeli Satış Sözleşmesi',
              href: './sayfa/mesafeli-satis-sozlesmesi-26/'
            },
            {
              label: 'İptal ve İade Koşulları',
              href: './sayfa/iptal-ve-iade-kosullari-28/'
            }
          ]
        },
        {
          title: 'Markalar',
          items: [
            {
              label: 'Unityverse Academy',
              href: './'
            },
            {
              label: 'Tüm Eğitimler',
              href: './tum-urunler/'
            },
            {
              label: 'Staj Garantili Eğitimler',
              href: './kategori/staj-garantili-egitimler-266/'
            }
          ]
        },
        {
          title: 'Kariyer',
          items: [
            {
              label: 'Bizimle Çalışmak İster Misiniz?',
              href: './os/KARIYER-14/'
            },
            {
              label: 'Başarı Hikayeleri',
              href: './sayfa/basari-hikayeleri-12/'
            },
            {
              label: 'Eğitmenlerimiz',
              href: './sayfa/egitmenler-10/'
            }
          ]
        }
      ],
      social: {
        title: 'Sosial media',
        items: [
          {
            label: 'Twitter',
            href: 'https://mobile.twitter.com/semantik_soft',
            iconClass: 'fa fa-twitter'
          },
          {
            label: 'Instagram',
            href: 'https://www.instagram.com/unityverse.akademi/?igshid=YmMyMTA2M2Y=',
            iconClass: 'fa fa-instagram'
          },
          {
            label: 'WhatsApp',
            href: 'https://api.whatsapp.com/send?phone=+905454228887&text=Merhaba,%20bilgi%20almak%20istiyorum',
            iconClass: 'fa fa-whatsapp'
          },
          {
            label: 'YouTube',
            href: 'https://www.youtube.com/channel/UCmrjYQ72sDrKKaMHKq0Pa_Q/',
            iconClass: 'fa fa-youtube-play'
          },
          {
            label: 'LinkedIn',
            href: 'https://www.linkedin.com/company/unityverse-academy/',
            iconClass: 'fa fa-linkedin'
          }
        ]
      },
      whatsapp: {
        href: 'https://wa.me/+905454228887?text=Bilgi almak istiyorum...',
        ariaLabel: 'WhatsApp ile bilgi al',
        iconClass: 'fa fa-whatsapp'
      },
      copyright: '© 2026 Unityverse Academy. Tüm Hakları Saklıdır.'
    }
  };
})(window);
