(function(window, document, $) {
  'use strict';

  if (!$) return;

  var siteUrl = window.site_url || '/';
  var statusSelector = '[data-cart-status]';

  window.lang_arr = window.lang_arr || {};
  window.lang_arr.js_control_stok = window.lang_arr.js_control_stok || 'En fazla {0} adet ekleyebilirsiniz.';
  window.lang_arr.js_text_product = window.lang_arr.js_text_product || 'Kurs';
  window.lang_arr.js_sepet_urun_yok = window.lang_arr.js_sepet_urun_yok || 'Sepetinizde kurs bulunmamaktadır.';
  window.lang_arr.js_sepet_silinecek = window.lang_arr.js_sepet_silinecek || 'Sepetiniz silinecek, onaylıyor musunuz?';

  window.min_order_amount = parseFloat(window.min_order_amount || '');
  window.total_price = parseFloat(window.total_price || '0');
  window.has_must_be_delete_items = window.has_must_be_delete_items || '';

  function endpoint(path) {
    return (siteUrl.replace(/\/?$/, '/') + path.replace(/^\//, '')).replace(/([^:])\/{2,}/g, '$1/');
  }

  function setStatus(message, type) {
    var status = document.querySelector(statusSelector);

    if (!status) return;

    status.textContent = message || '';
    status.classList.toggle('is-error', type === 'error');
  }

  function notify(selector, message, type) {
    var text = String(message || '').replace(/{br}/g, '\n');

    setStatus(text, type);

    if ($.notify) {
      if (selector) {
        $(selector).notify(text, { position: 'top center', className: type || 'info' });
      } else {
        $.notify(text, { position: 'top center', className: type || 'info' });
      }
    }

    return false;
  }

  function showCartState(hasProducts) {
    $('.uv-cart-layout').toggle(Boolean(hasProducts));
    $('#basket_null').toggle(!hasProducts);
    $('#basket_full').toggle(Boolean(hasProducts));
  }

  function parseAjaxHtml(html, selector) {
    return $($.parseHTML(html || '', document, true)).filter(selector).html();
  }

  function closeCampaignModal() {
    $('#campaign_popup').removeClass('is-open').attr('aria-hidden', 'true');
    $('body').removeClass('uv-modal-open');
    window.refreshBasket('get', '', '');
  }

  window._success = function(selector, msg) {
    return notify(selector, msg || 'İşlem başarıyla tamamlandı.', 'success');
  };

  window._error = function(selector, msg) {
    return notify(selector, msg || 'Beklenmeyen bir hata oluştu.', 'error');
  };

  window._warn = function(selector, msg) {
    return notify(selector, msg || 'Lütfen bilgileri kontrol edin.', 'warn');
  };

  window._confirm = function(msg) {
    var confirmed = window.confirm(msg || 'Onaylıyor musunuz?');

    if (confirmed) {
      $(document).trigger('uv-cart-confirm-yes');
    }

    return confirmed;
  };

  window.getBasketContent = function() {
    return false;
  };

  window.bindPlusMinus = function() {
    $('.minus-btn').off('click.uvCart');
    $('.plus-btn').off('click.uvCart');

    $('.minus-btn').on('click.uvCart', function(e) {
      e.preventDefault();
      var input = $(this).parent('div').find('input');
      var factor = parseFloat(input.data('count-factor'));
      var value = parseFloat(input.val());

      if (!factor || factor <= 0) factor = 1;
      if (!value || value < factor) value = factor;
      if (value !== factor) value -= factor;
      if (value < factor) value = factor;

      input.val(value).trigger('change');
    });

    $('.plus-btn').on('click.uvCart', function(e) {
      e.preventDefault();
      var input = $(this).parent('div').find('input');
      var factor = parseFloat(input.data('count-factor'));
      var value = parseFloat(input.val());

      if (!factor || factor <= 0) factor = 1;
      if (!value) value = 0;

      input.val(value + factor).trigger('change');
    });
  };

  window.basketSummary = function(cmd, pid, bid, count) {
    $.ajax({
      type: 'POST',
      url: endpoint('ajax/basket/summary'),
      dataType: 'json',
      global: false,
      contentType: 'application/json; charset=utf-8',
      data: JSON.stringify({
        cmd: cmd || 'refresh',
        pid: pid || 0,
        bid: bid || 0,
        count: count || 0
      }),
      success: function(result) {
        if ($.trim(result.status) !== 'success') {
          window._error('', result.message);
          return;
        }

        if (result.param.stockcount > 0) {
          window._error('#spcount_' + bid, window.lang_arr.js_control_stok.replace('{0}', result.param.stockcount));
          $('#spcount_' + bid).val(result.param.stockcount);
          return;
        }

        $('.cart-total-full').html(result.param.productcount + ' ' + window.lang_arr.js_text_product + ' - ' + result.param.totalprice);
        $('.uv-new-header-basket-total-price').html(result.param.totalprice);
        $('.uv-new-header-basket-total-count').text(result.param.productcount);
        $('.sepet_sayi').text(result.param.productcount);

        if (result.param.totalpriceraw !== undefined) {
          window.total_price = parseFloat(result.param.totalpriceraw);
        }

        window.bindPlusMinus();
      }
    });

    return false;
  };

  window.refreshBasket = function(cmd, pid, bid, count) {
    count = count || 0;

    if (cmd === 'del') {
      return refreshBasketRequest(cmd, pid, bid, count);
    }

    if (cmd === 'upd' && pid > 0) {
      count = $('#pcount_' + bid).val();

      if (count == 0) {
        if (window._confirm('Seçilen kurs silinecek, onaylıyor musunuz?')) {
          return refreshBasketRequest('del', pid, bid, count);
        }

        return false;
      }

      return refreshBasketRequest(cmd, pid, bid, count);
    }

    if (cmd === 'usegiftcheck') {
      var giftcode = $('#gift_check_code').val();

      if (!giftcode || giftcode.length < 5) {
        window._error('#giftcheck_content', 'Hediye Çeki Kodu en az 5 karakterden oluşmalıdır');
        return false;
      }

      return refreshBasketRequest(cmd, giftcode, bid, count);
    }

    return refreshBasketRequest(cmd, pid, bid, count);
  };

  function refreshBasketRequest(cmd, pid, bid, count) {
    var paramObj = {
      pid: pid,
      bid: bid,
      cmd: cmd,
      count: count
    };

    $.ajax({
      type: 'POST',
      data: JSON.stringify(paramObj),
      url: endpoint('ajax/basket/basketcontent'),
      dataType: 'json',
      contentType: 'application/json; charset=utf-8',
      success: function(result) {
        if (result.param.status === '0') {
          if (result.param.stockcount > 0) {
            window._error('#pcount_' + bid, window.lang_arr.js_control_stok.replace('{0}', result.param.stockcount));
            $('#pcount_' + bid).val(result.param.stockcount);
          } else {
            var basketProducts = parseAjaxHtml(result.param.products, '#ajax_basket_products');
            var basketPrices = parseAjaxHtml(result.param.products, '#ajax_basket_prices');

            if (typeof basketProducts === 'undefined') {
              $('#basket_products').html('');
              $('#basket_prices').html('');
              showCartState(false);
            } else {
              $('#basket_products').html(basketProducts);
              $('#basket_prices').html(basketPrices || '');
              showCartState(true);
            }

            window.basketSummary();
            $('.sepet_sayi').text(result.param.productcount);

            if (cmd === 'usescore') $('#score_content').css('display', 'none');
            if (cmd === 'removescore') $('#score_content').css('display', '');
            if (cmd === 'usegiftcheck') $('#giftcheck_content').css('display', 'none');
            if (cmd === 'removegiftcheck') $('#giftcheck_content').css('display', '');

            if (typeof window._hookGtagUpdateBasket === 'function') {
              window._hookGtagUpdateBasket(paramObj);
            }

            if (typeof result.param.has_must_be_delete_items !== 'undefined' && !result.param.has_must_be_delete_items) {
              window.has_must_be_delete_items = false;
            }
          }
        } else if (result.param.status === '2') {
          window._error('#giftcheck_content', result.message);
        } else if (result.param.status === '3') {
          window._error('#score_content input', result.message);
        }

        window.bindPlusMinus();
      },
      error: function() {
        showCartState(false);
        setStatus('Sepet bilgileri şu anda yüklenemedi.', 'error');
      }
    });

    return false;
  }

  window.plus = function(id, productid, bid, stockunit, countFactor) {
    var factor = countFactor !== 0 ? countFactor : 1;
    var input = $('#pcount_' + bid);
    var clicks = parseFloat(input.val());

    if (stockunit === 6 || stockunit === 7 || stockunit === 12) {
      factor = 0.25;
    }

    if (!clicks) clicks = factor;

    if (id === 1) {
      clicks += factor;
      input.val(clicks);
    } else if (input.val() == factor) {
      input.val(factor);
    } else {
      clicks -= factor;
      input.val(clicks);
    }

    window.refreshBasket('upd', productid, bid);
  };

  window.removeBasket = function() {
    var previousCount = $('.sepet_sayi').text();

    if (previousCount === '0') {
      window._error('', window.lang_arr.js_sepet_urun_yok);
      return false;
    }

    if (!window._confirm(window.lang_arr.js_sepet_silinecek)) {
      return false;
    }

    $.ajax({
      type: 'POST',
      url: endpoint('ajax/basket/delete'),
      dataType: 'json',
      success: function(result) {
        if (result.status === 'success') {
          window._success('', result.message);
          window.refreshBasket('get', '', '');
        }
      }
    });

    return false;
  };

  window.getCampaignsProducts = function(id, topic, text) {
    $.ajax({
      type: 'POST',
      data: JSON.stringify({ id: id }),
      url: endpoint('ajax/basket/getCampaignsProducts'),
      dataType: 'json',
      contentType: 'application/json; charset=utf-8',
      success: function(result) {
        if (result.status === 'success') {
          $('#campain_products').html(result.param);
          $('#campaign_topic').text(topic);
          $('#campaign_text').text(text);
          $('#campaign_popup').addClass('is-open').attr('aria-hidden', 'false');
          $('body').addClass('uv-modal-open');
        }
      }
    });

    return false;
  };

  window.goToInvoice = function() {
    if (window.min_order_amount > 0 && window.total_price < window.min_order_amount) {
      window._error('', 'Siparişinizi tamamlayabilmeniz için {br}sepet toplamınız en az {price} olmalıdır.');
      return false;
    }

    if (window.has_must_be_delete_items) {
      window._error('', 'Sepetinizde satın alınamayacak durumda olan ürünler bulunmakta devam etmek için bu ürünleri sepetinizden silmeniz gerekmektedir.');
      return false;
    }

    window.location.href = '/uye/fatura-teslimat/';
    return false;
  };

  function loadLastViewedProducts() {
    var localproductids = window.localStorage ? window.localStorage.getItem('unityverse_last_viewed_products') : null;

    $.ajax({
      type: 'POST',
      url: endpoint('ajax/getviewedproducts'),
      dataType: 'json',
      contentType: 'application/json; charset=utf-8',
      data: JSON.stringify({ localproductids: localproductids }),
      success: function(result) {
        if (result.status === 'success') {
          $('#lastviewedproducts').html(result.message);
          if (result.param && window.localStorage) {
            window.localStorage.removeItem('unityverse_last_viewed_products');
          }
        }
      }
    });
  }

  $(function() {
    showCartState(false);

    if (window.uvCartAjaxEnabled === true) {
      window.refreshBasket('get', '', '');
      loadLastViewedProducts();
    }

    $('#campaign_popup').on('click', '[data-cart-modal-close]', closeCampaignModal);
    $('#campaign_popup').on('click', function(event) {
      if (event.target === this) closeCampaignModal();
    });
    $(document).on('keydown', function(event) {
      if (event.key === 'Escape' && $('#campaign_popup').hasClass('is-open')) closeCampaignModal();
    });
  });
})(window, document, window.jQuery);
