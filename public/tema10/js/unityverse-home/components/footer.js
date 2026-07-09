(function(window, document) {
  var components = window.UnityverseHome.Components;
  var utils = components.utils;

  function renderLinks(items) {
    return '<ul>' + utils.htmlList(items, function(item) {
      return '<li><a href="' + utils.escapeHtml(item.href) + '">' + utils.escapeHtml(item.label) + '</a></li>';
    }) + '</ul>';
  }

  function renderColumn(column, index) {
    var panelId = 'uv-footer-panel-' + index;

    return '<section class="uv-footer__column">' +
      '<button class="uv-footer__toggle" type="button" aria-expanded="false" aria-controls="' + panelId + '">' +
        '<span>' + utils.escapeHtml(column.title) + '</span>' +
      '</button>' +
      '<div class="uv-footer__panel" id="' + panelId + '">' + renderLinks(column.items) + '</div>' +
    '</section>';
  }

  function renderSocial(items) {
    return '<div class="uv-footer__socials">' + utils.htmlList(items, function(item) {
      return '<a href="' + utils.escapeHtml(item.href) + '" aria-label="' + utils.escapeHtml(item.label) + '" target="_blank" rel="noreferrer noopener">' +
        '<i class="' + utils.escapeHtml(item.iconClass) + '" aria-hidden="true"></i>' +
      '</a>';
    }) + '</div>';
  }

  components.footer = function footer(props) {
    return '<footer class="uv-footer">' +
      '<div class="uv-shell">' +
        '<div class="uv-footer__grid">' +
          utils.htmlList(props.columns, renderColumn) +
          '<section class="uv-footer__column uv-footer__column--social">' +
            '<button class="uv-footer__toggle" type="button" aria-expanded="false" aria-controls="uv-footer-socials">' +
              '<span>' + utils.escapeHtml(props.social.title) + '</span>' +
            '</button>' +
            '<div class="uv-footer__panel" id="uv-footer-socials">' + renderSocial(props.social.items) + '</div>' +
          '</section>' +
        '</div>' +
        '<div class="uv-footer__bottom">' + utils.escapeHtml(props.copyright) + '</div>' +
      '</div>' +
      '<a class="uv-floating-whatsapp" href="' + utils.escapeHtml(props.whatsapp.href) + '" aria-label="' + utils.escapeHtml(props.whatsapp.ariaLabel) + '" target="_blank" rel="noreferrer noopener">' +
        '<i class="' + utils.escapeHtml(props.whatsapp.iconClass) + '" aria-hidden="true"></i>' +
      '</a>' +
    '</footer>';
  };

  components.initFooter = function initFooter(root) {
    var toggles = root.querySelectorAll('.uv-footer__toggle');
    var desktopQuery = window.matchMedia('(min-width: 992px)');

    Array.prototype.forEach.call(toggles, function(toggle) {
      toggle.addEventListener('click', function() {
        if (desktopQuery.matches) {
          return;
        }

        var expanded = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', String(!expanded));
      });
    });

    function syncFooterState() {
      Array.prototype.forEach.call(toggles, function(toggle) {
        toggle.setAttribute('aria-expanded', String(desktopQuery.matches));
      });
    }

    syncFooterState();

    if (desktopQuery.addEventListener) {
      desktopQuery.addEventListener('change', syncFooterState);
    } else {
      desktopQuery.addListener(syncFooterState);
    }
  };
})(window, document);
