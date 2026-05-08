/* ═══════════════════════════════════════════════
   ACCESORII NUNTĂ – Frontend App
   Backend: /api/products  /api/orders
═══════════════════════════════════════════════ */

const PRODUCTS_PER_PAGE   = 24;
const DELIVERY_CHISINAU   = 100;
const FREE_DELIVERY_LIMIT = 500;

const CATEGORY_ICONS = {
  'Lumânări':         '🕯️',
  'Set legat mâinile':'🤝',
  'Prosoape':         '🛁',
  'Legături':         '🎗️',
  'Buchete':          '💐',
  'Pahare':           '🥂',
  'Cutii și boluri':  '🎁',
  'Invitații':        '✉️',
  'Plicuri și panou': '🗂️',
  'Decor auto':       '🚗',
  'Cutii verighete':  '💍',
  'Set despodobire':  '👰',
};

// ── State ──
let allProducts       = [];
let filteredProducts  = [];
let cart              = [];
let currentPage       = 1;
let currentView       = 'home';
let activeCategory    = null;
let activeSubcategory = null;
let searchQuery       = '';
let sortOrder         = 'default';
let currentProductId  = null;
let currentProductQty = 1;

// ══════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  showLoadingOverlay(true);
  await loadProducts();
  showLoadingOverlay(false);
  loadCart();
  renderCart();
  updateCartCount();
  renderHomePage();
  bindEvents();
  bindPopState();
  document.getElementById('footer-year').textContent = new Date().getFullYear();

  // Înregistrează starea inițială (Home) în istoricul browserului
  history.replaceState(buildHistoryState('home', {}), '', '/');
});

function showLoadingOverlay(show) {
  let el = document.getElementById('page-loader');
  if (!el) {
    el = document.createElement('div');
    el.id = 'page-loader';
    el.style.cssText = 'position:fixed;inset:0;background:#fdfaf6;display:flex;align-items:center;justify-content:center;z-index:9999;transition:opacity .4s';
    el.innerHTML = '<div style="text-align:center"><div class="loading-spinner"></div><p style="font-family:\'Cormorant Garamond\',serif;color:#8b6355;font-size:1.1rem;margin-top:12px">Se încarcă...</p></div>';
    document.body.appendChild(el);
  }
  if (show) { el.style.opacity = '1'; el.style.pointerEvents = 'all'; }
  else { el.style.opacity = '0'; el.style.pointerEvents = 'none'; }
}

async function loadProducts() {
  try {
    const res  = await fetch('/api/products');
    const data = await res.json();
    allProducts = data.products || [];
  } catch (e) {
    console.error('Eroare products API:', e);
    allProducts = [];
    showToast('Eroare la încărcarea produselor.', 'error');
  }
}

// ══════════════════════════════════════════════
// NAVIGATION + HISTORY API
// ══════════════════════════════════════════════

// Construiește obiectul de stare salvat în history
function buildHistoryState(view, data = {}) {
  return {
    view,
    data,
    activeCategory,
    activeSubcategory,
    searchQuery,
    sortOrder,
    currentPage,
  };
}

// Construiește URL-ul reflectat în bara de adrese
function buildHistoryUrl(view, data = {}) {
  if (view === 'home') return '/';
  const p = new URLSearchParams();
  if (view !== 'catalog') p.set('v', view);
  if (data.id)            p.set('id', data.id);
  if (activeCategory)     p.set('cat', activeCategory);
  if (activeSubcategory)  p.set('sub', activeSubcategory);
  if (searchQuery)        p.set('q', searchQuery);
  const qs = p.toString();
  return qs ? '/?' + qs : '/?v=catalog';
}

// Apelat din sidebar/filtre când view-ul rămâne catalog dar starea se schimbă
function pushCatalogState() {
  history.pushState(
    buildHistoryState('catalog', {}),
    '',
    buildHistoryUrl('catalog', {})
  );
}

