// Shared broken-image handler for the public site. On a load error (404,
// network failure, etc.) swaps the <img> for an inline placeholder styled
// like the rest of the site instead of leaving the browser's broken-image
// icon + alt text showing. Attach via onerror="window.dpcHandleImgError(this)"
// on any product-related <img>. Must be included before app.js and cart.js.
(function (window, document) {
  'use strict';

  function dpcHandleImgError(img) {
    if (!img || img.dataset.dpcFallback === '1') return;
    img.dataset.dpcFallback = '1';

    var placeholder = document.createElement('div');
    placeholder.className = (img.className ? img.className + ' ' : '') + 'dpc-img-fallback';
    placeholder.setAttribute('role', 'img');
    placeholder.setAttribute('aria-label', img.alt || 'Зображення недоступне');
    placeholder.innerHTML = '<i data-feather="image" class="w-6 h-6"></i>';

    if (img.parentNode) img.parentNode.replaceChild(placeholder, img);
    if (window.feather) window.feather.replace();
  }

  window.dpcHandleImgError = dpcHandleImgError;
})(window, document);
