/*
  Digital PC - Main Application Script
  Handles: SPA Routing, Catalog/Detail Views, Translations, Modals, Pagination
*/

(function () {
  // --- CONFIGURATION ---
  // GitHub Pages Fix: Use relative path for data
  const DATA_URL = window.PRODUCTS_JSON_URL || "./data/products.json";
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
    // Computers filters
    cpu: [],
    ramType: [],
    ramSize: [],
    storage: [],
    gpu: [],
    // Periphery filters
    peripheryType: [] // Клавіатури, Миші, Навушники, Ігрові килимки
  };
  let currentSort = 'default';

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
                         <button onclick="window.openOrderModal('${product.title.replace(/'/g, "\\'")}')" class="w-full font-bold py-5 px-8 rounded-2xl transition-all flex items-center justify-center text-xl transform hover:-translate-y-1 dpc-btn-order">
                            <i data-feather="phone-call" class="w-6 h-6 mr-3"></i> ${txtOrder}
                         </button>
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
    return `
    <div class="rounded-lg overflow-hidden product-card transition-all duration-300 transform hover:-translate-y-2 h-full flex flex-col group">
        <a href="${detailPage}#product=${p.id}" class="block relative h-64 bg-black/20 flex items-center justify-center overflow-hidden cursor-pointer">
             <img src="${imageUrl}" alt="${title}" class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110">
             <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all duration-300"></div>
        </a>
        <div class="p-6 flex flex-col flex-grow">
            <a href="${detailPage}#product=${p.id}" class="block">
                <h3 class="text-xl font-bold mb-2 leading-tight transition-colors dpc-card-title">${title}</h3>
            </a>
            <div class="flex items-center mb-4">
                 <span class="text-2xl font-bold dpc-price">${price}</span>
            </div>
            <div class="flex flex-col gap-3 mt-auto">
                 <button onclick="window.openOrderModal('${title.replace(/'/g, "\\'")}')" class="w-full font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center dpc-btn-order">
                    <i data-feather="phone-call" class="w-5 h-5 mr-2"></i> ${txtOrder}
                 </button>
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
    if (!document.getElementById('filter-cpu') && !document.getElementById('filter-periphery-type')) return;

    if (currentCategory === 'computers') {
      generateComputerFilters(data);
    } else if (currentCategory === 'periphery') {
      generatePeripheryFilters(data);
    }
  }

  function generateComputerFilters(data) {
    // Define Rigid Categories (buckets)
    const buckets = {
      cpu: {
        'Intel core i5': false,
        'Intel core i7': false,
        'Amd ryzen 5': false,
        'Amd ryzen 7': false,
        'Amd ryzen X3D': false
      },
      ramType: {
        'DDR4': false,
        'DDR5': false
      },
      ramSize: {
        '16 GB': false,
        '32 GB': false,
        '64 GB': false
      },
      storage: {
        'SSD M.2': false,
        'SSD SATA': false,
        'HDD': false
      },
      gpu: {
        '10 Серія (10xx)': false,
        '20 Серія (20xx)': false,
        '30 Серія (30xx)': false,
        '40 Серія (40xx)': false,
        '50 Серія (50xx)': false,
        'AMD Radeon': false
      }
    };

    // Filter data to only computers
    const computers = data.filter(p => p.type === 'computers');

    computers.forEach(p => {
      const fullSpecs = p.full_specs || {};
      const specs = p.specs || {};
      const title = p.title || "";
      const rawText = (title + " " + JSON.stringify(fullSpecs) + " " + JSON.stringify(specs)).toLowerCase();

      // CPU Mapping
      if (rawText.match(/core\s*i5|i5-\d/)) buckets.cpu['Intel core i5'] = true;
      if (rawText.match(/core\s*i7|i7-\d/)) buckets.cpu['Intel core i7'] = true;
      if (rawText.match(/ryzen\s*5/)) buckets.cpu['Amd ryzen 5'] = true;
      if (rawText.match(/ryzen\s*7/)) buckets.cpu['Amd ryzen 7'] = true;
      if (rawText.match(/ryzen.*x3d|x3d/)) buckets.cpu['Amd ryzen X3D'] = true;

      // RAM Type
      if (rawText.includes('ddr4')) buckets.ramType['DDR4'] = true;
      if (rawText.includes('ddr5')) buckets.ramType['DDR5'] = true;

      // RAM Size
      if (rawText.match(/16\s*gb/)) buckets.ramSize['16 GB'] = true;
      if (rawText.match(/32\s*gb/)) buckets.ramSize['32 GB'] = true;
      if (rawText.match(/64\s*gb/)) buckets.ramSize['64 GB'] = true;

      // Storage
      if (rawText.match(/ssd.*m\.?2|m\.?2.*ssd|nvme/)) buckets.storage['SSD M.2'] = true;
      if (rawText.match(/ssd.*sata|sata.*ssd/) && !rawText.match(/m\.?2/)) buckets.storage['SSD SATA'] = true;
      if (rawText.match(/\bhdd\b|hard\s*disk/)) buckets.storage['HDD'] = true;

      // GPU Mapping - Grouping
      if (rawText.match(/gtx\s*10\d\d|10\d\d/)) buckets.gpu['10 Серія (10xx)'] = true;
      if (rawText.match(/rtx\s*20\d\d|20\d\d/)) buckets.gpu['20 Серія (20xx)'] = true;
      if (rawText.match(/rtx\s*30\d\d|30\d\d/)) buckets.gpu['30 Серія (30xx)'] = true;
      if (rawText.match(/rtx\s*40\d\d|40\d\d/)) buckets.gpu['40 Серія (40xx)'] = true;
      if (rawText.match(/rtx\s*50\d\d|50\d\d/)) buckets.gpu['50 Серія (50xx)'] = true;
      if (rawText.match(/amd.*radeon|radeon.*rx|rx\s*\d{3,4}/)) buckets.gpu['AMD Radeon'] = true;
    });

    const renderCheckboxes = (activeMap, containerId, name, showAll = false) => {
      const container = document.getElementById(containerId);
      if (!container) return;

      let items = Object.keys(activeMap);
      if (!showAll) {
        items = items.filter(k => activeMap[k]);
      }

      if (items.length === 0) {
        container.innerHTML = '<p class="text-sm italic dpc-muted-text">Немає варіантів</p>';
        return;
      }

      container.innerHTML = items.map(item => `
        <label class="flex items-center cursor-pointer p-2 rounded transition-colors dpc-filter-label">
            <input type="checkbox" class="filter-checkbox form-checkbox rounded" name="${name}" value="${item}">
            <span class="ml-2 text-sm font-medium">${item}</span>
        </label>
        `).join('');
    };

    // Render rigid groups
    renderCheckboxes(buckets.cpu, 'filter-cpu', 'cpu', true);
    renderCheckboxes(buckets.gpu, 'filter-gpu', 'gpu', true);
    renderCheckboxes(buckets.ramType, 'filter-ram-type', 'ram-type', true);
    renderCheckboxes(buckets.ramSize, 'filter-ram-size', 'ram-size', true);
    renderCheckboxes(buckets.storage, 'filter-storage', 'storage', true);

    // Re-attach listeners
    document.querySelectorAll('.filter-checkbox').forEach(cb => {
      cb.addEventListener('change', window.applyFilters);
    });
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
    } else if (currentCategory === 'periphery') {
      result = result.filter(p => p.type === 'periphery');
    }

    // Helper: Normalize product text for searching
    const getProductText = (p) => (p.title + " " + JSON.stringify(p.full_specs || {}) + " " + JSON.stringify(p.specs || {})).toLowerCase();
    const norm = (str) => (str || "").toLowerCase().replace(/\s+/g, '');

    // --- COMPUTER-SPECIFIC FILTERS ---
    if (currentCategory === 'computers') {
      // CPU Filter
      if (activeFilters.cpu.length > 0) {
        result = result.filter(p => {
          const text = getProductText(p);
          return activeFilters.cpu.some(cat => {
            if (cat === 'Intel core i5') return text.match(/core\s*i5|i5-\d/);
            if (cat === 'Intel core i7') return text.match(/core\s*i7|i7-\d/);
            if (cat === 'Amd ryzen 5') return text.match(/ryzen\s*5/);
            if (cat === 'Amd ryzen 7') return text.match(/ryzen\s*7/);
            if (cat === 'Amd ryzen X3D') return text.match(/ryzen.*x3d|x3d/);
            return false;
          });
        });
      }

      // GPU Filter
      if (activeFilters.gpu.length > 0) {
        result = result.filter(p => {
          const text = getProductText(p);
          return activeFilters.gpu.some(group => {
            if (group === '10 Серія (10xx)') return text.match(/gtx\s*10\d\d|10\d\d/);
            if (group === '20 Серія (20xx)') return text.match(/rtx\s*20\d\d|20\d\d/);
            if (group === '30 Серія (30xx)') return text.match(/rtx\s*30\d\d|30\d\d/);
            if (group === '40 Серія (40xx)') return text.match(/rtx\s*40\d\d|40\d\d/);
            if (group === '50 Серія (50xx)') return text.match(/rtx\s*50\d\d|50\d\d/);
            if (group === 'AMD Radeon') return text.match(/amd.*radeon|radeon.*rx|rx\s*\d{3,4}/);
            return false;
          });
        });
      }

      // RAM Type
      if (activeFilters.ramType.length > 0) {
        result = result.filter(p => {
          const text = getProductText(p);
          return activeFilters.ramType.some(f => text.includes(f.toLowerCase()));
        });
      }

      // RAM Size
      if (activeFilters.ramSize.length > 0) {
        result = result.filter(p => {
          const text = getProductText(p);
          return activeFilters.ramSize.some(f => {
            return text.includes(f.toLowerCase());
          });
        });
      }

      // Storage
      if (activeFilters.storage.length > 0) {
        result = result.filter(p => {
          const text = getProductText(p);
          return activeFilters.storage.some(f => {
            if (f === 'SSD M.2') return text.match(/ssd.*m\.?2|m\.?2.*ssd|nvme/);
            if (f === 'SSD SATA') return text.match(/ssd.*sata|sata.*ssd/) && !text.match(/m\.?2/);
            if (f === 'HDD') return text.match(/\bhdd\b|hard\s*disk/);
            return false;
          });
        });
      }
    }

    // --- PERIPHERY-SPECIFIC FILTERS ---
    if (currentCategory === 'periphery') {
      if (activeFilters.peripheryType.length > 0) {
        result = result.filter(p => {
          return activeFilters.peripheryType.includes(p.subtype);
        });
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
    // Update state from DOM
    activeFilters.cpu = Array.from(document.querySelectorAll('input[name="cpu"]:checked')).map(cb => cb.value);
    activeFilters.ramType = Array.from(document.querySelectorAll('input[name="ram-type"]:checked')).map(cb => cb.value);
    activeFilters.ramSize = Array.from(document.querySelectorAll('input[name="ram-size"]:checked')).map(cb => cb.value);
    activeFilters.storage = Array.from(document.querySelectorAll('input[name="storage"]:checked')).map(cb => cb.value);
    activeFilters.gpu = Array.from(document.querySelectorAll('input[name="gpu"]:checked')).map(cb => cb.value);
    activeFilters.peripheryType = Array.from(document.querySelectorAll('input[name="periphery-type"]:checked')).map(cb => cb.value);

    const sortEl = document.getElementById('sort-select');
    if (sortEl) currentSort = sortEl.value;

    currentPage = 1;
    renderApp();

    // Scroll to top of catalog (optional)
    const cat = document.getElementById('catalog');
    if (cat) cat.scrollIntoView({ behavior: 'smooth' });
  };

  window.resetFilters = function () {
    document.querySelectorAll('.filter-checkbox').forEach(cb => cb.checked = false);
    const sortEl = document.getElementById('sort-select');
    if (sortEl) sortEl.value = 'default';
    activeFilters = { cpu: [], ramType: [], ramSize: [], storage: [], gpu: [], peripheryType: [] };
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
      <div id="lead-form-modal" class="hidden fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 relative transform transition-all">
          <button onclick="window.closeLeadForm()" class="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors">
            <i data-feather="x" class="w-6 h-6"></i>
          </button>
          
          <div class="mb-6">
            <h2 class="text-2xl font-bold text-gray-900 mb-2">Зв'яжіться з нами</h2>
            <p class="text-gray-600">Оберіть зручний спосіб зв'язку</p>
          </div>

          <!-- Quick Contact Buttons -->
          <div class="grid grid-cols-2 gap-3 mb-6">
            <a href="tel:${PHONE_NUMBER}" 
              title="${PHONE_DISPLAY}"
              class="flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-all shadow-md hover:shadow-lg group relative">
              <i data-feather="phone" class="w-5 h-5 mr-2"></i>
              <span class="hidden md:inline">Зателефонувати</span>
              <span class="md:hidden">Зателефонувати</span>
              <span class="hidden md:group-hover:block absolute -bottom-12 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-sm px-3 py-2 rounded-lg whitespace-nowrap z-10 shadow-lg">
                ${PHONE_DISPLAY}
              </span>
            </a>
            <a href="${TELEGRAM_URL}" target="_blank"
              class="flex items-center justify-center bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-4 rounded-lg transition-all shadow-md hover:shadow-lg">
              <i data-feather="send" class="w-5 h-5 mr-2"></i>
              Telegram
            </a>
          </div>

          <div class="relative mb-6">
            <div class="absolute inset-0 flex items-center">
              <div class="w-full border-t border-gray-300"></div>
            </div>
            <div class="relative flex justify-center text-sm">
              <span class="px-2 bg-white text-gray-500">або залиште заявку</span>
            </div>
          </div>

          <form id="lead-form" class="space-y-4">
            <div>
              <label for="lead-name" class="block text-sm font-medium text-gray-700 mb-1">Ім'я *</label>
              <input type="text" id="lead-name" name="name" required
                class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="Ваше ім'я">
            </div>

            <div>
              <label for="lead-phone" class="block text-sm font-medium text-gray-700 mb-1">Телефон *</label>
              <input type="tel" id="lead-phone" name="phone" required
                class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="+380 XX XXX XX XX">
            </div>

            <div>
              <label for="lead-message" class="block text-sm font-medium text-gray-700 mb-1">Повідомлення (опціонально)</label>
              <textarea id="lead-message" name="message" rows="3"
                class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                placeholder="Додаткова інформація або питання"></textarea>
            </div>

            <input type="hidden" id="lead-product" name="product" value="">

            <div class="flex gap-3 mt-6">
              <button type="submit"
                class="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-all shadow-lg hover:shadow-blue-500/30 transform hover:-translate-y-0.5">
                Відправити
              </button>
              <button type="button" onclick="window.closeLeadForm()"
                class="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-all">
                Скасувати
              </button>
            </div>
          </form>

          <div id="form-success" class="hidden mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p class="text-green-800 font-medium">✓ Дякуємо! Ми зв'яжемося з вами найближчим часом.</p>
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

    // Telegram send function
    async function sendToTelegram(formData) {
      // FINAL PRODUCTION CREDENTIALS
      const BOT_TOKEN = '8396429322:AAHc8xU9IGechcfnFpFLqH-PDWENKNJ4yG4';
      const CHAT_ID = '6558889586';

      const text = `Нова заявка з сайту Digital PC!\n` +
        `==========================\n` +
        `👤 Ім'я: ${formData.name}\n` +
        `📱 Телефон: ${formData.phone}\n` +
        `💬 Повідомлення: ${formData.message || 'Немає'}\n` +
        `🖥 Товар: ${formData.product || 'Без товару'}\n` +
        `⏰ Час: ${new Date().toLocaleString('uk-UA')}`;

      // Use GET request with query params to avoid preflight complications, 
      // and no-cors mode to allow the browser to send it to a different origin.
      const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage?chat_id=${CHAT_ID}&text=${encodeURIComponent(text)}`;

      await fetch(url, {
        method: 'GET',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      // Since mode is no-cors, we get an opaque response. We assume success if no network error occurred.
      return { ok: true };
    }

    // Form submission handler
    const form = document.getElementById('lead-form');
    const formError = document.createElement('div');
    formError.id = 'form-error';
    formError.className = 'hidden mt-4 p-4 bg-red-50 border border-red-200 rounded-lg';
    formError.innerHTML = '<p class="text-red-800 font-medium"></p>';
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
    
    // Detect current page and set category
    const currentPage = window.location.pathname.split('/').pop() || 'computers.html';
    if (currentPage.includes('periphery')) {
      currentCategory = 'periphery';
    } else {
      currentCategory = 'computers';
    }

    try {
      const res = await fetch(DATA_URL);
      if (!res.ok) throw new Error("Failed to load products");
      allProductsData = await res.json();

      // Initial Render
      handleHashChange();

      // Generate Filters
      generateFilters(allProductsData);

      // Initialize Filter Listeners
      document.querySelectorAll('.filter-checkbox').forEach(cb => {
        cb.addEventListener('change', window.applyFilters);
      });

    } catch (e) {
      console.error(e);
    }
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
          <img class="product-lightbox__image" id="productLightboxImage" src="" alt="">
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
          <img src="${src}" data-lightbox-thumb="${idx}" class="${idx === lightboxIndex ? 'is-active' : ''}" alt="Мініатюра ${idx + 1}" loading="lazy">
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
