/* ═══════════════════════════════════════════════
   ACCESORII NUNTĂ – Admin Panel
   Backend API: /api/auth  /api/products  /api/categories  /api/upload
═══════════════════════════════════════════════ */

const ADMIN_PER_PAGE = 20;

let allProducts     = [];
let allCategories   = [];   // încărcate din /api/categories
let filtered        = [];
let adminPage       = 1;
let editingId       = null;
let confirmCallback = null;
let authToken       = sessionStorage.getItem('admin_token') || null;

// ══════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  if (authToken) showApp();
  document.getElementById('login-form').addEventListener('submit', handleLogin);
  bindAdminEvents();
});

// ══════════════════════════════════════════════
// AUTH
// ══════════════════════════════════════════════
async function handleLogin(e) {
  e.preventDefault();
  const password = document.getElementById('login-password').value;
  const errEl    = document.getElementById('login-error');
  errEl.classList.add('hidden');

  try {
    const res  = await fetch('/api/auth/login', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Parolă incorectă');
    authToken = data.token;
    sessionStorage.setItem('admin_token', authToken);
    errEl.classList.add('hidden');
    showApp();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  }
}

function authHeaders() {
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` };
}

async function apiRequest(url, options = {}) {
  const res = await fetch(url, { ...options, headers: authHeaders() });
  if (res.status === 401) { logout(); return null; }
  return res;
}

function logout() {
  sessionStorage.removeItem('admin_token');
  authToken = null;
  location.reload();
}

function showApp() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('admin-app').classList.remove('hidden');
  Promise.all([loadProducts(), loadCategories()]).then(() => {
    populateCatFilter();
    applyAdminFilters();
  });
}

// ══════════════════════════════════════════════
// DATA – API calls
// ══════════════════════════════════════════════
async function loadProducts() {
  try {
    const res  = await fetch('/api/products');
    const data = await res.json();
    allProducts = data.products || [];
  } catch {
    allProducts = [];
    showAdminToast('Nu s-au putut încărca produsele!', 'error');
  }
}

async function loadCategories() {
  try {
    const res  = await fetch('/api/categories');
    const data = await res.json();
    allCategories = data.categories || [];
  } catch {
    allCategories = [];
  }
}

async function apiAddProduct(product) {
  const res = await apiRequest('/api/products', {
    method: 'POST', body: JSON.stringify(product),
  });
  return res ? await res.json() : null;
}

async function apiUpdateProduct(id, product) {
  const res = await apiRequest(`/api/products/${id}`, {
    method: 'PUT', body: JSON.stringify(product),
  });
  return res ? await res.json() : null;
}

async function apiDeleteProduct(id) {
  const res = await apiRequest(`/api/products/${id}`, { method: 'DELETE' });
  return res ? await res.json() : null;
}

async function apiImportProducts(products) {
  const res = await apiRequest('/api/products/import', {
    method: 'POST', body: JSON.stringify({ products }),
  });
  return res ? await res.json() : null;
}

// ══════════════════════════════════════════════
// EVENTS
// ══════════════════════════════════════════════
function bindAdminEvents() {
  document.getElementById('logout-btn')?.addEventListener('click', logout);
  document.getElementById('add-product-btn')?.addEventListener('click', () => openModal(null));

  document.getElementById('export-btn')?.addEventListener('click', exportJSON);
  document.getElementById('import-btn')?.addEventListener('click', () =>
    document.getElementById('import-file-input').click());
  document.getElementById('import-file-input')?.addEventListener('change', importJSON);

  document.getElementById('reset-btn')?.addEventListener('click', () => {
    showConfirm('Reîncarcă datele originale din fișier?', async () => {
      try {
        const res  = await fetch('/api/products');
        const data = await res.json();
        showAdminToast(`${data.total} produse încărcate.`, 'success');
        allProducts = data.products || [];
        populateCatFilter();
        applyAdminFilters();
      } catch {
        showAdminToast('Eroare la resetare!', 'error');
      }
    });
  });

  document.getElementById('admin-search')?.addEventListener('input',  () => { adminPage = 1; applyAdminFilters(); });
  document.getElementById('admin-cat-filter')?.addEventListener('change', () => { adminPage = 1; applyAdminFilters(); });

  // Product modal
  document.getElementById('modal-close')?.addEventListener('click', closeModal);
  document.getElementById('modal-cancel')?.addEventListener('click', closeModal);
  document.getElementById('modal-save')?.addEventListener('click', saveProduct);
  document.getElementById('product-modal-overlay')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });

  // Image upload buttons
  setupImageUpload(1);
  setupImageUpload(2);

  // Crop modal
  document.getElementById('crop-modal-close')?.addEventListener('click', closeCropModal);
  document.getElementById('crop-cancel')?.addEventListener('click', closeCropModal);
  document.getElementById('crop-confirm')?.addEventListener('click', confirmCrop);
  document.getElementById('crop-modal-overlay')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeCropModal();
  });

  // Categories modal
  document.getElementById('manage-cats-btn')?.addEventListener('click', openCatsModal);
  document.getElementById('cats-modal-close')?.addEventListener('click', closeCatsModal);
  document.getElementById('cats-modal-done')?.addEventListener('click', closeCatsModal);
  document.getElementById('cats-modal-overlay')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeCatsModal();
  });

  // Change password modal
  document.getElementById('change-pass-btn')?.addEventListener('click', () => {
    document.getElementById('pass-modal-overlay').classList.remove('hidden');
    document.getElementById('pass-error').classList.add('hidden');
    ['old-pass','new-pass','confirm-pass'].forEach(id => document.getElementById(id).value = '');
  });
  document.getElementById('pass-modal-close')?.addEventListener('click',  () => document.getElementById('pass-modal-overlay').classList.add('hidden'));
  document.getElementById('pass-modal-cancel')?.addEventListener('click', () => document.getElementById('pass-modal-overlay').classList.add('hidden'));
  document.getElementById('pass-modal-save')?.addEventListener('click', handleChangePassword);
  document.getElementById('pass-modal-overlay')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) e.currentTarget.classList.add('hidden');
  });

  // Confirm dialog
  document.getElementById('confirm-cancel')?.addEventListener('click', () => {
    document.getElementById('confirm-overlay').classList.add('hidden'); confirmCallback = null;
  });
  document.getElementById('confirm-ok')?.addEventListener('click', () => {
    document.getElementById('confirm-overlay').classList.add('hidden');
    if (confirmCallback) { confirmCallback(); confirmCallback = null; }
  });
}

// ══════════════════════════════════════════════
// IMAGE UPLOAD + CROP
// ══════════════════════════════════════════════
let cropperInstance  = null;
let cropTargetField  = null; // 'img1' sau 'img2'

function setupImageUpload(fieldNum) {
  const pickBtn   = document.getElementById(`pick-img${fieldNum}`);
  const fileInput = document.getElementById(`file-img${fieldNum}`);
  const removeBtn = document.getElementById(`remove-img${fieldNum}`);

  pickBtn?.addEventListener('click', () => fileInput.click());

  fileInput?.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => openCropModal(ev.target.result, `img${fieldNum}`);
    reader.readAsDataURL(file);
    e.target.value = ''; // permite re-selectarea aceluiași fișier
  });

  removeBtn?.addEventListener('click', () => {
    document.getElementById(`pf-img${fieldNum}`).value = '';
    document.getElementById(`img${fieldNum}-wrap`).style.display = 'none';
  });
}

function openCropModal(src, field) {
  cropTargetField = field;
  const overlay  = document.getElementById('crop-modal-overlay');
  const cropImg  = document.getElementById('crop-image');

  overlay.classList.remove('hidden');
  cropImg.src = src;

  if (cropperInstance) { cropperInstance.destroy(); cropperInstance = null; }

  cropImg.onload = () => {
    cropperInstance = new Cropper(cropImg, {
      aspectRatio: 8 / 9,
      viewMode: 1,
      dragMode: 'move',
      autoCropArea: 0.9,
      restore: false,
      guides: true,
      center: true,
      highlight: false,
      cropBoxMovable: true,
      cropBoxResizable: true,
      toggleDragModeOnDblclick: false,
    });
  };
}

async function confirmCrop() {
  if (!cropperInstance) return;

  const canvas = cropperInstance.getCroppedCanvas({
    width: 800,
    height: 900,
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'high',
  });

  const btn = document.getElementById('crop-confirm');
  btn.disabled = true; btn.textContent = 'Se încarcă...';

  canvas.toBlob(async blob => {
    if (!blob) { btn.disabled = false; btn.textContent = '✔ Aplică & Încarcă'; return; }

    const formData = new FormData();
    formData.append('image', blob, 'product.jpg');

    try {
      const res = await fetch('/api/upload', {
        method:  'POST',
        headers: { 'Authorization': `Bearer ${authToken}` },
        body:    formData,
      });
      const data = await res.json();
      if (data.ok) {
        const fieldNum = cropTargetField.replace('img', '');
        document.getElementById(`pf-${cropTargetField}`).value = data.url;
        const imgEl  = document.getElementById(`${cropTargetField}-preview`);
        const wrap   = document.getElementById(`${cropTargetField}-wrap`);
        imgEl.src    = data.url;
        wrap.style.display = 'flex';
        closeCropModal();
        showAdminToast('Imaginea a fost încărcată!', 'success');
      } else {
        showAdminToast(data.error || 'Eroare la încărcare!', 'error');
      }
    } catch {
      showAdminToast('Eroare de rețea la upload!', 'error');
    }

    btn.disabled = false; btn.textContent = '✔ Aplică & Încarcă';
  }, 'image/jpeg', 0.92);
}

function closeCropModal() {
  document.getElementById('crop-modal-overlay').classList.add('hidden');
  if (cropperInstance) { cropperInstance.destroy(); cropperInstance = null; }
  cropTargetField = null;
}

// ══════════════════════════════════════════════
// CATEGORIES MANAGEMENT MODAL
// ══════════════════════════════════════════════
function openCatsModal() {
  document.getElementById('cats-modal-overlay').classList.remove('hidden');
  renderCatsModal();
}

function closeCatsModal() {
  document.getElementById('cats-modal-overlay').classList.add('hidden');
}

function renderCatsModal() {
  const body = document.getElementById('cats-modal-body');

  const catsHtml = allCategories.length
    ? allCategories.map(c => renderCatItem(c)).join('')
    : '<p style="color:var(--text-muted);text-align:center;padding:20px">Nu există categorii.</p>';

  body.innerHTML = `
    <div class="cat-add-row">
      <input type="text" id="new-cat-name" class="cat-text-input" placeholder="Categorie nouă...">
      <button class="btn-admin btn-primary-admin" id="btn-add-cat">+ Adaugă</button>
    </div>
    <div id="cats-list-container">${catsHtml}</div>
  `;

  document.getElementById('btn-add-cat').addEventListener('click', addCategory);
  document.getElementById('new-cat-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); addCategory(); }
  });

  // Event delegation pentru acțiunile din lista de categorii
  document.getElementById('cats-list-container').addEventListener('click', handleCatsListClick);
  document.getElementById('cats-list-container').addEventListener('keydown', handleCatsListKeydown);
}

function renderCatItem(cat) {
  const safeId = CSS.escape(cat.name);
  return `
    <div class="cat-item" data-cat="${esc(cat.name)}">
      <div class="cat-item-header">
        <input type="text" class="cat-rename-input cat-text-input" value="${esc(cat.name)}" data-orig="${esc(cat.name)}" title="Editează numele categoriei">
        <div class="cat-item-actions">
          <button class="btn-admin btn-sm btn-ghost-admin" data-action="save-cat" title="Salvează">💾 Salvează</button>
          <button class="btn-admin btn-sm btn-danger-sm" data-action="del-cat" title="Șterge categoria">🗑</button>
        </div>
      </div>
      <div class="sub-list">
        ${cat.subcategories.map(s => `
          <span class="sub-tag">
            ${esc(s)}
            <button class="sub-remove-btn" data-action="del-sub" data-sub="${esc(s)}" title="Șterge subcategoria">✕</button>
          </span>
        `).join('')}
      </div>
      <div class="sub-add-row">
        <input type="text" class="sub-new-input cat-text-input" placeholder="Subcategorie nouă..." data-cat="${esc(cat.name)}">
        <button class="btn-admin btn-sm btn-ghost-admin" data-action="add-sub">+ Adaugă</button>
      </div>
    </div>
  `;
}

function handleCatsListClick(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action  = btn.dataset.action;
  const catItem = btn.closest('.cat-item');
  const catName = catItem?.dataset.cat;

  if (action === 'save-cat') {
    const input = catItem.querySelector('.cat-rename-input');
    renameCategory(input.dataset.orig, input.value.trim());
  } else if (action === 'del-cat') {
    deleteCategory(catName);
  } else if (action === 'del-sub') {
    deleteSubcategory(catName, btn.dataset.sub);
  } else if (action === 'add-sub') {
    const input = catItem.querySelector('.sub-new-input');
    addSubcategory(catName, input.value.trim());
  }
}

function handleCatsListKeydown(e) {
  if (e.key !== 'Enter') return;
  const el = e.target;
  if (el.classList.contains('sub-new-input')) {
    e.preventDefault();
    const catItem = el.closest('.cat-item');
    addSubcategory(catItem.dataset.cat, el.value.trim());
  } else if (el.classList.contains('cat-rename-input')) {
    e.preventDefault();
    const catItem = el.closest('.cat-item');
    renameCategory(el.dataset.orig, el.value.trim());
  }
}

// ── Category API helpers ──

async function addCategory() {
  const input = document.getElementById('new-cat-name');
  const name  = input.value.trim();
  if (!name) { input.focus(); return; }

  const res  = await apiRequest('/api/categories', { method: 'POST', body: JSON.stringify({ name }) });
  const data = await res?.json();
  if (data?.ok) {
    allCategories = data.categories;
    input.value   = '';
    renderCatsModal();
    showAdminToast('Categorie adăugată!', 'success');
  } else {
    showAdminToast(data?.error || 'Eroare!', 'error');
  }
}

async function renameCategory(oldName, newName) {
  if (!newName) { showAdminToast('Introduceți un nume valid!', 'error'); return; }
  if (newName === oldName) return;

  const res  = await apiRequest(`/api/categories/${encodeURIComponent(oldName)}`, {
    method: 'PUT', body: JSON.stringify({ name: newName }),
  });
  const data = await res?.json();
  if (data?.ok) {
    allCategories = data.categories;
    renderCatsModal();
    showAdminToast('Categorie redenumită!', 'success');
  } else {
    showAdminToast(data?.error || 'Eroare!', 'error');
  }
}

async function deleteCategory(name) {
  showConfirm(`Ștergi categoria "${name}"?\nProdusele din ea rămân neschimbate.`, async () => {
    const res  = await apiRequest(`/api/categories/${encodeURIComponent(name)}`, { method: 'DELETE' });
    const data = await res?.json();
    if (data?.ok) {
      allCategories = data.categories;
      renderCatsModal();
      showAdminToast('Categorie ștearsă!', 'success');
    } else {
      showAdminToast(data?.error || 'Eroare!', 'error');
    }
  });
}

async function addSubcategory(catName, subName) {
  if (!subName) return;
  const res  = await apiRequest(
    `/api/categories/${encodeURIComponent(catName)}/subcategories`,
    { method: 'POST', body: JSON.stringify({ name: subName }) }
  );
  const data = await res?.json();
  if (data?.ok) {
    allCategories = data.categories;
    renderCatsModal();
    showAdminToast('Subcategorie adăugată!', 'success');
  } else {
    showAdminToast(data?.error || 'Eroare!', 'error');
  }
}

async function deleteSubcategory(catName, subName) {
  const res  = await apiRequest(
    `/api/categories/${encodeURIComponent(catName)}/subcategories/${encodeURIComponent(subName)}`,
    { method: 'DELETE' }
  );
  const data = await res?.json();
  if (data?.ok) {
    allCategories = data.categories;
    renderCatsModal();
    showAdminToast('Subcategorie ștearsă!', 'success');
  } else {
    showAdminToast(data?.error || 'Eroare!', 'error');
  }
}

// ══════════════════════════════════════════════
// TABLE
// ══════════════════════════════════════════════
function populateCatFilter() {
  const sel  = document.getElementById('admin-cat-filter');
  const cats = [...new Set(allProducts.map(p => p.category))].sort();
  sel.innerHTML = '<option value="">Toate categoriile</option>' +
    cats.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
}

function applyAdminFilters() {
  const q   = (document.getElementById('admin-search')?.value || '').toLowerCase().trim();
  const cat = document.getElementById('admin-cat-filter')?.value || '';
  filtered = allProducts.filter(p => {
    const matchCat = !cat || p.category === cat;
    const matchQ   = !q ||
      (p.title||'').toLowerCase().includes(q) ||
      (p.category||'').toLowerCase().includes(q) ||
      (p.details||'').toLowerCase().includes(q);
    return matchCat && matchQ;
  });
  document.getElementById('admin-products-count').textContent = filtered.length;
  renderTable();
}

function renderTable() {
  const tbody      = document.getElementById('admin-tbody');
  const totalPages = Math.ceil(filtered.length / ADMIN_PER_PAGE);
  const start      = (adminPage - 1) * ADMIN_PER_PAGE;
  const page       = filtered.slice(start, start + ADMIN_PER_PAGE);

  if (!page.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:#8A7B75">Nu există produse.</td></tr>`;
    document.getElementById('admin-pagination').innerHTML = '';
    return;
  }

  tbody.innerHTML = page.map(p => {
    const badgeHtml = p.badge
      ? `<span class="badge-pill badge-${p.badge==='NEW'?'new':p.badge==='PROMO'?'promo':'sold'}">${esc(p.badge)}</span>`
      : '—';
    return `<tr>
      <td><img class="prod-thumb" src="${esc(p.imgUrl)}" alt="" loading="lazy" onerror="this.style.opacity='.3'"></td>
      <td class="prod-title-cell">
        <div class="prod-title-text">${esc(p.title)}</div>
        ${p.details ? `<div class="prod-detail-text">${esc(p.details.substring(0,60))}${p.details.length>60?'…':''}</div>` : ''}
      </td>
      <td><div>${esc(p.category)}</div><div style="font-size:11px;color:#8A7B75">${esc(p.subcategory||'')}</div></td>
      <td style="font-weight:700">${p.priceNumeric} MDL</td>
      <td>${badgeHtml}</td>
      <td>
        <div class="action-btns">
          <button class="btn-admin btn-ghost-admin btn-icon-admin" onclick="openModal('${esc(p.id)}')" title="Editează">✏️</button>
          <button class="btn-admin btn-icon-admin" style="color:#C0392B;border:1px solid #f5c6c6" onclick="deleteProduct('${esc(p.id)}')" title="Șterge">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join('');

  renderAdminPagination(totalPages);
}

function renderAdminPagination(totalPages) {
  const el = document.getElementById('admin-pagination');
  if (!el || totalPages <= 1) { el && (el.innerHTML = ''); return; }
  let html = '';
  if (adminPage > 1) html += `<button class="admin-page-btn" data-p="${adminPage-1}">‹</button>`;
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i-adminPage) <= 2)
      html += `<button class="admin-page-btn${i===adminPage?' active':''}" data-p="${i}">${i}</button>`;
    else if (Math.abs(i-adminPage) === 3)
      html += `<span class="admin-page-btn" style="pointer-events:none">…</span>`;
  }
  if (adminPage < totalPages) html += `<button class="admin-page-btn" data-p="${adminPage+1}">›</button>`;
  el.innerHTML = html;
  el.onclick = e => {
    const btn = e.target.closest('[data-p]');
    if (btn) { adminPage = +btn.dataset.p; renderTable(); }
  };
}

// ══════════════════════════════════════════════
// MODAL ADD / EDIT PRODUCT
// ══════════════════════════════════════════════
function populateCategorySelect(selectedCat) {
  const catSel = document.getElementById('pf-category');
  catSel.innerHTML = '<option value="">-- Selectează categoria --</option>' +
    allCategories.map(c => `<option value="${esc(c.name)}">${esc(c.name)}</option>`).join('');
  if (selectedCat) catSel.value = selectedCat;
}

function populateSubcategorySelect(catName, selectedSub) {
  const subSel = document.getElementById('pf-subcategory');
  const cat    = allCategories.find(c => c.name === catName);
  const subs   = cat ? cat.subcategories : [];

  subSel.innerHTML =
    '<option value="">-- Fără subcategorie --</option>' +
    subs.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('');
  if (selectedSub) subSel.value = selectedSub;
}

function setProductImage(field, url) {
  document.getElementById(`pf-${field}`).value = url || '';
  const imgEl = document.getElementById(`${field}-preview`);
  const wrap  = document.getElementById(`${field}-wrap`);
  if (url) {
    imgEl.src = url;
    wrap.style.display = 'flex';
  } else {
    wrap.style.display = 'none';
  }
}

function openModal(id) {
  editingId = id;
  document.getElementById('product-modal-overlay').classList.remove('hidden');
  document.getElementById('modal-title').textContent = id ? 'Editează produsul' : 'Produs nou';

  if (id) {
    const p = allProducts.find(x => x.id === id);
    if (!p) return;
    populateCategorySelect(p.category || '');
    populateSubcategorySelect(p.category || '', p.subcategory || '');
    document.getElementById('pf-id').value       = p.id;
    document.getElementById('pf-title').value    = p.title || '';
    document.getElementById('pf-price').value    = p.priceNumeric || '';
    document.getElementById('pf-badge').value    = p.badge || '';
    document.getElementById('pf-details').value  = p.details || '';
    document.getElementById('pf-isnew').checked  = !!p.isNew;
    setProductImage('img1', p.imgUrl  || '');
    setProductImage('img2', p.imgUrl2 || '');
  } else {
    document.getElementById('product-form').reset();
    populateCategorySelect('');
    populateSubcategorySelect('', '');
    setProductImage('img1', '');
    setProductImage('img2', '');
  }

  // Când se schimbă categoria → actualizează subcategoriile
  document.getElementById('pf-category').onchange = function() {
    populateSubcategorySelect(this.value, '');
  };
}

function closeModal() {
  document.getElementById('product-modal-overlay').classList.add('hidden');
  editingId = null;
}

async function saveProduct() {
  const titleVal = document.getElementById('pf-title').value.trim();
  const priceVal = document.getElementById('pf-price').value;
  const catVal   = document.getElementById('pf-category').value;
  const imgVal   = document.getElementById('pf-img1').value.trim();

  let valid = true;
  [['pf-title',titleVal],['pf-price',priceVal],['pf-category',catVal]].forEach(([id,val]) => {
    document.getElementById(id).classList.toggle('error', !val);
    if (!val) valid = false;
  });
  if (!imgVal) {
    showAdminToast('Selectați o imagine principală!', 'error');
    valid = false;
  }
  if (!valid) { showAdminToast('Completați câmpurile obligatorii!', 'error'); return; }

  const badge = document.getElementById('pf-badge').value;
  const price = parseFloat(priceVal);

  const productData = {
    title:        titleVal,
    priceNumeric: price,
    price:        price + 'MDL',
    currency:     'MDL',
    category:     catVal,
    subcategory:  document.getElementById('pf-subcategory').value || '',
    badge:        badge || null,
    isNew:        badge === 'NEW' || document.getElementById('pf-isnew').checked,
    details:      document.getElementById('pf-details').value.trim(),
    imgUrl:       imgVal,
    imgUrl2:      document.getElementById('pf-img2').value.trim() || null,
  };

  const saveBtn = document.getElementById('modal-save');
  saveBtn.disabled = true; saveBtn.textContent = 'Se salvează...';

  try {
    let result;
    if (editingId) {
      result = await apiUpdateProduct(editingId, productData);
      if (result?.ok) {
        const idx = allProducts.findIndex(x => x.id === editingId);
        if (idx !== -1) allProducts[idx] = result.product;
        showAdminToast('Produs actualizat!', 'success');
      }
    } else {
      result = await apiAddProduct(productData);
      if (result?.ok) {
        allProducts.unshift(result.product);
        showAdminToast('Produs adăugat!', 'success');
      }
    }
    if (result?.ok) {
      closeModal();
      populateCatFilter();
      applyAdminFilters();
    } else {
      showAdminToast(result?.error || 'Eroare la salvare!', 'error');
    }
  } catch {
    showAdminToast('Eroare de rețea!', 'error');
  }

  saveBtn.disabled = false; saveBtn.textContent = 'Salvează produsul';
}

async function deleteProduct(id) {
  const p = allProducts.find(x => x.id === id);
  if (!p) return;
  showConfirm(`Ștergi "${p.title}"? Această acțiune nu poate fi anulată.`, async () => {
    const result = await apiDeleteProduct(id);
    if (result?.ok) {
      allProducts = allProducts.filter(x => x.id !== id);
      applyAdminFilters();
      showAdminToast('Produs șters!', 'success');
    } else {
      showAdminToast('Eroare la ștergere!', 'error');
    }
  });
}

// ══════════════════════════════════════════════
// IMPORT / EXPORT
// ══════════════════════════════════════════════
function exportJSON() {
  const data = { meta: { exportedAt: new Date().toISOString(), totalProducts: allProducts.length }, products: allProducts };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: 'products_' + new Date().toISOString().slice(0,10) + '.json' });
  a.click(); URL.revokeObjectURL(url);
  showAdminToast('JSON exportat cu succes!', 'success');
}

function importJSON(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async ev => {
    try {
      const data     = JSON.parse(ev.target.result);
      const products = data.products || (Array.isArray(data) ? data : null);
      if (!products?.length) throw new Error('Format invalid');
      showConfirm(`Importezi ${products.length} produse pe server? Datele existente vor fi înlocuite.`, async () => {
        const result = await apiImportProducts(products);
        if (result?.ok) {
          allProducts = products;
          populateCatFilter(); applyAdminFilters();
          showAdminToast(`${products.length} produse importate pe server!`, 'success');
        } else {
          showAdminToast('Eroare la import!', 'error');
        }
      });
    } catch {
      showAdminToast('Fișier JSON invalid!', 'error');
    }
    e.target.value = '';
  };
  reader.readAsText(file);
}

// ══════════════════════════════════════════════
// CHANGE PASSWORD
// ══════════════════════════════════════════════
async function handleChangePassword() {
  const oldPass = document.getElementById('old-pass').value;
  const newPass = document.getElementById('new-pass').value;
  const conf    = document.getElementById('confirm-pass').value;
  const errEl   = document.getElementById('pass-error');
  errEl.classList.add('hidden');

  if (newPass.length < 6) {
    errEl.textContent = 'Parola nouă trebuie să aibă minim 6 caractere.';
    errEl.classList.remove('hidden'); return;
  }
  if (newPass !== conf) {
    errEl.textContent = 'Parolele nu coincid.';
    errEl.classList.remove('hidden'); return;
  }

  try {
    const checkRes = await fetch('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: oldPass }),
    });
    if (!checkRes.ok) { errEl.textContent = 'Parola curentă este incorectă.'; errEl.classList.remove('hidden'); return; }

    const res = await apiRequest('/api/auth/change-password', {
      method: 'POST', body: JSON.stringify({ newPassword: newPass }),
    });
    const data = await res.json();
    if (data.ok) {
      document.getElementById('pass-modal-overlay').classList.add('hidden');
      showAdminToast('Parola a fost schimbată! Reconectează-te.', 'success');
      setTimeout(logout, 2000);
    } else {
      errEl.textContent = data.error || 'Eroare'; errEl.classList.remove('hidden');
    }
  } catch {
    errEl.textContent = 'Eroare de rețea.'; errEl.classList.remove('hidden');
  }
}

// ══════════════════════════════════════════════
// UI HELPERS
// ══════════════════════════════════════════════
function showConfirm(msg, cb) {
  document.getElementById('confirm-message').textContent = msg;
  document.getElementById('confirm-overlay').classList.remove('hidden');
  confirmCallback = cb;
}

function showAdminToast(msg, type = '') {
  const t = document.getElementById('admin-toast');
  t.textContent = msg;
  t.className   = 'admin-toast show' + (type ? ' ' + type : '');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 3000);
}

function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
