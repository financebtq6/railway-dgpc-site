/*
  Digital PC - Main Application Script
  Handles: SPA Routing, Catalog/Detail Views, Translations, Modals, Pagination
*/

(function () {
  // --- CONFIGURATION ---
  const PROM_FALLBACK_URL = window.PROM_FALLBACK_URL || "https://prom.ua/ua/c3808817-digital.html";
  const TELEGRAM_URL = window.TELEGRAM_URL || "https://t.me/Digital_Pc";
  const INSTAGRAM_URL = "https://www.instagram.com/digital_pc_dnipro";
  const OLX_FALLBACK_URL = "https://www.olx.ua";
  const PHONE_NUMBER = "+380993173348";
  const PHONE_DISPLAY = "+380 99 317 33 48";

  const ITEMS_PER_PAGE = 9; // Updated to 9 per page

  // --- GLOBAL STATE ---
  let currentLang = 'uk';
  let currentPage = 1;
  let allProductsData = [];
  let currentRoute = { view: 'catalog', params: {} };
  let currentCategory = 'computers'; // 'computers' or 'periphery'

  // --- FILTER STATE ---
  let activeFilters = {
    // Computers filters (structured catalog filters — see getComputerFilterFields)
    series: [],      // Base | Solid | Midline | Esport | Apex
    condition: [],   // new | used
    cpuFamily: [],   // e.g. 'amd:ryzen-7', 'intel:core-i5'
    cpuX3D: false,
    gpuModel: [],    // e.g. 'rtx-5070-ti', 'rx-9070-xt'
    vram: [],        // '8' | '12' | '16+'
    ramType: [],
    ramSize: [],
    storage: [],
    priceMin: null,
    priceMax: null,
    // Periphery filters
    peripheryType: [] // Клавіатури, Миші, Навушники, Ігрові килимки
  };
  let currentSort = 'default';
  let computerPriceBounds = { min: 0, max: 0 };

  // --- TRANSLATIONS ---
  const i18n = {
    uk: {
      nav_home: "Головна",
      nav_catalog: "Комп'ютери",
      nav_periphery: "Периферія",
      nav_reviews: "Відгуки",
      nav_about: "Про нас",
      nav_contacts: "Контакти",
      nav_clients: "Клієнтам",
      nav_warranty: "Гарантія та сервіс",
      nav_delivery: "Доставка та оплата",

      back_to_catalog: "Назад до каталогу",
      buy_now: "Купити зараз",
      specs_title: "Характеристики",
      desc_title: "Опис",

      hero_title: "DIGITAL PC",
      hero_subtitle: "Професійні готові ПК для геймінгу, рендерингу та офісних задач. Ми створюємо машини, які надихають на перемоги.",
      hero_btn: "Обрати комп'ютер",
      feat_title: "Наші топові збірки",
      feat_subtitle: "Кращі конфігурації для будь-яких завдань - від кіберспорту до професійного монтажу",
      btn_prom: "Купити на Prom.ua",
      btn_olx: "Купити на OLX",
      btn_order: "Замовити",
      modal_title: "Зв'яжіться з нами",
      modal_telegram: "Написати в Telegram",
      modal_call: "Зателефонувати",
      modal_cancel: "Скасувати",
      
      // Contact info
      contact_addr: "вул. Європейська 5а, Дніпро",
      contact_hours: "Пн-Нд: 10:00-18:00",

      // Periphery-specific
      periphery_keyboards: "Клавіатури",
      periphery_mice: "Миші",
      periphery_headsets: "Навушники",
      periphery_pads: "Ігрові килимки"
    },
    en: {
      nav_home: "Home",
      nav_catalog: "Computers",
      nav_periphery: "Periphery",
      nav_reviews: "Reviews",
      nav_about: "About Us",
      nav_contacts: "Contacts",
      nav_clients: "For Clients",
      nav_warranty: "Warranty & Service",
      nav_delivery: "Delivery & Payment",

      back_to_catalog: "Back to Catalog",
      buy_now: "Buy Now",
      specs_title: "Specifications",
      desc_title: "Description",

      hero_title: "DIGITAL PC",
      hero_subtitle: "Professional ready-made PCs for gaming, rendering, and office tasks. We create machines that inspire victory.",
      hero_btn: "Choose Computer",
      feat_title: "Our Top Builds",
      feat_subtitle: "Best configurations for any task - from esports to professional editing",
      btn_prom: "Buy on Prom.ua",
      btn_olx: "Buy on OLX",
      btn_order: "Order Now",
      modal_title: "Contact Us",
      modal_telegram: "Write on Telegram",
      modal_call: "Call Us",
      modal_cancel: "Cancel",
      
      // Contact info
      contact_addr: "Yevropeyska 5a St., Dnipro",
      contact_hours: "Mon-Sun: 10:00-18:00",

      // Periphery-specific
      periphery_keyboards: "Keyboards",
      periphery_mice: "Mice",
      periphery_headsets: "Headsets",
      periphery_pads: "Gaming Pads"
    }
  };

  // --- UTILS ---
  const money = (n) => {
    if (n === undefined || n === null || n === "") return "";
    return Number(n).toLocaleString('uk-UA', { maximumFractionDigits: 0 }) + " ₴";
  };

  // --- ROUTING ---
  function handleHashChange() {
    const hash = window.location.hash;
    if (hash.startsWith('#product=')) {
      const id = hash.split('=')[1];
      currentRoute = { view: 'detail', params: { id } };
    } else {
      currentRoute = { view: 'catalog', params: {} };
    }
    renderApp();
  }

  // --- APP RENDERER ---
  function renderApp() {
    // Any full re-render means we're not inside an active product photo
    // viewer anymore — always drop the lightbox + scroll lock first so a
    // stale one can never survive a route/filter/language change.
    cleanupProductLightbox();

    const catalogContainer = document.getElementById("catalog");
    const detailContainer = document.getElementById("product-detail");
    const paginationNav = document.getElementById("pagination-nav");
    const pageHeader = document.getElementById("page-header");
    const featuredContainer = document.getElementById("featured");
    const sidebar = document.getElementById("filters-sidebar");

    // If we are on Home Page (has #featured div), render Featured products
    if (featuredContainer && !catalogContainer) {
      // Home Page - render featured products
      renderFeatured();
      // If there's a product detail hash, show detail view
      if (currentRoute.view === 'detail' && detailContainer) {
        const product = allProductsData.find(p => p.id === currentRoute.params.id);
        if (product) {
          detailContainer.style.display = 'block';
          renderDetailView(product, detailContainer);
        }
      } else if (detailContainer) {
        detailContainer.style.display = 'none';
      }
      return;
    }

    if (currentRoute.view === 'detail') {
      // Hide Catalog, Show Detail, HIDE PAGE HEADER
      if (catalogContainer) catalogContainer.style.display = 'none';
      if (paginationNav) paginationNav.style.display = 'none';
      if (pageHeader) pageHeader.style.display = 'none';
      if (sidebar) sidebar.style.display = 'none';

      let dContainer = detailContainer;
      if (!dContainer) {
        // Create container if not exists
        dContainer = document.createElement('div');
        dContainer.id = 'product-detail';
        dContainer.className = 'container mx-auto px-4 py-8 max-w-7xl';
        if (catalogContainer) catalogContainer.parentNode.insertBefore(dContainer, catalogContainer);
      }
      dContainer.style.display = 'block';

      const product = allProductsData.find(p => p.id === currentRoute.params.id);
      if (product) {
        renderDetailView(product, dContainer);
      } else {
        dContainer.innerHTML = `<div class="text-center py-20 text-xl">Product not found. <a href="#" class="text-blue-500 hover:underline">Back to catalog</a></div>`;
      }
    } else {
      // Show Catalog, Hide Detail, SHOW PAGE HEADER
      if (catalogContainer) {
        if (catalogContainer) {
          // Restore visibility: detail view sets display:none on this container,
          // and it must be cleared here or the catalog stays hidden after navigating back.
          catalogContainer.style.removeProperty('display');

          const filteredData = getFilteredAndSortedData();
          renderCatalogWithPagination(filteredData, currentPage);
          if (sidebar) sidebar.style.display = 'block';
        }
      }
      if (detailContainer) detailContainer.style.display = 'none';
      if (paginationNav) paginationNav.style.display = 'flex';
      if (pageHeader) pageHeader.style.display = 'block';

      // Show catalog controls when in catalog view
      const catalogControls = document.getElementById('catalog-controls');
      if (catalogControls) catalogControls.style.display = 'flex';
    }

    // Always ensure Featured is handled if present (e.g. on mixed pages, though usually separate)
    // On pages with #catalog, we typically don't show featured unless it's the home page mixed.
    // Assuming computers.html only has #catalog.
  }
  // --- DETAIL VIEW ---
  function renderDetailView(product, container) {
    const mainImage = (product.images && product.images.length > 0) ? product.images[0] : (product.image || './images/placeholder.jpg');
    const price = money(product.price);
    const txtBack = i18n[currentLang].back_to_catalog || "Back";
    const txtOrder = i18n[currentLang].btn_order;
    const txtProm = i18n[currentLang].btn_prom;
    const txtOlx = i18n[currentLang].btn_olx;
    const txtSpecs = i18n[currentLang].specs_title || "Specs";
    const txtDesc = i18n[currentLang].desc_title || "Description";

    const promLink = product.url || PROM_FALLBACK_URL;
    const olxLink = product.olx_url || OLX_FALLBACK_URL;
    
    const isPeriphery = product.type === 'periphery';

    // Cart/favorites (Stage 1, localStorage-only): guarded so a missing
    // cart.js never breaks product detail rendering.
    const isFav = !!(window.DpcFavorites && window.DpcFavorites.has(product.id));
    const inCart = !!(window.DpcCart && window.DpcCart.has(product.id));

    // Parse Specs to clean structured object
    const specsData = product.specs || {};

    const specIcons = {
      'cpu': { icon: 'cpu', label: 'Процесор' },
      'motherboard': { icon: 'grid', label: 'Материнська плата' },
      'ram': { icon: 'layers', label: "Оперативна пам'ять" },
      'storage': { icon: 'hard-drive', label: 'Накопичувач' },
      'gpu': { icon: 'monitor', label: 'Відеокарта' },
      'psu': { icon: 'zap', label: 'Блок живлення' },
      'case': { icon: 'box', label: 'Корпус' },
      'cooling': { icon: 'wind', label: 'Охолодження' }
    };

    const order = ['cpu', 'video_card', 'gpu', 'storage', 'psu', 'case', 'cooling', 'motherboard', 'ram'];

    // Specs Grid Generation (only for computers, not periphery)
    let specsHtml = '';
    if (!isPeriphery) {
      specsHtml = '<div class="col-span-1 lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">';
      let hasSpecs = false;

      for (const key of order) {
        let val = specsData[key];
        if (!val) continue;

        hasSpecs = true;
        const def = specIcons[key] || { icon: 'check-circle', label: key };

        specsHtml += `
              <div class="flex items-start p-4 rounded-xl transition-colors dpc-spec-card">
                  <div class="p-3 bg-white rounded-lg shadow-sm mr-4 text-blue-600 mt-1">
                      <i data-feather="${def.icon}" class="w-5 h-5"></i>
                  </div>
                  <div>
                      <div class="text-xs font-bold uppercase tracking-wider mb-1 dpc-muted-text">${def.label}</div>
                      <div class="font-semibold text-sm leading-snug dpc-text-primary">${val}</div>
                  </div>
              </div>`;
      }

      if (!hasSpecs) {
        specsHtml += `<div class="col-span-2 p-4 italic dpc-muted-text">Специфікації уточнюйте у менеджера</div>`;
      }

      specsHtml += '</div>';
    }

    // Build gallery HTML
    const allImages = product.images && product.images.length > 0 ? product.images : [mainImage];
    const thumbnailsHtml = allImages.length > 1 ? allImages.map((img, idx) => `
        <img src="${img}"
             alt="${product.title}"
             class="w-20 h-20 object-cover rounded-lg cursor-pointer border-2 transition-all hover:border-blue-500 dpc-thumb ${idx === 0 ? 'border-blue-600' : 'border-gray-200'}"
             onerror="window.dpcHandleImgError(this)"
             onclick="changeMainImage('${img}', this)"
             loading="lazy">
    `).join('') : '';

    const backLink = isPeriphery ? "periphery.html" : "computers.html";

    container.innerHTML = `
        <div class="pt-12 md:pt-14 mb-4">
            <a href="${backLink}" class="inline-flex items-center transition-colors font-medium text-lg dpc-back-link">
                <i data-feather="arrow-left" class="w-5 h-5 mr-2"></i> ${txtBack}
            </a>
        </div>

        <div class="rounded-3xl overflow-hidden dpc-detail-panel">
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-0">
                <!-- Image Gallery Section -->
                <div class="dpc-gallery-bg p-4 lg:px-8 lg:py-6 flex flex-col items-center justify-start relative">
                     <div class="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent"></div>

                     <!-- Main Image -->
                     <img id="mainProductImage" src="${mainImage}" alt="${product.title}"
                          class="relative z-10 max-h-[500px] w-full object-contain drop-shadow-2xl transition-all duration-300 mb-4 cursor-pointer hover:scale-105"
                          onerror="window.dpcHandleImgError(this)"
                          data-images='${JSON.stringify(allImages)}' data-current-index="0">

                     <!-- Thumbnails -->
                     ${allImages.length > 1 ? `
                     <div class="relative z-10 flex gap-3 overflow-x-auto pb-2 max-w-full dpc-thumb-strip">
                         ${thumbnailsHtml}
                     </div>
                     ` : ''}
                </div>

                <!-- Info Section -->
                <div class="p-8 lg:p-12 flex flex-col justify-center">
                    <div class="mb-6">
                        <span class="inline-block px-3 py-1 text-xs font-bold tracking-wide uppercase rounded-full mb-4 dpc-badge">In Stock</span>
                        <h1 class="text-3xl lg:text-4xl font-extrabold mb-4 leading-tight tracking-tight dpc-card-title">${product.title}</h1>
                        <div class="text-4xl font-black dpc-price">${price}</div>
                    </div>

                    <!-- Characteristics (Specs) - ONLY FOR COMPUTERS -->
                    ${!isPeriphery ? `
                    <div class="mb-8 w-full">
                        ${specsHtml}
                    </div>
                    ` : ''}

                    <!-- Description -->
                    <div class="mb-8">
                        <div class="mt-4 mb-6">
                          <h4 class="font-bold mb-2 dpc-text-primary">Інформація про товар:</h4>
                          <div class="space-y-1 text-sm dpc-muted-text">${product.description}</div>
                          ${product.descPartOne ? `
                          <ul class="space-y-1 text-sm dpc-muted-text">
                            ${product.descPartOne ? `<li class="flex items-center"><i data-feather="check" class="w-4 h-4 text-green-500 mr-2"></i>${product.descPartOne}</li>` : ''}
                            ${product.descPartTwo ? `<li class="flex items-center"><i data-feather="check" class="w-4 h-4 text-green-500 mr-2"></i>${product.descPartTwo}</li>` : ''}
                            ${product.descPartThree ? `<li class="flex items-center"><i data-feather="check" class="w-4 h-4 text-green-500 mr-2"></i>${product.descPartThree}</li>` : ''}
                            ${product.descPartFour ? `<li class="flex items-center"><i data-feather="check" class="w-4 h-4 text-green-500 mr-2"></i>${product.descPartFour}</li>` : ''}
                            ${product.descPartFive ? `<li class="flex items-center"><i data-feather="check" class="w-4 h-4 text-green-500 mr-2"></i>${product.descPartFive}</li>` : ''}
                            ${product.descPartSix ? `<li class="flex items-center"><i data-feather="check" class="w-4 h-4 text-green-500 mr-2"></i>${product.descPartSix}</li>` : ''}
                          </ul>
                          ` : ''}
                        </div>
                    </div>

                    <div class="flex flex-col gap-4 mt-auto">
                         <div class="flex gap-4">
                             <button onclick="window.openOrderModal('${product.title.replace(/'/g, "\\'")}')" class="flex-grow font-bold py-5 px-8 rounded-2xl transition-all flex items-center justify-center text-xl transform hover:-translate-y-1 dpc-btn-order">
                                <i data-feather="phone-call" class="w-6 h-6 mr-3"></i> ${txtOrder}
                             </button>
                             <button type="button" onclick="window.dpcAddToCart(event, '${product.id}')" class="dpc-card-cart-btn dpc-detail-action-btn ${inCart ? 'is-active' : ''}" data-product-id="${product.id}" aria-label="До кошика" title="До кошика">
                                <i data-feather="shopping-cart" class="w-6 h-6"></i>
                             </button>
                             <button type="button" onclick="window.dpcToggleFavorite(event, '${product.id}')" class="dpc-card-fav-btn dpc-detail-action-btn ${isFav ? 'is-active' : ''}" data-product-id="${product.id}" aria-label="Обране" title="Обране">
                                <i data-feather="heart" class="w-6 h-6"></i>
                             </button>
                         </div>
                         <div class="grid grid-cols-2 gap-4">
                            <a href="${promLink}" target="_blank" class="flex items-center justify-center font-bold py-4 px-6 rounded-2xl transition-all text-center dpc-btn-prom">
                                ${txtProm}
                            </a>
                            <a href="${olxLink}" target="_blank" class="flex items-center justify-center font-bold py-4 px-6 rounded-2xl transition-all text-center dpc-btn-olx">
                                ${txtOlx}
                            </a>
                         </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Add gallery change function
    window.changeMainImage = function (newSrc, thumbnail) {
      const mainImg = document.getElementById('mainProductImage');
      if (mainImg) {
        mainImg.src = newSrc;
        const thumbnails = Array.prototype.slice.call(thumbnail.parentElement.querySelectorAll('img'));
        mainImg.dataset.currentIndex = String(thumbnails.indexOf(thumbnail));
        thumbnails.forEach(t => t.classList.remove('border-blue-600'));
        thumbnails.forEach(t => t.classList.add('border-gray-200'));
        thumbnail.classList.remove('border-gray-200');
        thumbnail.classList.add('border-blue-600');
      }
    };

    // Let vertical mouse wheel/trackpad scroll the thumbnail strip horizontally
    const thumbStrip = container.querySelector('.dpc-thumb-strip');
    if (thumbStrip) {
      thumbStrip.addEventListener('wheel', function (e) {
        if (thumbStrip.scrollWidth > thumbStrip.clientWidth) {
          e.preventDefault();
          thumbStrip.scrollLeft += e.deltaY;
        }
      }, { passive: false });
    }

    if (window.feather) feather.replace();

    // Hide catalog controls in detail view
    const catalogControls = document.getElementById('catalog-controls');
    if (catalogControls) catalogControls.style.display = 'none';

    // Attach lightbox event listener
    setTimeout(() => {
      const mainImg = document.getElementById('mainProductImage');
      if (mainImg) {
        mainImg.addEventListener('click', () => {
          const images = JSON.parse(mainImg.getAttribute('data-images') || '[]');
          const startIndex = parseInt(mainImg.dataset.currentIndex || '0', 10) || 0;
          openProductLightbox(images, startIndex);
        });
      }
    }, 100);

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // --- CATALOG RENDER ---
  const getCardHTML = (p) => {
    // Determine card click action
    // We want the whole card to be clickable OR a specific button. 
    // Requirement: "Make every card clickable. On click: open a dedicated detail page"
    // We'll wrap the image/title in a link or onclick.

    // Clean product title
    let title = p.title || "PC Build";
    // Remove red !! marks
    title = title.replace(/‼️/g, '').trim();
    // Remove redundant prefixes
    title = title.replace(/^(?:Ігровий\s+)?(?:пк|pc)\s+/i, '').trim();
    title = title.replace(/^ТОП\s+/i, '');
    title = title.replace(/^В наявності\s*•\s*/i, '');
    // Remove upgrade text like "(або 32 гб)"
    title = title.replace(/\(або\s+\d+\s*гб\)/gi, '');
    title = title.replace(/можна\s+встановити.*/gi, '');
    title = title.replace(/можна\s+додати.*/gi, '');
    let specs = "";
    if (p.specs && typeof p.specs === 'object' && !Array.isArray(p.specs)) {
      // Pick key specs for card: CPU, GPU, RAM
      const s = p.specs;
      const parts = [];
      if (s.cpu) parts.push(s.cpu);
      if (s.gpu) parts.push(s.gpu);
      if (s.ram) parts.push(s.ram);
      specs = parts.join(" • ");
    } else if (Array.isArray(p.specs)) {
      specs = p.specs.slice(0, 4).join(" • ");
    } else {
      specs = p.title;
    }
    const price = money(p.price);
    const imageUrl = (p.images && p.images.length > 0) ? p.images[0] : (p.image || './images/placeholder.jpg');

    const txtOrder = i18n[currentLang].btn_order;
    const txtProm = i18n[currentLang].btn_prom;
    const txtOlx = i18n[currentLang].btn_olx;

    // Route detail link to correct page based on product type
    const detailPage = p.type === 'periphery' ? 'periphery.html' : 'computers.html';
    // Cart/favorites (Stage 1, localStorage-only): guarded so a missing
    // cart.js never breaks catalog rendering.
    const isFav = !!(window.DpcFavorites && window.DpcFavorites.has(p.id));
    const inCart = !!(window.DpcCart && window.DpcCart.has(p.id));
    return `
    <div class="rounded-lg overflow-hidden product-card transition-all duration-300 transform hover:-translate-y-2 h-full flex flex-col group">
        <div class="dpc-card-image-wrap">
            <a href="${detailPage}#product=${p.id}" class="block relative h-64 bg-black/20 flex items-center justify-center overflow-hidden cursor-pointer">
                 <img src="${imageUrl}" alt="${title}" class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" onerror="window.dpcHandleImgError(this)">
                 <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all duration-300"></div>
            </a>
            <button type="button" onclick="window.dpcToggleFavorite(event, '${p.id}')" class="dpc-card-fav-btn ${isFav ? 'is-active' : ''}" data-product-id="${p.id}" aria-label="Обране" title="Обране">
                <i data-feather="heart" class="w-4 h-4"></i>
            </button>
        </div>
        <div class="p-6 flex flex-col flex-grow">
            <a href="${detailPage}#product=${p.id}" class="block">
                <h3 class="text-xl font-bold mb-2 leading-tight transition-colors dpc-card-title">${title}</h3>
            </a>
            <div class="flex items-center mb-4">
                 <span class="text-2xl font-bold dpc-price">${price}</span>
            </div>
            <div class="flex flex-col gap-3 mt-auto">
                 <div class="flex gap-3">
                     <button onclick="window.openOrderModal('${title.replace(/'/g, "\\'")}')" class="flex-grow font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center dpc-btn-order">
                        <i data-feather="phone-call" class="w-5 h-5 mr-2"></i> ${txtOrder}
                     </button>
                     <button type="button" onclick="window.dpcAddToCart(event, '${p.id}')" class="dpc-card-cart-btn ${inCart ? 'is-active' : ''}" data-product-id="${p.id}" aria-label="До кошика" title="До кошика">
                        <i data-feather="shopping-cart" class="w-5 h-5"></i>
                     </button>
                 </div>
                 <div class="grid grid-cols-2 gap-3">
                    <a href="${p.url || PROM_FALLBACK_URL}" target="_blank" class="flex items-center justify-center text-xs font-bold py-2 px-2 rounded-lg transition-colors text-center dpc-btn-prom">
                        ${txtProm}
                    </a>
                    <a href="${p.olx_url || OLX_FALLBACK_URL}" target="_blank" class="flex items-center justify-center text-xs font-bold py-2 px-2 rounded-lg transition-colors text-center dpc-btn-olx">
                        ${txtOlx}
                    </a>
                 </div>
            </div>
        </div>
    </div>
    `;
  };

  const renderCatalogWithPagination = (data, page) => {
    const catalog = document.getElementById("catalog");
    if (!catalog) return;

    if (data.length === 0 && currentCategory === 'computers') {
      catalog.innerHTML = `
        <div class="col-span-full text-center py-16 px-6 dpc-filter-panel">
          <p class="text-lg font-bold mb-2 dpc-text-primary">Нічого не знайдено за цими фільтрами</p>
          <p class="dpc-muted-text mb-6">Спробуйте змінити умови або скинути фільтри</p>
          <div class="flex flex-wrap items-center justify-center gap-3">
            <button onclick="window.resetFilters()" class="py-2 px-4 rounded-lg dpc-reset-btn">Скинути фільтри</button>
            <a href="${TELEGRAM_URL}" target="_blank" rel="noopener noreferrer" class="py-2 px-4 rounded-lg dpc-btn-order font-bold">Підберемо під ваш бюджет</a>
          </div>
        </div>`;
      if (window.feather) feather.replace();
      const emptyNav = document.getElementById('pagination-nav');
      if (emptyNav) emptyNav.innerHTML = '';
      return;
    }

    const start = (page - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const pageData = data.slice(start, end);
    const totalPages = Math.ceil(data.length / ITEMS_PER_PAGE);

    // Render Cards
    catalog.innerHTML = pageData.map(getCardHTML).join("");
    if (window.feather) feather.replace();

    // Render Pagination
    let nav = document.getElementById('pagination-nav');
    if (!nav) {
      nav = document.createElement('nav');
      nav.id = 'pagination-nav';
      nav.className = 'flex justify-center mt-12 mb-8';
      catalog.parentNode.insertBefore(nav, catalog.nextSibling);
    }

    // Logic for Previous/Next
    let navHTML = `<ul class="flex space-x-2">`;
    if (page > 1) {
      navHTML += `<li><button onclick="window.changePage(${page - 1})" class="px-3 py-2 rounded-md dpc-page-btn">←</button></li>`;
    }
    for (let i = 1; i <= totalPages; i++) {
      const activeClass = i === page ? "active" : "";
      navHTML += `<li><button onclick="window.changePage(${i})" class="px-3 py-2 rounded-md dpc-page-btn ${activeClass}">${i}</button></li>`;
    }
    if (page < totalPages) {
      navHTML += `<li><button onclick="window.changePage(${page + 1})" class="px-3 py-2 rounded-md dpc-page-btn">→</button></li>`;
    }
    navHTML += `</ul>`;
    nav.innerHTML = navHTML;
  };

  const renderFeatured = () => {
    const featured = document.getElementById("featured");
    if (featured && allProductsData.length > 0) {
      // Top 6 by price
      const top6 = [...allProductsData]
        .sort((a, b) => (b.price || 0) - (a.price || 0))
        .slice(0, 6);
      featured.innerHTML = top6.map(getCardHTML).join("");
      if (window.feather) feather.replace();
    }
  };

  // --- FILTER & SORT LOGIC ---
  function generateFilters(data) {
    if (!document.getElementById('filters-sidebar-inner') && !document.getElementById('filter-periphery-type')) return;

    if (currentCategory === 'computers') {
      renderComputerFilters(data);
    } else if (currentCategory === 'periphery') {
      generatePeripheryFilters(data);
    }
  }

  // =====================================================
  // COMPUTER CATALOG FILTERS
  //
  // Products only carry free-text `specs` (cpu/gpu/ram/storage strings)
  // filled in by hand via the admin panel — there are no structured
  // cpuBrand/gpuModel/etc. columns. getComputerFilterFields() parses each
  // product's specs once (cached on the product as `_f`) into structured
  // fields, so every filter/count check below reads those fields instead
  // of re-running regex over free text on every render.
  // =====================================================

  const CPU_TAXONOMY = [
    { brand: 'AMD', families: [
      { key: 'amd:ryzen-5', label: 'Ryzen 5' },
      { key: 'amd:ryzen-7', label: 'Ryzen 7' },
      { key: 'amd:ryzen-9', label: 'Ryzen 9' }
    ] },
    { brand: 'Intel', families: [
      { key: 'intel:core-i3', label: 'Core i3' },
      { key: 'intel:core-i5', label: 'Core i5' },
      { key: 'intel:core-i7', label: 'Core i7' },
      { key: 'intel:core-i9', label: 'Core i9' },
      { key: 'intel:core-ultra', label: 'Core Ultra' }
    ] }
  ];

  const SERIES_TAXONOMY = ['Base', 'Solid', 'Midline', 'Esport', 'Apex'];

  const VRAM_BUCKETS = [
    { key: '8', label: '8 ГБ', test: (v) => v === 8 },
    { key: '12', label: '12 ГБ', test: (v) => v === 12 },
    { key: '16+', label: '16 ГБ+', test: (v) => v >= 16 }
  ];

  const RAM_TYPE_TAXONOMY = ['DDR4', 'DDR5'];
  const RAM_SIZE_TAXONOMY = [16, 32, 64];

  const STORAGE_BUCKETS = [
    { key: '512', label: '512 ГБ', test: (v) => v <= 512 },
    { key: '1024', label: '1 ТБ', test: (v) => v > 512 && v <= 1024 },
    { key: '2048', label: '2 ТБ+', test: (v) => v > 1024 }
  ];

  // A few GPU models in the catalog don't state VRAM in the free-text specs
  // (the model name alone implies it). Used only when the text has no
  // explicit "XX GB" — an explicit value in the text always wins.
  const GPU_VRAM_FALLBACK = {
    'rtx-5060': 8,
    'rtx-5060-ti': 8,
    'rtx-5070': 12,
    'rtx-5070-ti': 16,
    'rtx-5080': 16,
    'rtx-3070-ti': 8,
    'rtx-3080': 10,
    'rx-6900-xt': 16,
    'rx-9070-xt': 16
  };

  // One-time migration patch for free-text quirks the general parser can't
  // resolve (e.g. a RAM string with no DDR generation in it). Keyed by
  // product id — not a parsing rule applied to every product.
  const SPEC_OVERRIDES = {
    'Digital-PC-Apex-Legacy': { ramType: 'DDR5' }
  };

  function slugify(str) {
    return String(str || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function parseCpu(cpuText) {
    const text = (cpuText || '').toLowerCase();
    const x3d = /x3d/.test(text);
    const ryzenMatch = text.match(/ryzen\s*(\d)/);
    const ultraMatch = /core\s*ultra/.test(text);
    const intelMatch = text.match(/core\s*i(\d)/);

    if (ryzenMatch) {
      return { brand: 'AMD', familyKey: 'amd:ryzen-' + ryzenMatch[1], familyLabel: 'Ryzen ' + ryzenMatch[1], x3d };
    }
    if (ultraMatch) {
      return { brand: 'Intel', familyKey: 'intel:core-ultra', familyLabel: 'Core Ultra', x3d };
    }
    if (intelMatch) {
      return { brand: 'Intel', familyKey: 'intel:core-i' + intelMatch[1], familyLabel: 'Core i' + intelMatch[1], x3d };
    }
    return { brand: null, familyKey: null, familyLabel: null, x3d };
  }

  function parseGpu(gpuText) {
    const raw = gpuText || '';
    const used = /б\s*\/?\s*в/i.test(raw);
    // Fixes the one known typo in the catalog: "RT3070Ti" is missing the X.
    const fixed = raw.replace(/\brt(\d)/gi, 'rtx$1');
    const m = fixed.match(/r(tx|x)\s*-?\s*(\d{3,4})\s*(ti|xt)?/i);
    if (!m) return { brand: null, modelKey: null, modelLabel: null, vram: null, used };

    const isNvidia = m[1].toLowerCase() === 'tx';
    const brand = isNvidia ? 'NVIDIA' : 'AMD';
    const prefix = isNvidia ? 'RTX' : 'RX';
    const num = m[2];
    const suffixRaw = m[3] ? m[3].toUpperCase() : '';
    const suffixLabel = suffixRaw === 'TI' ? 'Ti' : suffixRaw;
    const modelLabel = prefix + ' ' + num + (suffixLabel ? ' ' + suffixLabel : '');
    const modelKey = slugify(modelLabel);

    const vramMatch = fixed.match(/(\d{1,2})\s*gb/i);
    const vram = vramMatch ? Number(vramMatch[1]) : (GPU_VRAM_FALLBACK[modelKey] || null);

    return { brand, modelKey, modelLabel, vram, used };
  }

  function parseRam(ramText) {
    const text = ramText || '';
    const typeMatch = text.match(/ddr(\d)/i);
    const sizeMatch = text.match(/(\d{2,3})\s*gb/i);
    return {
      type: typeMatch ? 'DDR' + typeMatch[1] : null,
      size: sizeMatch ? Number(sizeMatch[1]) : null
    };
  }

  function parseStorageSize(storageText) {
    const m = (storageText || '').match(/(\d+(?:\.\d+)?)\s*(gb|tb)/i);
    if (!m) return null;
    const value = parseFloat(m[1]);
    return Math.round(m[2].toLowerCase() === 'tb' ? value * 1024 : value);
  }

  function parseSeries(title) {
    const m = (title || '').match(/Digital PC (Base|Solid|Midline|Esport|Apex)\b/i);
    if (!m) return null;
    const s = m[1].toLowerCase();
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // Computes (and caches on the product) the structured filter fields,
  // derived once from the free-text `specs` the admin already fills in.
  function getComputerFilterFields(p) {
    if (p._f) return p._f;
    const specs = p.specs || {};
    const cpu = parseCpu(specs.cpu);
    const gpu = parseGpu(specs.gpu);
    const ram = parseRam(specs.ram);
    const override = SPEC_OVERRIDES[p.id] || {};
    const isTradeIn = p.id === 'Digital-PC-Traid-In' || /trade\s*in/i.test(p.title || '');

    const f = {
      series: isTradeIn ? null : parseSeries(p.title),
      condition: isTradeIn ? 'used' : 'new',
      cpuBrand: cpu.brand,
      cpuFamilyKey: cpu.familyKey,
      cpuFamilyLabel: cpu.familyLabel,
      cpuX3D: cpu.x3d,
      gpuBrand: gpu.brand,
      gpuModelKey: gpu.modelKey,
      gpuModelLabel: gpu.modelLabel,
      gpuUsed: gpu.used,
      vram: gpu.vram,
      ramType: override.ramType || ram.type,
      ramSize: ram.size,
      storageSize: parseStorageSize(specs.storage),
      price: Number(p.price) || 0
    };
    p._f = f;
    return f;
  }

  // One matcher per filter group — AND across groups, OR within a group.
  // Excluding a group (for its own facet counts) just skips its matcher.
  const COMPUTER_FILTER_GROUPS = {
    series: (p, f) => !f.series.length || f.series.includes(getComputerFilterFields(p).series),
    condition: (p, f) => !f.condition.length || f.condition.includes(getComputerFilterFields(p).condition),
    cpuFamily: (p, f) => !f.cpuFamily.length || f.cpuFamily.includes(getComputerFilterFields(p).cpuFamilyKey),
    cpuX3D: (p, f) => !f.cpuX3D || getComputerFilterFields(p).cpuX3D === true,
    gpuModel: (p, f) => !f.gpuModel.length || f.gpuModel.includes(getComputerFilterFields(p).gpuModelKey),
    vram: (p, f) => {
      if (!f.vram.length) return true;
      const v = getComputerFilterFields(p).vram;
      if (v === null) return false;
      return f.vram.some(key => (VRAM_BUCKETS.find(b => b.key === key) || {}).test(v));
    },
    ramType: (p, f) => !f.ramType.length || f.ramType.includes(getComputerFilterFields(p).ramType),
    ramSize: (p, f) => !f.ramSize.length || f.ramSize.includes(String(getComputerFilterFields(p).ramSize)),
    storage: (p, f) => {
      if (!f.storage.length) return true;
      const v = getComputerFilterFields(p).storageSize;
      if (v === null) return false;
      return f.storage.some(key => (STORAGE_BUCKETS.find(b => b.key === key) || {}).test(v));
    },
    price: (p, f) => {
      const price = Number(p.price) || 0;
      if (f.priceMin != null && price < f.priceMin) return false;
      if (f.priceMax != null && price > f.priceMax) return false;
      return true;
    }
  };

  function applyComputerFilterGroups(products, filters, excludeGroup) {
    return products.filter(p => {
      for (const key in COMPUTER_FILTER_GROUPS) {
        if (key === excludeGroup) continue;
        if (!COMPUTER_FILTER_GROUPS[key](p, filters)) return false;
      }
      return true;
    });
  }

  function computerPriceBoundsFrom(products) {
    const prices = products.map(p => Number(p.price) || 0);
    if (!prices.length) return { min: 0, max: 0 };
    return { min: Math.min(...prices), max: Math.max(...prices) };
  }

  function checkboxRow(name, value, label) {
    return `
      <label class="flex items-center justify-between gap-2 cursor-pointer p-2 rounded transition-colors dpc-filter-label" data-filter-option data-group="${name}" data-value="${value}">
        <span class="flex items-center">
          <input type="checkbox" class="filter-checkbox form-checkbox rounded" name="${name}" value="${value}">
          <span class="ml-2 text-sm font-medium">${label}</span>
        </span>
        <span class="text-xs dpc-muted-text" data-count>(0)</span>
      </label>`;
  }

  function filterGroupWrap(heading, innerHTML, open) {
    return `
      <details class="dpc-filter-group" ${open ? 'open' : ''}>
        <summary class="font-bold dpc-filter-heading cursor-pointer">${heading}</summary>
        <div class="space-y-1 mt-2">${innerHTML}</div>
      </details>`;
  }

  function renderComputerFilters(data) {
    const container = document.getElementById('filters-sidebar-inner');
    if (!container) return;

    const computers = data.filter(p => !p.type || p.type === 'computers');
    computers.forEach(getComputerFilterFields); // populate the _f cache

    computerPriceBounds = computerPriceBoundsFrom(computers);

    const gpuByBrand = {};
    computers.forEach(p => {
      const f = p._f;
      if (!f.gpuModelKey) return;
      if (!gpuByBrand[f.gpuBrand]) gpuByBrand[f.gpuBrand] = {};
      gpuByBrand[f.gpuBrand][f.gpuModelKey] = f.gpuModelLabel;
    });

    const priceHTML = `
      <details class="dpc-filter-group" open>
        <summary class="font-bold dpc-filter-heading cursor-pointer">Ціна, ₴</summary>
        <div class="mt-3 space-y-3">
          <div class="dpc-price-slider-track">
            <input type="range" class="dpc-price-range dpc-price-range-min" min="${computerPriceBounds.min}" max="${computerPriceBounds.max}" value="${computerPriceBounds.min}" step="500" aria-label="Ціна від">
            <input type="range" class="dpc-price-range dpc-price-range-max" min="${computerPriceBounds.min}" max="${computerPriceBounds.max}" value="${computerPriceBounds.max}" step="500" aria-label="Ціна до">
          </div>
          <div class="flex items-center gap-2">
            <input type="number" class="dpc-select dpc-price-input dpc-price-input-min w-full rounded-md py-1.5 px-2 text-sm" min="${computerPriceBounds.min}" max="${computerPriceBounds.max}" value="${computerPriceBounds.min}" aria-label="Ціна від, грн">
            <span class="dpc-muted-text">—</span>
            <input type="number" class="dpc-select dpc-price-input dpc-price-input-max w-full rounded-md py-1.5 px-2 text-sm" min="${computerPriceBounds.min}" max="${computerPriceBounds.max}" value="${computerPriceBounds.max}" aria-label="Ціна до, грн">
          </div>
        </div>
      </details>`;

    const seriesHTML = filterGroupWrap('Лінійка',
      SERIES_TAXONOMY.map(s => checkboxRow('series', s, s)).join(''), true);

    const conditionHTML = filterGroupWrap('Стан', [
      checkboxRow('condition', 'new', 'Нові'),
      checkboxRow('condition', 'used', 'Б/в (Trade IN)')
    ].join(''), false);

    const cpuHTML = filterGroupWrap('Процесор',
      CPU_TAXONOMY.map(group => `
        <div class="mb-2">
          <div class="text-xs font-bold uppercase tracking-wide dpc-muted-text mb-1">${group.brand}</div>
          ${group.families.map(fam => checkboxRow('cpuFamily', fam.key, fam.label)).join('')}
        </div>
      `).join('') + `
        <div class="mt-2 pt-2" style="border-top:1px solid var(--glass-border)">
          ${checkboxRow('cpuX3D', '1', "з 3D V-Cache (X3D)")}
        </div>
      `, false);

    const gpuGroupsHTML = Object.keys(gpuByBrand).sort().map(brand => `
        <div class="mb-2">
          <div class="text-xs font-bold uppercase tracking-wide dpc-muted-text mb-1">${brand}</div>
          ${Object.keys(gpuByBrand[brand]).sort().map(key => checkboxRow('gpuModel', key, gpuByBrand[brand][key])).join('')}
        </div>
      `).join('');
    const gpuHTML = filterGroupWrap('Відеокарта',
      gpuGroupsHTML || '<p class="text-sm italic dpc-muted-text">Немає варіантів</p>', false);

    const vramHTML = filterGroupWrap("Відеопам'ять",
      VRAM_BUCKETS.map(b => checkboxRow('vram', b.key, b.label)).join(''), false);

    const ramHTML = filterGroupWrap('ОЗУ', `
        <div class="text-xs font-bold uppercase tracking-wide dpc-muted-text mb-1">Тип</div>
        ${RAM_TYPE_TAXONOMY.map(t => checkboxRow('ramType', t, t)).join('')}
        <div class="text-xs font-bold uppercase tracking-wide dpc-muted-text mb-1 mt-2">Об'єм</div>
        ${RAM_SIZE_TAXONOMY.map(s => checkboxRow('ramSize', String(s), s + ' ГБ')).join('')}
      `, false);

    const storageHTML = filterGroupWrap('Накопичувач',
      STORAGE_BUCKETS.map(b => checkboxRow('storage', b.key, b.label)).join(''), false);

    container.innerHTML = [priceHTML, seriesHTML, conditionHTML, cpuHTML, gpuHTML, vramHTML, ramHTML, storageHTML].join('') + `
      <button onclick="window.resetFilters()" class="w-full py-2 px-4 rounded-lg transition-colors dpc-reset-btn">
        Скинути фільтри
      </button>`;

    bindComputerFilterEvents(container);
    updateComputerFilterCounts();
    if (window.feather) feather.replace();
  }

  // Reusable across the desktop sidebar and the mobile sheet (which clones
  // the sidebar's markup) — see openMobileFilters() in computers.html.
  function bindComputerFilterEvents(scope) {
    const isMobileScope = scope.id === 'mobile-filters-content';
    scope.querySelectorAll('.filter-checkbox').forEach(cb => {
      cb.addEventListener('change', function () {
        if (isMobileScope) mirrorCheckboxToSidebar(cb.name, cb.value, cb.checked);
        window.applyFilters();
      });
    });
    scope.querySelectorAll('.dpc-price-input').forEach(inp => {
      inp.addEventListener('change', onPriceInputChange);
    });
    scope.querySelectorAll('.dpc-price-range').forEach(range => {
      range.addEventListener('input', onPriceRangeInput);
      range.addEventListener('change', window.applyFilters);
    });
  }
  window.bindComputerFilterEvents = bindComputerFilterEvents;

  function mirrorCheckboxToSidebar(name, value, checked) {
    const safeValue = value.replace(/"/g, '\\"');
    const target = document.querySelector('#filters-sidebar-inner input[name="' + name + '"][value="' + safeValue + '"]');
    if (target) target.checked = checked;
  }

  function getFilterRoot(el) {
    return el.closest('#filters-sidebar-inner, #mobile-filters-content') || document;
  }

  function syncPriceControlsEverywhere(minV, maxV) {
    document.querySelectorAll('.dpc-price-input-min, .dpc-price-range-min').forEach(el => { el.value = minV; });
    document.querySelectorAll('.dpc-price-input-max, .dpc-price-range-max').forEach(el => { el.value = maxV; });
  }

  function onPriceRangeInput(e) {
    const root = getFilterRoot(e.target);
    let minV = Number(root.querySelector('.dpc-price-range-min').value);
    let maxV = Number(root.querySelector('.dpc-price-range-max').value);
    if (minV > maxV) {
      if (e.target.classList.contains('dpc-price-range-min')) minV = maxV; else maxV = minV;
    }
    syncPriceControlsEverywhere(minV, maxV);
  }

  function onPriceInputChange(e) {
    const root = getFilterRoot(e.target);
    let minV = Number(root.querySelector('.dpc-price-input-min').value);
    let maxV = Number(root.querySelector('.dpc-price-input-max').value);
    if (Number.isNaN(minV)) minV = computerPriceBounds.min;
    if (Number.isNaN(maxV)) maxV = computerPriceBounds.max;
    minV = Math.max(computerPriceBounds.min, Math.min(minV, computerPriceBounds.max));
    maxV = Math.max(computerPriceBounds.min, Math.min(maxV, computerPriceBounds.max));
    if (minV > maxV) { const t = minV; minV = maxV; maxV = t; }
    syncPriceControlsEverywhere(minV, maxV);
    window.applyFilters();
  }

  // Updates the (count) next to each option and greys out zero-result
  // options, without rebuilding the DOM (keeps checked state, <details>
  // open/closed state, and scroll position intact across every filter tick).
  function updateComputerFilterCounts() {
    const computers = allProductsData.filter(p => !p.type || p.type === 'computers');

    document.querySelectorAll('#filters-sidebar-inner, #mobile-filters-content').forEach(root => {
      root.querySelectorAll('[data-filter-option]').forEach(optionEl => {
        const group = optionEl.getAttribute('data-group');
        const value = optionEl.getAttribute('data-value');
        const scoped = applyComputerFilterGroups(computers, activeFilters, group);

        const count = scoped.filter(p => {
          const fields = getComputerFilterFields(p);
          switch (group) {
            case 'series': return fields.series === value;
            case 'condition': return fields.condition === value;
            case 'cpuFamily': return fields.cpuFamilyKey === value;
            case 'cpuX3D': return fields.cpuX3D === true;
            case 'gpuModel': return fields.gpuModelKey === value;
            case 'vram': {
              const bucket = VRAM_BUCKETS.find(b => b.key === value);
              return !!bucket && fields.vram !== null && bucket.test(fields.vram);
            }
            case 'ramType': return fields.ramType === value;
            case 'ramSize': return String(fields.ramSize) === value;
            case 'storage': {
              const bucket = STORAGE_BUCKETS.find(b => b.key === value);
              return !!bucket && fields.storageSize !== null && bucket.test(fields.storageSize);
            }
            default: return false;
          }
        }).length;

        const countEl = optionEl.querySelector('[data-count]');
        if (countEl) countEl.textContent = '(' + count + ')';
        const input = optionEl.querySelector('input');
        if (input) {
          const isChecked = input.checked;
          optionEl.classList.toggle('dpc-filter-option-zero', count === 0 && !isChecked);
          input.disabled = count === 0 && !isChecked;
        }
      });
    });
  }

  const FILTER_GROUP_LABELS = {
    series: 'Лінійка', condition: 'Стан', cpuFamily: 'Процесор',
    gpuModel: 'Відеокарта', vram: "Відеопам'ять", ramType: 'ОЗУ', ramSize: 'ОЗУ', storage: 'Накопичувач'
  };

  function findOptionLabel(group, value) {
    const safeValue = String(value).replace(/"/g, '\\"');
    const el = document.querySelector('#filters-sidebar-inner [data-group="' + group + '"][data-value="' + safeValue + '"] .font-medium');
    return el ? el.textContent : value;
  }

  // Active-filter chips above the grid + "Знайдено: N" count. Each chip
  // removes just that one filter; "Скинути все" clears everything.
  function renderActiveFilterChips() {
    const container = document.getElementById('filter-chips');
    if (!container || currentCategory !== 'computers') return;

    const chips = [];
    ['series', 'condition', 'cpuFamily', 'gpuModel', 'vram', 'ramType', 'ramSize', 'storage'].forEach(group => {
      (activeFilters[group] || []).forEach(value => {
        chips.push({ group, value, label: FILTER_GROUP_LABELS[group] + ': ' + findOptionLabel(group, value) });
      });
    });
    if (activeFilters.cpuX3D) chips.push({ group: 'cpuX3D', value: '1', label: 'Процесор: з 3D V-Cache' });
    if (activeFilters.priceMin != null || activeFilters.priceMax != null) {
      const min = activeFilters.priceMin != null ? activeFilters.priceMin : computerPriceBounds.min;
      const max = activeFilters.priceMax != null ? activeFilters.priceMax : computerPriceBounds.max;
      chips.push({ group: 'price', value: 'price', label: 'Ціна: ' + money(min) + ' – ' + money(max) });
    }

    const resultCount = getFilteredAndSortedData().length;

    if (!chips.length) {
      container.innerHTML = `<div class="text-sm dpc-muted-text">Знайдено: ${resultCount}</div>`;
      return;
    }

    container.innerHTML = `
      <div class="flex flex-wrap items-center gap-2 mb-2">
        ${chips.map(c => `
          <button type="button" class="dpc-active-filter-chip" data-remove-group="${c.group}" data-remove-value="${c.value}">
            ${c.label}
            <i data-feather="x" class="w-3 h-3"></i>
          </button>
        `).join('')}
        <button type="button" onclick="window.resetFilters()" class="dpc-reset-btn px-3 py-1.5 rounded-full text-xs">Скинути все</button>
      </div>
      <div class="text-sm dpc-muted-text">Знайдено: ${resultCount}</div>`;

    container.querySelectorAll('[data-remove-group]').forEach(btn => {
      btn.addEventListener('click', function () {
        removeActiveFilter(btn.getAttribute('data-remove-group'), btn.getAttribute('data-remove-value'));
      });
    });
    if (window.feather) feather.replace();
  }

  function removeActiveFilter(group, value) {
    if (group === 'cpuX3D') {
      document.querySelectorAll('#filters-sidebar-inner input[name="cpuX3D"]').forEach(cb => { cb.checked = false; });
    } else if (group === 'price') {
      syncPriceControlsEverywhere(computerPriceBounds.min, computerPriceBounds.max);
    } else {
      const safeValue = String(value).replace(/"/g, '\\"');
      document.querySelectorAll('#filters-sidebar-inner input[name="' + group + '"][value="' + safeValue + '"]').forEach(cb => { cb.checked = false; });
    }
    window.applyFilters();
  }

  // --- URL STATE (shareable filter links, e.g. ?series=esport&gpu=rtx-5070-ti&price_max=80000) ---
  const VRAM_URL_MAP = { '8': '8', '12': '12', '16+': '16plus' };
  const VRAM_URL_MAP_REV = { '8': '8', '12': '12', '16plus': '16+' };

  function cpuKeyToParam(key) { return key.replace(':', '-'); }
  function paramToCpuKey(token) {
    const i = token.indexOf('-');
    return i === -1 ? token : token.slice(0, i) + ':' + token.slice(i + 1);
  }

  function syncURLFromState() {
    if (currentCategory !== 'computers' || !window.history) return;
    const params = new URLSearchParams();

    if (activeFilters.series.length) params.set('series', activeFilters.series.map(s => s.toLowerCase()).join(','));
    if (activeFilters.condition.length) params.set('condition', activeFilters.condition.join(','));
    if (activeFilters.cpuFamily.length) params.set('cpu', activeFilters.cpuFamily.map(cpuKeyToParam).join(','));
    if (activeFilters.cpuX3D) params.set('x3d', '1');
    if (activeFilters.gpuModel.length) params.set('gpu', activeFilters.gpuModel.join(','));
    if (activeFilters.vram.length) params.set('vram', activeFilters.vram.map(v => VRAM_URL_MAP[v] || v).join(','));
    if (activeFilters.ramType.length) params.set('ram_type', activeFilters.ramType.map(t => t.toLowerCase()).join(','));
    if (activeFilters.ramSize.length) params.set('ram_size', activeFilters.ramSize.join(','));
    if (activeFilters.storage.length) params.set('storage', activeFilters.storage.join(','));
    if (activeFilters.priceMin != null) params.set('price_min', activeFilters.priceMin);
    if (activeFilters.priceMax != null) params.set('price_max', activeFilters.priceMax);
    if (currentSort && currentSort !== 'default') params.set('sort', currentSort);

    const qs = params.toString();
    const newUrl = window.location.pathname + (qs ? '?' + qs : '') + window.location.hash;
    window.history.replaceState(null, '', newUrl);
  }

  function loadStateFromURL() {
    if (currentCategory !== 'computers' || !window.location.search) return;
    const params = new URLSearchParams(window.location.search);
    const root = document.getElementById('filters-sidebar-inner');
    if (!root) return;

    const checkValues = (name, values, transform) => {
      values.forEach(v => {
        const val = transform ? transform(v) : v;
        const safeVal = String(val).replace(/"/g, '\\"');
        const cb = root.querySelector('input[name="' + name + '"][value="' + safeVal + '"]');
        if (cb) cb.checked = true;
      });
    };

    if (params.get('series')) checkValues('series', params.get('series').split(','), s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase());
    if (params.get('condition')) checkValues('condition', params.get('condition').split(','));
    if (params.get('cpu')) checkValues('cpuFamily', params.get('cpu').split(','), paramToCpuKey);
    if (params.get('x3d') === '1') {
      const cb = root.querySelector('input[name="cpuX3D"]');
      if (cb) cb.checked = true;
    }
    if (params.get('gpu')) checkValues('gpuModel', params.get('gpu').split(','));
    if (params.get('vram')) checkValues('vram', params.get('vram').split(','), v => VRAM_URL_MAP_REV[v] || v);
    if (params.get('ram_type')) checkValues('ramType', params.get('ram_type').split(','), t => t.toUpperCase());
    if (params.get('ram_size')) checkValues('ramSize', params.get('ram_size').split(','));
    if (params.get('storage')) checkValues('storage', params.get('storage').split(','));

    const priceMin = params.get('price_min');
    const priceMax = params.get('price_max');
    if (priceMin || priceMax) {
      syncPriceControlsEverywhere(
        priceMin ? Number(priceMin) : computerPriceBounds.min,
        priceMax ? Number(priceMax) : computerPriceBounds.max
      );
    }

    const sortParam = params.get('sort');
    if (sortParam) {
      const sortEl = document.getElementById('sort-select');
      if (sortEl) sortEl.value = sortParam;
    }

    window.applyFilters();
  }

  function generatePeripheryFilters(data) {
    // Defines periphery subtypes
    const subtypes = {
      'Клавіатури': false,
      'Миші': false,
      'Навушники': false,
      'Ігрові килимки': false
    };

    // Filter data to only periphery products
    const periphery = data.filter(p => p.type === 'periphery');

    periphery.forEach(p => {
      if (subtypes.hasOwnProperty(p.subtype)) {
        subtypes[p.subtype] = true;
      }
    });

    const container = document.getElementById('filter-periphery-type');
    if (!container) return;

    let items = Object.keys(subtypes).filter(k => subtypes[k]);

    if (items.length === 0) {
      container.innerHTML = '<p class="text-sm italic dpc-muted-text">Немає варіантів</p>';
      return;
    }

    container.innerHTML = items.map(item => `
      <label class="flex items-center cursor-pointer p-2 rounded transition-colors dpc-filter-label">
          <input type="checkbox" class="filter-checkbox form-checkbox rounded" name="periphery-type" value="${item}">
          <span class="ml-2 text-sm font-medium">${item}</span>
      </label>
      `).join('');

    // Re-attach listeners
    document.querySelectorAll('.filter-checkbox').forEach(cb => {
      cb.addEventListener('change', window.applyFilters);
    });
  }

  function getFilteredAndSortedData() {
    let result = [...allProductsData];

    // Filter by category (handle backward compatibility for products without type field)
    if (currentCategory === 'computers') {
      result = result.filter(p => !p.type || p.type === 'computers');
      result = applyComputerFilterGroups(result, activeFilters, null);
    } else if (currentCategory === 'periphery') {
      result = result.filter(p => p.type === 'periphery');
      if (activeFilters.peripheryType.length > 0) {
        result = result.filter(p => activeFilters.peripheryType.includes(p.subtype));
      }
    }

    // Sort
    if (currentSort === 'price_asc') {
      result.sort((a, b) => a.price - b.price);
    } else if (currentSort === 'price_desc') {
      result.sort((a, b) => b.price - a.price);
    }

    return result;
  }

  window.applyFilters = function () {
    if (currentCategory === 'computers') {
      const root = document.getElementById('filters-sidebar-inner') || document;
      activeFilters.series = Array.from(root.querySelectorAll('input[name="series"]:checked')).map(cb => cb.value);
      activeFilters.condition = Array.from(root.querySelectorAll('input[name="condition"]:checked')).map(cb => cb.value);
      activeFilters.cpuFamily = Array.from(root.querySelectorAll('input[name="cpuFamily"]:checked')).map(cb => cb.value);
      activeFilters.cpuX3D = !!root.querySelector('input[name="cpuX3D"]:checked');
      activeFilters.gpuModel = Array.from(root.querySelectorAll('input[name="gpuModel"]:checked')).map(cb => cb.value);
      activeFilters.vram = Array.from(root.querySelectorAll('input[name="vram"]:checked')).map(cb => cb.value);
      activeFilters.ramType = Array.from(root.querySelectorAll('input[name="ramType"]:checked')).map(cb => cb.value);
      activeFilters.ramSize = Array.from(root.querySelectorAll('input[name="ramSize"]:checked')).map(cb => cb.value);
      activeFilters.storage = Array.from(root.querySelectorAll('input[name="storage"]:checked')).map(cb => cb.value);

      const minInput = root.querySelector('.dpc-price-input-min');
      const maxInput = root.querySelector('.dpc-price-input-max');
      const minV = minInput ? Number(minInput.value) : computerPriceBounds.min;
      const maxV = maxInput ? Number(maxInput.value) : computerPriceBounds.max;
      activeFilters.priceMin = minV > computerPriceBounds.min ? minV : null;
      activeFilters.priceMax = maxV < computerPriceBounds.max ? maxV : null;
    } else {
      activeFilters.peripheryType = Array.from(document.querySelectorAll('input[name="periphery-type"]:checked')).map(cb => cb.value);
    }

    const sortEl = document.getElementById('sort-select');
    if (sortEl) currentSort = sortEl.value;

    currentPage = 1;
    renderApp();

    if (currentCategory === 'computers') {
      updateComputerFilterCounts();
      renderActiveFilterChips();
      syncURLFromState();
    }

    // Scroll to top of catalog (optional)
    const cat = document.getElementById('catalog');
    if (cat) cat.scrollIntoView({ behavior: 'smooth' });
  };

  window.resetFilters = function () {
    document.querySelectorAll('.filter-checkbox').forEach(cb => cb.checked = false);
    document.querySelectorAll('.dpc-price-input-min, .dpc-price-range-min').forEach(el => { el.value = computerPriceBounds.min; });
    document.querySelectorAll('.dpc-price-input-max, .dpc-price-range-max').forEach(el => { el.value = computerPriceBounds.max; });
    const sortEl = document.getElementById('sort-select');
    if (sortEl) sortEl.value = 'default';
    activeFilters = {
      series: [], condition: [], cpuFamily: [], cpuX3D: false, gpuModel: [], vram: [],
      ramType: [], ramSize: [], storage: [], priceMin: null, priceMax: null,
      peripheryType: []
    };
    currentSort = 'default';
    window.applyFilters();
  };

  // --- EVENTS ---
  window.changePage = function (newPage) {
    currentPage = newPage;
    renderCatalogWithPagination(getFilteredAndSortedData(), currentPage);
    const catSection = document.getElementById("catalog");
    if (catSection) {
      const y = catSection.getBoundingClientRect().top + window.scrollY - 100;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  // --- LEAD FORM MODAL ---
  function createLeadFormModal() {
    if (document.getElementById("lead-form-modal")) return;

    const modalHTML = `
      <div id="lead-form-modal" class="hidden fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="dpc-lead-modal-panel max-w-md w-full p-8 relative transform transition-all">
          <button onclick="window.closeLeadForm()" class="dpc-lead-modal-close" aria-label="Закрити">
            <i data-feather="x" class="w-5 h-5"></i>
          </button>

          <div class="mb-6">
            <h2 class="text-2xl font-bold dpc-text-primary mb-2">Зв'яжіться з нами</h2>
            <p class="dpc-muted-text">Оберіть зручний спосіб зв'язку</p>
          </div>

          <!-- Quick Contact Buttons -->
          <div class="grid grid-cols-2 gap-3 mb-6">
            <a href="tel:${PHONE_NUMBER}"
              title="${PHONE_DISPLAY}"
              class="dpc-btn-order flex items-center justify-center font-bold py-3 px-4 rounded-lg transition-all group relative">
              <i data-feather="phone" class="w-5 h-5 mr-2"></i>
              Зателефонувати
              <span class="dpc-lead-tooltip hidden md:group-hover:block">
                ${PHONE_DISPLAY}
              </span>
            </a>
            <a href="${TELEGRAM_URL}" target="_blank"
              class="dpc-lead-telegram-btn flex items-center justify-center font-bold py-3 px-4 rounded-lg transition-all">
              <i data-feather="send" class="w-5 h-5 mr-2"></i>
              Telegram
            </a>
          </div>

          <div class="dpc-lead-divider">
            <span>або залиште заявку</span>
          </div>

          <form id="lead-form" class="space-y-4">
            <div class="dpc-form-field">
              <label for="lead-name">Ім'я *</label>
              <input type="text" id="lead-name" name="name" required placeholder="Ваше ім'я">
            </div>

            <div class="dpc-form-field">
              <label for="lead-phone">Телефон *</label>
              <input type="tel" id="lead-phone" name="phone" required placeholder="+380 XX XXX XX XX">
            </div>

            <div class="dpc-form-field">
              <label for="lead-message">Повідомлення (опціонально)</label>
              <textarea id="lead-message" name="message" rows="3" placeholder="Додаткова інформація або питання"></textarea>
            </div>

            <input type="hidden" id="lead-product" name="product" value="">

            <div class="flex gap-3 mt-6">
              <button type="submit"
                class="dpc-btn-order flex-1 font-bold py-3 px-6 rounded-lg transition-all transform hover:-translate-y-0.5">
                Відправити
              </button>
              <button type="button" onclick="window.closeLeadForm()"
                class="dpc-btn-outline px-6 py-3 rounded-lg transition-all">
                Скасувати
              </button>
            </div>
          </form>

          <div id="form-success" class="dpc-checkout-message dpc-checkout-message--success hidden mt-4">
            <p>✓ Дякуємо! Ми зв'яжемося з вами найближчим часом.</p>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    if (window.feather) feather.replace();

    // Phone validation function
    function validatePhone(phone) {
      const cleaned = phone.replace(/\s+/g, '');
      return /^\+380\d{9}$/.test(cleaned);
    }

    // Telegram send function — relays through the server-side
    // /api/telegram-notify endpoint (server.js) so the bot token stays out
    // of frontend code. Message format is unchanged from before.
    async function sendToTelegram(formData) {
      const text = `Нова заявка з сайту Digital PC!\n` +
        `==========================\n` +
        `👤 Ім'я: ${formData.name}\n` +
        `📱 Телефон: ${formData.phone}\n` +
        `💬 Повідомлення: ${formData.message || 'Немає'}\n` +
        `🖥 Товар: ${formData.product || 'Без товару'}\n` +
        `⏰ Час: ${new Date().toLocaleString('uk-UA')}`;

      const res = await fetch('/api/telegram-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      const data = await res.json().catch(() => ({ ok: false }));
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Telegram send failed');
      }
      return data;
    }

    // Form submission handler
    const form = document.getElementById('lead-form');
    const formError = document.createElement('div');
    formError.id = 'form-error';
    formError.className = 'dpc-checkout-message dpc-checkout-message--error hidden mt-4';
    formError.innerHTML = '<p></p>';
    form.parentNode.insertBefore(formError, document.getElementById('form-success'));

    if (form) {
      form.addEventListener('submit', async function (e) {
        e.preventDefault();

        const formData = {
          name: document.getElementById('lead-name').value.trim(),
          phone: document.getElementById('lead-phone').value.trim(),
          message: document.getElementById('lead-message').value.trim(),
          product: document.getElementById('lead-product').value
        };

        // Hide previous messages
        document.getElementById('form-error').classList.add('hidden');
        document.getElementById('form-success').classList.add('hidden');

        // Validate phone number
        if (!validatePhone(formData.phone)) {
          document.getElementById('form-error').querySelector('p').textContent =
            'Будь ласка, введіть коректний номер телефону у форматі +380XXXXXXXXX';
          document.getElementById('form-error').classList.remove('hidden');
          return;
        }

        // Disable submit button during processing
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Відправка...';

        try {
          // Send to Telegram
          await sendToTelegram(formData);

          console.log('Lead form submitted successfully:', formData);

          // Show success message
          form.classList.add('hidden');
          document.getElementById('form-success').classList.remove('hidden');

          // Reset and close after 2 seconds
          setTimeout(() => {
            window.closeLeadForm();
            form.reset();
            form.classList.remove('hidden');
            document.getElementById('form-success').classList.add('hidden');
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
          }, 2000);

        } catch (error) {
          console.error('Telegram send error:', error);

          // Show error message
          document.getElementById('form-error').querySelector('p').textContent =
            'Помилка відправки. Спробуйте ще раз або зателефонуйте нам безпосередньо.';
          document.getElementById('form-error').classList.remove('hidden');

          // Re-enable submit button
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        }
      });
    }
  }

  window.openLeadForm = function (productTitle = '') {
    createLeadFormModal();
    const modal = document.getElementById("lead-form-modal");
    const productInput = document.getElementById("lead-product");
    if (productInput && productTitle) {
      productInput.value = productTitle;
    }
    if (modal) modal.classList.remove('hidden');
  };

  window.closeLeadForm = function () {
    const modal = document.getElementById("lead-form-modal");
    if (modal) modal.classList.add('hidden');
  };

  // Legacy support - redirect old modal calls to new lead form
  window.openOrderModal = function (productTitle = '') {
    window.openLeadForm(productTitle);
  };

  window.closeModal = function () {
    window.closeLeadForm();
  };

  // --- INITIALIZATION ---
  async function init() {
    // Initialize mobile menu immediately
    initMobileMenu();
    initTelegramFab();

    // Detect current page and set category
    const currentPage = window.location.pathname.split('/').pop() || 'computers.html';
    if (currentPage.includes('periphery')) {
      currentCategory = 'periphery';
    } else {
      currentCategory = 'computers';
    }

    try {
      allProductsData = await window.DPCProducts.load();

      // Initial Render
      handleHashChange();

      // Generate Filters (self-attaches its own change listeners)
      generateFilters(allProductsData);

      // A shared filter link (?series=esport&gpu=rtx-5070-ti&price_max=80000)
      // applies on load and re-renders the catalog accordingly.
      if (currentCategory === 'computers') {
        loadStateFromURL();
        renderActiveFilterChips();
      }

    } catch (e) {
      console.error(e);
    }
  }

  // --- FLOATING TELEGRAM BUTTON ---
  function initTelegramFab() {
    if (document.querySelector('.dpc-telegram-fab')) return;

    const fab = document.createElement('a');
    fab.className = 'dpc-telegram-fab';
    fab.href = TELEGRAM_URL;
    fab.target = '_blank';
    fab.rel = 'noopener noreferrer';
    fab.setAttribute('aria-label', 'Написати нам у Telegram');
    fab.title = 'Написати нам у Telegram';
    fab.innerHTML = '<svg viewBox="0 0 448 512" aria-hidden="true" focusable="false"><path fill="#fff" d="M446.7 98.6l-67.6 318.8c-5.1 22.5-18.4 28.1-37.3 17.5l-103-75.9-49.7 47.8c-5.5 5.5-10.1 10.1-20.7 10.1l7.4-104.9 190.9-172.5c8.3-7.4-1.8-11.5-12.8-4.1L117.8 285 15.5 253.1c-22.2-6.9-22.6-22.2 4.6-32.9L418.2 66.4c18.5-6.9 34.7 4.1 28.5 32.2z"/></svg>';

    fab.addEventListener('click', function () {
      if (typeof window.gtag === 'function') {
        window.gtag('event', 'telegram_click');
      }
    });

    document.body.appendChild(fab);
  }

  // --- MOBILE MENU ---
  function initMobileMenu() {
    const mobBtn = document.getElementById('mobile-menu-button');
    const mobileMenu = document.getElementById('mobile-menu');

    if (mobBtn && mobileMenu) {
      // Toggle menu on button click
      mobBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        const isHidden = mobileMenu.classList.contains('hidden');
        mobileMenu.classList.toggle('hidden');
        console.log('Mobile menu toggled:', isHidden ? 'opening' : 'closing');
        if (window.feather) feather.replace();
      });

      // Close menu when clicking on any link inside it
      const menuLinks = mobileMenu.querySelectorAll('a');
      menuLinks.forEach(link => {
        link.addEventListener('click', function () {
          mobileMenu.classList.add('hidden');
          console.log('Mobile menu closed via link click');
        });
      });

      // Close menu when clicking outside
      document.addEventListener('click', function (e) {
        if (!mobileMenu.classList.contains('hidden') &&
          !mobileMenu.contains(e.target) &&
          !mobBtn.contains(e.target)) {
          mobileMenu.classList.add('hidden');
          console.log('Mobile menu closed via outside click');
        }
      });
    } else {
      console.warn('Mobile menu elements not found:', { mobBtn: !!mobBtn, mobileMenu: !!mobileMenu });
    }
  }

  // --- MODAL ---
  function createModal() {
    if (document.getElementById("order-modal")) return;
    const modalHtml = `
      <div id="order-modal" class="fixed inset-0 z-[100] hidden overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
        <div class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
          <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onclick="closeModal()"></div>
          <span class="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
          <div class="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all w-[90vw] max-w-md sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
            <div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
               <!-- Modal Content Simplified for brevity -->
               <div class="text-center">
                  <h3 class="text-lg leading-6 font-medium text-gray-900 mb-4" data-i18n="modal_title">Зв'яжіться з нами</h3>
                  <a href="${TELEGRAM_URL}" target="_blank" class="block w-full bg-blue-500 text-white py-2 rounded mb-2">Telegram</a>
                  <a href="tel:${PHONE_NUMBER}" class="block w-full border border-gray-300 py-2 rounded mb-2">Call ${PHONE_DISPLAY}</a>
                  <button onclick="closeModal()" class="mt-2 text-gray-500 underline">Close</button>
               </div>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }

  // --- LANGUAGE ---
  window.setLanguage = function (lang) {
    if (!i18n[lang]) return;
    currentLang = lang;

    // Update data-i18n elements
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (i18n[lang][key]) el.innerHTML = i18n[lang][key];
    });

    // Re-render current view
    renderApp();
  };

  // --- PRODUCT FULLSCREEN LIGHTBOX ---
  // Scroll lock uses a CSS class (not inline styles) so it can never conflict
  // with other inline overflow styles, and repeated calls are always safe/idempotent.
  function lockPageScroll() {
    document.documentElement.classList.add('dpc-scroll-locked');
    document.body.classList.add('dpc-scroll-locked');
  }

  function restorePageScroll() {
    document.documentElement.classList.remove('dpc-scroll-locked');
    document.body.classList.remove('dpc-scroll-locked');
  }

  let lightboxImages = [];
  let lightboxIndex = 0;
  let lightboxEl = null;
  let lightboxTouchStartX = 0;

  // Builds the lightbox DOM and wires up its listeners exactly once. Every
  // subsequent open() call reuses the same singleton node/listeners, so
  // opening many different products never stacks up duplicate DOM nodes or
  // duplicate event listeners.
  function ensureProductLightbox() {
    if (lightboxEl) return lightboxEl;

    const html = `
      <div class="product-lightbox" id="productLightbox" role="dialog" aria-modal="true" aria-hidden="true" aria-label="Перегляд зображення товару">
        <div class="product-lightbox__backdrop" data-lightbox-close></div>
        <div class="product-lightbox__stage">
          <button type="button" class="product-lightbox__close" data-lightbox-close aria-label="Закрити">&times;</button>
          <button type="button" class="product-lightbox__arrow product-lightbox__arrow--prev" data-lightbox-prev aria-label="Попереднє зображення">&#10094;</button>
          <img class="product-lightbox__image" id="productLightboxImage" src="" alt="" onerror="window.dpcHandleImgError(this)">
          <button type="button" class="product-lightbox__arrow product-lightbox__arrow--next" data-lightbox-next aria-label="Наступне зображення">&#10095;</button>
          <div class="product-lightbox__counter" id="productLightboxCounter"></div>
          <div class="product-lightbox__thumbs" id="productLightboxThumbs"></div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
    lightboxEl = document.getElementById('productLightbox');

    lightboxEl.addEventListener('click', function (e) {
      if (e.target.closest('[data-lightbox-prev]')) { showLightboxImage(lightboxIndex - 1); return; }
      if (e.target.closest('[data-lightbox-next]')) { showLightboxImage(lightboxIndex + 1); return; }
      const thumb = e.target.closest('[data-lightbox-thumb]');
      if (thumb) { showLightboxImage(Number(thumb.dataset.lightboxThumb)); return; }
      // Close only on the backdrop, close button, or empty stage padding —
      // never when the click lands on the image itself.
      if (e.target.closest('[data-lightbox-close]') || e.target.classList.contains('product-lightbox__stage')) {
        closeProductLightbox();
      }
    });

    document.addEventListener('keydown', function (e) {
      if (!lightboxEl.classList.contains('is-open')) return;
      if (e.key === 'Escape') closeProductLightbox();
      if (e.key === 'ArrowLeft') showLightboxImage(lightboxIndex - 1);
      if (e.key === 'ArrowRight') showLightboxImage(lightboxIndex + 1);
    });

    lightboxEl.addEventListener('touchstart', function (e) {
      lightboxTouchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    lightboxEl.addEventListener('touchend', function (e) {
      const touchEndX = e.changedTouches[0].screenX;
      if (Math.abs(lightboxTouchStartX - touchEndX) > 50) {
        if (touchEndX < lightboxTouchStartX) showLightboxImage(lightboxIndex + 1); // swipe left -> next
        else showLightboxImage(lightboxIndex - 1); // swipe right -> prev
      }
    }, { passive: true });

    return lightboxEl;
  }

  function showLightboxImage(index) {
    if (!lightboxImages.length) return;
    const total = lightboxImages.length;
    lightboxIndex = ((index % total) + total) % total;

    const imgEl = document.getElementById('productLightboxImage');
    if (imgEl) imgEl.src = lightboxImages[lightboxIndex];

    const counterEl = document.getElementById('productLightboxCounter');
    if (counterEl) {
      counterEl.textContent = total > 1 ? `${lightboxIndex + 1} / ${total}` : '';
      counterEl.hidden = total <= 1;
    }

    const thumbsEl = document.getElementById('productLightboxThumbs');
    if (thumbsEl) {
      thumbsEl.hidden = total <= 1;
      thumbsEl.innerHTML = total > 1 ? lightboxImages.map((src, idx) => `
          <img src="${src}" data-lightbox-thumb="${idx}" class="${idx === lightboxIndex ? 'is-active' : ''}" alt="Мініатюра ${idx + 1}" loading="lazy" onerror="window.dpcHandleImgError(this)">
        `).join('') : '';
    }

    if (lightboxEl) {
      const prevBtn = lightboxEl.querySelector('[data-lightbox-prev]');
      const nextBtn = lightboxEl.querySelector('[data-lightbox-next]');
      if (prevBtn) prevBtn.hidden = total <= 1;
      if (nextBtn) nextBtn.hidden = total <= 1;
    }
  }

  function openProductLightbox(images, startIndex) {
    if (!images || !images.length) return;
    lightboxImages = images;
    ensureProductLightbox();
    showLightboxImage(startIndex || 0);
    lightboxEl.classList.add('is-open');
    lightboxEl.setAttribute('aria-hidden', 'false');
    lockPageScroll();
  }

  function closeProductLightbox() {
    if (!lightboxEl) return;
    lightboxEl.classList.remove('is-open');
    lightboxEl.setAttribute('aria-hidden', 'true');
    restorePageScroll();
  }

  // Defensive cleanup: guarantees the lightbox is closed and page scroll is
  // never left locked, no matter how the user left the product detail view
  // (Back button, hash change back to catalog, closing/re-rendering, etc.).
  // Safe to call unconditionally — it is a no-op if nothing is open/locked.
  function cleanupProductLightbox() {
    if (lightboxEl) lightboxEl.classList.remove('is-open');
    restorePageScroll();
  }

  // Listeners
  window.addEventListener('hashchange', function () {
    cleanupProductLightbox();
    handleHashChange();
  });
  document.addEventListener("DOMContentLoaded", init);

})();