// Ascultă butonul Back/Forward al browserului
function bindPopState() {
  window.addEventListener('popstate', e => {
    const s = e.state;
    if (!s || s.view === 'home') {
      // Resetează totul și afișează Home
      activeCategory = null; activeSubcategory = null;
      searchQuery = ''; sortOrder = 'default'; currentPage = 1;
      showView('home', {}, true);
      return;
    }
    // Restaurează starea salvată
    activeCategory    = s.activeCategory    ?? null;
    activeSubcategory = s.activeSubcategory ?? null;
    searchQuery       = s.searchQuery       ?? '';
    sortOrder         = s.sortOrder         ?? 'default';
    currentPage       = s.currentPage       ?? 1;
    showView(s.view, s.data || {}, true);
  });
}

function showView(name, data = {}, skipHistory = false) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const el = document.getElementById('view-' + name);
  if (!el) return;
  el.classList.add('active');
  currentView = name;
  window.scrollTo({ top: 0, behavior: 'smooth' });

  document.querySelectorAll('.nav-link[data-view]').forEach(a =>
    a.classList.toggle('active', a.dataset.view === name));

  if (name === 'catalog')  renderCatalog(data);
  if (name === 'product' && data.id) renderProductPage(data.id);
  if (name === 'checkout') renderCheckoutSummary();
  closeMobileNav();
  closeCart();

  // Înregistrează în istoricul browserului (back/forward pe telefon)
  if (!skipHistory) {
    history.pushState(
      buildHistoryState(name, data),
      '',
      buildHistoryUrl(name, data)
    );
  }
}

function bindEvents() {
  document.body.addEventListener('click', e => {
    const viewEl = e.target.closest('[data-view]');
    if (viewEl) {
      e.preventDefault();
      const view   = viewEl.dataset.view;
      const filter = viewEl.dataset.filter;
      const cat    = viewEl.dataset.cat;
      if (cat) {
        activeCategory = cat; activeSubcategory = null; searchQuery = '';
        applyFilters(); showView('catalog'); return; // showView face pushState
      }
      if (view === 'catalog' && filter === 'new') {
        activeCategory = null; activeSubcategory = null; searchQuery = '';
        filteredProducts = allProducts.filter(p => p.isNew);
        currentPage = 1; sortOrder = 'default';
        showView('catalog', { preset: 'new' }); return;
      }
      showView(view);
    }

    const scrollEl = e.target.closest('.nav-scroll');
    if (scrollEl) {
      e.preventDefault();
      const target = document.querySelector(scrollEl.getAttribute('href'));
      if (target) target.scrollIntoView({ behavior: 'smooth' });
      closeMobileNav();
    }

    const atcBtn = e.target.closest('.add-to-cart-btn');
    if (atcBtn) { e.stopPropagation(); addToCart(atcBtn.dataset.id, 1); }

    const card = e.target.closest('.product-card[data-id]');
    if (card && !e.target.closest('.add-to-cart-btn'))
      showView('product', { id: card.dataset.id });
  });

  // Search
  const searchToggle = document.getElementById('search-toggle');
  const searchWrap   = document.getElementById('search-bar-wrap');
  const headerSearch = document.getElementById('header-search');
  searchToggle?.addEventListener('click', () => {
    searchWrap.classList.toggle('open');
    if (searchWrap.classList.contains('open')) headerSearch.focus();
  });
  document.getElementById('search-clear')?.addEventListener('click', () => {
    headerSearch.value = ''; searchWrap.classList.remove('open');
  });
  headerSearch?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const q = headerSearch.value.trim();
      if (q) {
        activeCategory = null; activeSubcategory = null;
        searchQuery = q; applyFilters(); showView('catalog');
        searchWrap.classList.remove('open');
      }
    }
  });

  // Mobile nav
  document.getElementById('hamburger')?.addEventListener('click', openMobileNav);
  document.getElementById('mobile-nav-close')?.addEventListener('click', closeMobileNav);
  document.getElementById('mobile-overlay')?.addEventListener('click', () => {
    closeMobileNav();
    document.getElementById('catalog-sidebar')?.classList.remove('open');
    document.getElementById('mobile-overlay')?.classList.remove('open');
  });

  // Cart
  document.getElementById('cart-toggle')?.addEventListener('click', toggleCart);
  document.getElementById('cart-close')?.addEventListener('click', closeCart);
  document.getElementById('cart-overlay')?.addEventListener('click', closeCart);
  document.getElementById('checkout-btn')?.addEventListener('click', () => {
    if (!cart.length) { showToast('Coșul tău este gol!', 'error'); return; }
    closeCart(); showView('checkout');
  });
  document.getElementById('continue-shopping')?.addEventListener('click', () => { closeCart(); showView('catalog'); });
  document.getElementById('cart-browse')?.addEventListener('click', () => { closeCart(); showView('catalog'); });

  // Catalog
  document.getElementById('clear-filters')?.addEventListener('click', () => {
    activeCategory = null; activeSubcategory = null; searchQuery = '';
    const cs = document.getElementById('catalog-search');
    const ss = document.getElementById('sort-select');
    if (cs) cs.value = ''; if (ss) ss.value = 'default';
    sortOrder = 'default'; applyFilters(); renderSidebarCats(); renderCatalogBreadcrumb();
    pushCatalogState();
  });
  document.getElementById('catalog-search')?.addEventListener('input', e => {
    searchQuery = e.target.value.trim(); currentPage = 1; applyFilters();
  });
  document.getElementById('sort-select')?.addEventListener('change', e => {
    sortOrder = e.target.value; currentPage = 1; applyFilters();
    pushCatalogState();
  });
  document.getElementById('mobile-filter-btn')?.addEventListener('click', () => {
    document.getElementById('catalog-sidebar').classList.toggle('open');
    document.getElementById('mobile-overlay').classList.toggle('open');
  });

  // Checkout
  document.getElementById('checkout-form')?.addEventListener('submit', handleCheckoutSubmit);
  document.getElementById('f-city')?.addEventListener('change', renderCheckoutSummary);
}

