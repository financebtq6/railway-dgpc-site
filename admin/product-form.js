(function () {
  'use strict';

  const KNOWN_SPEC_FIELDS = [
    { key: 'cpu', elId: 'spec-cpu' },
    { key: 'gpu', elId: 'spec-gpu' },
    { key: 'motherboard', elId: 'spec-motherboard' },
    { key: 'ram', elId: 'spec-ram' },
    { key: 'storage', elId: 'spec-storage' },
    { key: 'psu', elId: 'spec-psu' },
    { key: 'cooling', elId: 'spec-cooling' },
    { key: 'case', elId: 'spec-case' }
  ];
  const KNOWN_SPEC_KEYS = KNOWN_SPEC_FIELDS.map(function (f) { return f.key; });

  const DESC_PART_IDS = ['field-desc-1', 'field-desc-2', 'field-desc-3', 'field-desc-4', 'field-desc-5', 'field-desc-6'];
  const DESC_PART_KEYS = ['descPartOne', 'descPartTwo', 'descPartThree', 'descPartFour', 'descPartFive', 'descPartSix'];

  let isDirty = false;
  let isSaving = false;
  let mode = 'create';
  let productId = null;

  function qs(sel) { return document.querySelector(sel); }

  function escapeHtml(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function markDirty() {
    isDirty = true;
  }

  function showMessage(text, type) {
    const el = qs('#product-form-message');
    el.textContent = text;
    el.hidden = false;
    el.className = 'admin-form-message' + (type ? ' admin-form-message-' + type : '');
  }

  function hideMessage() {
    const el = qs('#product-form-message');
    el.hidden = true;
    el.textContent = '';
  }

  function addSpecRow(key, value) {
    const container = qs('#specs-extra-rows');
    const row = document.createElement('div');
    row.className = 'admin-specs-row';
    row.innerHTML =
      '<input type="text" class="admin-spec-key" placeholder="Ключ" value="' + escapeHtml(key || '') + '">' +
      '<input type="text" class="admin-spec-value" placeholder="Значення" value="' + escapeHtml(value || '') + '">' +
      '<button type="button" class="admin-btn admin-btn-ghost admin-spec-remove" aria-label="Видалити">✕</button>';

    row.querySelector('.admin-spec-remove').addEventListener('click', function () {
      row.remove();
      markDirty();
    });
    row.querySelector('.admin-spec-key').addEventListener('input', markDirty);
    row.querySelector('.admin-spec-value').addEventListener('input', markDirty);

    container.appendChild(row);
  }

  function clearSpecRows() {
    qs('#specs-extra-rows').innerHTML = '';
  }

  function populateSpecsEditor(specs) {
    clearSpecRows();
    const obj = specs && typeof specs === 'object' ? specs : {};
    Object.keys(obj).forEach(function (key) {
      if (KNOWN_SPEC_KEYS.indexOf(key) === -1) {
        addSpecRow(key, obj[key]);
      }
    });
  }

  function buildSpecsFromForm() {
    const specs = {};

    KNOWN_SPEC_FIELDS.forEach(function (field) {
      const val = qs('#' + field.elId).value.trim();
      if (val) specs[field.key] = val;
    });

    const rows = qs('#specs-extra-rows').querySelectorAll('.admin-specs-row');
    rows.forEach(function (row) {
      const key = row.querySelector('.admin-spec-key').value.trim();
      const value = row.querySelector('.admin-spec-value').value.trim();
      if (key) specs[key] = value;
    });

    return specs;
  }

  function renderReadonlyImages(images) {
    const container = qs('#product-images-readonly');
    if (!images || !images.length) {
      container.innerHTML = '<p class="admin-field-hint">Немає зображень.</p>';
      return;
    }
    container.innerHTML = images.map(function (url) {
      return (
        '<div class="admin-image-thumb">' +
          '<img src="' + escapeHtml(url) + '" alt="" loading="lazy">' +
          '<span class="admin-image-url" title="' + escapeHtml(url) + '">' + escapeHtml(url) + '</span>' +
        '</div>'
      );
    }).join('');
  }

  function populateForm(product) {
    qs('#field-id').value = product.id;
    qs('#field-id').disabled = true;
    qs('#field-title').value = product.title || '';
    qs('#field-type').value = product.type || 'computers';
    qs('#field-subtype').value = product.subtype || '';
    qs('#field-price').value = product.price !== null && product.price !== undefined ? product.price : '';
    qs('#field-old-price').value = product.oldPrice !== null && product.oldPrice !== undefined ? product.oldPrice : '';
    qs('#field-status').value = product.status || 'draft';
    qs('#field-sort-order').value = product.sortOrder !== null && product.sortOrder !== undefined ? product.sortOrder : 0;
    qs('#field-featured').checked = !!product.featured;

    qs('#field-description').value = product.description || '';
    DESC_PART_IDS.forEach(function (elId, idx) {
      qs('#' + elId).value = product[DESC_PART_KEYS[idx]] || '';
    });

    const specs = product.specs || {};
    KNOWN_SPEC_FIELDS.forEach(function (field) {
      qs('#' + field.elId).value = specs[field.key] || '';
    });
    populateSpecsEditor(specs);

    qs('#field-full-specs').value = JSON.stringify(product.full_specs || {}, null, 2);

    qs('#field-olx-url').value = product.olx_url || '';
    qs('#field-prom-url').value = product.prom_url || '';

    renderReadonlyImages(product.images || []);
  }

  function collectPayload() {
    let fullSpecs;
    const fullSpecsRaw = qs('#field-full-specs').value.trim() || '{}';
    try {
      fullSpecs = JSON.parse(fullSpecsRaw);
      if (!fullSpecs || typeof fullSpecs !== 'object' || Array.isArray(fullSpecs)) {
        throw new Error('not an object');
      }
    } catch (e) {
      return { error: 'full_specs має бути валідним JSON-об’єктом' };
    }

    const payload = {
      title: qs('#field-title').value.trim(),
      type: qs('#field-type').value,
      subtype: qs('#field-subtype').value.trim(),
      price: qs('#field-price').value === '' ? null : Number(qs('#field-price').value),
      oldPrice: qs('#field-old-price').value === '' ? null : Number(qs('#field-old-price').value),
      status: qs('#field-status').value,
      featured: qs('#field-featured').checked,
      sortOrder: qs('#field-sort-order').value === '' ? 0 : Number(qs('#field-sort-order').value),
      description: qs('#field-description').value.trim(),
      specs: buildSpecsFromForm(),
      full_specs: fullSpecs,
      olx_url: qs('#field-olx-url').value.trim(),
      prom_url: qs('#field-prom-url').value.trim()
    };

    DESC_PART_IDS.forEach(function (elId, idx) {
      payload[DESC_PART_KEYS[idx]] = qs('#' + elId).value.trim();
    });

    if (mode === 'create') {
      payload.id = qs('#field-id').value.trim();
    }

    return { payload: payload };
  }

  function validateClientSide(payload) {
    const errors = [];
    if (mode === 'create' && !payload.id) errors.push('Вкажіть ID товару.');
    if (!payload.title) errors.push('Вкажіть назву товару.');
    if (payload.price === null || Number.isNaN(payload.price) || payload.price < 0) errors.push('Вкажіть коректну ціну.');
    if (!payload.description) errors.push('Вкажіть короткий опис.');
    return errors;
  }

  function setSaving(saving) {
    isSaving = saving;
    qs('#product-form-save').disabled = saving;
    qs('#product-form-saving-indicator').hidden = !saving;
  }

  function handleSubmit(e) {
    e.preventDefault();
    hideMessage();

    const collected = collectPayload();
    if (collected.error) {
      showMessage(collected.error, 'error');
      return;
    }

    const clientErrors = validateClientSide(collected.payload);
    if (clientErrors.length) {
      showMessage(clientErrors.join(' '), 'error');
      return;
    }

    setSaving(true);

    const url = mode === 'create' ? '/api/admin/products' : '/api/admin/products/' + encodeURIComponent(productId);
    const method = mode === 'create' ? 'POST' : 'PUT';

    fetch(url, {
      method: method,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(collected.payload)
    })
      .then(function (res) {
        if (res.status === 401) {
          window.location.href = '/admin/login.html';
          return Promise.reject(new Error('not authenticated'));
        }
        return res.json().then(function (data) { return { ok: res.ok, status: res.status, data: data }; });
      })
      .then(function (result) {
        if (!result.ok) {
          const details = result.data && result.data.details ? result.data.details.join(' ') : '';
          const message = (result.data && result.data.error ? result.data.error : 'Не вдалося зберегти товар') + (details ? ': ' + details : '');
          showMessage(message, 'error');
          return;
        }

        isDirty = false;

        if (mode === 'create') {
          showMessage('Товар створено. Перенаправлення...', 'success');
          window.location.href = '/admin/product-form.html?id=' + encodeURIComponent(result.data.id);
          return;
        }

        showMessage('Товар збережено.', 'success');
        populateForm(result.data);
      })
      .catch(function (err) {
        if (err.message !== 'not authenticated') showMessage('Помилка з’єднання. Спробуйте ще раз.', 'error');
      })
      .finally(function () {
        setSaving(false);
      });
  }

  function loadProduct(id) {
    qs('#product-form-loading').hidden = false;
    qs('#product-form').hidden = true;

    fetch('/api/admin/products/' + encodeURIComponent(id), { credentials: 'same-origin' })
      .then(function (res) {
        if (res.status === 401) {
          window.location.href = '/admin/login.html';
          return Promise.reject(new Error('not authenticated'));
        }
        if (res.status === 404) throw new Error('Товар не знайдено.');
        if (!res.ok) throw new Error('Не вдалося завантажити товар.');
        return res.json();
      })
      .then(function (product) {
        qs('#product-form-title').textContent = 'Редагування товару';
        qs('#product-form-subtitle').textContent = product.id;
        populateForm(product);
        qs('#product-form-loading').hidden = true;
        qs('#product-form').hidden = false;
        isDirty = false;
      })
      .catch(function (err) {
        if (err.message === 'not authenticated') return;
        qs('#product-form-loading').hidden = true;
        const errEl = qs('#product-form-error');
        errEl.hidden = false;
        errEl.textContent = err.message;
      });
  }

  function initCreateMode() {
    mode = 'create';
    qs('#field-status').value = 'draft';
    populateSpecsEditor({});
  }

  function watchDirtyState() {
    const form = qs('#product-form');
    form.addEventListener('input', markDirty);
    form.addEventListener('change', markDirty);

    window.addEventListener('beforeunload', function (e) {
      if (!isDirty || isSaving) return;
      e.preventDefault();
      e.returnValue = '';
    });
  }

  function init() {
    const form = qs('#product-form');
    if (!form) return;

    const params = new URLSearchParams(window.location.search);
    productId = params.get('id');

    qs('#specs-extra-add').addEventListener('click', function () {
      addSpecRow('', '');
      markDirty();
    });

    form.addEventListener('submit', handleSubmit);
    watchDirtyState();

    if (productId) {
      mode = 'edit';
      loadProduct(productId);
    } else {
      initCreateMode();
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
