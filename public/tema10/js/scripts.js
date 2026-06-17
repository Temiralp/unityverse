(function() {
    function checkDevice() {
        var isMobile = window.innerWidth < 1200;
        var htmlEl = document.documentElement;
        if (isMobile) {
            if (htmlEl.classList.contains('pbl-desktop')) {
                htmlEl.classList.remove('pbl-desktop');
                htmlEl.classList.add('pbl-mobile');
            }
            if (window.js_configurations) {
                window.js_configurations.is_mobile = true;
            }
        } else {
            if (htmlEl.classList.contains('pbl-mobile')) {
                htmlEl.classList.remove('pbl-mobile');
                htmlEl.classList.add('pbl-desktop');
            }
            if (window.js_configurations) {
                window.js_configurations.is_mobile = false;
            }
        }
    }
    // Run immediately
    checkDevice();
    // Also run on DOMContentLoaded and Load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', checkDevice);
    } else {
        checkDevice();
    }
    window.addEventListener('load', checkDevice);
    // Also run on resize
    window.addEventListener('resize', checkDevice);
})();

$(window).load(function(){	
	$("img.lazy").lazy({effect : "fadeIn", effectTime: 500,visibleOnly : true});
	$("html").get(0).style.setProperty("--header-h", $('.header-bottom').height()+'px');	
});

/*==================================================== notify.js ====================================================*/
function _info(selector, msg, position)
{
	position = (position == undefined || position == "") ? "top center" : position;
	if($(window).width() < 768)
		position = "top left";
	if(selector == '')
		$.notify(msg, { position:position, className:"info notifyctr"});
	else
		$(selector).notify(msg, { position:position, className:"info"});
	return false;
}
function _success(selector, msg, position)
{
	msg = msg.replace(/{br}/g, '\n');
	
	position = (position == undefined || position == "") ? "top center" : position;	
	if($(window).width() < 768)
		position = "top left";
	if(selector == '')
	{
		$.notify( msg, { position:position, className:"success notifyctr"});
	}
	else
		$(selector).notify(msg, { position:position, className:"success"});
	return false;
}
function _error(selector, msg, position)
{
	msg = msg.replace(/{br}/g, '\n');
	
	position = (position == undefined || position == "") ? "top center" : position;
	if($(window).width() < 768 && selector == '')
		position = "top left";
	if(selector == '')
		$.notify(msg, { position:position, className:"error notifyctr"});
	else
	{
		var $el = $(selector);
		if($el.length && $el.offset())
		{
			if($(window).scrollTop() > $el.offset().top - 100)
			{
				$('html, body').animate({
			        scrollTop: $el.offset().top - 100
			    }, 1000);
			}
			if($el.offset().top - 100 < 0)
			{
				$('.fancybox-inner').animate({
			        scrollTop: $el.offset().top - 100
			    }, 1000);
			}
		}
		$el.notify(msg, { position:position, className:"error"});
	}
	return false;
}
function _warn(selector, msg, position)
{
	position = (position == undefined || position == "") ? "top center" : position;
	if($(window).width() < 768)
		position = "top left";
	if(selector == '')
		$.notify(msg, { position:position, className:"warn notifyctr"});
	else
		$(selector).notify(msg, { position:"top center", className:"warn"});
	return false;
}
function _confirm(msg, position)
{
	position = (position == undefined || position == "") ? "top center" : position;
	if($(window).width() < 768)
		position = "top left";
	$.notify({title:msg}, { style:'confirm', position:position, autoHide:false, clickToHide: false});
	$('#site_locked').addClass('site_locked');
	
	$(document).on('click', '.notifyjs-confirm-base .no', function() {
	  $('#site_locked').removeClass('site_locked');
	  $(this).trigger('notify-hide');
	});
}
$(".ti-close").on('click',function(){
	
$(".search-bar").removeClass('show');
});

$("#searchicon").on('click',function(){
	 setTimeout(function() {
	$("#q").get(0).focus();
	 }, 200);
});

function number(evt) {
	var charCode = (evt.which) ? evt.which : event.keyCode
	if (charCode > 31 && (charCode < 48 || charCode > 57))
		return false;
	return true;
}

function writeCookie(name, value, days) {
    if(days==null || days=="")days=365;
    var d=new Date(); 
    d.setTime(d.getTime()+(days*24*60*60*1000));  
    var expires="; expires="+d.toGMTString();  
    document.cookie = name+"="+value+expires+"; path=/"; 
}
function readCookie(name){
    var c=document.cookie ; 
    if (c.indexOf(name)!=-1) { 
        pos1=c.indexOf("=", c.indexOf(name))+1; 
        pos2=c.indexOf(";",pos1);  
            if(pos2==-1)    pos2=c.length;;        
        data=c.substring(pos1,pos2);         
        return data;
    }
} 
function sendSystemLog(selector, desc, text)
{
    // Statik sitede eksik backend API istekleri için hata mesajı gösterimini engelledik
}


function check_tcno(a){
	  if(!/^\d+$/.test(a)) {
	  	return false;
	  }
	  if(a.substr(0,1)==0 || a.length!=11){
	    return false;
	  }
	  var i = 9, md='', mc='', digit, mr='';
	  while(digit = a.charAt(--i)){
	    i%2==0 ? md += digit : mc += digit;
	  }
	  if(((eval(md.split('').join('+'))*7)-eval(mc.split('').join('+')))%10!=parseInt(a.substr(9,1),10)){
	    return false;
	  }
	  for (c=0;c<=9;c++){
	    mr += a.charAt(c);
	  }
	  if(eval(mr.split('').join('+'))%10!=parseInt(a.substr(10,1),10)){
	    return false;
	  }
	  return true;
	}

function addCompare(pid)
{
	$.ajax({
		type: "post",
		url: site_url + "ajax/compare",
		data: ({id:pid, act:"add"}),
		success: function(msg) {	
			if($.trim(msg) == 'limit')
			{
				_error('', 'En fazla 4 tane ürün karşılaştırabilirsiniz.');
			}
			else
			{
				$('.secilileri_karsilastir').html('<li class="info-link wishlist-icon content"><a href="#!" onclick="return compare();" title=""><i class="fa fa-exchange" aria-hidden="true"></i>Seçili Ürünleri Karşılaştır (<b id="compare_count">'+msg+'</b>)</a></li>');
				$("#compare"+pid).show();
				$("#compare"+pid).html('<a href="#!" onclick="return compare();">Seçilenleri Karşılaştır</a><a href="#!" onclick="removeCompare('+pid+')" title="Bu Ürünü Karşılaştırma Listesinden Çıkart" data-toggle="tooltip" data-placement="top"><i class="fa fa-times"></i></a>');
				$('#compareicon'+pid).html("");
			}
		},
	});	
	return false;

}

function compare()
{
	if($("#compare_count").text() < 2)
	{
		_error ("", "En az 2 ürün seçmelisiniz.");		
	}
	else
		window.location.href = site_url + 'pbl/karsilastir?return_url='+document.URL;
	return false;
}

