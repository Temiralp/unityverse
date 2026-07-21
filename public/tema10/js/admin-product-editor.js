(function () {
  'use strict';

  function normalizeInitialContent(value) {
    var content = String(value || '').trim();
    if (!content || /<\/?[a-z][\s\S]*>/i.test(content)) return content;

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

    window.Jodit.make(input, {
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

    var variantRows = Array.prototype.slice.call(form.querySelectorAll('[data-variant-row]'));
    variantRows.forEach(function (row, index) {
      row.querySelector('[data-field="variantProductId"]')
        .setAttribute('name', 'variants[' + index + '][variantProductId]');
      row.querySelector('[data-field="label"]')
        .setAttribute('name', 'variants[' + index + '][label]');
      row.querySelector('[data-field="sortOrder"]')
        .setAttribute('name', 'variants[' + index + '][sortOrder]');
      row.querySelector('[data-field="isActivePresent"]')
        .setAttribute('name', 'variants[' + index + '][isActivePresent]');
      row.querySelector('[data-field="isActive"]')
        .setAttribute('name', 'variants[' + index + '][isActive]');
      row.querySelector('[data-field="isDefault"]').value = String(index);
    });

    if (variantRows.length && !variantRows.some(function (row) {
      return row.querySelector('[data-field="isDefault"]').checked;
    })) {
      variantRows[0].querySelector('[data-field="isDefault"]').checked = true;
    }
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
    var variantList = form.querySelector('[data-variant-list]');
    var variantSection = form.querySelector('[data-product-variants]');
    var tabTemplate = document.getElementById('product-tab-template');
    var outcomeTemplate = document.getElementById('product-outcome-template');
    var variantTemplate = document.getElementById('product-variant-template');
    var variantCandidates = [];

    form.querySelectorAll('[data-product-editor]').forEach(initEditor);
    refreshNames(form);

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

    function candidateMatchesSearch(candidate, searchTerm) {
      var normalizedSearch = String(searchTerm || '').trim().toLocaleLowerCase('tr-TR');
      if (!normalizedSearch) return true;

      return [
        candidate.id,
        candidate.title,
        candidate.duration,
        candidate.status
      ].some(function (value) {
        return String(value || '').toLocaleLowerCase('tr-TR').indexOf(normalizedSearch) >= 0;
      });
    }

    function updateVariantSelect(select, searchTerm) {
      var selectedValue = select.value;
      while (select.options.length > 1) select.remove(1);

      variantCandidates.forEach(function (candidate) {
        var isSelected = String(candidate.id) === String(selectedValue);
        if (!isSelected && !candidateMatchesSearch(candidate, searchTerm)) return;

        var option = document.createElement('option');
        option.value = String(candidate.id);
        option.textContent = candidate.title
          + (candidate.duration ? ' — ' + candidate.duration : '')
          + ' [' + candidate.status + ']';
        option.selected = isSelected;
        select.appendChild(option);
      });
    }

    function refreshVariantCandidates() {
      if (!variantSection || !variantSection.dataset.variantCandidatesUrl) {
        return Promise.resolve();
      }

      var query = variantSection.dataset.productId
        ? '?excludeId=' + encodeURIComponent(variantSection.dataset.productId)
        : '';

      return fetch(variantSection.dataset.variantCandidatesUrl + query, {
        credentials: 'same-origin',
        headers: { 'X-Requested-With': 'XMLHttpRequest' }
      })
        .then(function (response) {
          if (!response.ok) throw new Error('Kurs seçenekleri alınamadı.');
          return response.json();
        })
        .then(function (payload) {
          if (payload.status !== 'success' || !Array.isArray(payload.products)) {
            throw new Error('Kurs seçenekleri alınamadı.');
          }

          variantCandidates = payload.products;
          form.querySelectorAll('[data-variant-row]').forEach(function (row) {
            updateVariantSelect(
              row.querySelector('[data-field="variantProductId"]'),
              row.querySelector('[data-variant-search]').value
            );
          });
        })
        .catch(function () {
          // Server-rendered options remain available if a live refresh fails.
        });
    }

    form.querySelector('[data-add-variant]').addEventListener('click', function () {
      var appendVariant = function () {
        var fragment = variantTemplate.content.cloneNode(true);
        variantList.appendChild(fragment);
        var row = variantList.lastElementChild;
        var select = row.querySelector('[data-field="variantProductId"]');
        if (variantCandidates.length) updateVariantSelect(select, '');
        refreshNames(form);
        row.querySelector('[data-variant-search]').focus();
      };

      if (variantCandidates.length) appendVariant();
      else refreshVariantCandidates().then(appendVariant);
    });

    form.addEventListener('focusin', function (event) {
      if (event.target.matches('[data-field="variantProductId"]')) {
        refreshVariantCandidates();
      }
    });

    form.addEventListener('input', function (event) {
      if (!event.target.matches('[data-variant-search]')) return;
      if (!variantCandidates.length) return;

      var row = event.target.closest('[data-variant-row]');
      updateVariantSelect(
        row.querySelector('[data-field="variantProductId"]'),
        event.target.value
      );
    });

    refreshVariantCandidates();

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

      var removeVariant = event.target.closest('[data-remove-variant]');
      if (removeVariant) {
        removeVariant.closest('[data-variant-row]').remove();
        refreshNames(form);
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-product-form]').forEach(initForm);
  });
}());
