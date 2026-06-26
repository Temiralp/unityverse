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
    var tabTemplate = document.getElementById('product-tab-template');
    var outcomeTemplate = document.getElementById('product-outcome-template');

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
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-product-form]').forEach(initForm);
  });
}());
