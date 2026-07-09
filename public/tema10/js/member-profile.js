(function () {
  'use strict';

  function setText(selector, value) {
    var element = document.querySelector(selector);
    if (element) element.textContent = value || '-';
  }

  function money(value) {
    var number = Number(value || 0);
    if (!Number.isFinite(number)) number = 0;

    return number.toLocaleString('tr-TR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + ' TL';
  }

  function dateText(value, withTime) {
    if (!value) return '-';
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';

    return date.toLocaleString('tr-TR', withTime ? {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    } : {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  function clear(element) {
    if (!element) return;
    while (element.firstChild) element.removeChild(element.firstChild);
  }

  function appendCell(row, value) {
    var cell = document.createElement('td');
    cell.textContent = value || '-';
    row.appendChild(cell);
  }

  function renderList(selector, items, fallback) {
    var list = document.querySelector(selector);
    clear(list);
    if (!list) return;

    var values = (items || []).filter(Boolean);
    if (!values.length) {
      var empty = document.createElement('li');
      empty.textContent = fallback;
      empty.className = 'is-empty';
      list.appendChild(empty);
      return;
    }

    values.forEach(function (item) {
      var li = document.createElement('li');
      li.textContent = item;
      list.appendChild(li);
    });
  }

  function renderTable(containerSelector, columns, rows, emptyText) {
    var container = document.querySelector(containerSelector);
    clear(container);
    if (!container) return;

    if (!rows.length) {
      var empty = document.createElement('p');
      empty.className = 'member-table-empty';
      empty.textContent = emptyText;
      container.appendChild(empty);
      return;
    }

    var wrapper = document.createElement('div');
    wrapper.className = 'member-table-wrap';
    var table = document.createElement('table');
    var thead = document.createElement('thead');
    var headRow = document.createElement('tr');
    columns.forEach(function (column) {
      var th = document.createElement('th');
      th.textContent = column;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    var tbody = document.createElement('tbody');
    rows.forEach(function (values) {
      var row = document.createElement('tr');
      values.forEach(function (value) {
        appendCell(row, value);
      });
      tbody.appendChild(row);
    });
    table.appendChild(tbody);
    wrapper.appendChild(table);
    container.appendChild(wrapper);
  }

  function registrationTotals(registrations) {
    return (registrations || []).reduce(function (totals, registration) {
      var finance = registration.finance || {};
      totals.total += Number(finance.totalAmount || 0);
      totals.paid += Number(finance.paidAmount || 0);
      totals.remaining += Number(finance.remainingAmount || 0);
      return totals;
    }, { total: 0, paid: 0, remaining: 0 });
  }

  function renderCourseDetail(registration) {
    var detail = document.querySelector('[data-member-course-detail]');
    if (!detail || !registration) return;

    var finance = registration.finance || {};
    var product = registration.product || {};
    var content = registration.content || {};
    var meta = [
      product.duration,
      product.lessonType,
      registration.startsAt ? 'Başlangıç: ' + dateText(registration.startsAt) : '',
      registration.invoiceStatusLabel
    ].filter(Boolean).join(' · ');

    detail.hidden = false;
    setText('[data-course-status]', registration.statusLabel + ' · ' + registration.paymentStatusLabel);
    setText('[data-course-title]', registration.courseTitle);
    setText('[data-course-meta]', meta || 'Eğitim detayları hazırlanıyor.');
    setText('[data-course-total]', money(finance.totalAmount));
    setText('[data-course-paid]', money(finance.paidAmount));
    setText('[data-course-remaining]', money(finance.remainingAmount));
    setText('[data-course-installment-count]', String(finance.remainingInstallmentCount || 0));

    var link = document.querySelector('[data-course-link]');
    if (link) {
      link.href = product.slug ? '/urun/' + product.slug + '/' : '../tum-urunler/';
      link.hidden = !product.slug;
    }

    renderList('[data-course-lessons]', content.lessons, 'Ders içerikleri admin panelinden eklendiğinde burada görünür.');
    renderList('[data-course-outcomes]', content.outcomes, 'Kazanım bilgileri admin panelinden eklendiğinde burada görünür.');

    renderTable('[data-course-payments]', ['Tutar', 'Yöntem', 'Tarih', 'Not'], (registration.payments || []).map(function (payment) {
      return [
        money(payment.amount),
        payment.method || '-',
        dateText(payment.paidAt, true),
        payment.note || '-'
      ];
    }), 'Henüz ödeme kaydı görünmüyor.');

    renderTable('[data-course-installments]', ['Başlık', 'Tutar', 'Vade', 'Durum'], (registration.installments || []).map(function (installment) {
      return [
        installment.title || 'Taksit',
        money(installment.amount),
        dateText(installment.dueDate),
        installment.statusLabel || installment.status
      ];
    }), 'Taksit planı bulunmuyor.');
  }

  function renderCourses(registrations) {
    var list = document.querySelector('[data-member-course-list]');
    var empty = document.querySelector('[data-member-empty]');
    var detail = document.querySelector('[data-member-course-detail]');
    clear(list);

    if (!registrations.length) {
      if (empty) empty.hidden = false;
      if (detail) detail.hidden = true;
      return;
    }

    if (empty) empty.hidden = true;
    registrations.forEach(function (registration, index) {
      var button = document.createElement('button');
      var title = document.createElement('strong');
      var meta = document.createElement('span');
      var finance = registration.finance || {};

      button.type = 'button';
      button.className = 'member-course-item' + (index === 0 ? ' is-active' : '');
      title.textContent = registration.courseTitle;
      meta.textContent = [
        registration.paymentStatusLabel,
        'Kalan: ' + money(finance.remainingAmount)
      ].filter(Boolean).join(' · ');
      button.appendChild(title);
      button.appendChild(meta);
      button.addEventListener('click', function () {
        Array.prototype.forEach.call(document.querySelectorAll('.member-course-item'), function (item) {
          item.classList.remove('is-active');
        });
        button.classList.add('is-active');
        renderCourseDetail(registration);
      });
      list.appendChild(button);
    });

    renderCourseDetail(registrations[0]);
  }

  function showProfile(member, registrations) {
    var courses = registrations || [];
    var totals = registrationTotals(courses);
    var fullName = [member.name, member.surname].filter(Boolean).join(' ').trim() || member.email;
    setText('[data-member-name]', fullName);
    setText('[data-member-initial]', fullName.charAt(0).toUpperCase());
    setText('[data-member-first-name]', member.name);
    setText('[data-member-surname]', member.surname);
    setText('[data-member-email]', member.email);
    setText('[data-member-phone]', member.phone);
    setText('[data-member-course-count]', String(courses.length));
    setText('[data-member-total-amount]', money(totals.total));
    setText('[data-member-paid-amount]', money(totals.paid));
    setText('[data-member-remaining-amount]', money(totals.remaining));
    renderCourses(courses);
    document.querySelector('[data-member-loading]').hidden = true;
    document.querySelector('[data-member-profile]').hidden = false;
  }

  function showError() {
    document.querySelector('[data-member-loading]').hidden = true;
    document.querySelector('[data-member-error]').hidden = false;
  }

  function setMessage(message, type) {
    var element = document.querySelector('[data-member-message]');
    if (!element) return;

    element.textContent = message || '';
    element.hidden = !message;
    element.classList.toggle('is-error', type === 'error');
  }

  function readJson(response) {
    return response.json().catch(function () {
      return {};
    });
  }

  function requestCsrfToken() {
    return fetch('/api/csrf-token', { credentials: 'same-origin' })
      .then(function (response) {
        if (!response.ok) throw new Error('CSRF token request failed');
        return readJson(response);
      })
      .then(function (result) {
        if (!result.token) throw new Error('CSRF token missing');
        return result.token;
      });
  }

  function logout() {
    var button = document.querySelector('[data-member-logout]');
    if (button) button.disabled = true;
    setMessage('', '');

    requestCsrfToken()
      .then(function (token) {
        return fetch('/ajax/member/logout', {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': token
          },
          body: JSON.stringify({})
        });
      })
      .then(function (response) {
        return readJson(response).then(function (result) {
          return { response: response, result: result };
        });
      })
      .then(function (payload) {
        if (payload.response.ok && payload.result.status === 'success') {
          window.location.replace(payload.result.param && payload.result.param.login_callback_url || '/');
          return;
        }

        throw new Error(payload.result.message || 'Çıkış yapılamadı.');
      })
      .catch(function (error) {
        setMessage(error.message || 'Çıkış yapılamadı. Lütfen tekrar deneyiniz.', 'error');
        if (button) button.disabled = false;
      });
  }

  var logoutButton = document.querySelector('[data-member-logout]');
  if (logoutButton) {
    logoutButton.addEventListener('click', logout);
  }

  fetch('/ajax/member/me', { credentials: 'same-origin' })
    .then(function (response) {
      if (!response.ok) throw new Error('Member request failed');
      return response.json();
    })
    .then(function (result) {
      if (!result || !result.authenticated || !result.member) {
        window.location.replace('/uye-girisi/');
        return;
      }

      showProfile(result.member, result.registrations || []);
    })
    .catch(showError);
}());