function removeCompare(pid)
{
	$.ajax({
		type: "post",
		url: site_url + "ajax/compare",
		data: ({id:pid, act:"del"}),
		success: function(msg) {											
			$('#karsilastir_' + pid).html('<a href="#" onclick="return addCompare('+pid+')"> <span> Bu Ürünü Karşılaştır </span> </a>');				
			if(msg == '0') {
				$('.secilileri_karsilastir').html('');
				$("#compare"+pid).hide();
				$("#compare"+pid).html('');
				$('#compareicon'+pid).html('<a onclick="return addCompare(' +pid+ ')" id="karsilastir_'+pid+'" pid="' +pid+ '" href="#!"  title="Karşılaştır" data-toggle="tooltip" data-placement="right" href=""><span><i class="fa fa-exchange"></i></span></a>');
			}
			else		
			{
				$('.secilileri_karsilastir').html('<a href="" onclick="return compare();" data-placement="bottom" data-toggle="tooltip" title="" data-original-title="Seçili Ürünleri Karşılaştır"> <span> <qqq><www><eee> Seçili Ürünleri Karşılaştır (<span id="compare_count">'+msg+'</span>) </eee></www></qqq> </span> </a><a href="#" onclick="return compareRemoveAll();"> <span> <qqq><www><eee> <i class="fa fa-times"></i> </eee></www></qqq></span> </a>');
				$("#compare"+pid).hide();
				$("#compare"+pid).html('');
				$('#compareicon'+pid).html('<a onclick="return addCompare(' +pid+ ')" id="karsilastir_'+pid+'" pid="' +pid+ '" href="#!"  title="Karşılaştır" data-toggle="tooltip" data-placement="right" href=""><span><i class="fa fa-exchange"></i></span></a>');
			}	
			return false;
		},
	});	
	return false;
}
function compareRemoveAll()
{
	$.ajax({
		type: "post",
		url: site_url + "ajax/compare",
		data: ({act:"clear"}),
		success: function(msg) {								
			
			$('.secilileri_karsilastir').html('');
		},
	});	
	return false;
}
  
  function checkOptions()
  {
  	if($(".variant-popup").length == 0 && (($("#poptions1").val() != undefined && $("#poptions1").val() == 0) || ($("#poptions2").val() != undefined && $("#poptions2").val() == 0) || ($("#poptions3").val() != undefined && $("#poptions3").val() == 0)))
  	{
  		_error("", "Bu Bir Seçenekli Üründür\n Lütfen Seçim Yapınız");	
  		return false;
  	}	
  	return true;
  }
  function checkAddressIsDefined() {
	if(typeof $("#preaddress")[0] === 'undefined')
		return true;
	
	if($("#modal_countryid").val() > 0  && $("#modal_cityid").val() > 0 && $("#modal_townid").val() > 0 && $("#modal_neighborhoodid").val() > 0 )
		return true;
	else {
		_error('', 'Lütfen Adres Seçimi Yapınız');
		return false;
	}
		
}	
  function addToBasket(pid, pcount, getit, extra_price, pdigital = 0, pidx = 0)
  {
  	if(pcount > 0)
  	{
  		if(!checkOptions()) return false;
  		
  		poptions = "";
  		additionalentry = "";
  		product_fileupload = "";
  		if($("#poptions1").val() != undefined && $("#poptions1 option:selected").text() != "")	
  			poptions = $("#poptions1 option:selected").text();	
  		if($("#poptions2").val() != undefined && $("#poptions2 option:selected").text() != "")	
  			poptions = poptions + " - " + $("#poptions2 option:selected").text();
  		if($("#poptions3").val() != undefined && $("#poptions3 option:selected").text() != "")	
  			poptions = poptions + " - " + $("#poptions3 option:selected").text();
  		if($("#field_product_fileupload") && $("#field_product_fileupload") != '')	
  			product_fileupload = $("#field_product_fileupload").val();
  		if($("#additionalentry").val())	
  			additionalentry = $("#additionalentry").val();
  		if($('#product_width').val() || $('#product_heiht').val())
  			additionalentry = additionalentry + ' ' + $('#product_width').val() + 'x' + $('#product_height').val();
  		
  		if(checkAddressIsDefined()) {
        	$("#preaddress").modal('hide');
        	_addToBasket(pid, pcount, poptions, additionalentry, getit, extra_price, product_fileupload, 0, pdigital, pidx,true);
        }
        else {        	
        	$("#preaddress").modal('show');
        	$("#addbasketmodal").attr('onclick','addToBasket('+pid+', '+pcount+', '+getit+')');
        }
  	}
  	else
  		_error('', lang_arr.js_urun_miktar);
  	return false;
  }
  function getBasketContent(openModal) {
	  params = JSON.stringify({pid:"",bid:"",cmd:"getpopup",count:""});
		$.ajax({
			type: 'post',
			data: params,
			url: site_url+"ajax/basket/basketcontent",
			dataType: 'json',
			contentType: "application/json; charset=utf-8",
			success: function (result) {
				if (result.param.status == "0") 
				{
					var basket_products = $($.parseHTML(result.param.products)).filter("#ajax_basket_products").html();
					if(typeof basket_products == 'undefined') {	
						$("#basket_popup_content").html("");
						$("#basket_popup").modal('hide');
					} else {
						$("#basket_popup_content").html(basket_products);
						if(!$("#basket_popup").hasClass('in') && openModal)
							$("#basket_popup").modal('show');
					}
					$('#product_details').modal('hide');
					bindPlusMinus();
					if (typeof result.param.has_must_be_delete_items !== "undefined") {
						if(!result.param.has_must_be_delete_items) {
							has_must_be_delete_items = false;
						}
					}	
				} 
			},
		});
		return false;
  }
  function _addToBasket(pid, pcount, poptions, additionalentry, getit, extra_price, product_fileupload = '', extra_price_once = 0, pdigital = false, pidx = 0,show_variant_popup = false)
  {
	var phone = "+905454228887";
	var courseName = "";
	
	// Try to find course name from detail page H1
	var h1Element = document.querySelector('.product-info h1, h1');
	if (h1Element) {
		courseName = h1Element.textContent.trim();
	}
	
	// If not on detail page, try to find from the clicked card
	if (!courseName && document.activeElement) {
		var activeEl = document.activeElement;
		var card = activeEl.closest('.pbl-product-card-item');
		if (card) {
			var nameEl = card.querySelector('.pbl-product-card-item-name a');
			if (nameEl) {
				courseName = nameEl.textContent.trim();
			}
		}
	}
	
	// Fallback
	if (!courseName) {
		courseName = document.title.split('|')[0].trim();
	}
	
	var text = "Merhaba, bilgi almak istiyorum.";
	if (courseName) {
		text = "Merhaba, " + courseName + " eğitimi hakkında bilgi almak ve kayıt olmak istiyorum.";
	}
	
	var whatsappUrl = "https://api.whatsapp.com/send?phone=" + phone + "&text=" + encodeURIComponent(text);
	window.open(whatsappUrl, '_blank');
	return false;
}
function ___addToBasket(pid, pcount, poptions, additionalentry, getit, extra_price, product_fileupload = '', extra_price_once = 0, pidx = 0,show_variant_popup = false)
{
	params = JSON.stringify({
			productid:pid,
			productcount:pcount, 
			poptions:poptions,
			additionalentry:additionalentry,
			extra_price:extra_price,
			product_fileupload:product_fileupload,
			extra_price_once:extra_price_once,
			countryid: $('#modal_countryid').val(),
			cityid: $('#modal_cityid').val(),
			townid: $('#modal_townid').val(),
			current_url: window.location.href
	});
	$.ajax({
		type: 'POST',
		url: site_url + "ajax/basket/addtobasket",
		dataType: 'json',
		contentType: "application/json; charset=utf-8",
		data: params,
		success: function (result) {
			if (result.param.sonuc == "0") 
			{
				if(getit)
					window.location.href= site_url + 'uye/sepet';
				else
				{
					if (result.param.product_detail != null) {
						result.param.product_detail.pidx = pidx;
						if(typeof _hookGtagAddBasket == 'function')
							_hookGtagAddBasket(result.param.product_detail);
						if(typeof _hookPixelAddBasket == 'function')
							_hookPixelAddBasket(result.param.product_detail,result.param.totalcount);
					}
					if(js_configurations.hide_basket_modal == 2)
						setTimeout(() => {
							location.reload();
						}, 500);
					if(js_configurations.hide_basket_modal > 0)
						_success("", result.message);
					$('.cart-total-full').html(result.param.totalcount + ' ' + lang_arr.js_text_product + ' - '+ result.param.totalprice);
				  $('.sepet_sayi').text(result.param.totalcount);
				  if(!$('#kolay_urun_ekle').hasClass('in') && !js_configurations.hide_basket_modal)
					  getBasketContent(true);
				}
			} else if (result.param.sonuc == "1") {
				if(result.param.stokmiktar == 0)
					_error("", result.message);
				else
					_error("", result.param.extra_msg);					
			} else if (result.param.sonuc == "2") {
				if(getit)
					window.location.href= site_url + 'uye/sepet';
				_error("", result.param.extra_msg);
			} else if (result.param.sonuc == "3") {
				_error("", result.message);
				if(show_variant_popup && !result.param.is_option)
					getProductVariantPopup(pid);
				else if(result.param.is_option && result.param.purl != '')
					setTimeout(function(){ window.location.href= result.param.purl; }, 2000);
			} else if (result.param.sonuc == "4") {
				_error("", result.message);	
				setTimeout(function(){ window.location.href= site_url + 'pbl/uye-girisi'; }, 2000);
			} else if (result.param.sonuc == "5") {
				_error("", result.message);	
				setTimeout(function(){ window.location.href= site_url + 'uye/sepet'; }, 3000);
			}else {
				sendSystemLog('', 'addtobasket', result.message);
			}
		},
	});	
  }
  function getProductVariantPopup(product_id) {

      let params = JSON.stringify({ product_ids: product_id});

      $.ajax({
          type: 'post',
          data: params,
          url: site_url + "ajax/getproductvariantpopup",
          dataType: 'json',
          contentType: "application/json; charset=utf-8",
          success: function (result) {

              if (result.status == 'success') {

                  let $popup = $(result.message);
                  $popup.css({
                      opacity: 0
                  });

                  $("body").append($popup);

                  let $box = $popup.find("> div").first();

                  $box.css({
                      transform: "translateY(30px)",
                      opacity: 0
                  });

                  requestAnimationFrame(function () {
                      $box.css({
                          transition: "all 300ms ease",
                          transform: "translateY(0)",
                          opacity: 1
                      });

                      $popup.css({
                          transition: "opacity 200ms ease",
                          opacity: 1
                      });

                  });
              }
          }
      });

      return false;
  }

  function removeBasket()
  {
	  	var oncekiUrunSayisi = $('.sepet_sayi').text();
	  	if(oncekiUrunSayisi == '0')
	  		_error('', lang_arr.js_sepet_urun_yok);
	  	else 
	  	{
	  		_confirm(lang_arr.js_sepet_silinecek);
	  		$(document).on('click', '.notifyjs-confirm-base .yes', function() {
	  			$('#site_locked').removeClass('site_locked');
	  			$.ajax({
	  				type: 'POST',
	  				url: site_url + 'ajax/basket/delete',
	  				dataType : 'json',
	  				success: function (result) {	
	  					if(result.status == 'success')
	  					{
	  						_success("", result.message);
	  						refreshBasket("get", "", "");
	  					} else {
	  						sendSystemLog('', 'removeBasket', result.message);
	  					}
	  				},
	  			});
	  		    $(this).trigger('notify-hide');
	  		});
	  	}
  }

  function basketSummary(cmd = 'refresh', pid = 0, bid = 0, count = 0)
  {
  	params = JSON.stringify({cmd:cmd,pid:pid,bid:bid,count:count});
  	
  	$.ajax({
		type: 'POST',
		url: site_url + "ajax/basket/summary",
		dataType: 'json',
		global : false,
		contentType: "application/json; charset=utf-8",
		data: params,
		success: function (result) {
			if($.trim(result.status) == "success")
				_basketSummary(result, bid)
			else 
				_error('', result.message);
		},
	});
  	return false;
  }

  function _basketSummary(result, bid = 0)
  {
  	if(result.param.stockcount > 0)
	{
		_error('#spcount_' + bid, lang_arr.js_control_stok.replace('{0}', result.param.stockcount));
		$("#spcount_"+bid).val(result.param.stockcount);
	}
	else
	{
	  	$('.pbl-new-header-basket-side-bar-content').html(result.param.products);
	  	$('.cart-total-full').html(result.param.productcount + ' ' + lang_arr.js_text_product + ' - '+ result.param.totalprice);
	  	$('.pbl-new-header-basket-total-price').html(result.param.totalprice);
	    $('.pbl-new-header-basket-total-count').text(result.param.productcount);
	    $('.sepet_sayi').text(result.param.productcount);
	    
	    if(typeof total_price !== 'undefined' && result.param.totalpriceraw !== undefined) {
	    	total_price = parseFloat(result.param.totalpriceraw);
	    }
	    
	    bindPlusMinus();
    }
  }

  $(document).ajaxError(
  		function (event, jqXHR, ajaxSettings, thrownError) {
  			if(ajaxSettings.url != '' && ajaxSettings.url.indexOf('errorreport') > 0 ) return;
  			if((jqXHR && jqXHR.statusText == 'abort') || thrownError == 'abort') return;
  			if(ajaxSettings.data == undefined && jqXHR.responseText == undefined && thrownError.message == undefined) return;
  			var desc = "url: " + ajaxSettings.url + '\ndata: ' + ajaxSettings.data;
  			var text = "responseText: " + jqXHR.responseText + "\nThrownMessage: " + thrownError.message;
  			sendSystemLog('', desc, text);		
  	});


  function updateCityList(cityselector, townselector, country_id, city_id, town_id, neighborhoodselector, neighborhood_id)
  {
  	if(country_id > 0)
  	{
  		$.ajax({
  			type: "post",
  			url: site_url + "ajax/member/citylist",
  			data: ({countryid:country_id}),
  			success: function(msg) {	
  				$(cityselector).empty().append(msg);
  				if(city_id > 0)
  					$(cityselector).val(city_id).attr('selected',true);	
  				if(town_id == 0)
  				{
  					$(townselector).empty();
  					$(townselector).hide().show();
  				}
				updateTownList(townselector, city_id, town_id,neighborhoodselector,neighborhood_id);
  					
  			},
  		});
  	}
  	else
  	{
  		$(cityselector).empty();
  		$(cityselector).hide().show();
  		$(townselector).empty();
  		$(townselector).hide().show();
  	}
  		
  }

  function updateTownList(townselector, city_id, town_id,neighborhoodselector, neighborhood_id)
  {
  	if(city_id > 0)
  	{
  		$.ajax({
  			type: "post",
  			url: site_url + "ajax/member/townlist",
  			data: ({cityid:city_id}),
  			success: function(msg) {
				if($(msg + ' option').length <= 1)
				{
					var city_selector = 'cityid';
					if(townselector[1] == 'f')
						city_selector = 'fcityid';
					const city_name = $('#' + city_selector + ' option[value="' + city_id + '"]').text();
					msg += '<option value="-1">' + city_name + '</option>\n';
					town_id = -1;
				}
  				$(townselector).empty().append(msg);
  				if(town_id != 0)
  					$(townselector).val(town_id).attr('selected',true);		
				if($(neighborhoodselector).length > 0)
					updateNeighborhoodList(neighborhoodselector, town_id, neighborhood_id);
  			},
  		});	
  	}
  	else
  	{
  		$(townselector).empty();
  		$(townselector).hide().show();
  	}
  }
  
  function updateNeighborhoodList(neighborhoodselector, town_id, neighborhood_id)
    {
    	if(town_id > 0)
    	{
    		$.ajax({
    			type: "post",
    			url: site_url + "ajax/member/neighborhoodlist",
    			data: ({town_id:town_id}),
    			success: function(msg) {
  				if($(msg + ' option').length <= 1)
  				{
  					var town_selector = 'townid';
  					if(neighborhoodselector[1] == 'f')
  						town_selector = 'ftownid';
  					const town_name = $('#' + town_selector + ' option[value="' + town_id + '"]').text();
  					msg += '<option value="-1">' + town_name + '</option>\n';
  					neighborhood_id = -1;
  				}
    				$(neighborhoodselector).empty().append(msg);
    				if(neighborhood_id != 0)
    					$(neighborhoodselector).val(neighborhood_id).attr('selected',true);			
    			},
    		});	
    	}
    	else
    	{
    		$(neighborhoodselector).empty();
    		$(neighborhoodselector).hide().show();
    	}
    }

  function saveMail(selector = '', use_selector_notify = true)
  {
  	value = selector ? $('#' + selector).val() : $('#savemail').val();
	let selector_notify = use_selector_notify ? (selector ? '#' + selector : '#savemail') : '';
  	if(!/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(value))
  	{
  		return _error(selector_notify, "Lütfen geçerli bir mail adresi giriniz");
  	}
  	
  	$.ajax({
  	   type: "post",
  	   url: site_url + "/ajax/savemail",
  	   data: ({mail : value}),
  	   success: function(msg){
  		  msg = $.trim(msg);
  		  if(msg == "duplicate")
  			 _info(selector_notify, "Mail adresi sistemimizde kayıtlıdır.");
  		  else if(msg=="ok")
  		  {
  			_success(selector_notify, "Mail adresiniz kaydedilmiştir. Teşekkür ederiz. ");
  			$('#savemail').val('');
  		  }
  		  else 
  			_error(selector_notify, "Beklenmeyen bir hata oluştu.");
  	   }
  	 }); 		
  }

