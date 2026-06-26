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
    if (!window.Jodit) return;

    var csrfInput = input.form.querySelector('input[name="_csrf"]');
    input.value = normalizeInitialContent(input.value);

    window.Jodit.make(input, {
      language: 'tr',
      height: 560,
      minHeight: 420,
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
        'source', '|',
        'undo', 'redo', '|',
        'paragraph', 'font', 'fontsize', 'brush', '|',
        'bold', 'italic', 'underline', 'strikethrough', '|',
        'ul', 'ol', 'outdent', 'indent', '|',
        'left', 'center', 'right', 'justify', '|',
        'link', 'image', 'table', 'hr', '|',
        'copyformat', 'eraser', 'fullsize', 'preview'
      ],
      uploader: {
        url: '/admin/blog/image',
        method: 'POST',
        format: 'json',
        withCredentials: true,
        insertImageAsBase64URI: false,
        imagesExtensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif'],
        filesVariableName: function () {
          return 'coverImage';
        },
        prepareData: function (formData) {
          formData.append('_csrf', csrfInput.value);
          return formData;
        },
        isSuccess: function (response) {
          return Boolean(response && response.success);
        },
        getMessage: function (response) {
          var messages = response && response.data && response.data.messages;
          return Array.isArray(messages) ? messages.join(' ') : 'Görsel yüklenemedi.';
        },
        process: function (response) {
          return response.data;
        }
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-blog-editor]').forEach(initEditor);
  });
}());
