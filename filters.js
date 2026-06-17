function bindFilter() {

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
                        this.selected_filters.push({type:'sn', value:0, name:'Yeni ÃrÃ¼nler ('+this.special.new_count+')'});
                    if(getUrlParameter('ss') == '1')
                        this.selected_filters.push({type:'ss', value:0, name:'Sponsor ÃrÃ¼nler ('+this.special.sponsor_count+')'});
                    if(getUrlParameter('sc') == '1')
                        this.selected_filters.push({type:'sc', value:0, name:'KampanyalÄ± ÃrÃ¼nler ('+this.special.campaign_count+')'});
                    if(getUrlParameter('sb') == '1')
                        this.selected_filters.push({type:'sb', value:0, name:'En Ä°yi SatÄ±cÄ±lar ('+this.special.bestseller_count+')'});
                }
                if(getUrlParameter('q') != '')
                    this.selected_filters.push({type:'q', value:0, name:'Arama: '+decodeURIComponent(getUrlParameter('q').replace( /\+/g, ' ' ))});
        	}
        
        },
        
        created() {
            this.url = getFilterUrl();
            fetch(this.url)
                .then((res) => {
                    return res.json();
                })
                .then((res) => {
                	$('.filter-loading').hide();
                	res = res.param;
                	this.sub_category_list = res.sub_category_list;
                	this.category_tree = res.category_tree;
                    this.brands = res.brand_filters;
                    this.prices = res.price_filters;
                    this.special = res.special_filters;
                    this.feature_filter_values = res.feature_filter_values;
                    this.detectSelectedFilters();
                    this.loading=false;
                    
                    $('.pagination').html(res.pagination);
                    $('#search_result').html(res.total_product_count + ' Ã¼rÃ¼n bulundu');
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
                });
        },
    });
}

window.addEventListener("load", function (event) {
    bindFilter();
});