var isManualSearchSubmitting = false;
var searchRequest = null;

  function manualSearch()
  {
  	var q = $("#q").val().trim();
  	if(q == '')
  	{
  		_error('', 'Lütfen aramak istediğiniz kelimeyi giriniz.')
  		return false;
  	}
  	else if(q.length < 2)	
  	{
  		_error('', 'Aradığınız kelime en az 3 harfli olmalıdır.');
  		return false;
  	}
	var activeSearchRequest = searchRequest;
	if(activeSearchRequest && activeSearchRequest.readyState !== 4 && typeof activeSearchRequest.abort === 'function')
		activeSearchRequest.abort();
  	if(typeof isManualSearchSubmitting !== 'undefined' && isManualSearchSubmitting)
  		return false;
  	isManualSearchSubmitting = true;
  	$('#searchform button[type="submit"]').prop('disabled', true);
  	return true;
  }

  function loginwithfacebook(p)
  {
      document.location.href = "https://e-eticaret.net/social/facebook/login.php?" + p;
      return false;
  }

  function loginwithgoogle(p)
  {
  	document.location.href = "https://e-eticaret.net/social/google/login.php?" + p;
  	return false;
  }

  function changeLang(url) {
      if(url != 0)
          document.location.href = url;
          return false;
  }

$(document).ajaxStart(function() {
   if(typeof ajaxloadingdisabled === 'undefined' || !ajaxloadingdisabled)
  	$(".site_loading").show();
}).ajaxStop(function() {
	if(typeof ajaxloadingdisabled === 'undefined' || !ajaxloadingdisabled)
	$(".site_loading").hide();
});
  $("#pollsubmit").click(function() {
      $("#pollerror").addClass('display_none');
      $("#pollok").addClass('display_none');
      var cookieName = "pobol_anket_" + activepollid;
      var voted = "";
      if (readCookie(cookieName) == "true") {
          $("#pollerror").html('Daha Önce Katıldınız');
          $("#pollerror").removeClass('display_none').fadeTo("slow", 1, function() {
              setTimeout(function() {
                  $("#pollerror").fadeOut("slow");
              }, 3000);
          });;
          voted = "voted";
      }
      var pollanswerid = $("input[type='radio'][name='pollanswerid']:checked").val();
      if (pollanswerid > 0 || voted == 'voted') {
          $.ajax({
              type: "POST",
              url: site_url + "ajax/poll",
              data: {
                  pollid: activepollid,
                  pollanswerid: pollanswerid,
                  voted: voted
              },
              success: function(msg) {
                  if (voted == '') {
                      $("#pollok").html("Teşekkür ederiz").fadeTo("slow", 1, function() {
                          setTimeout(function() {
                              $("#pollok").fadeOut("slow");
                          }, 3000);
                      });
                      writeCookie(cookieName, "true", 30);
                  }
                  answers = msg.split(",");
                  var count = answers.length;
                  var total = 0;
                  for (i = 0; i < count; i++) {
                      if (answers[i] != '') total += parseInt(answers[i]);
                  }
                  color_arr = ['yesil', 'sari', 'turuncu', 'mavi', 'pembe', 'kirmizi'];
                  for (i = 0; i < count; i++) {
                      p = Math.ceil((answers[i] * 100) / total);
                      $('#pollanswer_' + (i + 1)).html('( ' + p + '% - ' + answers[i] + ' oy )');
                      $('#pollbar_' + (i + 1)).html('<div class="bar ' + color_arr[i] + '" style="width: ' + p + '%"></div>');
                  }
              },
          });
      } else {
          $("#pollerror").html("Cevap seçiniz").fadeTo("slow", 1, function() {
              setTimeout(function() {
                  $("#pollerror").fadeOut("slow");
              }, 3000);
          });
      }
  });
  
  function getFileIcon(filename)
  {
  	if(filename == undefined)
  		return '<i class="fa fa-file" aria-hidden="true"></i>';
  	if(filename.endsWith(".pdf"))
  		return '<i class="fa fa-file-pdf" aria-hidden="true" style="color:red;"></i>';
  	else if(filename.endsWith(".xls") || filename.endsWith(".xlsx"))
  		return '<i class="fa fa-file-excel" aria-hidden="true" style="color:green;"></i>';
  	else if(filename.endsWith(".doc") || filename.endsWith(".docx"))
  		return '<i class="fa fa-file-word" aria-hidden="true" style="color:blue;"></i>';
  	else if(filename.endsWith(".zip") || filename.endsWith(".rar") || filename.endsWith(".tar") || filename.endsWith(".gz"))
  		return '<i class="fa fa-file-archive" aria-hidden="true" style="color:purple;"></i>';	
  	else if(filename.endsWith(".txt"))
  		return '<i class="fa fa-file-alt" aria-hidden="true"></i>';
  	else
  		return '<i class="fa fa-file" aria-hidden="true"></i>';
  }

  function characterLimit(text, count){
  	if(text == undefined)
  		return '';
      return text.slice(0, count) + (text.length > count ? "..." : "");
  }
	
