(function () {
  'use strict';

  function normalizeInitialContent(value) {
    var content = String(value || '').trim();
    if (!content) return content;

    content = content.replace(/(<img\b[^>]*\bsrc\s*=\s*)(["'])([^"']*)\2/gi, function (_, prefix, quote, source) {
      var normalizedSource = source
        .replace(/\\/g, '/')
        .replace(/^(?:(?:\.\.?\/)+|\/)?(?=uploads\/)/i, '/');
      return prefix + quote + normalizedSource + quote;
    });

    if (/<\/?[a-z][\s\S]*>/i.test(content)) return content;

    return content
      .split(/\n{2,}/)
      .map(function (paragraph) {
        return '<p>' + paragraph.replace(/\n/g, '<br>') + '</p>';
      })
      .join('');
  }

  function initEditor(input) {
    if (!window.Jodit || input.dataset.editorReady === 'true') return;

    var csrfInput = input.form.querySelector('input[name="_csrf"]');
    input.value = normalizeInitialContent(input.value);
    input.dataset.editorReady = 'true';

    input.uvProductEditor = window.Jodit.make(input, {
      language: 'tr',
      height: 420,
      minHeight: 320,
      toolbarAdaptive: false,
      toolbarSticky: true,
      showCharsCounter: true,
      showWordsCounter: true,
      showXPathInStatusbar: false,
      askBeforePasteHTML: false,
      processPasteHTML: true,
      sourceEditor: 'area',
      beautifyHTML: false,
      defaultMode: window.Jodit.MODE_WYSIWYG,
      buttons: [
        'source', '|', 'undo', 'redo', '|',
        'paragraph', 'font', 'fontsize', 'brush', '|',
        'bold', 'italic', 'underline', 'strikethrough', '|',
        'ul', 'ol', 'outdent', 'indent', '|',
        'left', 'center', 'right', 'justify', '|',
        'link', 'image', 'table', 'hr', '|',
        'copyformat', 'eraser', 'fullsize', 'preview'
      ],
      uploader: {
        url: '/admin/products/image',
        method: 'POST',
        format: 'json',
        withCredentials: true,
        insertImageAsBase64URI: false,
        imagesExtensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif'],
        filesVariableName: function () { return 'productImage'; },
        prepareData: function (formData) {
          formData.append('_csrf', csrfInput.value);
          return formData;
        },
        isSuccess: function (response) { return Boolean(response && response.success); },
        getMessage: function (response) {
          var messages = response && response.data && response.data.messages;
          return Array.isArray(messages) ? messages.join(' ') : 'Görsel yüklenemedi.';
        },
        process: function (response) { return response.data; }
      }
    });
  }

  function refreshNames(form) {
    form.querySelectorAll('[data-tab-editor]').forEach(function (tab, index) {
      tab.querySelector('[data-field="systemKey"], input[name$="[systemKey]"]')
        .setAttribute('name', 'tabs[' + index + '][systemKey]');
      var title = tab.querySelector('[data-field="title"], input[name$="[title]"]');
      if (title) title.setAttribute('name', 'tabs[' + index + '][title]');
      var content = tab.querySelector('[data-field="content"], textarea[name$="[content]"]');
      if (content) content.setAttribute('name', 'tabs[' + index + '][content]');
    });

    form.querySelectorAll('[data-outcome-row]').forEach(function (row, index) {
      row.querySelector('[data-field="text"], input[name$="[text]"]')
        .setAttribute('name', 'learningOutcomes[' + index + '][text]');
    });

    var durationRows = Array.prototype.slice.call(form.querySelectorAll('[data-duration-row]'));
    var parentStatus = form.querySelector('[data-parent-product-status]');
    var hasManagedVariantGroup = form.dataset.managedVariantGroup === 'true'
      || durationRows.length > 1;

    if (!hasManagedVariantGroup && durationRows.length === 1 && parentStatus) {
      durationRows[0].querySelector('[data-field="status"]').value = parentStatus.value;
      durationRows[0].querySelector('[data-field="isActive"]').value =
        parentStatus.value === 'PUBLISHED' ? '1' : '0';
    }
    durationRows.forEach(function (row, index) {
      ['id', 'variantProductId', 'label', 'price', 'status', 'sortOrder', 'isActivePresent', 'isActive']
        .forEach(function (fieldName) {
          row.querySelector('[data-field="' + fieldName + '"]')
            .setAttribute('name', 'variants[' + index + '][' + fieldName + ']');
        });
      row.querySelector('[data-field="isDefault"]').value = String(index);
      row.querySelector('[data-field="isDefault"]').disabled =
        row.querySelector('[data-field="status"]').value !== 'PUBLISHED';
      row.setAttribute('aria-label', 'Eğitim süresi ' + (index + 1));
    });

    var checkedDefaultRow = durationRows.find(function (row) {
      return row.querySelector('[data-field="isDefault"]').checked;
    });
    if (checkedDefaultRow
      && checkedDefaultRow.querySelector('[data-field="status"]').value !== 'PUBLISHED') {
      checkedDefaultRow.querySelector('[data-field="isDefault"]').checked = false;
      checkedDefaultRow = null;
    }
    if (durationRows.length && !checkedDefaultRow) {
      var firstPublishedRow = durationRows.find(function (row) {
        return row.querySelector('[data-field="status"]').value === 'PUBLISHED';
      });
      if (firstPublishedRow) firstPublishedRow.querySelector('[data-field="isDefault"]').checked = true;
    }

    durationRows.forEach(function (row) {
      row.querySelector('[data-remove-duration]').hidden = durationRows.length <= 1;
    });
  }

  function moveCustomTab(form, tab, direction) {
    var customTabs = Array.prototype.slice.call(form.querySelectorAll('[data-tab-editor]'))
      .filter(function (item) { return !item.dataset.systemKey; });
    var currentIndex = customTabs.indexOf(tab);
    var targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= customTabs.length) return;

    if (direction === 'up') {
      tab.parentNode.insertBefore(tab, customTabs[targetIndex]);
    } else {
      tab.parentNode.insertBefore(customTabs[targetIndex], tab);
    }

    refreshNames(form);
  }

  function initForm(form) {
    var tabList = form.querySelector('[data-tab-list]');
    var outcomeList = form.querySelector('[data-outcome-list]');
    var durationList = form.querySelector('[data-duration-list]');
    var durationStatusMessage = form.querySelector('[data-duration-status-message]');
    var tabTemplate = document.getElementById('product-tab-template');
    var outcomeTemplate = document.getElementById('product-outcome-template');
    var durationTemplate = document.getElementById('product-duration-template');

    form.querySelectorAll('[data-product-editor]').forEach(initEditor);
    refreshNames(form);

    form.addEventListener('submit', function () {
      form.querySelectorAll('[data-product-editor]').forEach(function (input) {
        if (input.uvProductEditor && typeof input.uvProductEditor.synchronizeValues === 'function') {
          input.uvProductEditor.synchronizeValues();
        }
      });
      refreshNames(form);
    });

    form.querySelector('[data-add-tab]').addEventListener('click', function () {
      var fragment = tabTemplate.content.cloneNode(true);
      tabList.appendChild(fragment);
      var tab = tabList.lastElementChild;
      refreshNames(form);
      initEditor(tab.querySelector('[data-product-editor]'));
      tab.querySelector('[data-field="title"]').focus();
    });

    form.querySelector('[data-add-outcome]').addEventListener('click', function () {
      outcomeList.appendChild(outcomeTemplate.content.cloneNode(true));
      refreshNames(form);
      outcomeList.lastElementChild.querySelector('[data-field="text"]').focus();
    });

    form.querySelector('[data-add-duration]').addEventListener('click', function () {
      durationList.appendChild(durationTemplate.content.cloneNode(true));
      var row = durationList.lastElementChild;
      row.querySelector('[data-field="sortOrder"]').value = String(durationList.children.length - 1);
      refreshNames(form);
      durationStatusMessage.textContent = 'Yeni eğitim süresi eklendi.';
      row.querySelector('[data-field="label"]').focus();
    });

    form.addEventListener('change', function (event) {
      var parentStatus = form.querySelector('[data-parent-product-status]');
      var durationRows = form.querySelectorAll('[data-duration-row]');
      var hasManagedVariantGroup = form.dataset.managedVariantGroup === 'true'
        || durationRows.length > 1;

      if (event.target.matches('[data-parent-product-status]')) {
        if (!hasManagedVariantGroup && durationRows.length === 1) {
          durationRows[0].querySelector('[data-field="status"]').value = event.target.value;
          durationRows[0].querySelector('[data-field="isActive"]').value =
            event.target.value === 'PUBLISHED' ? '1' : '0';
        }
        refreshNames(form);
        return;
      }

      if (!event.target.matches('[data-duration-row] [data-field="status"]')) return;

      var row = event.target.closest('[data-duration-row]');
      var isPublished = event.target.value === 'PUBLISHED';
      row.querySelector('[data-field="isActive"]').value = isPublished ? '1' : '0';
      if (!hasManagedVariantGroup && parentStatus) parentStatus.value = event.target.value;

      if (!isPublished && row.querySelector('[data-field="isDefault"]').checked) {
        row.querySelector('[data-field="isDefault"]').checked = false;
      }
      refreshNames(form);
    });

    form.addEventListener('click', function (event) {
      var removeTab = event.target.closest('[data-remove-tab]');
      if (removeTab) {
        removeTab.closest('[data-tab-editor]').remove();
        refreshNames(form);
        return;
      }

      var moveTab = event.target.closest('[data-move-tab]');
      if (moveTab) {
        moveCustomTab(form, moveTab.closest('[data-tab-editor]'), moveTab.dataset.moveTab);
        return;
      }

      var removeOutcome = event.target.closest('[data-remove-outcome]');
      if (removeOutcome) {
        removeOutcome.closest('[data-outcome-row]').remove();
        refreshNames(form);
        return;
      }

      var removeDuration = event.target.closest('[data-remove-duration]');
      if (removeDuration && form.querySelectorAll('[data-duration-row]').length > 1) {
        removeDuration.closest('[data-duration-row]').remove();
        refreshNames(form);
        durationStatusMessage.textContent = 'Eğitim süresi kaldırıldı.';
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-product-form]').forEach(initForm);
  });
}());
