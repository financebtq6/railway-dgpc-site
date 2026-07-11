// Shared product-catalog loader for the public site (Stage 6).
//
// Tries the PostgreSQL-backed /api/products first. Falls back to the
// static data/products.json snapshot only on network failure, a non-2xx
// response, invalid JSON, or a response whose parsed root isn't an array.
// Both app.js (catalog pages) and cart.js (cart/favorites lookups) call
// window.DPCProducts.load() so there is exactly one fetch-and-fallback
// implementation for the whole site, instead of two divergent ones.
//
// Must be included before app.js and cart.js on every page that uses them.
(function (window) {
  'use strict';

  var API_URL = '/api/products';
  var FALLBACK_URL = window.PRODUCTS_JSON_URL || './data/products.json';

  function fetchProductArray(url) {
    return fetch(url, { credentials: 'same-origin' })
      .then(function (res) {
        if (!res.ok) throw new Error('Request to ' + url + ' failed with status ' + res.status);
        return res.json();
      })
      .then(function (data) {
        if (!Array.isArray(data)) throw new Error('Response from ' + url + ' is not an array');
        return data;
      });
  }

  var loadPromise = null;

  // Cached per page load (module-level variable, not localStorage) so
  // every caller on the same page shares one in-flight/settled request
  // instead of re-fetching. A full page navigation naturally resets it.
  function load() {
    if (!loadPromise) {
      loadPromise = fetchProductArray(API_URL).catch(function (err) {
        console.warn('[DPCProducts] /api/products unavailable, falling back to static product data:', err.message);
        return fetchProductArray(FALLBACK_URL);
      });
    }
    return loadPromise;
  }

  window.DPCProducts = { load: load };
})(window);