// ══════════════════════════════════════════════
// HOME
// ══════════════════════════════════════════════
function renderHomePage() {
  renderCategoryCards();
  renderNewProducts();
  renderMobileNavCats();
  renderFooterCats();
}

function renderCategoryCards() {
  const grid = document.getElementById('categories-grid');
  if (!grid) return;
  const cats = getCategories();
  grid.innerHTML = cats.map(cat => {
    const total = allProducts.filter(p => p.category === cat).length;
    return `<div class="cat-card" data-cat="${esc(cat)}" data-view="catalog">
      <span class="cat-icon">${CATEGORY_ICONS[cat] || '✦'}</span>
      <span class="cat-name">${esc(cat)}</span>
      <span class="cat-count">${total} produse</span>
    </div>`;
  }).join('');
}

function renderNewProducts() {
  const grid = document.getElementById('new-products-grid');
  if (!grid) return;
  const newProds = allProducts.filter(p => p.isNew).slice(0, 8);
  if (!newProds.length) { grid.closest('.section-new')?.remove(); return; }
  grid.innerHTML = newProds.map(renderProductCard).join('');
}

function renderMobileNavCats() {
  const el = document.getElementById('mobile-nav-cats');
  if (!el) return;
  el.innerHTML = getCategories().map(cat =>
    `<a href="#" class="mobile-nav-cat-item" data-cat="${esc(cat)}" data-view="catalog">
      ${CATEGORY_ICONS[cat] || '✦'} ${esc(cat)}
    </a>`
  ).join('');
}

function renderFooterCats() {
  const el = document.getElementById('footer-cats');
  if (!el) return;
  el.innerHTML = getCategories().slice(0, 8).map(cat =>
    `<a href="#" data-cat="${esc(cat)}" data-view="catalog">${esc(cat)}</a>`
  ).join('');
}

// ══════════════════════════════════════════════
// CATALOG
// ══════════════════════════════════════════════
function renderCatalog(data = {}) {
  if (data.preset !== 'new' && !searchQuery) applyFilters();
  else if (!filteredProducts.length && !data.preset) applyFilters();
  renderSidebarCats();
  renderCatalogGrid();
  renderCatalogBreadcrumb();
}

