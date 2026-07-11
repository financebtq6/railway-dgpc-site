/*
  Digital PC - Cart & Favorites (Stage 1) + Cart Checkout (Stage 2)
  Cart/favorites: localStorage persistence only, no accounts, no database.
  Checkout: submits an order request (name/phone/city/NP branch/payment
  method/comment + cart items) to the server-side /api/telegram-notify
  endpoint (server.js) — no online payment, no Nova Poshta API yet (plain
  text city/branch inputs).
  Loaded on every public page. Exposes window.DpcCart / window.DpcFavorites
  and renders the standalone cart.html / favorites.html pages when their
  root containers are present.
*/

(function () {
  const CART_KEY = 'dpc_cart_v1';
  const FAV_KEY = 'dpc_favorites_v1';

  // --- Storage helpers ---
  function readCart() {
    try {
      const raw = JSON.parse(localStorage.getItem(CART_KEY));
      return (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
    } catch (e) {
      return {};
    }
  }

  function writeCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    updateBadges();
  }

  function readFavorites() {
    try {
      const raw = JSON.parse(localStorage.getItem(FAV_KEY));
      return Array.isArray(raw) ? raw : [];
    } catch (e) {
      return [];
    }
  }

  function writeFavorites(favs) {
    localStorage.setItem(FAV_KEY, JSON.stringify(favs));
    updateBadges();
  }

  function cartCount() {
    const cart = readCart();
    return Object.keys(cart).reduce((sum, id) => sum + (Number(cart[id]) || 0), 0);
  }

  function favCount() {
    return readFavorites().length;
  }

  // --- Public API ---
  const DpcCart = {
    getAll: readCart,
    getCount: cartCount,
    has: function (id) { return !!readCart()[id]; },
    add: function (id, qty) {
      const cart = readCart();
      cart[id] = (Number(cart[id]) || 0) + (qty || 1);
      writeCart(cart);
    },
    setQuantity: function (id, qty) {
      const cart = readCart();
      if (qty <= 0) { delete cart[id]; } else { cart[id] = qty; }
      writeCart(cart);
    },
    remove: function (id) {
      const cart = readCart();
      delete cart[id];
      writeCart(cart);
    },
    clear: function () { writeCart({}); }
  };

  const DpcFavorites = {
    getAll: readFavorites,
    getCount: favCount,
    has: function (id) { return readFavorites().indexOf(id) !== -1; },
    // Returns true if the product is now favorited, false if it was removed.
    toggle: function (id) {
      const favs = readFavorites();
      const idx = favs.indexOf(id);
      if (idx === -1) { favs.push(id); } else { favs.splice(idx, 1); }
      writeFavorites(favs);
      return idx === -1;
    },
    remove: function (id) {
      writeFavorites(readFavorites().filter(function (x) { return x !== id; }));
    }
  };

  window.DpcCart = DpcCart;
  window.DpcFavorites = DpcFavorites;

  // --- Navbar badge updates (desktop icon buttons + mobile menu rows) ---
  function updateBadges() {
    const c = cartCount();
    const f = favCount();
    document.querySelectorAll('.dpc-cart-badge').forEach(function (el) {
      el.textContent = String(c);
      el.style.display = c > 0 ? '' : 'none';
    });
    document.querySelectorAll('.dpc-fav-badge').forEach(function (el) {
      el.textContent = String(f);
      el.style.display = f > 0 ? '' : 'none';
    });
  }

  // Keep badges in sync if cart/favorites change in another tab.
  window.addEventListener('storage', function (e) {
    if (e.key === CART_KEY || e.key === FAV_KEY) updateBadges();
  });

  // --- Inline handlers used by product cards / product detail (app.js) ---
  window.dpcToggleFavorite = function (event, id) {
    if (event) event.preventDefault();
    const nowFav = DpcFavorites.toggle(id);
    const btn = event && event.currentTarget;
    if (btn) btn.classList.toggle('is-active', nowFav);
  };

  window.dpcAddToCart = function (event, id) {
    if (event) event.preventDefault();
    DpcCart.add(id, 1);
    const btn = event && event.currentTarget;
    if (btn) btn.classList.add('is-active');
  };

  // --- Shared product fetch (favorites.html / cart.html only) ---
  let productsPromise = null;
  function fetchProducts() {
    if (!productsPromise) {
      productsPromise = window.DPCProducts.load()
        .catch(function (e) {
          console.error('DpcCart: failed to load products', e);
          return [];
        });
    }
    return productsPromise;
  }

  function money(n) {
    if (n === undefined || n === null || n === '') return '';
    return Number(n).toLocaleString('uk-UA', { maximumFractionDigits: 0 }) + ' ₴';
  }

  function detailPageFor(p) {
    return p.type === 'periphery' ? 'periphery.html' : 'computers.html';
  }

  function emptyStateHTML(icon, message) {
    return (
      '<div class="dpc-empty-state">' +
      '<i data-feather="' + icon + '" class="w-12 h-12 mb-4"></i>' +
      '<p>' + message + '</p>' +
      '<a href="computers.html" class="dpc-btn-order inline-flex items-center justify-center px-6 py-3 rounded-lg font-bold mt-4">Перейти до каталогу</a>' +
      '</div>'
    );
  }

  // --- favorites.html ---
  function favoriteCardHTML(p) {
    const imageUrl = (p.images && p.images.length) ? p.images[0] : (p.image || './images/placeholder.jpg');
    const page = detailPageFor(p);
    return (
      '<div class="rounded-lg overflow-hidden product-card h-full flex flex-col" data-product-id="' + p.id + '">' +
      '<a href="' + page + '#product=' + p.id + '" class="block relative h-56 bg-black/20 overflow-hidden">' +
      '<img src="' + imageUrl + '" alt="' + p.title + '" class="h-full w-full object-cover">' +
      '</a>' +
      '<div class="p-5 flex flex-col flex-grow">' +
      '<a href="' + page + '#product=' + p.id + '" class="block">' +
      '<h3 class="text-lg font-bold mb-2 leading-tight dpc-card-title">' + p.title + '</h3>' +
      '</a>' +
      '<span class="text-xl font-bold dpc-price mb-4">' + money(p.price) + '</span>' +
      '<div class="flex gap-3 mt-auto">' +
      '<a href="' + page + '#product=' + p.id + '" class="flex-grow text-center font-bold py-2.5 px-4 rounded-lg dpc-btn-order">Переглянути</a>' +
      '<button type="button" onclick="window.dpcRemoveFavorite(\'' + p.id + '\')" class="dpc-card-fav-btn is-active" aria-label="Прибрати з обраного" title="Прибрати з обраного">' +
      '<i data-feather="trash-2" class="w-4 h-4"></i>' +
      '</button>' +
      '</div>' +
      '</div>' +
      '</div>'
    );
  }

  function renderFavoritesPage() {
    const root = document.getElementById('dpc-favorites-root');
    if (!root) return;
    fetchProducts().then(function (products) {
      const favIds = readFavorites();
      const items = favIds.map(function (id) { return products.find(function (p) { return p.id === id; }); }).filter(Boolean);

      if (items.length === 0) {
        root.innerHTML = emptyStateHTML('heart', 'У вас поки немає обраних товарів.');
      } else {
        root.innerHTML = '<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">' + items.map(favoriteCardHTML).join('') + '</div>';
      }
      if (window.feather) feather.replace();
    });
  }

  window.dpcRemoveFavorite = function (id) {
    DpcFavorites.remove(id);
    renderFavoritesPage();
  };

  // --- cart.html ---
  function cartRowHTML(p, qty) {
    const imageUrl = (p.images && p.images.length) ? p.images[0] : (p.image || './images/placeholder.jpg');
    const page = detailPageFor(p);
    const lineTotal = (Number(p.price) || 0) * qty;
    return (
      '<div class="dpc-cart-row" data-product-id="' + p.id + '">' +
      '<a href="' + page + '#product=' + p.id + '" class="dpc-cart-row-image">' +
      '<img src="' + imageUrl + '" alt="' + p.title + '">' +
      '</a>' +
      '<div class="dpc-cart-row-info">' +
      '<a href="' + page + '#product=' + p.id + '" class="dpc-card-title font-bold">' + p.title + '</a>' +
      '<span class="dpc-price font-bold">' + money(p.price) + '</span>' +
      '</div>' +
      '<div class="dpc-cart-row-qty">' +
      '<button type="button" onclick="window.dpcChangeQty(\'' + p.id + '\', ' + (qty - 1) + ')" aria-label="Зменшити кількість">−</button>' +
      '<span>' + qty + '</span>' +
      '<button type="button" onclick="window.dpcChangeQty(\'' + p.id + '\', ' + (qty + 1) + ')" aria-label="Збільшити кількість">+</button>' +
      '</div>' +
      '<div class="dpc-cart-row-linetotal">' + money(lineTotal) + '</div>' +
      '<button type="button" class="dpc-cart-row-remove" onclick="window.dpcRemoveFromCart(\'' + p.id + '\')" aria-label="Видалити">' +
      '<i data-feather="trash-2" class="w-5 h-5"></i>' +
      '</button>' +
      '</div>'
    );
  }

  function renderCartPage() {
    const root = document.getElementById('dpc-cart-root');
    if (!root) return;
    const summaryEl = document.getElementById('dpc-cart-summary');

    fetchProducts().then(function (products) {
      const cart = readCart();
      const ids = Object.keys(cart);
      const items = ids
        .map(function (id) { return { product: products.find(function (p) { return p.id === id; }), qty: cart[id] }; })
        .filter(function (x) { return x.product; });

      if (items.length === 0) {
        root.innerHTML = emptyStateHTML('shopping-cart', 'Ваш кошик порожній.');
        if (summaryEl) summaryEl.style.display = 'none';
        window.dpcCloseCheckoutForm();
        if (window.feather) feather.replace();
        return;
      }

      root.innerHTML = items.map(function (x) { return cartRowHTML(x.product, x.qty); }).join('');

      const total = items.reduce(function (sum, x) { return sum + (Number(x.product.price) || 0) * x.qty; }, 0);
      const totalValueEl = document.getElementById('dpc-cart-total-value');
      if (totalValueEl) totalValueEl.textContent = money(total);
      if (summaryEl) summaryEl.style.display = '';

      if (window.feather) feather.replace();
    });
  }

  window.dpcChangeQty = function (id, qty) {
    DpcCart.setQuantity(id, qty);
    renderCartPage();
  };

  window.dpcRemoveFromCart = function (id) {
    DpcCart.remove(id);
    renderCartPage();
  };

  // --- Cart checkout form (Stage 2) ---
  window.dpcOpenCheckoutForm = function () {
    const wrap = document.getElementById('dpc-checkout-form-wrap');
    if (!wrap) return;
    wrap.style.display = '';
    wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const nameInput = document.getElementById('checkout-name');
    if (nameInput) nameInput.focus();
  };

  window.dpcCloseCheckoutForm = function () {
    const wrap = document.getElementById('dpc-checkout-form-wrap');
    if (wrap) wrap.style.display = 'none';
  };

  function validatePhoneUA(phone) {
    return /^\+380\d{9}$/.test(phone.replace(/\s+/g, ''));
  }

  function showCheckoutMessage(type, text) {
    const errorEl = document.getElementById('dpc-checkout-error');
    const successEl = document.getElementById('dpc-checkout-success');
    if (errorEl) errorEl.style.display = 'none';
    if (successEl) successEl.style.display = 'none';
    const el = type === 'error' ? errorEl : successEl;
    if (el) {
      el.textContent = text;
      el.style.display = '';
    }
  }

  function initCheckoutForm() {
    const form = document.getElementById('dpc-checkout-form');
    if (!form) return;

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      const data = {
        name: document.getElementById('checkout-name').value.trim(),
        phone: document.getElementById('checkout-phone').value.trim(),
        city: document.getElementById('checkout-city').value.trim(),
        warehouse: document.getElementById('checkout-warehouse').value.trim(),
        payment: document.getElementById('checkout-payment').value,
        comment: document.getElementById('checkout-comment').value.trim()
      };

      if (!data.name || !data.phone || !data.city || !data.warehouse || !data.payment) {
        showCheckoutMessage('error', 'Будь ласка, заповніть усі обов’язкові поля.');
        return;
      }
      if (!validatePhoneUA(data.phone)) {
        showCheckoutMessage('error', 'Будь ласка, введіть коректний номер телефону у форматі +380XXXXXXXXX');
        return;
      }

      const cart = readCart();
      const ids = Object.keys(cart);
      if (ids.length === 0) {
        showCheckoutMessage('error', 'Ваш кошик порожній.');
        return;
      }

      const submitBtn = document.getElementById('dpc-checkout-submit-btn');
      const originalHTML = submitBtn ? submitBtn.innerHTML : '';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Відправка...';
      }

      fetchProducts().then(function (products) {
        const items = ids
          .map(function (id) { return { product: products.find(function (p) { return p.id === id; }), qty: cart[id] }; })
          .filter(function (x) { return x.product; });

        if (items.length === 0) {
          throw new Error('Товари з кошика не знайдено.');
        }

        const total = items.reduce(function (sum, x) { return sum + (Number(x.product.price) || 0) * x.qty; }, 0);

        const itemLines = items.map(function (x, i) {
          const lineTotal = (Number(x.product.price) || 0) * x.qty;
          return (i + 1) + '. ' + x.product.title + ' — ' + x.qty + ' шт. × ' + money(x.product.price) + ' = ' + money(lineTotal);
        }).join('\n');

        const text =
          'Нове замовлення з кошика Digital PC!\n' +
          '==========================\n' +
          '\u{1F464} Ім\'я: ' + data.name + '\n' +
          '\u{1F4F1} Телефон: ' + data.phone + '\n' +
          '\u{1F3D9} Місто: ' + data.city + '\n' +
          '\u{1F4E6} Відділення Нової Пошти: ' + data.warehouse + '\n' +
          '\u{1F4B3} Спосіб оплати: ' + data.payment + '\n' +
          '\u{1F4AC} Коментар: ' + (data.comment || 'Немає') + '\n' +
          '--------------------------\n' +
          'Товари:\n' + itemLines + '\n' +
          '--------------------------\n' +
          '\u{1F4B0} Сума замовлення: ' + money(total) + '\n' +
          '\u{1F4CD} Джерело: Cart checkout\n' +
          '⏰ Час: ' + new Date().toLocaleString('uk-UA');

        return fetch('/api/telegram-notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: text })
        }).then(function (res) {
          return res.json().catch(function () { return { ok: false }; }).then(function (resData) {
            if (!res.ok || !resData.ok) {
              throw new Error(resData.error || 'Telegram send failed');
            }
          });
        });
      }).then(function () {
        showCheckoutMessage('success', 'Дякуємо! Заявку відправлено, ми зв’яжемося з вами найближчим часом. Кошик очищено.');
        form.reset();
        DpcCart.clear();
        renderCartPage();
        setTimeout(function () {
          window.dpcCloseCheckoutForm();
          const successEl = document.getElementById('dpc-checkout-success');
          if (successEl) successEl.style.display = 'none';
        }, 4000);
      }).catch(function (err) {
        console.error('Checkout submit failed:', err);
        showCheckoutMessage('error', 'Помилка відправки заявки. Спробуйте ще раз або зв’яжіться з нами за телефоном.');
      }).finally(function () {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalHTML;
          if (window.feather) feather.replace();
        }
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    updateBadges();
    initCheckoutForm();
    renderFavoritesPage();
    renderCartPage();
  });
})();
