(function () {
  'use strict';

  const state = {
    page: 1,
    pageSize: 20,
    search: '',
    type: '',
    subtype: '',
    status: '',
    total: 0,
    totalPages: 1
  };

  let searchDebounceTimer = null;

  function qs(sel) {
    return document.querySelector(sel);
  }

  function escapeHtml(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('uk-UA', { year: 'numeric', month: '2-digit', day: '2-digit' });
  }

  function formatPrice(n) {
    if (n === null || n === undefined) return '—';
    return Number(n).toLocaleString('uk-UA') + ' грн';
  }

  const STATUS_LABELS = { draft: 'Чернетка', published: 'Опубліковано', hidden: 'Приховано' };

  function buildQuery() {
    const params = new URLSearchParams();
    params.set('page', String(state.page));
    params.set('pageSize', String(state.pageSize));
    if (state.search) params.set('search', state.search);
    if (state.type) params.set('type', state.type);
    if (state.subtype) params.set('subtype', state.subtype);
    if (state.status) params.set('status', state.status);
    return params.toString();
  }

  function setViewState(view) {
    qs('#products-loading').hidden = view !== 'loading';
    qs('#products-empty').hidden = view !== 'empty';
    qs('#products-error').hidden = view !== 'error';
    qs('#products-table-wrap').hidden = view !== 'data';
  }

  function renderRows(products) {
    const tbody = qs('#products-tbody');
    tbody.innerHTML = products.map(function (p) {
      const editHref = '/admin/product-form.html?id=' + encodeURIComponent(p.id);
      const hideRestoreBtn = p.status === 'hidden'
        ? '<button type="button" class="admin-btn admin-btn-ghost admin-row-action" data-action="restore" data-id="' + escapeHtml(p.id) + '">Відновити</button>'
        : '<button type="button" class="admin-btn admin-btn-ghost admin-row-action" data-action="hide" data-id="' + escapeHtml(p.id) + '">Приховати</button>';

      return (
        '<tr>' +
        '<td data-label="Назва"><a href="' + editHref + '">' + escapeHtml(p.title) + '</a></td>' +
        '<td data-label="ID"><code>' + escapeHtml(p.id) + '</code></td>' +
        '<td data-label="Ціна">' + formatPrice(p.price) + '</td>' +
        '<td data-label="Тип">' + escapeHtml(p.type) + '</td>' +
        '<td data-label="Підтип">' + escapeHtml(p.subtype || '—') + '</td>' +
        '<td data-label="Статус"><span class="admin-badge admin-badge-' + escapeHtml(p.status) + '">' + escapeHtml(STATUS_LABELS[p.status] || p.status) + '</span></td>' +
        '<td data-label="Топ">' + (p.featured ? 'Так' : 'Ні') + '</td>' +
        '<td data-label="Порядок">' + escapeHtml(p.sortOrder) + '</td>' +
        '<td data-label="Оновлено">' + formatDate(p.updatedAt) + '</td>' +
        '<td data-label="Дії" class="admin-row-actions">' +
          '<a class="admin-btn admin-btn-ghost admin-row-action" href="' + editHref + '">Редагувати</a>' +
          '<button type="button" class="admin-btn admin-btn-ghost admin-row-action" data-action="duplicate" data-id="' + escapeHtml(p.id) + '" data-title="' + escapeHtml(p.title) + '">Дублювати</button>' +
          hideRestoreBtn +
        '</td>' +
        '</tr>'
      );
    }).join('');
  }

  function renderPagination() {
    qs('#products-pagination-info').textContent =
      'Сторінка ' + state.page + ' з ' + state.totalPages + ' (' + state.total + ' товарів)';
    qs('#products-prev').disabled = state.page <= 1;
    qs('#products-next').disabled = state.page >= state.totalPages;
  }

  function loadProducts() {
    setViewState('loading');

    fetch('/api/admin/products?' + buildQuery(), { credentials: 'same-origin' })
      .then(function (res) {
        if (res.status === 401) {
          window.location.href = '/admin/login.html';
          return Promise.reject(new Error('not authenticated'));
        }
        if (!res.ok) throw new Error('Request failed with status ' + res.status);
        return res.json();
      })
      .then(function (data) {
        state.total = data.pagination.total;
        state.totalPages = data.pagination.totalPages;

        if (!data.products.length) {
          setViewState('empty');
        } else {
          renderRows(data.products);
          setViewState('data');
        }
        renderPagination();
      })
      .catch(function (err) {
        if (err.message === 'not authenticated') return;
        setViewState('error');
      });
  }

  function handleRowAction(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.getAttribute('data-action');
    const id = btn.getAttribute('data-id');

    if (action === 'duplicate') {
      openDuplicateDialog(id, btn.getAttribute('data-title') || '');
      return;
    }

    if (action === 'hide' || action === 'restore') {
      const confirmMsg = action === 'hide'
        ? 'Приховати цей товар з каталогу?'
        : 'Товар буде переведено у статус «Чернетка». Він НЕ з’явиться в каталозі, поки ви не опублікуєте його вручну через редагування товару. Продовжити?';
      if (!window.confirm(confirmMsg)) return;
      btn.disabled = true;

      const url = action === 'hide'
        ? '/api/admin/products/' + encodeURIComponent(id) + '/status'
        : '/api/admin/products/' + encodeURIComponent(id) + '/restore';
      const opts = {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' }
      };
      if (action === 'hide') opts.body = JSON.stringify({ status: 'hidden' });

      fetch(url, opts)
        .then(function (res) {
          if (res.status === 401) { window.location.href = '/admin/login.html'; return Promise.reject(new Error('not authenticated')); }
          return res.json().then(function (data) {
            if (!res.ok) throw new Error(data.error || 'Дія не вдалася');
            loadProducts();
          });
        })
        .catch(function (err) {
          if (err.message !== 'not authenticated') window.alert('Помилка: ' + err.message);
        })
        .finally(function () { btn.disabled = false; });
    }
  }

  let duplicateSourceId = null;

  function showDuplicateError(message) {
    const errorEl = qs('#duplicate-dialog-error');
    errorEl.textContent = message;
    errorEl.hidden = false;
  }

  function hideDuplicateError() {
    const errorEl = qs('#duplicate-dialog-error');
    errorEl.hidden = true;
    errorEl.textContent = '';
  }

  function openDuplicateDialog(sourceId, sourceTitle) {
    duplicateSourceId = sourceId;
    hideDuplicateError();
    qs('#duplicate-source-title').textContent = sourceTitle || sourceId;
    qs('#duplicate-new-id').value = '';
    qs('#duplicate-new-title').value = sourceTitle ? sourceTitle + ' (копія)' : '';
    const dialog = qs('#duplicate-dialog');
    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
    qs('#duplicate-new-id').focus();
  }

  function closeDuplicateDialog() {
    const dialog = qs('#duplicate-dialog');
    if (typeof dialog.close === 'function') {
      dialog.close();
    } else {
      dialog.removeAttribute('open');
    }
    duplicateSourceId = null;
  }

  function submitDuplicateDialog(e) {
    e.preventDefault();
    hideDuplicateError();

    const newId = qs('#duplicate-new-id').value.trim();
    const newTitle = qs('#duplicate-new-title').value.trim();

    const clientErrors = [];
    if (!newId) clientErrors.push('Вкажіть новий ID.');
    else if (!/^[A-Za-z0-9_-]{1,100}$/.test(newId)) clientErrors.push('ID може містити лише латинські літери, цифри, "-" та "_".');
    if (!newTitle) clientErrors.push('Вкажіть нову назву.');

    if (clientErrors.length) {
      showDuplicateError(clientErrors.join(' '));
      return;
    }

    const submitBtn = qs('#duplicate-submit');
    submitBtn.disabled = true;

    fetch('/api/admin/products/' + encodeURIComponent(duplicateSourceId) + '/duplicate', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newId: newId, newTitle: newTitle })
    })
      .then(function (res) {
        if (res.status === 401) { window.location.href = '/admin/login.html'; return Promise.reject(new Error('not authenticated')); }
        return res.json().then(function (data) { return { ok: res.ok, status: res.status, data: data }; });
      })
      .then(function (result) {
        if (!result.ok) {
          const details = result.data && result.data.details ? result.data.details.join(' ') : '';
          throw new Error((result.data && result.data.error ? result.data.error : 'Не вдалося дублювати товар') + (details ? ': ' + details : ''));
        }
        closeDuplicateDialog();
        loadProducts();
      })
      .catch(function (err) {
        if (err.message !== 'not authenticated') showDuplicateError(err.message);
      })
      .finally(function () {
        submitBtn.disabled = false;
      });
  }

  function initDuplicateDialog() {
    const dialog = qs('#duplicate-dialog');
    if (!dialog) return;

    qs('#duplicate-form').addEventListener('submit', submitDuplicateDialog);
    qs('#duplicate-cancel').addEventListener('click', closeDuplicateDialog);
    dialog.addEventListener('cancel', function () {
      duplicateSourceId = null;
    });
  }

  function initProductDashboard() {
    const tbody = qs('#products-tbody');
    if (!tbody) return;

    qs('#products-search').addEventListener('input', function (e) {
      clearTimeout(searchDebounceTimer);
      const value = e.target.value;
      searchDebounceTimer = setTimeout(function () {
        state.search = value.trim();
        state.page = 1;
        loadProducts();
      }, 350);
    });

    qs('#products-type-filter').addEventListener('change', function (e) {
      state.type = e.target.value;
      state.page = 1;
      loadProducts();
    });

    qs('#products-subtype-filter').addEventListener('change', function (e) {
      state.subtype = e.target.value;
      state.page = 1;
      loadProducts();
    });

    qs('#products-status-filter').addEventListener('change', function (e) {
      state.status = e.target.value;
      state.page = 1;
      loadProducts();
    });

    qs('#products-prev').addEventListener('click', function () {
      if (state.page > 1) { state.page -= 1; loadProducts(); }
    });

    qs('#products-next').addEventListener('click', function () {
      if (state.page < state.totalPages) { state.page += 1; loadProducts(); }
    });

    qs('#products-retry').addEventListener('click', loadProducts);

    tbody.addEventListener('click', handleRowAction);

    initDuplicateDialog();

    loadProducts();
  }

  document.addEventListener('DOMContentLoaded', initProductDashboard);
})();