function applyFilters() {
  let products = [...allProducts];
  if (activeCategory)    products = products.filter(p => p.category === activeCategory);
  if (activeSubcategory) products = products.filter(p => p.subcategory === activeSubcategory);
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    products = products.filter(p =>
      (p.title||'').toLowerCase().includes(q) ||
      (p.category||'').toLowerCase().includes(q) ||
      (p.subcategory||'').toLowerCase().includes(q) ||
      (p.details||'').toLowerCase().includes(q) ||
      (p.sku||'').toLowerCase().includes(q)
    );
  }
  if (sortOrder === 'price-asc')  products.sort((a,b) => a.priceNumeric - b.priceNumeric);
  if (sortOrder === 'price-desc') products.sort((a,b) => b.priceNumeric - a.priceNumeric);
  if (sortOrder === 'new')        products.sort((a,b) => (b.isNew?1:0) - (a.isNew?1:0));
  if (sortOrder === 'name-asc')   products.sort((a,b) => (a.title||'').localeCompare(b.title||''));
  filteredProducts = products;
  currentPage = 1;
  renderCatalogGrid();
  renderCatalogBreadcrumb();
}

function renderCatalogGrid() {
  const grid    = document.getElementById('catalog-grid');
  const countEl = document.getElementById('results-count');
  if (!grid) return;
  const total      = filteredProducts.length;
  const totalPages = Math.ceil(total / PRODUCTS_PER_PAGE);
  const start      = (currentPage - 1) * PRODUCTS_PER_PAGE;
  const page       = filteredProducts.slice(start, start + PRODUCTS_PER_PAGE);
  if (countEl) countEl.textContent = `${total} produse`;
  if (!page.length) {
    grid.innerHTML = `<div class="products-empty"><p>Nu au fost găsite produse.<br><small>Încearcă să modifici filtrele sau căutarea.</small></p></div>`;
    document.getElementById('pagination').innerHTML = '';
    return;
  }
  grid.innerHTML = page.map(renderProductCard).join('');
  renderPagination(totalPages);
}

function renderProductCard(p) {
  const badge = p.badge
    ? `<span class="product-badge${p.badge==='PROMO'?' badge-promo':''}">${esc(p.badge)}</span>` : '';
  const img2 = p.imgUrl2
    ? `<img class="product-img-secondary" src="${esc(p.imgUrl2)}" alt="${esc(p.title)}" loading="lazy">` : '';
  return `
    <div class="product-card" data-id="${esc(p.id)}">
      <div class="product-img-wrap">
        ${badge}
        <img class="product-img-primary" src="${esc(p.imgUrl)}" alt="${esc(p.title)}" loading="lazy">
        ${img2}
      </div>
      <div class="product-body">
        <span class="product-cat-label">${esc(p.subcategory || p.category)}</span>
        <div class="product-title">${esc(p.title)}</div>
        ${p.details ? `<div class="product-details">${esc(p.details)}</div>` : ''}
      </div>
      <div class="product-footer">
        <span class="product-price">${p.priceNumeric} MDL</span>
        <button class="add-to-cart-btn" data-id="${esc(p.id)}" title="Adaugă în coș">+</button>
      </div>
    </div>`;
}