$(function () {
	$("#cookie-close").click(function (e) {
		e.stopPropagation();
		$(".cookie-bottom").removeClass("cokie-open");
		$(".cookie-bottom").addClass("cokie-closed");
		writeCookie('apply_cookie', 1, 30);
		setTimeout(function () {
			$(".cookie-bottom").css({visibility: "hidden", opacity: "0"});
		}, 1000);
	});
});
if (readCookie('apply_cookie') == 1) {
	$(".cookie-bottom").removeClass("cokie-open");
	$(".cookie-bottom").addClass("cokie-closed");
} else if (readCookie('apply_cookie') == 0) {
	$(".cookie-bottom").addClass("cokie-closed");
	$(".cookie-bottom").removeClass("cokie-open");
} else {
	$(".cookie-bottom").removeClass("cokie-closed");
	setTimeout(function () {
		$(".cookie-bottom").addClass("cokie-open");
	}, 1000);
}
function initCountDown() {
	$(".countdown").each(function(i, obj) {
    var data_time = $(obj).data("time");
    $(obj).countdown(data_time, function(event) {
        var $this = $(obj).html(event.strftime(''
            + '<div class="countdown-element"><span class="countdown-number">%D</span><span class="countdown-text">'+lang_arr.js_gun+'</span></div></div> '
            + '<div class="countdown-element"><span class="countdown-number">%H</span><span class="countdown-text">'+lang_arr.js_saat+'</span></div></div> '
            + '<div class="countdown-element"><span class="countdown-number">%M</span><span class="countdown-text">'+lang_arr.js_dakika+'</span></div></div> '
            + '<div class="countdown-element"><span class="countdown-number">%S</span><span class="countdown-text">'+lang_arr.js_saniye+'</span></div></div>'));
    }).on('finish.countdown', function() {
           $(this).hide();
    });
});
}	
initCountDown();
function getJsonDataFromForm(formid) 
{
	var jsonData = {};
	var formData = $("#" + formid).serializeArray();
	$.each(formData, function() {
	 	if (jsonData[this.name]) {
	 		if (!jsonData[this.name].push) {
	 			jsonData[this.name] = [jsonData[this.name]];
	 		}
	 		jsonData[this.name].push($.trim(this.value) || '');
	 	} else {
	 		jsonData[this.name] = $.trim(this.value) || '';
		}
	});
	return JSON.stringify(jsonData);
}
function bindPlusMinus()
{
  $('.minus-btn').off('click');
  $('.plus-btn').off('click');
  $('.minus-btn').on('click', function(e) {
	    e.preventDefault();
	    var $this = $(this);
	    var $input = $this.parent('div').find('input');
	    var $factor = $input.data('count-factor');
	    if($factor == undefined || $factor <= 0) $factor = 1;
	    var value = parseFloat($input.val());
	
	    if(value != $factor) 
		    value = value - $factor;
		if(value < $factor)
			value = $factor;
	    $input.val(value).trigger('change');
  });

  $('.plus-btn').on('click', function(e) {
	    e.preventDefault();
	    var $this = $(this);
	    var $input = $this.parent('div').find('input');
	    var $factor = $input.data('count-factor');
		if($factor == undefined || $factor <= 0) $factor = 1;
	    var value = parseFloat($input.val());
        
        value = value + $factor;
	    $input.val(value).trigger('change');
  });
}
bindPlusMinus();

function getUrlParameter(sParam) {
    var sPageURL = window.location.search.substring(1),
        sURLVariables = sPageURL.split('&'),
        sParameterName,
        i;

    for (i = 0; i < sURLVariables.length; i++) {
        sParameterName = sURLVariables[i].split('=');

        if(sParam == 'b' && sParameterName[1] === undefined && predefined_brand_id != undefined)
        	return predefined_brand_id;
        if (sParameterName[0] === sParam) {
            return typeof sParameterName[1] === undefined ? true : decodeURIComponent(sParameterName[1]);
        }
    }
    return false;
};

function addParameterToURL(param){
    var _url = location.href;
    _url += (_url.split('?')[1] ? '&':'?') + param;
    window.history.pushState('page', document.title, _url);    
}

function updateURLParameter(url, param, paramVal){
    var newAdditionalURL = "";
    var tempArray = url.split("?");
    var baseURL = tempArray[0];
    var additionalURL = tempArray[1];
    var temp = "";
    if (additionalURL) {
        tempArray = additionalURL.split("&");
        for (var i=0; i<tempArray.length; i++){
            if(tempArray[i].split('=')[0] != param){
                newAdditionalURL += temp + tempArray[i];
                temp = "&";
            }
        }
    }

    var rows_txt = temp + "" + param + "=" + paramVal;
    return baseURL + "?" + newAdditionalURL + rows_txt;
}

function delay(callback, ms) {
  var timer = 0;
  return function() {
    var context = this, args = arguments;
    clearTimeout(timer);
    timer = setTimeout(function () {
      callback.apply(context, args);
    }, ms || 0);
  };
}

