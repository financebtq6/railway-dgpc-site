// Single source of truth for the "Наші платформи" block and the site
// footer — both were previously duplicated (with drift) across all 12
// public pages. Renders into <div id="site-platforms-root"></div> and
// <div id="site-footer-root"></div> wherever present on the page. Must be
// included after js/site-config.js (reads window.SOCIAL_LINKS,
// window.GOOGLE_MAPS_URL, window.googleRating, window.googleReviewCount).
(function (window, document) {
  'use strict';

  // --- Brand icons (inline SVG, Simple Icons where available) ---
  // OLX and Prom.ua have no Simple Icons entry (regional classifieds/
  // marketplace brands) — these two are a simplified geometric mark in the
  // brand's own color, not a pixel-exact reproduction of their wordmark.
  var ICONS = {
    telegram: '<svg viewBox="0 0 448 512" aria-hidden="true"><path fill="currentColor" d="M446.7 98.6l-67.6 318.8c-5.1 22.5-18.4 28.1-37.3 17.5l-103-75.9-49.7 47.8c-5.5 5.5-10.1 10.1-20.7 10.1l7.4-104.9 190.9-172.5c8.3-7.4-1.8-11.5-12.8-4.1L117.8 285 15.5 253.1c-22.2-6.9-22.6-22.2 4.6-32.9L418.2 66.4c18.5-6.9 34.7 4.1 28.5 32.2z"/></svg>',
    instagram: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.898 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.898-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06zM12 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm7.846-10.405a1.44 1.44 0 1 1-2.881.001 1.44 1.44 0 0 1 2.881-.001z"/></svg>',
    tiktok: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/></svg>',
    prom: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 9.5 12 4l8 5.5V19a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1V9.5Z"/></svg>',
    olx: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2.4"/><circle cx="12" cy="12" r="3.2" fill="currentColor"/></svg>',
    googleMaps: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2C7.8 2 4.4 5.4 4.4 9.6c0 5.6 6.1 11.4 7.1 12.3.3.3.7.3 1 0 1-.9 7.1-6.7 7.1-12.3C19.6 5.4 16.2 2 12 2Zm0 10.4a2.8 2.8 0 1 1 0-5.6 2.8 2.8 0 0 1 0 5.6Z"/></svg>'
  };

  var PLATFORMS = [
    { key: 'telegram', name: 'Telegram', sub: '@Digital_Pc', color: '#0ea5ff', hrefKey: 'telegram', label: 'Telegram' },
    { key: 'instagram', name: 'Instagram', sub: '@digital_pc_dnipro', color: '#e1306c', hrefKey: 'instagram', label: 'Instagram' },
    { key: 'tiktok', name: 'TikTok', sub: '@digital_pc_dnipro_', color: '#f8fafc', hrefKey: 'tiktok', label: 'TikTok' },
    { key: 'prom', name: 'Prom.ua', sub: 'Магазин на Prom', color: '#a855f7', hrefKey: 'prom', label: 'Prom.ua' },
    { key: 'olx', name: 'OLX', sub: 'Наші оголошення', color: '#2dd4bf', hrefKey: 'olx', label: 'OLX' },
    { key: 'googleMaps', name: 'Google Maps', sub: 'Відгуки та маршрут', color: '#22c55e', hrefKey: 'googleMaps', label: 'Google Maps' }
  ];

  function links() {
    return window.SOCIAL_LINKS || {};
  }

  function renderPlatforms() {
    var root = document.getElementById('site-platforms-root');
    if (!root) return;

    var L = links();
    var cards = PLATFORMS.map(function (p) {
      return '' +
        '<a href="' + L[p.hrefKey] + '" target="_blank" rel="noopener" class="dpc-platform-card" aria-label="' + p.label + '">' +
          '<span class="dpc-platform-icon" style="--platform-color:' + p.color + '">' + ICONS[p.key] + '</span>' +
          '<span class="dpc-platform-name title-font">' + p.name + '</span>' +
          '<span class="dpc-platform-sub">' + p.sub + '</span>' +
        '</a>';
    }).join('');

    root.innerHTML = '' +
      '<section class="py-16 dpc-platforms-section">' +
        '<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">' +
          '<div class="text-center mb-12">' +
            '<h2 class="text-3xl font-bold title-font mb-4 dpc-text-primary">Наші платформи</h2>' +
            '<p class="text-lg dpc-muted-text">Слідкуйте за нами, щоб бути в курсі новинок та акцій</p>' +
          '</div>' +
          '<div class="dpc-platforms-grid">' + cards + '</div>' +
        '</div>' +
      '</section>';

    if (window.feather) window.feather.replace();
  }

  function socialButtonsHTML() {
    var L = links();
    return PLATFORMS.map(function (p) {
      return '' +
        '<a href="' + L[p.hrefKey] + '" target="_blank" rel="noopener" class="dpc-social-btn" style="--platform-color:' + p.color + '" aria-label="' + p.label + '">' +
          ICONS[p.key] +
        '</a>';
    }).join('');
  }

  function ratingBadgeHTML() {
    var rating = typeof window.googleRating === 'number' ? window.googleRating : 5.0;
    var count = typeof window.googleReviewCount === 'number' ? window.googleReviewCount : 0;
    return '' +
      '<a href="' + window.GOOGLE_MAPS_URL + '" target="_blank" rel="noopener" class="dpc-footer-rating" aria-label="Рейтинг Digital PC на Google Maps">' +
        '<span class="dpc-footer-rating-icon">' + ICONS.googleMaps + '</span>' +
        '<span class="dpc-footer-rating-text">' +
          '<span class="dpc-footer-rating-value">' + rating.toFixed(1) + '</span>' +
          '<span class="dpc-footer-rating-stars" aria-hidden="true">' + '★★★★★'.slice(0, Math.round(rating)) + '☆☆☆☆☆'.slice(0, 5 - Math.round(rating)) + '</span>' +
          '<span class="dpc-footer-rating-count">' + count + ' відгуків на Google</span>' +
        '</span>' +
      '</a>';
  }

  var CONTACT_ICONS = {
    phone: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M6.6 10.8c1.4 2.8 3.8 5.2 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.2.5 2.5.8 3.8.9.6 0 1 .5 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.1c.6 0 1 .4 1 1 .1 1.3.4 2.6.9 3.8.1.4.1.8-.2 1.1l-2.2 2Z"/></svg>',
    pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M12 21s7-6.5 7-11.5a7 7 0 1 0-14 0C5 14.5 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.3" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
    clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M12 7v5l3.5 2"/></svg>',
    mail: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M4 7l8 6 8-6"/></svg>'
  };

  function renderFooter() {
    var root = document.getElementById('site-footer-root');
    if (!root) return;

    var year = new Date().getFullYear();

    root.innerHTML = '' +
      '<footer class="dpc-footer">' +
        '<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">' +
          '<div class="dpc-footer-grid">' +

            '<div class="dpc-footer-col dpc-footer-col-brand">' +
              '<h3 class="title-font text-lg font-bold mb-3 dpc-text-primary">DIGITAL PC</h3>' +
              '<p class="dpc-footer-text mb-5">Професійні готові ПК для геймінгу, рендерингу та офісних задач. Збираємо з нових комплектуючих з офіційною гарантією.</p>' +
              ratingBadgeHTML() +
              '<div class="dpc-social-row">' + socialButtonsHTML() + '</div>' +
            '</div>' +

            '<div class="dpc-footer-col">' +
              '<h3 class="title-font font-bold mb-4 dpc-text-primary">Клієнтам</h3>' +
              '<ul class="dpc-footer-links">' +
                '<li><a href="index.html">Головна</a></li>' +
                '<li><a href="computers.html">Каталог ПК</a></li>' +
                '<li><a href="periphery.html">Периферія</a></li>' +
                '<li><a href="reviews.html">Відгуки</a></li>' +
                '<li><a href="about.html">Про нас</a></li>' +
              '</ul>' +
            '</div>' +

            '<div class="dpc-footer-col">' +
              '<h3 class="title-font font-bold mb-4 dpc-text-primary">Покупцям</h3>' +
              '<ul class="dpc-footer-links">' +
                '<li><a href="delivery.html">Доставка</a></li>' +
                '<li><a href="delivery.html#payment">Оплата і розстрочка</a></li>' +
                '<li><a href="computers.html?condition=used">Trade-in</a></li>' +
                '<li><a href="warranty.html">Гарантія</a></li>' +
                '<li><a href="contacts.html">Контакти</a></li>' +
              '</ul>' +
            '</div>' +

            '<div class="dpc-footer-col dpc-footer-col-contacts">' +
              '<h3 class="title-font font-bold mb-4 dpc-text-primary">Контакти</h3>' +
              '<a href="tel:+380993173348" class="dpc-footer-phone title-font">+380 99 317 33 48</a>' +
              '<p class="dpc-footer-phone-sub">Безкоштовна консультація</p>' +
              '<ul class="dpc-footer-contact-list">' +
                '<li><span class="dpc-footer-contact-icon">' + CONTACT_ICONS.pin + '</span><a href="' + window.GOOGLE_MAPS_URL + '" target="_blank" rel="noopener">вул. Європейська 5а, Дніпро</a></li>' +
                '<li><span class="dpc-footer-contact-icon">' + CONTACT_ICONS.clock + '</span><span>Вт–Сб: 11:00–18:00</span></li>' +
                '<li><span class="dpc-footer-contact-icon">' + CONTACT_ICONS.mail + '</span><a href="mailto:digital.pc.dnipro@gmail.com">digital.pc.dnipro@gmail.com</a></li>' +
              '</ul>' +
            '</div>' +

          '</div>' +

          '<div class="dpc-footer-bottom">' +
            '<p class="dpc-footer-copy">© 2022–' + year + ' Digital PC. Всі права захищені.</p>' +
            '<div class="dpc-footer-bottom-links">' +
              '<a href="privacy.html">Політика конфіденційності</a>' +
              '<a href="terms.html">Умови використання</a>' +
              '<a href="warranty.html">Гарантія</a>' +
            '</div>' +
          '</div>' +

        '</div>' +
      '</footer>';

    if (window.feather) window.feather.replace();
  }

  function renderSiteChrome() {
    renderPlatforms();
    renderFooter();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderSiteChrome);
  } else {
    renderSiteChrome();
  }

  window.DPCSiteFooter = { render: renderSiteChrome };
})(window, document);
