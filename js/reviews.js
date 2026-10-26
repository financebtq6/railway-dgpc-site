// Single source of truth for customer reviews across the public site.
// Both reviews.html (#reviews-grid, full list) and index.html
// (#featured-reviews, featured-only) call window.DPCReviews.render() —
// one fetch-and-render implementation instead of two hand-written
// static card lists that can drift out of sync.
(function (window, document) {
  'use strict';

  var DATA_URL = './data/reviews.json';
  var LONG_TEXT_THRESHOLD = 220; // ~5 lines at the card's width

  function pluralUk(n, forms) {
    var mod10 = n % 10;
    var mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return forms[0];
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
    return forms[2];
  }

  function relativeDateUk(iso) {
    var then = new Date(iso + 'T00:00:00');
    var now = new Date();
    var diffDays = Math.floor((now - then) / 86400000);

    if (diffDays <= 0) return 'сьогодні';
    if (diffDays === 1) return 'вчора';
    if (diffDays < 7) return diffDays + ' ' + pluralUk(diffDays, ['день', 'дні', 'днів']) + ' тому';

    var weeks = Math.floor(diffDays / 7);
    if (diffDays < 30) return weeks + ' ' + pluralUk(weeks, ['тиждень', 'тижні', 'тижнів']) + ' тому';

    var months = Math.floor(diffDays / 30);
    if (diffDays < 365) return months + ' ' + pluralUk(months, ['місяць', 'місяці', 'місяців']) + ' тому';

    var years = Math.floor(diffDays / 365);
    return years + ' ' + pluralUk(years, ['рік', 'роки', 'років']) + ' тому';
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var cardIdCounter = 0;

  function buildStars(rating, sizeClass) {
    var full = Math.round(rating);
    var size = sizeClass || 'w-5 h-5';
    var html = '';
    for (var i = 0; i < 5; i++) {
      html += '<i data-feather="star" class="fill-current ' + size + (i < full ? '' : ' dpc-star-empty') + '"></i>';
    }
    return html;
  }

  // Grid variant — reviews.html's #reviews-grid. Equal-height cards (grid
  // rows stretch children by default) with a clamp-and-expand for long text.
  function buildGridCard(review) {
    var textId = 'review-text-' + (cardIdCounter++);
    var initial = (review.author.trim().charAt(0) || '?').toUpperCase();
    var isLong = review.text.length > LONG_TEXT_THRESHOLD;

    return '' +
      '<div class="review-card dpc-review-card p-6 rounded-xl transition-all flex flex-col h-full">' +
        '<div class="flex items-center mb-4">' +
          '<div class="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xl">' +
            escapeHtml(initial) +
          '</div>' +
          '<div class="ml-4">' +
            '<h3 class="font-bold dpc-text-primary">' + escapeHtml(review.author) + '</h3>' +
            '<p class="text-sm dpc-muted-text">' + relativeDateUk(review.date) + '</p>' +
          '</div>' +
        '</div>' +
        '<div class="flex mb-3 text-yellow-400">' + buildStars(review.rating) + '</div>' +
        '<p class="leading-relaxed dpc-muted-text dpc-review-text' + (isLong ? ' is-clamped' : '') + '" id="' + textId + '">' +
          escapeHtml(review.text) +
        '</p>' +
        (isLong
          ? '<button type="button" class="dpc-review-toggle text-sm font-semibold mt-2" data-target="' + textId + '">Читати далі</button>'
          : '') +
      '</div>';
  }

  // Marquee variant — index.html's horizontally-scrolling featured strip.
  // Matches the page's pre-existing card look (user-icon avatar, quote
  // mark, quoted text, fixed card width) so the homepage design is untouched.
  function buildMarqueeCard(review) {
    var starsHtml = '';
    var full = Math.round(review.rating);
    for (var i = 0; i < 5; i++) {
      starsHtml += '<i data-feather="star" class="w-4 h-4 text-yellow-500' + (i < full ? ' fill-yellow-500' : '') + '"></i>';
    }

    return '' +
      '<div class="review-card flex-shrink-0 w-[400px]">' +
        '<div class="dpc-review-card p-6 rounded-2xl h-full transition-all duration-300 hover:-translate-y-1">' +
          '<div class="flex items-center justify-between mb-4">' +
            '<div class="flex items-center space-x-3">' +
              '<div class="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">' +
                '<i data-feather="user" class="w-5 h-5"></i>' +
              '</div>' +
              '<div>' +
                '<h3 class="font-bold dpc-text-primary">' + escapeHtml(review.author) + '</h3>' +
                '<p class="text-xs dpc-muted-text">' + relativeDateUk(review.date) + '</p>' +
              '</div>' +
            '</div>' +
            '<i data-feather="quote" class="w-8 h-8 text-blue-200"></i>' +
          '</div>' +
          '<div class="flex mb-3">' + starsHtml + '</div>' +
          '<p class="leading-relaxed dpc-muted-text">&quot;' + escapeHtml(review.text) + '&quot;</p>' +
        '</div>' +
      '</div>';
  }

  function attachToggleHandlers(scope) {
    var buttons = scope.querySelectorAll('.dpc-review-toggle');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener('click', function (e) {
        var btn = e.currentTarget;
        var p = document.getElementById(btn.getAttribute('data-target'));
        if (!p) return;
        var nowClamped = p.classList.toggle('is-clamped');
        btn.textContent = nowClamped ? 'Читати далі' : 'Згорнути';
      });
    }
  }

  function updateRatingHeader(reviews) {
    var valueEl = document.getElementById('google-rating-value');
    var countEl = document.getElementById('google-review-count');
    var starsEl = document.getElementById('google-rating-stars');

    var rating = typeof window.googleRating === 'number' ? window.googleRating : 5.0;
    var count = typeof window.googleReviewCount === 'number' ? window.googleReviewCount : reviews.length;

    if (valueEl) valueEl.textContent = rating.toFixed(1) + ' / 5.0';
    if (countEl) countEl.textContent = count + ' ' + pluralUk(count, ['відгук', 'відгуки', 'відгуків']) + ' • на основі Google Maps';
    if (starsEl) starsEl.innerHTML = buildStars(rating, 'w-6 h-6');
  }

  function sortNewestFirst(reviews) {
    return reviews.slice().sort(function (a, b) {
      return new Date(b.date) - new Date(a.date);
    });
  }

  function render(options) {
    var opts = options || {};
    var containerId = opts.containerId;
    var featuredOnly = !!opts.featuredOnly;
    var variant = opts.variant || 'grid';
    var buildFn = variant === 'marquee' ? buildMarqueeCard : buildGridCard;

    var container = document.getElementById(containerId);
    if (!container) return Promise.resolve();

    return fetch(DATA_URL, { credentials: 'same-origin' })
      .then(function (res) {
        if (!res.ok) throw new Error('Failed to load ' + DATA_URL + ': ' + res.status);
        return res.json();
      })
      .then(function (data) {
        if (!Array.isArray(data)) throw new Error('reviews.json is not an array');

        var reviews = sortNewestFirst(featuredOnly ? data.filter(function (r) { return r.featured; }) : data);

        container.innerHTML = reviews.map(buildFn).join('');
        if (variant === 'grid') attachToggleHandlers(container);

        if (!featuredOnly) updateRatingHeader(data);
        if (window.feather) feather.replace();
      })
      .catch(function (err) {
        console.error('[DPCReviews] render failed:', err);
        container.innerHTML = '<p class="text-center dpc-muted-text col-span-full">Не вдалося завантажити відгуки. Оновіть сторінку.</p>';
      });
  }

  window.DPCReviews = { render: render };
})(window, document);
