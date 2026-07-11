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

  // Product images are stored in Postgres as paths relative to the site
  // root (e.g. "./images/products/x/1.jpg") because that's how the public
  // pages have always resolved them. Rendered as-is inside
  // /admin/product-form.html, a relative path resolves against the admin
  // page's own URL instead ("/admin/images/..."), which 404s. This only
  // fixes how the *admin preview* resolves the path in the browser — the
  // stored value itself is never touched. R2 images already come back as
  // absolute https:// URLs, so they pass through untouched too.
  function normalizePreviewImageUrl(rawPath) {
    if (typeof rawPath !== 'string') return null;
    const trimmed = rawPath.trim();
    if (!trimmed) return null;

    if (/^https?:\/\//i.test(trimmed)) return trimmed;

    // Reject any other URL scheme (javascript:, data:, vbscript:, ...)
    // before ever assigning it to an <img src>.
    if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return null;

    if (trimmed.startsWith('/')) return trimmed;
    if (trimmed.startsWith('./')) return '/' + trimmed.slice(2);
    return '/' + trimmed.replace(/^\/+/, '');
  }

  function buildImagePlaceholder(rawUrl) {
    const placeholder = document.createElement('div');
    placeholder.className = 'admin-image-placeholder';
    placeholder.textContent = rawUrl ? 'Зображення недоступне' : 'Немає зображення';
    return placeholder;
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
          // Full navigation (not history/state manipulation) so the edit-mode
          // load path below re-runs from scratch and the image manager
          // initializes against the now-persisted product id.
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
        showImageManagerForEdit();
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
    showImageManagerForCreate();
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

  // ---------- Image manager (Stage 5: Cloudflare R2) ----------

  const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const MAX_IMAGE_FILE_SIZE = 10 * 1024 * 1024;
  const MAX_FILES_PER_BATCH = 10;

  let currentImages = [];
  let pendingFiles = [];
  let imageActionBusy = false;
  let pendingDeleteImage = null;

  function imagesApiUrl(suffix) {
    return '/api/admin/products/' + encodeURIComponent(productId) + '/images' + (suffix || '');
  }

  function sortImages(images) {
    return (images || []).slice().sort(function (a, b) { return a.sortOrder - b.sortOrder; });
  }

  function formatFileSize(bytes) {
    if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' МБ';
    if (bytes >= 1024) return Math.round(bytes / 1024) + ' КБ';
    return bytes + ' Б';
  }

  function showUploadError(message) {
    const el = qs('#image-upload-error');
    el.textContent = message || '';
    el.hidden = !message;
  }

  function sourceBadgeClass(source) {
    if (source === 'local') return 'admin-image-badge-local';
    if (source === 'r2') return 'admin-image-badge-r2';
    return 'admin-image-badge-external';
  }

  function sourceBadgeLabel(source) {
    if (source === 'local') return 'Local';
    if (source === 'r2') return 'R2';
    return 'External';
  }

  function setGalleryBusy(busy) {
    imageActionBusy = busy;
    qs('#product-images-gallery').querySelectorAll('button').forEach(function (btn) {
      btn.disabled = busy;
    });
  }

  function buildGalleryThumb(image) {
    const thumb = document.createElement('div');
    thumb.className = 'admin-image-card-thumb';

    const normalized = normalizePreviewImageUrl(image.url);
    if (normalized) {
      const img = document.createElement('img');
      img.alt = '';
      img.loading = 'lazy';
      img.addEventListener('error', function () {
        img.replaceWith(buildImagePlaceholder(image.url));
      });
      img.src = normalized;
      thumb.appendChild(img);
    } else {
      thumb.appendChild(buildImagePlaceholder(image.url));
    }

    const badges = document.createElement('div');
    badges.className = 'admin-image-badges';
    if (image.isMain) {
      const mainBadge = document.createElement('span');
      mainBadge.className = 'admin-image-badge admin-image-badge-main';
      mainBadge.textContent = 'Головне';
      badges.appendChild(mainBadge);
    }
    const sourceBadge = document.createElement('span');
    sourceBadge.className = 'admin-image-badge ' + sourceBadgeClass(image.source);
    sourceBadge.textContent = sourceBadgeLabel(image.source);
    badges.appendChild(sourceBadge);
    thumb.appendChild(badges);

    return thumb;
  }

  function buildGalleryCard(image, index, total) {
    const card = document.createElement('div');
    card.className = 'admin-image-card';
    card.appendChild(buildGalleryThumb(image));

    const position = document.createElement('span');
    position.className = 'admin-image-card-position';
    position.textContent = 'Позиція ' + (index + 1) + ' з ' + total;
    card.appendChild(position);

    const urlEl = document.createElement('span');
    urlEl.className = 'admin-image-card-url';
    urlEl.title = image.url;
    urlEl.textContent = image.url;
    card.appendChild(urlEl);

    const orderRow = document.createElement('div');
    orderRow.className = 'admin-image-card-order';

    const upBtn = document.createElement('button');
    upBtn.type = 'button';
    upBtn.className = 'admin-btn admin-btn-ghost';
    upBtn.textContent = '↑';
    upBtn.disabled = index === 0;
    upBtn.setAttribute('aria-label', 'Перемістити вгору');
    upBtn.addEventListener('click', function () { moveImage(image.id, -1); });

    const downBtn = document.createElement('button');
    downBtn.type = 'button';
    downBtn.className = 'admin-btn admin-btn-ghost';
    downBtn.textContent = '↓';
    downBtn.disabled = index === total - 1;
    downBtn.setAttribute('aria-label', 'Перемістити вниз');
    downBtn.addEventListener('click', function () { moveImage(image.id, 1); });

    orderRow.appendChild(upBtn);
    orderRow.appendChild(downBtn);
    card.appendChild(orderRow);

    const actions = document.createElement('div');
    actions.className = 'admin-image-card-actions';

    if (!image.isMain) {
      const mainBtn = document.createElement('button');
      mainBtn.type = 'button';
      mainBtn.className = 'admin-btn admin-btn-ghost';
      mainBtn.textContent = 'Зробити головним';
      mainBtn.addEventListener('click', function () { setMainImage(image.id); });
      actions.appendChild(mainBtn);
    }

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'admin-btn admin-btn-danger';
    deleteBtn.textContent = 'Видалити';
    deleteBtn.addEventListener('click', function () { openDeleteDialog(image); });
    actions.appendChild(deleteBtn);

    card.appendChild(actions);
    return card;
  }

  function renderGallery() {
    const gallery = qs('#product-images-gallery');
    const emptyEl = qs('#product-images-empty');
    gallery.textContent = '';

    if (!currentImages.length) {
      emptyEl.hidden = false;
      return;
    }
    emptyEl.hidden = true;

    currentImages.forEach(function (image, index) {
      gallery.appendChild(buildGalleryCard(image, index, currentImages.length));
    });
  }

  function fetchImages() {
    return fetch(imagesApiUrl(''), { credentials: 'same-origin' })
      .then(function (res) {
        if (res.status === 401) {
          window.location.href = '/admin/login.html';
          return Promise.reject(new Error('not authenticated'));
        }
        if (!res.ok) throw new Error('Не вдалося завантажити зображення.');
        return res.json();
      })
      .then(function (data) {
        currentImages = sortImages(data.images);
        renderGallery();
      })
      .catch(function (err) {
        if (err.message === 'not authenticated') return;
        showUploadError(err.message);
      });
  }

  function moveImage(imageId, delta) {
    if (imageActionBusy) return;
    const index = currentImages.findIndex(function (img) { return img.id === imageId; });
    const newIndex = index + delta;
    if (index === -1 || newIndex < 0 || newIndex >= currentImages.length) return;

    const reordered = currentImages.slice();
    const tmp = reordered[index];
    reordered[index] = reordered[newIndex];
    reordered[newIndex] = tmp;

    saveOrder(reordered.map(function (img) { return img.id; }));
  }

  function saveOrder(imageIds) {
    setGalleryBusy(true);
    showUploadError('');

    return fetch(imagesApiUrl('/order'), {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageIds: imageIds })
    })
      .then(function (res) {
        if (res.status === 401) {
          window.location.href = '/admin/login.html';
          return Promise.reject(new Error('not authenticated'));
        }
        return res.json().then(function (data) { return { ok: res.ok, data: data }; });
      })
      .then(function (result) {
        if (!result.ok) throw new Error(result.data && result.data.error ? result.data.error : 'Не вдалося змінити порядок.');
        currentImages = sortImages(result.data.images);
        renderGallery();
      })
      .catch(function (err) {
        if (err.message !== 'not authenticated') showUploadError(err.message);
      })
      .finally(function () {
        setGalleryBusy(false);
      });
  }

  function setMainImage(imageId) {
    if (imageActionBusy) return;
    setGalleryBusy(true);
    showUploadError('');

    fetch(imagesApiUrl('/' + encodeURIComponent(imageId) + '/main'), {
      method: 'PUT',
      credentials: 'same-origin'
    })
      .then(function (res) {
        if (res.status === 401) {
          window.location.href = '/admin/login.html';
          return Promise.reject(new Error('not authenticated'));
        }
        return res.json().then(function (data) { return { ok: res.ok, data: data }; });
      })
      .then(function (result) {
        if (!result.ok) throw new Error(result.data && result.data.error ? result.data.error : 'Не вдалося встановити головне зображення.');
        currentImages = sortImages(result.data.images);
        renderGallery();
      })
      .catch(function (err) {
        if (err.message !== 'not authenticated') showUploadError(err.message);
      })
      .finally(function () {
        setGalleryBusy(false);
      });
  }

  function openDeleteDialog(image) {
    pendingDeleteImage = image;
    const preview = qs('#image-delete-preview');
    preview.textContent = '';

    const normalized = normalizePreviewImageUrl(image.url);
    if (normalized) {
      const img = document.createElement('img');
      img.alt = '';
      img.src = normalized;
      preview.appendChild(img);
    }
    const urlSpan = document.createElement('span');
    urlSpan.className = 'admin-image-card-url';
    urlSpan.textContent = image.url;
    preview.appendChild(urlSpan);

    const warningEl = qs('#image-delete-warning');
    if (image.source === 'local') {
      warningEl.textContent = 'Це локальне зображення з git. Файл на диску видалено НЕ буде — видаляється лише запис у базі даних.';
    } else if (image.source === 'r2') {
      warningEl.textContent = 'Це зображення у сховищі R2. Після видалення запису файл також буде видалено зі сховища.';
    } else {
      warningEl.textContent = 'Буде видалено лише запис про це зображення.';
    }

    qs('#image-delete-error').hidden = true;

    const dialog = qs('#image-delete-dialog');
    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function closeDeleteDialog() {
    pendingDeleteImage = null;
    const dialog = qs('#image-delete-dialog');
    if (typeof dialog.close === 'function') {
      dialog.close();
    } else {
      dialog.removeAttribute('open');
    }
  }

  function confirmDelete() {
    if (!pendingDeleteImage) return;
    const imageId = pendingDeleteImage.id;
    const confirmBtn = qs('#image-delete-confirm');
    confirmBtn.disabled = true;

    fetch(imagesApiUrl('/' + encodeURIComponent(imageId)), {
      method: 'DELETE',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: true })
    })
      .then(function (res) {
        if (res.status === 401) {
          window.location.href = '/admin/login.html';
          return Promise.reject(new Error('not authenticated'));
        }
        return res.json().then(function (data) { return { ok: res.ok, data: data }; });
      })
      .then(function (result) {
        if (!result.ok) throw new Error(result.data && result.data.error ? result.data.error : 'Не вдалося видалити зображення.');
        currentImages = sortImages(result.data.images);
        renderGallery();
        closeDeleteDialog();
        if (result.data.warning) showUploadError(result.data.warning);
      })
      .catch(function (err) {
        if (err.message === 'not authenticated') return;
        const errEl = qs('#image-delete-error');
        errEl.textContent = err.message;
        errEl.hidden = false;
      })
      .finally(function () {
        confirmBtn.disabled = false;
      });
  }

  function renderSelectedFiles() {
    const list = qs('#image-selected-list');
    list.textContent = '';
    pendingFiles.forEach(function (file) {
      const li = document.createElement('li');
      const nameSpan = document.createElement('span');
      nameSpan.textContent = file.name;
      const sizeSpan = document.createElement('span');
      sizeSpan.textContent = formatFileSize(file.size);
      li.appendChild(nameSpan);
      li.appendChild(sizeSpan);
      list.appendChild(li);
    });
    qs('#image-upload-actions').hidden = pendingFiles.length === 0;
  }

  function validateSelectedFiles(files) {
    const errors = [];
    if (files.length > MAX_FILES_PER_BATCH) {
      errors.push('Максимум ' + MAX_FILES_PER_BATCH + ' файлів за раз.');
    }
    files.forEach(function (file) {
      if (ALLOWED_IMAGE_TYPES.indexOf(file.type) === -1) {
        errors.push(file.name + ': непідтримуваний формат.');
      } else if (file.size > MAX_IMAGE_FILE_SIZE) {
        errors.push(file.name + ': перевищує 10 МБ.');
      }
    });
    return errors;
  }

  function handleFilesSelected(fileList) {
    const files = Array.prototype.slice.call(fileList || []);
    if (!files.length) return;

    showUploadError('');
    const errors = validateSelectedFiles(files);
    if (errors.length) showUploadError(errors.join(' '));

    // Client-side checks are a UX convenience only — the server re-validates
    // type/size/count authoritatively and is what actually enforces limits.
    pendingFiles = files.slice(0, MAX_FILES_PER_BATCH);
    renderSelectedFiles();
  }

  function clearSelectedFiles() {
    pendingFiles = [];
    qs('#image-file-input').value = '';
    renderSelectedFiles();
    showUploadError('');
  }

  function uploadSelectedFiles() {
    if (!pendingFiles.length || imageActionBusy) return;

    showUploadError('');
    imageActionBusy = true;
    qs('#image-upload-submit').disabled = true;
    qs('#image-upload-cancel').disabled = true;
    const progressEl = qs('#image-upload-progress');
    progressEl.hidden = false;
    progressEl.textContent = 'Завантаження...';

    const formData = new FormData();
    pendingFiles.forEach(function (file) { formData.append('images', file); });

    // XMLHttpRequest (not fetch) so upload progress is observable — fetch
    // has no upload-progress event as of this writing.
    const xhr = new XMLHttpRequest();
    xhr.open('POST', imagesApiUrl(''), true);
    xhr.withCredentials = true;

    xhr.upload.addEventListener('progress', function (e) {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        progressEl.textContent = 'Завантаження... ' + pct + '%';
      }
    });

    xhr.addEventListener('load', function () {
      imageActionBusy = false;
      qs('#image-upload-submit').disabled = false;
      qs('#image-upload-cancel').disabled = false;
      progressEl.hidden = true;

      if (xhr.status === 401) {
        window.location.href = '/admin/login.html';
        return;
      }

      let data = {};
      try { data = JSON.parse(xhr.responseText); } catch (e) { /* non-JSON response */ }

      if (xhr.status < 200 || xhr.status >= 300) {
        const details = data && data.details ? data.details.join(' ') : '';
        const message = (data && data.error ? data.error : 'Не вдалося завантажити зображення') + (details ? ': ' + details : '');
        showUploadError(message);
        return;
      }

      currentImages = sortImages(data.images);
      renderGallery();
      pendingFiles = [];
      qs('#image-file-input').value = '';
      renderSelectedFiles();
    });

    xhr.addEventListener('error', function () {
      imageActionBusy = false;
      qs('#image-upload-submit').disabled = false;
      qs('#image-upload-cancel').disabled = false;
      progressEl.hidden = true;
      showUploadError('Помилка з’єднання під час завантаження.');
    });

    xhr.send(formData);
  }

  function initImageDropZone() {
    const zone = qs('#image-upload-zone');
    const input = qs('#image-file-input');

    qs('#image-file-pick').addEventListener('click', function () { input.click(); });
    input.addEventListener('change', function () { handleFilesSelected(input.files); });

    ['dragenter', 'dragover'].forEach(function (evtName) {
      zone.addEventListener(evtName, function (e) {
        e.preventDefault();
        e.stopPropagation();
        zone.classList.add('is-dragover');
      });
    });
    ['dragleave', 'drop'].forEach(function (evtName) {
      zone.addEventListener(evtName, function (e) {
        e.preventDefault();
        e.stopPropagation();
        zone.classList.remove('is-dragover');
      });
    });
    zone.addEventListener('drop', function (e) {
      if (e.dataTransfer && e.dataTransfer.files) handleFilesSelected(e.dataTransfer.files);
    });

    qs('#image-upload-submit').addEventListener('click', uploadSelectedFiles);
    qs('#image-upload-cancel').addEventListener('click', clearSelectedFiles);

    qs('#image-delete-cancel').addEventListener('click', closeDeleteDialog);
    qs('#image-delete-confirm').addEventListener('click', confirmDelete);
    qs('#image-delete-dialog').addEventListener('cancel', function () {
      pendingDeleteImage = null;
    });
  }

  function showImageManagerForEdit() {
    qs('#product-images-create-hint').hidden = true;
    qs('#product-images-manager').hidden = false;
    fetchImages();
  }

  function showImageManagerForCreate() {
    qs('#product-images-create-hint').hidden = false;
    qs('#product-images-manager').hidden = true;
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
    initImageDropZone();

    if (productId) {
      mode = 'edit';
      loadProduct(productId);
    } else {
      initCreateMode();
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
