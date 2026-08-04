function legacyFilterFallbackPayload() {
    const loggedIn = document.body && document.body.classList.contains('member-logged-in');

    return {
        sub_category_list: [
            { name: 'Oyun Geliştirme Eğitimleri', count: 23, url: site_url + 'kategori/oyun-gelistirme-egitimleri-244/' },
            { name: 'Yazılım Eğitimleri', count: 76, url: site_url + 'kategori/yazilim-egitimleri-245/' },
            { name: 'Grafik - Tasarım Eğitimleri', count: 39, url: site_url + 'kategori/grafik-tasarim-egitimleri-246/' },
            { name: '3D Modelleme Eğitimleri', count: 25, url: site_url + 'kategori/3d-modelleme-egitimleri-247/' },
            { name: 'Animasyon Eğitimleri', count: 8, url: site_url + 'kategori/animasyon-egitimleri-248/' },
            { name: 'Ses Tasarım Eğitimleri', count: 6, url: site_url + 'kategori/ses-tasarim-egitimleri-251/' },
            { name: 'Senaryo, Sinema ve Yönetmenlik Eğitimleri', count: 6, url: site_url + 'kategori/senaryo-sinema-ve-yonetmenlik-egitimleri-252/' },
            { name: 'Endüstriyel Ürün Tasarım Eğitimleri', count: 6, url: site_url + 'kategori/endustriyel-urun-tasarim-egitimleri-253/' },
            { name: 'Dil Eğitimleri', count: 2, url: site_url + 'kategori/dil-egitimleri-257/' },
            { name: 'Dijital Pazarlama Eğitimleri', count: 3, url: site_url + 'kategori/dijital-pazarlama-egitimleri-255/' },
            { name: 'Özel Dersler', count: 50, url: site_url + 'kategori/ozel-dersler-256/' },
            { name: 'Muhasebe ve Ofis Eğitimleri', count: 5, url: site_url + 'kategori/muhasebe-ve-ofis-egitimleri-258/' },
            { name: 'Mimarlık Eğitimleri', count: 22, url: site_url + 'kategori/mimarlik-egitimleri-259/' }
        ],
        category_tree: [],
        brand_filters: [{ id: 1, name: 'Unityverse Academy', pcount: 245 }],
        price_filters: loggedIn ? [
            { val1: 0, val2: 4999, pcount: 3 },
            { val1: 5000, val2: 9999, pcount: 6 },
            { val1: 10000, val2: 19999, pcount: 46 },
            { val1: 20000, val2: 39999, pcount: 55 },
            { val1: 40000, val2: 100000, pcount: 134 }
        ] : [],
        special_filters: {
            new_count: 3,
            sponsor_count: 0,
            campaign_count: 0,
            bestseller_count: 7
        },
        feature_filter_values: [],
        pagination: '',
        total_product_count: 245
    };
}

function filterFieldsetCell(legendText) {
    const cells = document.querySelectorAll('#filterPnl .table_cell');

    for (let i = 0; i < cells.length; i++) {
        const legend = cells[i].querySelector('legend');
        if (legend && legend.textContent.trim().toLowerCase() === legendText.toLowerCase()) {
            return cells[i];
        }
    }

    return null;
}

function renderCheckboxList(cell, rows, buildRow) {
    if (!cell) return;

    const list = cell.querySelector('ul');
    if (!list || !rows || rows.length === 0) {
        cell.style.display = 'none';
        return;
    }

    cell.style.display = '';
    list.innerHTML = rows.map(buildRow).join('');
}