function renderSidebarCats() {
  const el = document.getElementById('sidebar-cats');
  if (!el) return;
  const catsMap = {};
  allProducts.forEach(p => {
    if (!catsMap[p.category]) catsMap[p.category] = new Set();
    if (p.subcategory) catsMap[p.category].add(p.subcategory);
  });
  el.innerHTML = Object.entries(catsMap).map(([cat, subcats]) => {
    const isActive = cat === activeCategory;
    const subArr = [...subcats];
    const hasSubs = subArr.length > 1; // subcategorii vizibile doar dacă sunt 2+

    if (!hasSubs) {
      // Categorie simplă — un singur buton fără dropdown
      return `<div class="sidebar-cat-group">
        <button class="sidebar-cat-toggle sidebar-cat-simple${isActive?' active':''}" data-cat="${esc(cat)}">
          <span>${CATEGORY_ICONS[cat]||'✦'} ${esc(cat)}</span>
        </button>
      </div>`;
    }

    const subs = subArr.map(sub =>
      `<span class="sidebar-subcat-item${sub===activeSubcategory?' active':''}"
        data-cat="${esc(cat)}" data-sub="${esc(sub)}">${esc(sub)}</span>`
    ).join('');
    return `<div class="sidebar-cat-group">
      <button class="sidebar-cat-toggle${isActive?' active open':''}" data-cat="${esc(cat)}">
        <span>${CATEGORY_ICONS[cat]||'✦'} ${esc(cat)}</span>
        <span class="toggle-icon">▾</span>
      </button>
      <div class="sidebar-subcat-list${isActive?' open':''}">${subs}</div>
    </div>`;
  }).join('');

  el.addEventListener('click', e => {
    const tog = e.target.closest('.sidebar-cat-toggle');
    if (tog) {
      const cat = tog.dataset.cat;
      const isSimple = tog.classList.contains('sidebar-cat-simple');
      const wasActive = tog.classList.contains('active');

      // Resetează toate
      document.querySelectorAll('.sidebar-cat-toggle').forEach(b => {
        b.classList.remove('active','open');
        const list = b.nextElementSibling;
        if (list && list.classList.contains('sidebar-subcat-list')) list.classList.remove('open');
      });

      if (!wasActive) {
        tog.classList.add('active');
        if (!isSimple) {
          tog.classList.add('open');
          const list = tog.nextElementSibling;
          if (list) list.classList.add('open');
        }
        activeCategory = cat;
      } else {
        activeCategory = null;
      }
      activeSubcategory = null; currentPage = 1; applyFilters(); renderCatalogBreadcrumb();
      pushCatalogState(); // înregistrează filtrul în history
    }
    const sub = e.target.closest('.sidebar-subcat-item');
    if (sub) {
      activeCategory = sub.dataset.cat; activeSubcategory = sub.dataset.sub;
      document.querySelectorAll('.sidebar-subcat-item').forEach(s => s.classList.remove('active'));
      sub.classList.add('active');
      currentPage = 1; applyFilters(); renderCatalogBreadcrumb();
      pushCatalogState(); // înregistrează filtrul în history
      document.getElementById('catalog-sidebar').classList.remove('open');
      document.getElementById('mobile-overlay').classList.remove('open');
    }
  });
}

function renderCatalogBreadcrumb() {
  const el = document.getElementById('catalog-breadcrumb');
  if (!el) return;
  let html = '<span>Catalog</span>';
  if (activeCategory)    html += ` <span>/ ${esc(activeCategory)}</span>`;
  if (activeSubcategory) html += ` <span>/ ${esc(activeSubcategory)}</span>`;
  if (searchQuery)       html += ` <span>/ Căutare: "${esc(searchQuery)}"</span>`;
  el.innerHTML = html;
}

function renderPagination(totalPages) {
  const el = document.getElementById('pagination');
  if (!el || totalPages <= 1) { el && (el.innerHTML = ''); return; }
  let html = '';
  if (currentPage > 1) html += `<button class="page-btn" data-page="${currentPage-1}">‹</button>`;
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i-currentPage) <= 2)
      html += `<button class="page-btn${i===currentPage?' active':''}" data-page="${i}">${i}</button>`;
    else if (Math.abs(i-currentPage) === 3)
      html += `<span class="page-btn" style="pointer-events:none">…</span>`;
  }
  if (currentPage < totalPages) html += `<button class="page-btn" data-page="${currentPage+1}">›</button>`;
  el.innerHTML = html;
  el.onclick = e => {
    const btn = e.target.closest('[data-page]');
    if (!btn) return;
    currentPage = +btn.dataset.page;
    renderCatalogGrid();
    document.getElementById('view-catalog').scrollIntoView({ behavior: 'smooth' });
  };
}