function isValidEmail(email) {
	return /^(?:[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*|"[^"\r\n]+")@(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/.test(email);
}

$(document).ready(function() {
	var hovered = false
	if($('.navbar-version-three li:has(.submenu)').length < 1)
	{
		$('.navbar-version-three li:has(.submenu-sub)').mouseenter(function() {
			setTimeout(() => {
				if($(this).is(':hover'))
				{
					hovered = true;
					$(this).find('.submenu-sub').css({'visibility': 'visible', 'opacity': '1', '-webkit-transition': 'all 150ms linear 0ms', '-moz-transition': 'all 150ms linear 0ms', '-ms-transition': 'all 150ms linear 0ms', '-o-transition': 'all 150ms linear 0ms', 'transition': 'all 150ms linear 0ms'});
				}
			}, 200);
		});
		$('.navbar-version-three li:has(.submenu-sub)').mouseleave(function() {
			$(this).find('.submenu-sub').css({'visibility': 'hidden', 'opacity': '0', 'pointer-events': 'all', '-webkit-transition': 'all 150ms linear 400ms', '-moz-transition': 'all 150ms linear 400ms', '-ms-transition': 'all 150ms linear 400ms', '-o-transition': 'all 150ms linear 400ms', 'transition': 'all 150ms linear 400ms'});
		});
	}
	else
	{
		$('.navbar-version-three li:has(.submenu)').mouseenter(function() {
			setTimeout(() => {
				if($(this).is(':hover'))
				{
					hovered = true;
					$(this).find('.submenu').css({'visibility': 'visible', 'opacity': '1', '-webkit-transition': 'all 150ms linear 0ms', '-moz-transition': 'all 150ms linear 0ms', '-ms-transition': 'all 150ms linear 0ms', '-o-transition': 'all 150ms linear 0ms', 'transition': 'all 150ms linear 0ms'});
				}
			}, 200);
		});
		$('.navbar-version-three li:has(.submenu)').mouseleave(function() {
			$(this).find('.submenu').css({'visibility': 'hidden', 'opacity': '0', 'pointer-events': 'all', '-webkit-transition': 'all 150ms linear 400ms', '-moz-transition': 'all 150ms linear 400ms', '-ms-transition': 'all 150ms linear 400ms', '-o-transition': 'all 150ms linear 400ms', 'transition': 'all 150ms linear 400ms'});
		});
	}
	
    const $body = $('body');
    function getScrollWidth() {
        return window.innerWidth - document.documentElement.clientWidth;
    }

    function fixBody() {
        const scrollWidth = getScrollWidth();
        $body.addClass('body-fix bodyNoClick overlay');
        $body.css({paddingRight: scrollWidth > 0 ? scrollWidth : 0});
    }

    function unfixBody() {
        $body.removeClass('body-fix bodyNoClick overlay');
        $body.css({paddingRight: 0});
    }
    
    /* Search Box*/
    const $searchBox = $('.pbl-new-header-right-search-box');
    const $searchBoxWrapper = $('.search-pro');
    const $searchResult = $('.pbl-new-header-right-search-result');

    function openSearchBox() {
       search();
    }

    function closeSearchBox(event) {
        var searchBox = document.getElementById('sosearchpro');

        // Eğer tıklanan alan searchBox'ın dışındaysa
        if (!searchBox.contains(event.target) || event.currentTarget.className == 'pbl-new-header-right-search-result-close') {
            $searchBox.removeClass('active');
            $searchBoxWrapper.removeClass('active');
            setTimeout(() => unfixBody(), 0);
            searchBox.classList.remove('active'); // veya istediğin başka bir kapatma fonksiyonu
        }
		if(!$searchBox.hasClass('active'))
        	$('header').removeClass('header-overlay');
    }
    
    $searchBox.click((e) => {
    	if ($(e.target).closest('.pbl-barcode-scanner').length) {
	        return;
	    }
        e.stopPropagation();
        $searchBox.hasClass('active') ? closeSearchBox(e) : openSearchBox();
    });
    $searchResult.click((e) => e.stopPropagation());
    $('.pbl-new-header-right-search-result-close').click((e) => {
        e.stopPropagation();
        closeSearchBox(e);
    });
    $('#q').keyup(delay(function () {
    	search();
    }, js_configurations.autocomplete_delay));
    
    function removeSearchHistory(q = '')
	{
		ajaxloadingdisabled = true;	
		params = JSON.stringify({q:q});
		$.ajax({
			type: "post",
			url: site_url + "ajax/removesearchhistory",
			data: params,
			dataType: 'json',
			contentType: "application/json; charset=utf-8",
			success: function(result) {	
				if(result.status == 'success')
					search();
			},
			error: function () {
			}
		});	
		ajaxloadingdisabled = false;
	}
    
    function search()
	{
		if(isManualSearchSubmitting)
			return;
		q = $('#q').val()
		if(q != '' && q.length < 2)
			return;
		ajaxloadingdisabled = true;	
		params = JSON.stringify({q:q});
		var activeSearchRequest = searchRequest;
		if(activeSearchRequest && activeSearchRequest.readyState !== 4 && typeof activeSearchRequest.abort === 'function')
			activeSearchRequest.abort();
		searchRequest = $.ajax({
			type: "post",
			url: site_url + "ajax/search",
			data: params,
			dataType: 'json',
			contentType: "application/json; charset=utf-8",
			success: function(result) {	
				if(result.status == 'success')
				{
					search_left_side_html = '';
					search_right_side_html = '';
					param = result.param;
					if(undefined != param.products)
					{
						total_count = param.products.length;
						
						search_left_side_html += '<div class="pbl-new-header-right-search-result-left-side-content">';
						if(undefined != param.categories)
						{
							total_count += param.categories.length;
							for(i=0;i<param.categories.length;i++)
							{
								_category = param.categories[i];
								search_left_side_html += '<div class="pbl-new-header-right-search-result-left-side-item pbl-results"><a href="'+_category.category_url+'"><img src="data:image/svg+xml;charset=utf-8,%3Csvg width=%2724%27 height=%2724%27 viewBox=%270 0 24 24%27 fill=%27none%27 xmlns=%27http://www.w3.org/2000/svg%27 stroke=%27none%27%3E %3Cpath d=%27M7.125 10.5C8.98896 10.5 10.5 8.98896 10.5 7.125C10.5 5.26104 8.98896 3.75 7.125 3.75C5.26104 3.75 3.75 5.26104 3.75 7.125C3.75 8.98896 5.26104 10.5 7.125 10.5Z%27 stroke=%27%239B9B9B%27 stroke-width=%271.5%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27/%3E %3Cpath d=%27M3.79593 17.4232C3.73469 17.316 3.73469 17.184 3.79593 17.0768L5.31203 14.4232C5.37326 14.316 5.48643 14.25 5.6089 14.25H8.6411C8.76357 14.25 8.87674 14.316 8.93797 14.4232L10.4541 17.0768C10.5153 17.184 10.5153 17.316 10.4541 17.4232L8.93798 20.0768C8.87674 20.184 8.76357 20.25 8.6411 20.25H5.6089C5.48643 20.25 5.37326 20.184 5.31203 20.0768L3.79593 17.4232Z%27 stroke=%27%239B9B9B%27 stroke-width=%271.5%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27/%3E %3Cpath d=%27M16.875 3.75L13.543 9.17112C13.4092 9.43708 13.6038 9.75 13.9031 9.75H19.8469C20.1462 9.75 20.3408 9.43708 20.207 9.17111L16.875 3.75Z%27 stroke=%27%239B9B9B%27 stroke-width=%271.5%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27/%3E %3Cpath d=%27M19.5 13.5H14.25C13.8358 13.5 13.5 13.8358 13.5 14.25V19.5C13.5 19.9142 13.8358 20.25 14.25 20.25H19.5C19.9142 20.25 20.25 19.9142 20.25 19.5V14.25C20.25 13.8358 19.9142 13.5 19.5 13.5Z%27 stroke=%27%239B9B9B%27 stroke-width=%271.5%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27/%3E %3C/svg%3E"><span>'+_category.name+'</span><span class="brand-category" style="color:#248df9;">Kategori</span></a></div>';
							}
						}
						if(undefined != param.brands)
						{
							total_count += param.brands.length;
							for(i=0;i<param.brands.length;i++)
							{
								_brand = param.brands[i];
								search_left_side_html += '<div class="pbl-new-header-right-search-result-left-side-item pbl-results"><a href="'+_brand.brand_url+'"><img src="data:image/svg+xml;charset=utf-8,%3Csvg width=%2724%27 height=%2724%27 viewBox=%270 0 24 24%27 fill=%27none%27 xmlns=%27http://www.w3.org/2000/svg%27 stroke=%27none%27%3E %3Cg clip-path=%27url%28%23clip0_9764_114497%29%27%3E %3Cpath d=%27M12.375 20.625L12.4393 20.6893C13.0251 21.2751 13.9749 21.2751 14.5607 20.6893L20.6893 14.5607C21.2751 13.9749 21.2751 13.0251 20.6893 12.4393L11.3787 3.12868C10.8161 2.56607 10.053 2.25 9.25736 2.25H5.25C3.59315 2.25 2.25 3.59315 2.25 5.25V9.43934C2.25 10.1185 2.51978 10.7698 3 11.25M7.5 6C7.5 6.82843 6.82843 7.5 6 7.5C5.17157 7.5 4.5 6.82843 4.5 6C4.5 5.17157 5.17157 4.5 6 4.5C6.82843 4.5 7.5 5.17157 7.5 6ZM9.02625 13.9369L8.23058 11.5615C8.11629 11.2204 7.63371 11.2204 7.51942 11.5615L6.72375 13.9369H4.18124C3.81538 13.9369 3.66607 14.4072 3.96494 14.6182L6.01125 16.0631L5.22541 18.4168C5.11074 18.7602 5.50121 19.0507 5.79716 18.8421L7.875 17.3774L9.95284 18.8421C10.2488 19.0507 10.6393 18.7602 10.5246 18.4168L9.73875 16.0631L11.7851 14.6182C12.0839 14.4072 11.9346 13.9369 11.5688 13.9369H9.02625Z%27 stroke=%27%239B9B9B%27 stroke-width=%271.5%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27/%3E %3C/g%3E %3Cdefs%3E %3CclipPath id=%27clip0_9764_114497%27%3E %3Crect width=%2724%27 height=%2724%27 fill=%27white%27/%3E %3C/clipPath%3E %3C/defs%3E %3C/svg%3E"><span>'+_brand.name+'</span><span class="brand-category" style="color:#008817;">Marka</span></a></div>';
							}
						}
						for(i=0;i<param.products.length;i++)
						{
							_product = param.products[i];
							search_left_side_html += '<div class="pbl-new-header-right-search-result-left-side-item pbl-results"><a href="'+_product.product_url+'"><span>'+_product.name+'</span></a></div>';
						}
						if(total_count == 0)
							search_left_side_html += '<div class="pbl-new-header-right-search-result-left-side-item pbl-results">Aradığınız kriterde ürün bulunamadı.</div>';
						search_left_side_html += '</div>';
					}
					if(undefined != param.search_history && param.search_history.length > 0)
					{
						search_left_side_html += '<div class="pbl-new-header-right-search-result-left-side-title"><h3>Geçmiş Aramalar</h3><button type="button" data-searchtext="" class="remove-search-history">Temizle</button></div><div class="pbl-new-header-right-search-result-left-side-content">';
						for(i=0;i<param.search_history.length;i++)
						{
							_search_history = param.search_history[i];
							search_left_side_html += '<div class="pbl-new-header-right-search-result-left-side-item pbl-results"><a href="'+_search_history.search_url+'">'+_search_history.searchtext+'</a><button type="button" data-searchtext="'+_search_history.searchtext+'" class="remove-search-history"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><path fill="none" stroke="#1e1e1e" stroke-linecap="round" stroke-linejoin="round" d="M17 7L7 17M7 7l10 10"></path></svg></button></div>';
						}
						search_left_side_html += '</div>';
					}
					if(undefined != param.popular_searches && param.popular_searches.length > 0)
					{
						search_left_side_html += '<div class="pbl-new-header-right-search-result-left-side-title"><h3>Popüler Aramalar</h3></div><div class="pbl-new-header-right-search-result-left-side-popular-search">';
						for(i=0;i<param.popular_searches.length;i++)
						{
							_popular_search = param.popular_searches[i];
							search_left_side_html += '<a href="'+site_url+'arama?q='+_popular_search+'" class="pbl-new-header-right-search-result-left-side-popular-search-item">'+_popular_search+'</a>';
						}
						search_left_side_html += '</div>';
					}
					if(undefined != param.last_viewed_products && param.last_viewed_products.length > 0)
					{
						search_right_side_html += '<div class="pbl-new-header-right-search-result-right-side-title"><h3>Son gezdiğin ürünler</h3></div><div class="pbl-new-header-right-search-result-right-side-content">';
						for(i=0;i<param.last_viewed_products.length;i++)
						{
							_product = param.last_viewed_products[i];
							_old_price = (undefined != _product.view_old_price && _product.view_old_price != '') ? '<s style="color: #999;margin-right:5px;">'+_product.view_old_price+'</s>' : '';
							search_right_side_html += '<a href="'+_product.product_url+'" class="pbl-new-header-right-search-result-right-side-content-item">\
	                                            <div class="pbl-new-header-right-search-result-right-side-content-item-image ratio-1"><img src="'+_product.picture_url+'" alt="'+_product.name+'"></div>\
	                                            <div class="pbl-new-header-right-search-result-right-side-content-item-info">\
	                                                <div class="pbl-new-header-right-search-result-right-side-content-item-text">'+_product.name+'</div>\
	                                                <div class="pbl-new-header-right-search-result-right-side-content-item-price">'+_old_price+_product.view_price+'</div>\
	                                            </div>\
	                                        </a>';
						}
					} 
					else if(undefined != param.popular_products && param.popular_products.length > 0)
					{
						search_right_side_html += '<div class="pbl-new-header-right-search-result-right-side-title"><h3>Popüler ürünler</h3></div><div class="pbl-new-header-right-search-result-right-side-content">';
						for(i=0;i<param.popular_products.length;i++)
						{
							_product = param.popular_products[i];
							_old_price = (undefined != _product.view_old_price && _product.view_old_price != '') ? '<s style="color: #999;margin-right:5px;">'+_product.view_old_price+'</s>' : '';
							search_right_side_html += '<a href="'+_product.product_url+'" class="pbl-new-header-right-search-result-right-side-content-item">\
	                                            <div class="pbl-new-header-right-search-result-right-side-content-item-image ratio-1"><img src="'+_product.picture_url+'" alt="'+_product.name+'"></div>\
	                                            <div class="pbl-new-header-right-search-result-right-side-content-item-info">\
	                                                <div class="pbl-new-header-right-search-result-right-side-content-item-text">'+_product.name+'</div>\
	                                                <div class="pbl-new-header-right-search-result-right-side-content-item-price">'+_old_price+_product.view_price+'</div>\
	                                            </div>\
	                                        </a>';
						}
					}
					
					$('.pbl-new-header-right-search-result-left-side').html(search_left_side_html);
					$('.pbl-new-header-right-search-result-right-side').html(search_right_side_html);
					
					$('#q').focus();
					$searchBox.addClass('active');
			        $searchBoxWrapper.addClass('active');
			        $('header').addClass('header-overlay');
			        fixBody();
			        
			        $('.remove-search-history').click((e) => {
				        e.stopPropagation();
				        removeSearchHistory($(e.currentTarget).data('searchtext'));
				    });
				}
			},
			error: function () {
			},
			complete: function() {
				searchRequest = null;
			}
		});	
		ajaxloadingdisabled = false;
	}
	    
	/* Basket Sidebar*/
    const $basketSideBar = $('.pbl-new-header-basket-side-bar');
    function openBasket() {
        $basketSideBar.addClass('opened');
        fixBody();
        basketSummary();
    }

    function closeBasket() {
        $basketSideBar.removeClass('opened');
        setTimeout(() => unfixBody(), 160);
    }

    $('.pbl-new-header-action-item-basket, .pbl-new-header-basket-side-bar-header-close').click((e) => {
        e.stopPropagation();
        $basketSideBar.hasClass('opened') ? closeBasket() : openBasket();
    });
	
	/* User Sidebar*/
    const $userSideBar = $('.pbl-new-header-user-side-bar');

    function openUser() {
        $userSideBar.addClass('opened');
        fixBody();
    }

    function closeUser() {
        $userSideBar.removeClass('opened');
        setTimeout(() => unfixBody(), 160);
    }

    $('.pbl-new-header-action-item-user, .pbl-new-header-user-side-bar-header-close').click((e) => {
        e.stopPropagation();
        $userSideBar.hasClass('opened') ? closeUser() : openUser();
    });
	
	/* Global Click*/
    $(document).on('click', function (e) {
        if ($searchBox.hasClass('active') && !$(e.target).closest('.pbl-new-header-right-search-box').length && !$(e.target).closest('.pbl-new-header-right-search-result').length) {
            closeSearchBox(e);
        }
        if ($basketSideBar.hasClass('opened') && !$(e.target).closest('.pbl-new-header-basket-side-bar').length && !$(e.target).closest('.pbl-new-header-action-item-basket').length) {
            closeBasket();
        }
        if ($userSideBar.hasClass('opened') && !$(e.target).closest('.pbl-new-header-user-side-bar').length && !$(e.target).closest('.pbl-new-header-action-item-user').length) {
            closeUser();
        }
    });
    
    $('.pass-icon').on('click', function() {
	    var passwordField = $(this).siblings('input');
	    var fieldType = passwordField.attr('type');
	
	    if (fieldType === 'password') {
	        passwordField.attr('type', 'text');
	        $(this).find('.pass-icon-close').hide();
	        $(this).find('.pass-icon-open').show();
	    } else {
	        passwordField.attr('type', 'password');
	        $(this).find('.pass-icon-close').show();
	        $(this).find('.pass-icon-open').hide();
	    }
	});
});

function copyToClipboardFallback(text) {
	const textarea = document.createElement('textarea');
	textarea.value = text;
	textarea.style.position = 'fixed';
	textarea.style.opacity = '0';
	document.body.appendChild(textarea);
	textarea.focus();
	textarea.select();
	try {
		document.execCommand('copy');
		_success('', 'Panoya kopyalandı');
	} catch (err) {
		console.error('Copy failed:', err);
	}
	document.body.removeChild(textarea);
}

function copyToClipboard(text = '') 
{
	if(text == '')
		return;
	if (navigator.clipboard && window.isSecureContext) {
		navigator.clipboard.writeText(text).then(function() {
			_success('', 'Panoya kopyalandı');
		}).catch(function(err) {
			copyToClipboardFallback(text);
		});
	} else {
		copyToClipboardFallback(text);
	}
}

$( document ).ready(function() {
	$(".pbl-all-features-tab-button, .pbl-all-features-tab-close-button").click(function() {
		$('.tabsslider').toggleClass("active");
		$('body').toggleClass("body-fix");
	});
});

function validatePhoneNumber(evt, maxLen = 13, expectCountryCode = true) {
    if (js_configurations.disable_phone_control)
        return true;
    var inputField = evt.target;
    var currentValue = inputField.value;
    
    if (expectCountryCode) {
        if (!currentValue.startsWith('+')) {
            inputField.value = '+' + currentValue.replace(/^\++/, '');
            currentValue = inputField.value;
        }
    }
    
    var charCode = (evt.which) ? evt.which : event.keyCode;
    
    if (expectCountryCode) {
        if (charCode > 31 && (charCode < 48 || charCode > 57) && charCode != 43 && charCode != 32)
            return false;
        if (charCode == 43 && currentValue.indexOf('+') !== -1)
            return false;
        if (charCode == 43 && currentValue.length > 0)
            return false;
        if (charCode == 8 && currentValue.charAt(0) == '+' && currentValue.length == 1)
            inputField.value = '+';

        // Prevent entering 0 as the first digit immediately after country code
        if (charCode == 48) { // 48 is the keyCode for '0'
            var cleanValue = currentValue.replace(/\s/g, '');
            // Only block if we're at position 3 (right after +XX country code)
            // and there are exactly 2 digits after the +
            if (cleanValue.length === 3 && cleanValue.startsWith('+') && /^\+\d{2}$/.test(cleanValue)) {
                return false; // Don't allow 0 as first digit after country code
            }
        }

        if (currentValue.replace(/\s/g, '').length >= maxLen && charCode != 8 && charCode != 32)
            return false;
    } else {
        if (charCode > 31 && (charCode < 48 || charCode > 57) && charCode != 32)
            return false;
        
        if (charCode == 48 && currentValue.replace(/\s/g, '').length == 0) {
            return false; // Don't allow 0 as first digit
        }

        if (currentValue.replace(/\s/g, '').length >= maxLen && charCode != 8 && charCode != 32)
            return false;
    }

    return true;
}

$(document).ready(function () {
    if (js_configurations.disable_phone_control) {
        $('input[name="gsm"], input[name="fgsm"], input[name="phone"], input[name="fphone"], .sifremi-unuttum-phone').each(function () {
            $(this).removeAttr('maxlength').removeAttr('onkeypress').removeAttr('oninput');
            if ($.trim($(this).val()) === '+90')
                $(this).val('');
        });
    } else if (js_configurations.force_country_code === false) {
        $('input[name="gsm"]').each(function () {
            if ($.trim($(this).val()) === '+90')
                $(this).val('+');
        });
    }
});

$('.pbl-tabs .pbl-tab').click(function () {
	var main_tab_id = $(this).parents('.pbl-tabs').attr('data-tabid');
	$(this).parents('.pbl-tabs').find('.pbl-tab').removeClass('active');
	$('#' + main_tab_id).find('.pbl-data-tab-content').removeClass('active');
	var tab_id = $(this).attr('data-tab');
	$(this).addClass('active');
	$('#' + main_tab_id).find('#' + tab_id).addClass('active');
});

function initPhoneCountrySelector() {

	$(".phone-number-country-code-select").click(function(e) {
		if (!$(e.target).closest('.phone-number-country-code-list-ul li').length && !$(e.target).closest('.phone-number-country-code-list-search').length) { 
			const countryList = $(this).find(".phone-number-country-code-list");
			countryList.toggleClass("active");
			if (countryList.hasClass("active")) {
				loadVisiblePhoneCountryFlags(countryList[0]);
			}
		}
		e.stopPropagation();
	});

	$(".phone-number-country-code-list-search").click(function(e) {
		e.stopPropagation();
	});

    $(".phone-number-country-code-list-ul").each(function() {
        const countryListContainer = this;
        
        let cachedCountries = sessionStorage.getItem('phoneCountryData');
        
        if (cachedCountries) {
            try {
                renderPhoneCountries(JSON.parse(cachedCountries), countryListContainer);
            } catch(e) {
                console.error('Error parsing cached phone country data:', e);
                sessionStorage.removeItem('phoneCountryData');
                renderPhoneCountryFallbacks(countryListContainer);
            }
        } else {
            countryListContainer.innerHTML = '<li class="country-loading">Ülkeler yükleniyor...</li>';
            
            $.ajax({
                url: 'https://restcountries.com/v2/all?fields=name,alpha2Code,callingCodes,flags',
                type: 'GET',
                dataType: 'json',
                timeout: 5000,
                success: function(countries) {
                    if (countries && Array.isArray(countries)) {
                        const formattedCountries = formatPhoneCountryData(countries);
                        sessionStorage.setItem('phoneCountryData', JSON.stringify(formattedCountries));
                        
                        $(".phone-number-country-code-list-ul").each(function() {
                            renderPhoneCountries(formattedCountries, this);
                        });
                    } else {
                        renderPhoneCountryFallbacks(countryListContainer);
                    }
                },
                error: function(xhr, status, error) {
                    console.error('Error fetching country data:', error);
                    countryListContainer.innerHTML = '<li>Ülke bilgileri yüklenemedi. Daha sonra tekrar deneyin.</li>';
                    renderPhoneCountryFallbacks(countryListContainer);
                }
            });
            return false; // Only fetch once
        }
    });
    
    $(document).click(function(e) {
        if (!$(e.target).closest('.phone-number-country-code').length) {
            $(".phone-number-country-code-list").removeClass("active");
        }
    });
}

const PHONE_COUNTRY_FLAG_PLACEHOLDER = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

function loadPhoneCountryFlag(image) {
    if (!image || image.dataset.loaded === 'true') {
        return;
    }

    const flagUrl = image.dataset.flagUrl;

    if (!flagUrl) {
        return;
    }

    image.src = flagUrl;
    image.dataset.loaded = 'true';
}

function loadVisiblePhoneCountryFlags(countryList) {
    if (!countryList) {
        return;
    }

    const listContainer = countryList.querySelector('.phone-number-country-code-list-ul');

    if (!listContainer) {
        return;
    }

    const containerTop = listContainer.scrollTop;
    const containerBottom = containerTop + listContainer.clientHeight;

    listContainer.querySelectorAll('li').forEach(function(item) {
        if (item.style.display === 'none') {
            return;
        }

        const itemTop = item.offsetTop;
        const itemBottom = itemTop + item.offsetHeight;

        if (itemBottom >= containerTop && itemTop <= containerBottom) {
            loadPhoneCountryFlag(item.querySelector('img[data-flag-url]'));
        }
    });
}

function formatPhoneCountryData(countries) {
    const turkishNames = {
        'Turkey': 'Türkiye',
        'United States': 'Amerika Birleşik Devletleri',
        'United Kingdom': 'Birleşik Krallık',
        'Germany': 'Almanya',
        'France': 'Fransa',
        'Italy': 'İtalya',
        'Spain': 'İspanya',
        'Russia': 'Rusya',
        'China': 'Çin',
        'Japan': 'Japonya',
        'Canada': 'Kanada',
        'Netherlands': 'Hollanda',
        'Brazil': 'Brezilya',
        'Australia': 'Avustralya',
        'India': 'Hindistan'
    };
    
    return countries
        .filter(country => country.callingCodes && country.callingCodes.length > 0)
        .map(country => {
            return {
                name: turkishNames[country.name] || country.name,
                englishName: country.name,
                code: country.alpha2Code,
                dialCode: '+' + country.callingCodes[0],
                flagUrl: country.flags.svg
            };
        })
        .sort((a, b) => {
            // Turkey first, then alphabetical
            if (a.code === 'TR') return -1;
            if (b.code === 'TR') return 1;
            return a.name.localeCompare(b.name);
        });
}

function renderPhoneCountries(countries, container) {
	
    let countryListHTML = '';
    
    countries.forEach(country => {
        const dialCode = country.dialCode || '';
        const name = country.name || '';
        const englishName = country.englishName || country.name;
        
        countryListHTML += `
            <li data-country-name="${name}" data-english-name="${englishName}" data-country-name-code="${country.code}" data-dial-code="${dialCode}" data-flag-url="${country.flagUrl}" onclick="selectPhoneCountry(this)">
                <span class="phone-number-country-code-flag">
                    <img src="${PHONE_COUNTRY_FLAG_PLACEHOLDER}" data-flag-url="${country.flagUrl}" alt="${name} flag" loading="lazy">
                </span>
                <span class="phn-cauntry-code-code">${dialCode}</span>
            </li>
        `;
    });
    
    container.innerHTML = countryListHTML;
    
    // Country search - find the search input within the same container's parent
    const parentContainer = $(container).closest('.phone-number-country-code');
    const searchInput = parentContainer.find(".phone-number-country-code-list-search input")[0];
    const countryList = parentContainer.find(".phone-number-country-code-list")[0];
	
    if (searchInput) {
        const listItems = container.querySelectorAll("li");
        
        // Remove any existing event listeners
        $(searchInput).off('input');
        
        $(searchInput).on("input", function () {
            const searchText = searchInput.value.toLowerCase().trim();
    
            listItems.forEach(li => {
                const countryName = li.getAttribute("data-country-name").toLowerCase();
                const englishName = li.getAttribute("data-english-name")?.toLowerCase() || '';
                const countryCode = li.getAttribute("data-country-name-code").toLowerCase();
                const phoneCode = li.querySelector(".phn-cauntry-code-code").textContent.toLowerCase();
    
                if (countryName.includes(searchText) || englishName.includes(searchText) || 
                    countryCode.includes(searchText) || phoneCode.includes(searchText)) {
                    li.removeAttribute("style");
                } else {
                    li.style.display = "none";
                }
            });

            loadVisiblePhoneCountryFlags(countryList);
        });
    }

    $(container).off('scroll.phoneFlags').on('scroll.phoneFlags', function() {
        loadVisiblePhoneCountryFlags(countryList);
    });
}

function renderPhoneCountryFallbacks(container) {
    const fallbackCountries = [
        {name: "Türkiye", englishName: "Turkey", code: "TR", dialCode: "+90", flagUrl: site_url + 'public/img/tr.jpg' },
        {name: "Almanya", englishName: "Germany", code: "DE", dialCode: "+49", flagUrl: site_url + 'public/img/de.jpg' },
        {name: "İngiltere", englishName: "United Kingdom", code: "GB", dialCode: "+44", flagUrl: site_url + 'public/img/en.jpg' },
        {name: "Fransa", englishName: "France", code: "FR", dialCode: "+33", flagUrl: site_url + 'public/img/fr.jpg' },
        {name: "İspanya", englishName: "Spain", code: "ES", dialCode: "+34", flagUrl: site_url + 'public/img/es.jpg' },
        {name: "İtalya", englishName: "Italy", code: "IT", dialCode: "+39", flagUrl: site_url + 'public/img/it.jpg' },
        {name: "Rusya", englishName: "Russia", code: "RU", dialCode: "+7", flagUrl: site_url + 'public/img/ru.jpg' },
        {name: "Arap Ülkeleri", englishName: "Arab Countries", code: "AR", dialCode: "+966", flagUrl: site_url + 'public/img/ar.jpg' },
        {name: "Amerika Birleşik Devletleri", englishName: "United States", code: "US", dialCode: "+1", flagUrl: site_url + 'public/img/en.jpg' }
    ];
    
    renderPhoneCountries(fallbackCountries, container);
}

function selectPhoneCountry(countryElement) {
    const selectedCountry = $(countryElement);
    const selectedCountryCode = selectedCountry.data('dial-code');
    const selectedCountryFlagImage = selectedCountry.find('.phone-number-country-code-flag img')[0];
    loadPhoneCountryFlag(selectedCountryFlagImage);
    const selectedCountryFlag = selectedCountry.data('flag-url') || selectedCountry.find('.phone-number-country-code-flag img').attr('src');
	
	const container = selectedCountry.closest('.phone-number-country-code');
	container.find('.phone-number-country-code-select .phn-cauntry-code-code').first().text(selectedCountryCode);
	container.find('.phone-number-country-code-select > .phone-number-country-code-flag img').attr('src', selectedCountryFlag);
	container.find('#selected_country_code').val(selectedCountryCode);
    
    setTimeout(function() {
        container.find('.phone-number-country-code-list').removeClass('active');
    }, 10);
    
    if (event) {
        event.stopPropagation();
    }
}

$(document).ready(function() {
    initPhoneCountrySelector();
});

function filterPhoneCountries(searchTerm) {
    const countryItems = document.querySelectorAll('.phone-number-country-code-list-ul li');
    const normalizedSearchTerm = searchTerm.toLowerCase().trim();
    
    countryItems.forEach(item => {
        const countryName = item.getAttribute('data-country-name').toLowerCase();
        const englishName = item.getAttribute('data-english-name')?.toLowerCase() || '';
        const countryCode = item.getAttribute('data-country-name-code').toLowerCase();
        const dialCode = item.getAttribute('data-dial-code').toLowerCase();
        
        if (countryName.includes(normalizedSearchTerm) || 
            englishName.includes(normalizedSearchTerm) ||
            countryCode.includes(normalizedSearchTerm) || 
            dialCode.includes(normalizedSearchTerm)) {
            item.style.display = '';
        } else {
            item.style.display = 'none';
        }
    });
}

function openProductDetailsModal(product_id, modal = true)
{
	if(product_id == 0 || product_id == undefined)
	{
        $(".site_loading").hide();
		return false;
	}

	params = JSON.stringify({product_id:product_id,modal:modal});
	$.ajax({
		type: 'POST',
		url: site_url + "ajax/productdetails",
		dataType: 'json',
		global : true,
		contentType: "application/json; charset=utf-8",
		data: params,
		success: function (result) {
			if($.trim(result.status) == "success") {
				$(document).ready(function() { 	
				
					let product_details_html = result.message
					if(product_details_html == undefined || product_details_html == '')
						_error('', 'Ürün detayı bulunamadı');
					if($("#product_details") && $("#product_details").hasClass('in'))
					{
						$("#product_details_content_modal").html(product_details_html);
						$('.content-product-left .swiper').find('a').attr('href', 'javascript:void(0)');
						if(result.param.url != '' && !modal) {
							history.replaceState(null, '', result.param.url);
						}
					}
					else if(modal)
					{
						$("#product_details").modal('show');
						$("#product_details_content_modal").html(product_details_html);
						$('.content-product-left .swiper').find('a').attr('href', 'javascript:void(0)');
					}	
					else {
						$("#product_details_content").html(product_details_html);
						if(result.param.url != '') {
							history.replaceState(null, '', result.param.url);
						}
					}
					if(result.param.product_text !== undefined)
						$('#tab-info').html(result.param.product_text);
					bindPlusMinus();
				});
			}
			else {
				_error('', result.message);		
			}
		},
		error: function(result) {
			_error('', result.message);
		}
	});
	return false;
}

function toggleFavorite(productid, callback_success)
{
	var ajaxData = JSON.stringify({productid:productid});
	$.ajax({
		type: "post",
		url: site_url + "ajax/member/togglefavorite",
		dataType: 'json',
		contentType: "application/json; charset=utf-8",
		data: ajaxData,
			success: function(result) {
				if($.trim(result.status)=="success")
				{
					if (callback_success != '' && callback_success != null)
						window[callback_success](result);
					else
						_success('', result.message);
					
					if (typeof _hookPixelAddFavorite == 'function' && result.param.action == 'added')
  						_hookPixelAddFavorite(productid);
  					
  					$('.favorite-'+productid).html(result.param.svg);		
					$('.favorite-'+productid).attr('data-original-title', result.param.title).tooltip("destroy").tooltip();
					if(result.param.action == 'removed')
						$('.favorite-'+productid).removeClass('active');
					else if(result.param.action == 'added')
						$('.favorite-'+productid).addClass('active');
				}
				else if($.trim(result.status)=="failure")
					_error('', result.message);
				else
					sendSystemLog('', 'removeFavorite', result.message);
			},
	});
	return false;
}

function signin(from_sidebar = false)
{
	var class_prefix = '.uye-girisi-';
	if(from_sidebar)
		class_prefix = '.sidebar-';
	if($.trim($(class_prefix+'email').val()) == '')
	{
		_error(class_prefix+'email', lang_arr.js_mail_required);
		return false;
	}
	if(!isValidEmail($(class_prefix+'email').val()))
	{
		_error(class_prefix+'email', lang_arr.js_mail_invalid);
		return false;
	}
	if($.trim($(class_prefix+'pass').val()) == '')
	{
		_error(class_prefix+'pass', lang_arr.js_pass_required);
		return false;
	}
	if($.trim($(class_prefix+'pass').val()).length < 6)
	{
		_error(class_prefix+'pass', lang_arr.js_pass_least);
		return false;
	}
	var ajaxdata = JSON.stringify({email:$(class_prefix+'email').val(),pass:$(class_prefix+'pass').val()});
	$.ajax({
		type: "post",
		url: site_url + "ajax/member/signin",
		dataType: 'json',
		contentType: "application/json; charset=utf-8",
		data: ajaxdata,
		success: function(result) {
			if($.trim(result.status)=="success")
			{
				_success('', result.message);
				if($(class_prefix+'rememberme').is(":checked"))
					writeCookie(site_url, $(class_prefix+'email').val(), 30);
				if(undefined != result.param.login_callback_url)
					setTimeout(function(){ document.location = result.param.login_callback_url; }, 1000);
				else    
					setTimeout(function(){ document.location = return_url; }, 1000);
			}
			else if($.trim(result.status)=="failure")
			{
				_error('', result.message);
			}
			else
			{
				sendSystemLog('', 'signin', result.message);
			}
		},
	});
	return false;
}

if(readCookie(site_url))
{
	$('input[name="sidebar_signin_email"]').val(readCookie(site_url));
	$('input[name="signin_email"]').val(readCookie(site_url));
}
const headers = document.querySelectorAll('.pbl-acrdn-header');
headers.forEach(header => {
	header.addEventListener('click', () => {
		const item = header.parentElement;
		const content = item.querySelector('.pbl-acrdn-content');
		if (item.classList.contains('active')) {
			content.style.display = 'none';
			item.classList.remove('active');
		} else {
			document.querySelectorAll('.pbl-acrdn-item.active').forEach(openItem => {
				const openContent = openItem.querySelector('.pbl-acrdn-content');
				openContent.style.display = 'none';
				openItem.classList.remove('active');
			});
			content.style.display = 'block';
			item.classList.add('active');
		}
	});
});

function openGiftWheel()
{
	$.ajax({
	    type: "post",
	    url: site_url + "ajax/giftwheel/content",
	    dataType: 'json',
	    success: function(result) {
	        if(result.status === 'success')
	        {
	        	if(result.message != '')
	        	{
					$('#giftwheel_content').html(result.message);
					$("#giftwheel").modal('show');
				}
	        }
	        else
	            _error('', result.message);
	    },
	    error: function()
	    {
	        console.log('Hediye çarkı açılamadı');
	    }
	});
	return false;
}

function setProperty({ source, cssProp, variable, target = 'html' }) {
    const s = document.querySelector(source);
    const t = document.querySelector(target);
    if (s && t) {
        const val = window.getComputedStyle(s).getPropertyValue(cssProp);
        t.style.setProperty(variable, val);
    }
}
function watchProperties(configs) {
    const update = () => configs.forEach(cfg => setProperty(cfg));
    ['DOMContentLoaded', 'load'].forEach(e => window.addEventListener(e, update));
    window.addEventListener('resize', update);
    window.addEventListener('DOMContentLoaded', () =>
        configs.forEach(cfg => {
            const el = document.querySelector(cfg.source);
            if (el) new MutationObserver(update).observe(el, { childList: true, subtree: true, attributes: true });
        })
    );
}
$( document ).ready(function() {
	$(".campaigns-toggle").click(function() {
		$('.campaigns-toggle').toggleClass("opened");
		$('.kampanya').toggleClass("opened");
	});
});

if (typeof js_configurations !== 'undefined' && js_configurations.is_payment_page === true) {
	document.body.classList.add('payment-page');
}

$( document ).ready(function() {
	if (document.querySelector(".pbl-product-detail-quantity-boxes")) {
	    new Swiper(".pbl-product-detail-quantity-boxes", {
	        slidesPerView: "auto",
	        spaceBetween: 5,
	        navigation: {
	            nextEl: ".swiper-button-next",
	            prevEl: ".swiper-button-prev",
	        },
	        autoplay:false,
	        mousewheel: true,
	        keyboard: false,
	    });
	}
});