function renderStaticFilterFallback(payload) {
    payload = payload || legacyFilterFallbackPayload();

    const panel = document.getElementById('filterPnl');
    if (!panel) return;

    panel.removeAttribute('v-cloak');
    $('.filter-loading').hide();

    const categoryModule = panel.querySelector('.module.menu-category');
    const filterModule = panel.querySelector('.module.latest-product.filters');
    const categoryList = panel.querySelector('#cat_accordion');

    if (categoryModule) {
        categoryModule.classList.remove('display-none');
        categoryModule.classList.add('display-block');
    }

    if (filterModule) {
        filterModule.classList.remove('display-none');
        filterModule.classList.add('display-block');
    }

    if (categoryList) {
        categoryList.innerHTML = payload.sub_category_list.map(function(row) {
            return '<li><a href="' + row.url + '" onclick="return getresults(0, \'' + row.url + '\')">' + row.name + ' (' + row.count + ')</a></li>';
        }).join('');
    }

    renderCheckboxList(filterFieldsetCell('Markalar'), payload.brand_filters, function(brand) {
        return '<li><input type="checkbox" class="filterchanged" id="brand_' + brand.id + '" value="' + brand.id + '"> <label for="brand_' + brand.id + '">' + brand.name + ' (' + brand.pcount + ')</label></li>';
    });

    const specialRows = [];
    if (payload.special_filters && payload.special_filters.new_count > 0) {
        specialRows.push({ id: 'special_new', label: 'Yeni Ürünler', count: payload.special_filters.new_count });
    }
    if (payload.special_filters && payload.special_filters.bestseller_count > 0) {
        specialRows.push({ id: 'special_bestseller', label: 'Çok Satan Ürünler', count: payload.special_filters.bestseller_count });
    }

    renderCheckboxList(filterFieldsetCell('Özel Filtreler'), specialRows, function(row) {
        return '<li><input type="checkbox" class="filterchanged" id="' + row.id + '"> <label for="' + row.id + '">' + row.label + ' (' + row.count + ')</label></li>';
    });

    renderCheckboxList(filterFieldsetCell('Fiyat Aralığı'), payload.price_filters, function(price, index) {
        const value = price.val1 + '-' + price.val2;
        return '<li><input type="checkbox" class="filterchanged" id="price_' + index + '" value="' + value + '"> <label for="price_' + index + '">' + price.val1 + ' - ' + price.val2 + ' (' + price.pcount + ')</label></li>';
    });

    $('#search_result').html(payload.total_product_count + ' ürün bulundu');
    if (window.legacyCourseCatalog) {
        window.legacyCourseCatalog.refreshFromUrl();
    }
    $(".filterchanged").off('change.staticFilterFallback').on('change.staticFilterFallback', function () {
        getresults(0);
    });
}

function fetchFilterPayload(url) {
    const timeout = new Promise(function(resolve) {
        setTimeout(function() {
            resolve({ param: legacyFilterFallbackPayload() });
        }, 2500);
    });

    const request = fetch(url)
        .then(function(res) {
            if (!res.ok) throw new Error('Filter request failed');
            return res.json();
        })
        .then(function(res) {
            if (!res || !res.param) throw new Error('Invalid filter response');
            return res;
        })
        .catch(function() {
            return { param: legacyFilterFallbackPayload() };
        });

    return Promise.race([request, timeout]);
}