// ══════════════════════════════════════════════
// PRODUCT PAGE
// ══════════════════════════════════════════════
function renderProductPage(id) {
  const p = allProducts.find(x => x.id === id);
  if (!p) { showView('catalog'); return; }
  currentProductId = id; currentProductQty = 1;
  const el = document.getElementById('product-page');
  const related = allProducts.filter(x => x.category === p.category && x.id !== id).slice(0, 4);
  el.innerHTML = `
    <button class="product-back" onclick="history.back()">← Înapoi la catalog</button>
    <div class="product-detail-grid">
      <div class="product-gallery">
        <div class="product-gallery-main">
          <img id="gallery-main-img" src="${esc(p.imgUrl)}" alt="${esc(p.title)}">
        </div>
        ${p.imgUrl2 ? `
        <div class="product-gallery-thumbs">
          <div class="product-thumb active" onclick="switchGalleryImg('${esc(p.imgUrl)}',this)">
            <img src="${esc(p.imgUrl)}" alt=""></div>
          <div class="product-thumb" onclick="switchGalleryImg('${esc(p.imgUrl2)}',this)">
            <img src="${esc(p.imgUrl2)}" alt=""></div>
        </div>` : ''}
      </div>
      <div class="product-info">
        <div class="product-info-cat">${esc(p.category)} › ${esc(p.subcategory||'')}</div>
        <h1 class="product-info-title">${esc(p.title)}</h1>
        ${p.sku ? `<div class="product-info-sku">${esc(p.sku)}</div>` : ''}
        ${p.details ? `<div class="product-info-details">${esc(p.details)}</div>` : ''}
        <div class="product-info-price">${p.priceNumeric} MDL</div>
        <div class="product-qty-row">
          <div class="qty-control">
            <button class="qty-btn" onclick="changeQty(-1)">−</button>
            <span class="qty-val" id="detail-qty">1</span>
            <button class="qty-btn" onclick="changeQty(1)">+</button>
          </div>
          <button class="btn btn-primary add-to-cart-full" onclick="addToCart('${esc(id)}', currentProductQty)">
            🛍️ Adaugă în coș
          </button>
        </div>
        <div class="product-delivery-note">
          🚚 ${p.priceNumeric >= FREE_DELIVERY_LIMIT
            ? '<strong>Livrare gratuită</strong> în Chișinău!'
            : `Livrare Chișinău: <strong>100 MDL</strong> (gratuit la 500+ MDL)`}
        </div>
        ${p.badge ? `<span class="product-badge" style="position:static;display:inline-block;margin-top:8px">${esc(p.badge)}</span>` : ''}
      </div>
    </div>
    ${related.length ? `
    <div class="product-related">
      <h3>Produse similare</h3>
      <div class="products-grid">${related.map(renderProductCard).join('')}</div>
    </div>` : ''}`;
}

function switchGalleryImg(url, thumb) {
  document.getElementById('gallery-main-img').src = url;
  document.querySelectorAll('.product-thumb').forEach(t => t.classList.remove('active'));
  thumb.classList.add('active');
}
function changeQty(delta) {
  currentProductQty = Math.max(1, currentProductQty + delta);
  const el = document.getElementById('detail-qty');
  if (el) el.textContent = currentProductQty;
}

// ══════════════════════════════════════════════
// CART
// ══════════════════════════════════════════════
function loadCart() {
  try { cart = JSON.parse(localStorage.getItem('cart') || '[]'); } catch { cart = []; }
}
function saveCart() { localStorage.setItem('cart', JSON.stringify(cart)); }

