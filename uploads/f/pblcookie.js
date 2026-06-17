CookieConsent.run({

    disablePageInteraction: true,

    cookie: {
        name: "pbl_cookie",
    },

    guiOptions: {
        consentModal: {
            layout: "cloud width",
            position: "bottom center"
        },
        preferencesModal: {
            layout: "box"
        }
    },

    onFirstConsent: () => {
		params = JSON.stringify({first:1,accepttype:CookieConsent.getUserPreferences().acceptType,acceptedcategories:CookieConsent.getUserPreferences().acceptedCategories});
		$.ajax({
			type: "post",
			url: "../../ajax/cookieselection",
			data: params,
			dataType: "json",
			contentType: "application/json; charset=utf-8",
			success: function(result) {
			},
		});
    },

    onConsent: () => {
    },

    onChange: () => {
		params = JSON.stringify({accepttype:CookieConsent.getUserPreferences().acceptType,acceptedcategories:CookieConsent.getUserPreferences().acceptedCategories});
		$.ajax({
			type: "post",
			url: "../../ajax/cookieselection",
			data: params,
			dataType: "json",
			contentType: "application/json; charset=utf-8",
			success: function(result) {
			},
		});
    },

    categories: {
        necessary: {
            readOnly: true,
            enabled: true
        },
		functional: {
        },
		analitics: {
        },
		ads: {
        }},
	language: {
        default: "tr",

        translations: {
            tr: {
                consentModal: {
                    title: "Çerez Tercihleri",
                    description: "Web sitemizde gezinme deneyiminizi geliştirmek, size kişiselleştirilmiş içerik ve hedefli reklamlar göstermek, web sitesi trafiğimizi analiz etmek ve ziyaretçilerimizin nereden geldiğini anlamak için çerezleri ve diğer izleme teknolojilerini kullanıyoruz.",
                    acceptAllBtn: "Kabul Et",
                    acceptNecessaryBtn: "",
                    showPreferencesBtn: "Çerezleri Yönet",
                    closeIconLabel: "Hepsini Reddet ve Kapat",
                    footer: ``
                },
                preferencesModal: {
                    title: "Çerez Tercihleri",
                    acceptAllBtn: "Hepsini Kabul Et",
                    acceptNecessaryBtn: "",
                    savePreferencesBtn: "Tercihleri Kaydet",
                    sections: [
						{
                            title: "Çerez Kullanımı",
                            description: "Çerezler, bir web sitesini ziyaret ettiğinizde bilgisayarınızda depolanan çok küçük metin dosyalarıdır. Çerezleri çeşitli amaçlarla ve web sitemizdeki çevrimiçi deneyiminizi geliştirmek için (örneğin, hesap giriş bilgilerinizi hatırlamak için) kullanıyoruz. Web sitemizde gezinirken tercihlerinizi değiştirebilir ve bilgisayarınızda saklanacak belirli çerez türlerini reddedebilirsiniz. Ayrıca, bilgisayarınızda depolanmış olan çerezleri de kaldırabilirsiniz, ancak çerezleri silmenin web sitemizin bölümlerini kullanmanızı engelleyebileceğini unutmayın."
                        },
                        {
                            title: "Gerekli Çerezler",
                            description: "Bu çerezler, web sitemizin çalışması için gereklidir ve sistemlerimizde kapatılamaz. Bunlar genellikle tarafınızca yapılan ve hizmet talebi anlamına gelen eylemlere yanıt olarak yerleştirilir, örneğin gizlilik tercihlerinizi ayarlamak, oturum açmak ya da formları doldurmak. Tarayıcınızı bu çerezleri engelleyecek ya da bu çerezlerle ilgili olarak size uyarıda bulunacak şekilde ayarlayabilirsiniz, ancak bu durumda sitenizin bazı kısımları çalışmayabilir. Bu çerezler sizi kişisel olarak tanımlayabilecek herhangi bir bilgi saklamamaktadır.",
							linkedCategory: "necessary",
							
                        }, {
                            title: "Fonksiyonel Çerezler",
                            description: "Bu çerezler web sitesinin daha zengin işlevsellik ve kişiselleştirme sunmasına olanak sağlar. Bunlar firmamız veya sayfamıza hizmetlerini eklediğimiz üçüncü taraf tedarikçiler tarafından yerleştirilebilir. Bu çerezler size sitemizde önceki ziyaret ve seçimlerinize dayanarak daha kişisel bir deneyim sunmayı amaçlar. Bu çerezlere izin vermediğiniz takdirde bazı hizmetler, hatta hiçbir hizmet düzgün çalışmayabilir.",
                            linkedCategory: "functional",
							
                        }, {
                            title: "İzleme ve Performans Çerezleri",
                            description: "Bu çerezler, web sitemize gelen trafiği ve ziyaretçilerin web sitemizi nasıl kullandığını analiz etmek için bilgi toplamak amacıyla kullanılır. Örneğin, çerezler, web sitesinde ne kadar zaman geçirdiğiniz veya ziyaret ettiğiniz sayfalar gibi şeyleri izleyebilir ve bu da web sitemizi sizin için nasıl iyileştirebileceğimizi anlamamıza yardımcı olur. Bu izleme ve performans çerezleri aracılığıyla toplanan bilgiler anonim olup herhangi bir bireysel ziyaretçiyi tanımlamaz.",
                            linkedCategory: "analitics",
							
                        }, {
                            title: "Hedefleme ve reklam çerezleri",
                            description: "Bu çerezler web sitesinin daha zengin işlevsellik ve kişiselleştirme sunmasına olanak sağlar. Bunlar firmamız veya sayfamıza hizmetlerini eklediğimiz üçüncü taraf tedarikçiler tarafından yerleştirilebilir. Bu çerezler size sitemizde önceki ziyaret ve seçimlerinize dayanarak daha kişisel bir deneyim sunmayı amaçlar. Bu çerezlere izin vermediğiniz takdirde bazı hizmetler, hatta hiçbir hizmet düzgün çalışmayabilir.",
                            linkedCategory: "ads",
							
                        }
                    ]
                }
            }
        }
    }
});