function bindFilter() {
    if (typeof Vue === 'undefined') {
        renderStaticFilterFallback();
        return;
    }

    window.VueComponent = window.VueComponent || {};
    window.VueComponent.Filter = new Vue({
    	
    	delimiters: ['${', '}'],
        el: '#filterPnl',
        name: 'FilterSide',

        data: {
        	loading: true,
            url: '',
            sub_category_list: [],
            category_tree: [],
            brands: [],
            special: [],
            prices: [],
            feature_filter_values: [],
            selected_filters: []
        },
        
        methods: {
        	
        	includeParameter: function(type, val)
        	{
				if(val === '' || val === 0) return false;
        		list = getUrlParameter(type);
        		if(list === false) return false;
        		if(val == list) return true;
        		const arr = list.split(",");
        		if(arr.indexOf(''+val) >= 0)
        			return true;
        		return false;
        	},
        	
        	detectSelectedFilters: function ()
        	{
        		if(getUrlParameter('b') != '' && typeof this.brands !== 'undefined')
        		{
        			for(i=0; i<this.brands.length; i++)
        			{
        				let brand = this.brands[i];
        				if(this.includeParameter('b', brand.id))
        					this.selected_filters.push({type:'b', value:brand.id, name:brand.name + ' ('+brand.pcount+')'});
        			}
        		}
        		if(getUrlParameter('f') != '')
        		{
					for (const featureGroup of this.feature_filter_values)
					{
						const features = featureGroup.values;
						for(i=0; i<features.length; i++)
						{
							feature = features[i];
							if(this.includeParameter('f', feature.fid))
								this.selected_filters.push({type:'f', value:feature.fid, name:feature.fname + ' ('+feature.pcount+')'});
						}
					}
        		}
        		if(getUrlParameter('p') != '')
        		{
        			for(i=0; i<this.prices.length; i++)
        			{
        				let price = this.prices[i];
        				if(this.includeParameter('p', price.val1+'-'+price.val2))
        					this.selected_filters.push({type:'p', value:i, name:price.val1+'-'+price.val2 + ' ('+price.pcount+')'});
        			}
        		}
                if(typeof this.special !== 'undefined') {
                    if(getUrlParameter('sn') == '1')
                        this.selected_filters.push({type:'sn', value:0, name:'Yeni Ürünler ('+this.special.new_count+')'});
                    if(getUrlParameter('ss') == '1')
                        this.selected_filters.push({type:'ss', value:0, name:'Sponsor Ürünler ('+this.special.sponsor_count+')'});
                    if(getUrlParameter('sc') == '1')
                        this.selected_filters.push({type:'sc', value:0, name:'Kampanyalı Ürünler ('+this.special.campaign_count+')'});
                    if(getUrlParameter('sb') == '1')
                        this.selected_filters.push({type:'sb', value:0, name:'En İyi Satıcılar ('+this.special.bestseller_count+')'});
                }
                if(getUrlParameter('q') != '')
                    this.selected_filters.push({type:'q', value:0, name:'Arama: '+decodeURIComponent(getUrlParameter('q').replace( /\+/g, ' ' ))});
        	},

            applyPayload: function(res) {
                $('.filter-loading').hide();
                res = res.param;
                this.sub_category_list = res.sub_category_list || [];
                this.category_tree = res.category_tree || [];
                this.brands = res.brand_filters || [];
                this.prices = res.price_filters || [];
                this.special = res.special_filters || {};
                this.feature_filter_values = res.feature_filter_values || [];
                this.selected_filters = [];
                this.detectSelectedFilters();
                this.loading=false;

                if (typeof window.changePage === 'function') {
                    let pg = parseInt(getUrlParameter('pg')) || 1;
                    window.changePage(pg);
                } else {
                    $('.pagination').html(res.pagination || '');
                }
                $('#search_result').html(res.total_product_count + ' ürün bulundu');
                renderStaticFilterFallback(res);
                if (window.legacyCourseCatalog) {
                    window.legacyCourseCatalog.refreshFromUrl();
                }
                if(res.total_product_count > 12)
                {
                    $('.pagesize-div').show();
                    if(getUrlParameter('ps') != '')
                        $('#pagesize').val(getUrlParameter('ps')).change();
                }

                setTimeout(function () {

                    $(".filter-input").on("keyup", function() {
                        var value = $(this).val().toLowerCase();
                        $(this).parent('.filters-search').siblings('.checkboxes_list, .list-group').find('li').filter(function() {
                            $(this).toggle($(this).text().toLowerCase().indexOf(value) > -1)
                        });
                    });
                    $(".filterchanged").on('change',function () {
                        getresults(0);
                    });
                    $('#hide-filter').click(function() {
                        $('#column-left').removeClass('filtre_acik');
                        $('body').removeClass('body-fix');
                        return false;
                    });
                });
            }
        
        },
        
        created() {
            this.url = getFilterUrl();
            fetchFilterPayload(this.url).then(this.applyPayload);
        },
    });
}

window.addEventListener("load", function (event) {
    bindFilter();
    setTimeout(function() {
        const panel = document.getElementById('filterPnl');
        const visibleModule = panel && panel.querySelector('.module.menu-category.display-block');
        if (!visibleModule) {
            renderStaticFilterFallback();
        }
    }, 1200);
});