function addToCart(id, qty = 1) {
  const p = allProducts.find(x => x.id === id);
  if (!p) return;
  const existing = cart.find(i => i.id === id);
  if (existing) existing.qty += qty;
  else cart.push({ id, qty, title: p.title, price: p.priceNumeric, img: p.imgUrl, details: p.details });
  saveCart(); updateCartCount(); renderCart();
  showToast(`"${p.title}" adăugat în coș 🛍️`, 'success');
  document.querySelectorAll(`.add-to-cart-btn[data-id="${id}"]`).forEach(btn => {
    btn.classList.add('added');
    setTimeout(() => btn.classList.remove('added'), 1200);
  });
}
function removeFromCart(id) {
  cart = cart.filter(i => i.id !== id);
  saveCart(); updateCartCount(); renderCart();
  if (currentView === 'checkout') renderCheckoutSummary();
}
function updateCartQty(id, delta) {
  const item = cart.find(i => i.id === id);
  if (!item) return;
  item.qty = Math.max(1, item.qty + delta);
  saveCart(); updateCartCount(); renderCart();
  if (currentView === 'checkout') renderCheckoutSummary();
}
function updateCartCount() {
  const total = cart.reduce((s, i) => s + i.qty, 0);
  document.getElementById('cart-count').textContent = total;
}
function getCartSubtotal() { return cart.reduce((s, i) => s + i.price * i.qty, 0); }
function getDeliveryCost(city) {
  if (!city || city === 'Alta') return null;
  return getCartSubtotal() >= FREE_DELIVERY_LIMIT ? 0 : DELIVERY_CHISINAU;
}

function renderCart() {
  const listEl   = document.getElementById('cart-items-list');
  const footerEl = document.getElementById('cart-footer');
  const emptyEl  = document.getElementById('cart-empty');
  if (!listEl) return;
  if (!cart.length) {
    listEl.innerHTML = ''; footerEl.style.display = 'none';
    emptyEl.classList.add('show'); return;
  }
  footerEl.style.display = 'flex'; emptyEl.classList.remove('show');
  listEl.innerHTML = cart.map(item => `
    <div class="cart-item">
      <div class="cart-item-img"><img src="${esc(item.img)}" alt="${esc(item.title)}" loading="lazy"></div>
      <div class="cart-item-info">
        <div class="cart-item-title">${esc(item.title)}</div>
        ${item.details ? `<div class="cart-item-details">${esc(item.details)}</div>` : ''}
        <div class="cart-item-row">
          <div class="cart-item-qty">
            <button class="cart-qty-btn" onclick="updateCartQty('${esc(item.id)}',-1)">−</button>
            <span class="cart-qty-num">${item.qty}</span>
            <button class="cart-qty-btn" onclick="updateCartQty('${esc(item.id)}',1)">+</button>
          </div>
          <span class="cart-item-price">${item.price * item.qty} MDL</span>
          <button class="cart-item-remove" onclick="removeFromCart('${esc(item.id)}')">✕</button>
        </div>
      </div>
    </div>`).join('');
  const sub      = getCartSubtotal();
  const delivery = getDeliveryCost('Chișinău');
  document.getElementById('cart-subtotal').textContent = sub + ' MDL';
  document.getElementById('cart-delivery').textContent = delivery === 0 ? '✓ Gratuit' : delivery + ' MDL';
  document.getElementById('cart-total').textContent    = (sub + (delivery || 0)) + ' MDL';
}

function toggleCart() {
  document.getElementById('cart-sidebar').classList.toggle('open');
  document.getElementById('cart-overlay').classList.toggle('open');
}
function closeCart() {
  document.getElementById('cart-sidebar')?.classList.remove('open');
  document.getElementById('cart-overlay')?.classList.remove('open');
}

// ══════════════════════════════════════════════
// CHECKOUT
// ══════════════════════════════════════════════
function renderCheckoutSummary() {
  const itemsList  = document.getElementById('checkout-items-list');
  const subtotalEl = document.getElementById('summary-subtotal');
  const deliveryEl = document.getElementById('summary-delivery');
  const totalEl    = document.getElementById('summary-total');
  if (!itemsList) return;
  itemsList.innerHTML = cart.map(item => `
    <div class="checkout-item">
      <div class="checkout-item-img"><img src="${esc(item.img)}" alt="${esc(item.title)}" loading="lazy"></div>
      <div class="checkout-item-info">
        <div class="checkout-item-title">${esc(item.title)}</div>
        <div class="checkout-item-sub">x${item.qty}</div>
      </div>
      <span class="checkout-item-price">${item.price * item.qty} MDL</span>
    </div>`).join('');
  const sub  = getCartSubtotal();
  const city = document.getElementById('f-city')?.value;
  const del  = getDeliveryCost(city);
  if (subtotalEl) subtotalEl.textContent = sub + ' MDL';
  if (!city) {
    if (deliveryEl) deliveryEl.textContent = '—';
    if (totalEl)    totalEl.textContent    = sub + ' MDL';
  } else if (city === 'Alta') {
    if (deliveryEl) deliveryEl.innerHTML = 'Contra-cost';
    if (totalEl)    totalEl.textContent  = sub + ' MDL + livrare';
  } else {
    if (deliveryEl) deliveryEl.innerHTML = del === 0
      ? '<span class="free-delivery-badge">✓ Gratuit</span>' : del + ' MDL';
    if (totalEl) totalEl.textContent = (sub + del) + ' MDL';
  }
}

