(function initializeCorporateReferenceAdmin() {
  'use strict';

  const list = document.querySelector('[data-corporate-reference-list]');
  if (!list) return;

  const rowsContainer = list.querySelector('[data-corporate-reference-rows]');
  const orderInput = list.querySelector('[data-corporate-reference-order]');
  const previewDialog = document.querySelector('[data-logo-preview-dialog]');
  const previewImage = previewDialog && previewDialog.querySelector('[data-logo-preview-image]');
  const previewTitle = previewDialog && previewDialog.querySelector('[data-logo-preview-title]');
  const previewClose = previewDialog && previewDialog.querySelector('[data-logo-preview-close]');
  let draggedRow = null;
  let previewTrigger = null;

  function rows() {
    return Array.from(rowsContainer.querySelectorAll('[data-reference-id]'));
  }

  function synchronizeOrder() {
    const currentRows = rows();
    orderInput.value = currentRows.map((row) => row.dataset.referenceId).join(',');
    currentRows.forEach((row, index) => {
      const number = row.querySelector('[data-order-number]');
      if (number) number.textContent = String(index + 1);
      const up = row.querySelector('[data-move="up"]');
      const down = row.querySelector('[data-move="down"]');
      if (up) up.disabled = index === 0;
      if (down) down.disabled = index === currentRows.length - 1;
    });
  }

  function resetPreview() {
    if (previewImage) {
      previewImage.removeAttribute('src');
      previewImage.alt = '';
    }
    document.documentElement.classList.remove('has-corporate-reference-modal');
    if (previewTrigger) previewTrigger.focus();
    previewTrigger = null;
  }

  function closePreview() {
    if (!previewDialog) return;
    if (typeof previewDialog.close === 'function' && previewDialog.open) {
      previewDialog.close();
    } else {
      previewDialog.removeAttribute('open');
      resetPreview();
    }
  }

  function isSafeLogoSource(source) {
    return /^\/uploads\/corporate-references\/[a-z0-9][a-z0-9._-]*\.(?:avif|jpe?g|png|webp)$/i
      .test(source);
  }

  function openPreview(button) {
    if (!previewDialog || !previewImage || !previewTitle) return;

    const name = String(button.dataset.logoName || 'Kurumsal referans');
    const source = String(button.dataset.logoSrc || '');
    if (!isSafeLogoSource(source)) return;

    previewTrigger = button;
    previewImage.src = source;
    previewImage.alt = `${name} logosu`;
    previewTitle.textContent = name;

    if (typeof previewDialog.showModal === 'function') {
      previewDialog.showModal();
    } else {
      previewDialog.setAttribute('open', '');
    }
    document.documentElement.classList.add('has-corporate-reference-modal');
    if (previewClose) previewClose.focus();
  }

  list.addEventListener('click', (event) => {
    const previewButton = event.target.closest('[data-logo-preview]');
    if (previewButton) {
      openPreview(previewButton);
      return;
    }

    const moveButton = event.target.closest('[data-move]');
    if (moveButton) {
      const row = moveButton.closest('[data-reference-id]');
      if (moveButton.dataset.move === 'up' && row.previousElementSibling) {
        rowsContainer.insertBefore(row, row.previousElementSibling);
      } else if (moveButton.dataset.move === 'down' && row.nextElementSibling) {
        rowsContainer.insertBefore(row.nextElementSibling, row);
      }
      synchronizeOrder();
      return;
    }

    const deleteForm = event.target.closest('[data-confirm-delete]');
    if (deleteForm && !window.confirm('Bu kurumsal referansı silmek istediğinize emin misiniz?')) {
      event.preventDefault();
    }
  });

  if (previewDialog) {
    if (previewClose) previewClose.addEventListener('click', closePreview);
    previewDialog.addEventListener('click', (event) => {
      if (event.target === previewDialog) closePreview();
    });
    previewDialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      closePreview();
    });
    previewDialog.addEventListener('close', resetPreview);
  }

  rowsContainer.addEventListener('dragstart', (event) => {
    if (event.target.closest('[data-logo-preview]')) {
      event.preventDefault();
      return;
    }
    draggedRow = event.target.closest('[data-reference-id]');
    if (!draggedRow) return;
    draggedRow.classList.add('is-dragging');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', draggedRow.dataset.referenceId);
  });

  rowsContainer.addEventListener('dragover', (event) => {
    if (!draggedRow) return;
    const targetRow = event.target.closest('[data-reference-id]');
    if (!targetRow || targetRow === draggedRow) return;
    event.preventDefault();

    const bounds = targetRow.getBoundingClientRect();
    const insertAfter = event.clientY > bounds.top + (bounds.height / 2);
    rowsContainer.insertBefore(draggedRow, insertAfter ? targetRow.nextElementSibling : targetRow);
  });

  rowsContainer.addEventListener('dragend', () => {
    if (draggedRow) draggedRow.classList.remove('is-dragging');
    draggedRow = null;
    synchronizeOrder();
  });

  synchronizeOrder();
}());