async function handleCheckoutSubmit(e) {
  e.preventDefault();
  if (!validateCheckoutForm()) return;

  const btn     = document.getElementById('submit-order-btn');
  const btnText = document.getElementById('submit-btn-text');
  const btnLoad = document.getElementById('submit-btn-loader');
  btn.disabled  = true;
  btnText.classList.add('hidden');
  btnLoad.classList.remove('hidden');

  const name    = document.getElementById('f-name').value.trim();
  const phone   = document.getElementById('f-phone').value.trim();
  const email   = document.getElementById('f-email').value.trim();
  const city    = document.getElementById('f-city').value;
  const address = document.getElementById('f-address').value.trim();
  const notes   = document.getElementById('f-notes').value.trim();
  const sub     = getCartSubtotal();
  const del     = getDeliveryCost(city);
  const total   = city === 'Alta' ? sub + ' MDL + livrare' : (sub + del) + ' MDL';
  const orderId = 'AN-' + Date.now().toString(36).toUpperCase();
  const orderDate = new Date().toLocaleString('ro-RO');

  try {
    const res = await fetch('/api/orders', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId, orderDate,
        customerName: name, customerPhone: phone, customerEmail: email,
        customerCity: city === 'Alta' ? 'Altă localitate' : city,
        customerAddress: address, customerNotes: notes,
        items: cart, subtotal: sub, deliveryCost: del, total,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Eroare server');
    cart = []; saveCart(); updateCartCount();
    document.getElementById('success-order-id').textContent = orderId;
    showView('success');
  } catch (err) {
    console.error(err);
    showToast('Eroare la trimiterea comenzii. Contactați-ne telefonic.', 'error');
    btn.disabled = false;
    btnText.classList.remove('hidden');
    btnLoad.classList.add('hidden');
  }
}

function validateCheckoutForm() {
  let valid = true;
  [
    { id: 'f-name',    msg: 'Introduceți numele' },
    { id: 'f-phone',   msg: 'Introduceți telefonul' },
    { id: 'f-city',    msg: 'Selectați localitatea' },
    { id: 'f-address', msg: 'Introduceți adresa' },
  ].forEach(({ id, msg }) => {
    const el  = document.getElementById(id);
    el.parentElement.querySelector('.field-error')?.remove();
    el.classList.remove('error');
    if (!el.value.trim()) {
      el.classList.add('error');
      const err = Object.assign(document.createElement('span'), { className: 'field-error', textContent: msg });
      el.parentElement.appendChild(err);
      valid = false;
    }
  });
  return valid;
}

// ══════════════════════════════════════════════
// MOBILE NAV
// ══════════════════════════════════════════════
function openMobileNav() {
  document.getElementById('mobile-nav').classList.add('open');
  document.getElementById('mobile-overlay').classList.add('open');
}
function closeMobileNav() {
  document.getElementById('mobile-nav')?.classList.remove('open');
  if (!document.getElementById('catalog-sidebar')?.classList.contains('open'))
    document.getElementById('mobile-overlay')?.classList.remove('open');
}

// ══════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════
function getCategories() { return [...new Set(allProducts.map(p => p.category))]; }

function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className   = 'toast show' + (type ? ' ' + type : '');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 3200);
}
