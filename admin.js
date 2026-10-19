// Dataset Produk Default (Kasir Cafe)
const DEFAULT_PRODUCTS = [
  {
    id: 'aetheria',
    name: 'AMERICANO',
    category: 'Coffe',
    image: 'assets/americano.png',
    description: 'Kopi espresso racikan khas cafe dengan keharuman aroma yang manis dan lembut.',
    badge: 'Ready Stock',
    badgeClass: 'pulse-green',
    isReady: true,
    variants: [
      { size: 'Ice', price: 25000, stock: 15 },
      { size: 'Hot', price: 22000, stock: 10 }
    ]
  },
  {
    id: 'oud-nocturne',
    name: 'MOCHA LATTE',
    category: 'Coklat',
    image: 'assets/Mocha Latte.png',
    description: 'Coklat hangat/dingin premium dengan perpaduan rempah manis nan kaya rasa.',
    badge: 'Ready Stock',
    badgeClass: 'pulse-green',
    isReady: true,
    variants: [
      { size: 'Ice', price: 28000, stock: 12 },
      { size: 'Hot', price: 25000, stock: 8 }
    ]
  },
  {
    id: 'thalassa',
    name: 'CARBONARA',
    category: 'Makanan',
    image: 'assets/carbonara.png',
    description: 'Kesegaran pasta gurih berkrim spesial khas resep dapur cafe.',
    badge: 'Ready Stock',
    badgeClass: 'pulse-green',
    isReady: true,
    variants: [
      { size: 'Ice', price: 24000, stock: 15 },
      { size: 'Hot', price: 20000, stock: 10 }
    ]
  },
  {
    id: 'solstice',
    name: 'FRENCH FRIES',
    category: 'Camilan',
    image: 'assets/french fries.png',
    description: 'Camilan kentang goreng renyah dengan taburan bumbu gurih spesial.',
    badge: 'Ready Stock',
    badgeClass: 'pulse-green',
    isReady: true,
    variants: [
      { size: 'Ice', price: 22000, stock: 18 },
      { size: 'Hot', price: 18000, stock: 10 }
    ]
  }
];

// Admin Credentials
const ADMIN_PASSWORD_REQUIRED = 'admin123';
let currentFormImageDataUrl = 'assets/americano.png';

// Helper Format Rupiah
function formatRupiah(amount) {
  return 'Rp ' + (Number(amount) || 0).toLocaleString('id-ID');
}

// Inisialisasi Storage Produk (Sync dengan cafe_store_products)
function loadAdminProducts() {
  let stored = null;
  try {
    stored = JSON.parse(localStorage.getItem('cafe_store_products'));
    if (!stored) stored = JSON.parse(localStorage.getItem('parfum_store_products'));
  } catch (e) {
    stored = null;
  }

  if (!stored || !Array.isArray(stored) || stored.some(p => p.variants && p.variants.some(v => v.size && v.size.includes('ml')))) {
    localStorage.setItem('cafe_store_products', JSON.stringify(DEFAULT_PRODUCTS));
    localStorage.setItem('parfum_store_products', JSON.stringify(DEFAULT_PRODUCTS));
    stored = DEFAULT_PRODUCTS;
  } else {
    let updated = false;
    stored.forEach(p => {
      if (p.image === 'assets/americano.jpg' || !p.image || p.image.includes('perfume')) {
        if (p.id === 'aetheria') p.image = 'assets/americano.png';
        else if (p.id === 'oud-nocturne') p.image = 'assets/Mocha Latte.png';
        else if (p.id === 'thalassa') p.image = 'assets/carbonara.png';
        else if (p.id === 'solstice') p.image = 'assets/french fries.png';
        else p.image = 'assets/americano.png';
        updated = true;
      }
    });
    if (updated) {
      localStorage.setItem('cafe_store_products', JSON.stringify(stored));
      localStorage.setItem('parfum_store_products', JSON.stringify(stored));
    }
  }
  return stored;
}

let PRODUCTS = loadAdminProducts();
let searchQuery = '';

// Helper Storage Transaksi Konsisten (Key: 'transactions')
function getTransactionsFromStorage() {
  let txs = [];
  try {
    const raw = localStorage.getItem('transactions');
    if (raw) txs = JSON.parse(raw);
  } catch (e) { console.error(e); }

  if (!Array.isArray(txs) || txs.length === 0) {
    try {
      const oldRaw = localStorage.getItem('cafe_orders') || localStorage.getItem('em_parfume_orders');
      if (oldRaw) {
        const oldOrders = JSON.parse(oldRaw);
        if (Array.isArray(oldOrders) && oldOrders.length > 0) {
          txs = oldOrders.map(o => ({
            id: o.id,
            date: o.date || new Date().toISOString(),
            customer_name: o.customer_name || 'Pelanggan',
            total_price: Number(o.total_price) || 0,
            status: o.status || 'selesai',
            metode_pembayaran: o.metode_pembayaran || 'Cash',
            ratio_notes: o.ratio_notes || '-',
            items: o.items || []
          }));
          localStorage.setItem('transactions', JSON.stringify(txs));
        }
      }
    } catch (e) { console.error(e); }
  }
  return txs;
}

function saveTransactionToStorage(newTx) {
  const txs = getTransactionsFromStorage();
  txs.push(newTx);
  localStorage.setItem('transactions', JSON.stringify(txs));
  localStorage.setItem('cafe_orders', JSON.stringify(txs));
}

// ==================== LOGIKA OTENTIKASI ADMIN ====================

function checkAuthSession() {
  const isLoggedIn = sessionStorage.getItem('admin_logged_in') === 'true';
  const loginView = document.getElementById('login-view');
  const dashboardView = document.getElementById('dashboard-view');

  if (isLoggedIn) {
    if (loginView) loginView.classList.add('hidden');
    if (dashboardView) dashboardView.classList.remove('hidden');
    renderAdminDashboard();
  } else {
    if (loginView) loginView.classList.remove('hidden');
    if (dashboardView) dashboardView.classList.add('hidden');
  }
}

function handleLogin(event) {
  event.preventDefault();
  const usernameInput = document.getElementById('login-username')?.value.trim();
  const passwordInput = document.getElementById('login-password')?.value.trim();
  const errorMsg = document.getElementById('login-error-msg');

  if (passwordInput === ADMIN_PASSWORD_REQUIRED) {
    if (errorMsg) errorMsg.classList.add('hidden');
    sessionStorage.setItem('admin_logged_in', 'true');
    checkAuthSession();
  } else {
    if (errorMsg) {
      errorMsg.textContent = 'Password salah! Gunakan password yang benar';
      errorMsg.classList.remove('hidden');
    }
  }
}

function handleLogout() {
  sessionStorage.removeItem('admin_logged_in');
  checkAuthSession();
}

// ==================== MANAJEMEN KATEGORI DINAMIS (KOLLABORA_KATEGORI) ====================
const DEFAULT_CATEGORIES = ["Coffe", "Coklat", "Makanan", "Camilan"];
let adminSelectedCategory = 'Semua';

// Helper Ambil Kategori dari LocalStorage (Inisialisasi jika belum ada)
function getKollaboraCategories() {
  try {
    const raw = localStorage.getItem('kollabora_kategori');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Gagal membaca kollabora_kategori:', e);
  }
  // Inisialisasi default jika belum ada atau kosong
  localStorage.setItem('kollabora_kategori', JSON.stringify(DEFAULT_CATEGORIES));
  return [...DEFAULT_CATEGORIES];
}

// Simpan Kategori ke LocalStorage
function saveKollaboraCategories(categories) {
  localStorage.setItem('kollabora_kategori', JSON.stringify(categories));
  window.dispatchEvent(new CustomEvent('kollabora_categories_updated', { detail: categories }));
}

// Render Dropdown Pilihan Kategori di Modal Tambah/Edit Produk
function populateCategorySelect(selectedValue = '') {
  const select = document.getElementById('kategori') || document.getElementById('form-product-category');
  if (!select) return;

  const categories = getKollaboraCategories();
  
  // Jika selectedValue tidak ada dalam list kategori (misal kategori lama), masukkan sementara agar tidak hilang
  const optionsList = [...categories];
  if (selectedValue && !optionsList.includes(selectedValue)) {
    optionsList.unshift(selectedValue);
  }

  select.innerHTML = optionsList.map(cat => `<option value="${cat}">${cat}</option>`).join('');

  if (selectedValue && optionsList.includes(selectedValue)) {
    select.value = selectedValue;
  } else if (optionsList.length > 0) {
    select.value = optionsList[0];
  }
}

// Render Daftar Kategori di Modal Kelola Kategori
function renderCategoryList() {
  const container = document.getElementById('category-list-container');
  const countBadge = document.getElementById('category-count-badge');
  const emptyState = document.getElementById('category-empty-state');
  if (!container) return;

  const categories = getKollaboraCategories();

  if (countBadge) {
    countBadge.textContent = `${categories.length} Kategori`;
  }

  if (categories.length === 0) {
    container.innerHTML = '';
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }
  if (emptyState) emptyState.classList.add('hidden');

  container.innerHTML = categories.map((cat) => {
    // Hitung jumlah produk yang menggunakan kategori ini
    const usedCount = PRODUCTS.filter(p => p.category && p.category.toLowerCase() === cat.toLowerCase()).length;
    const escapedCat = cat.replace(/'/g, "\\'");
    return `
      <div class="flex items-center justify-between p-3 bg-zinc-800/80 rounded-xl border border-white/5 hover:border-amber-500/20 transition-all">
        <div class="flex items-center space-x-2.5">
          <span class="w-2 h-2 rounded-full bg-amber-400"></span>
          <span class="font-semibold text-sm text-zinc-100">${cat}</span>
          <span class="text-[10px] text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded-full border border-white/5 font-mono">${usedCount} Produk</span>
        </div>
        <button type="button" onclick="deleteCategory('${escapedCat}')" class="text-zinc-500 hover:text-red-400 hover:bg-red-500/10 p-1.5 rounded-lg transition-colors cursor-pointer" title="Hapus kategori ${cat}">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    `;
  }).join('');
}

// Tambah Kategori Baru
function handleAddCategory(e) {
  if (e) e.preventDefault();
  const input = document.getElementById('new-category-input');
  if (!input) return;

  const name = input.value.trim();
  if (!name) {
    alert('Nama kategori tidak boleh kosong!');
    return;
  }

  const categories = getKollaboraCategories();
  const isDuplicate = categories.some(c => c.toLowerCase() === name.toLowerCase());
  if (isDuplicate) {
    alert(`Kategori "${name}" sudah ada!`);
    return;
  }

  categories.push(name);
  saveKollaboraCategories(categories);
  input.value = '';

  // Auto Re-render
  renderCategoryList();
  populateCategorySelect();
  renderAdminCategoryChips();
  renderProductTable();
}

// Hapus Kategori
function deleteCategory(categoryName) {
  const categories = getKollaboraCategories();
  const usedCount = PRODUCTS.filter(p => p.category && p.category.toLowerCase() === categoryName.toLowerCase()).length;

  let confirmMsg = `Yakin ingin menghapus kategori "${categoryName}"?`;
  if (usedCount > 0) {
    confirmMsg = `Kategori "${categoryName}" saat ini digunakan oleh ${usedCount} produk.\n\nYakin ingin tetap menghapus kategori ini?`;
  }

  if (!confirm(confirmMsg)) {
    return;
  }

  const updated = categories.filter(c => c.toLowerCase() !== categoryName.toLowerCase());
  saveKollaboraCategories(updated);

  // Auto Re-render
  renderCategoryList();
  populateCategorySelect();
  renderAdminCategoryChips();
  renderProductTable();
}

// Reset Kategori ke Nilai Default
function resetCategoriesToDefault() {
  if (confirm('Pulihkan daftar kategori ke setelan default (Coffe, Coklat, Makanan, Camilan)?')) {
    saveKollaboraCategories([...DEFAULT_CATEGORIES]);
    renderCategoryList();
    populateCategorySelect();
    renderAdminCategoryChips();
    renderProductTable();
  }
}

// Buka Modal Kelola Kategori
function openCategoryModal() {
  const modal = document.getElementById('category-modal');
  const overlay = document.getElementById('category-modal-overlay');
  const content = document.getElementById('category-modal-content');
  const input = document.getElementById('new-category-input');

  if (!modal) return;
  renderCategoryList();

  modal.classList.remove('hidden', 'pointer-events-none');
  setTimeout(() => {
    overlay?.classList.remove('opacity-0');
    content?.classList.remove('translate-y-8', 'opacity-0', 'scale-95');
    if (input) input.focus();
  }, 10);
}

// Tutup Modal Kelola Kategori
function closeCategoryModal() {
  const modal = document.getElementById('category-modal');
  const overlay = document.getElementById('category-modal-overlay');
  const content = document.getElementById('category-modal-content');

  if (!modal) return;
  overlay?.classList.add('opacity-0');
  content?.classList.add('translate-y-8', 'opacity-0', 'scale-95');

  setTimeout(() => {
    modal.classList.add('hidden', 'pointer-events-none');
  }, 300);
}

// Render Filter Chips Kategori di Dashboard Admin
function renderAdminCategoryChips() {
  const container = document.getElementById('admin-category-chips');
  if (!container) return;

  const categories = ['Semua', ...getKollaboraCategories()];
  if (!categories.includes(adminSelectedCategory)) {
    adminSelectedCategory = 'Semua';
  }

  container.innerHTML = categories.map(cat => {
    const isActive = adminSelectedCategory === cat;
    return `
      <button type="button" class="px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${isActive
        ? 'bg-amber-400 text-black shadow-sm font-bold'
        : 'bg-zinc-900 border border-white/10 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
      }">
        ${cat}
      </button>
    `;
  }).join('');

  const chips = container.querySelectorAll('button');
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      adminSelectedCategory = chip.textContent.trim();
      renderAdminCategoryChips();
      renderProductTable();
    });
  });
}

// ==================== RENDER ADMIN DASHBOARD ====================

function renderAdminDashboard() {
  PRODUCTS = loadAdminProducts();
  renderStats();
  renderAdminCategoryChips();
  renderProductTable();
  renderTransactionHistory();
}

// Helper Filter Transaksi berdasarkan Rentang Waktu Dropdown
function filterTransactionsByTime(transactions, filterType) {
  if (filterType === 'all') return transactions;

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return transactions.filter(tx => {
    const txDate = new Date(tx.date);
    if (isNaN(txDate.getTime())) return true;

    if (filterType === 'today') {
      return txDate >= startOfToday;
    } else if (filterType === 'yesterday') {
      const startOfYesterday = new Date(startOfToday);
      startOfYesterday.setDate(startOfYesterday.getDate() - 1);
      return txDate >= startOfYesterday && txDate < startOfToday;
    } else if (filterType === '7days') {
      const sevenDaysAgo = new Date(startOfToday);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      return txDate >= sevenDaysAgo;
    } else if (filterType === '30days') {
      const thirtyDaysAgo = new Date(startOfToday);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return txDate >= thirtyDaysAgo;
    }
    return true;
  });
}

function renderStats() {
  PRODUCTS = loadAdminProducts();
  const totalProductsEl = document.getElementById('stat-total-products');
  const totalStockEl = document.getElementById('stat-total-stock');
  const totalTransactionsEl = document.getElementById('stat-total-transactions');
  const totalRevenueEl = document.getElementById('stat-total-revenue');
  const timeFilterSelect = document.getElementById('time-filter');

  const totalProducts = PRODUCTS.length;
  let totalStock = 0;

  PRODUCTS.forEach(p => {
    if (p.variants) {
      p.variants.forEach(v => totalStock += (v.stock || 0));
    }
  });

  if (totalProductsEl) totalProductsEl.textContent = totalProducts;
  if (totalStockEl) totalStockEl.textContent = totalStock;

  const timeFilterVal = timeFilterSelect ? timeFilterSelect.value : '30days';
  const allTx = getTransactionsFromStorage();
  const completedTx = allTx.filter(t => t.status === 'selesai' || !t.status);
  const filteredTx = filterTransactionsByTime(completedTx, timeFilterVal);

  const totalTransactionsCount = filteredTx.length;
  const totalRevenue = filteredTx.reduce((sum, t) => sum + (Number(t.total_price) || 0), 0);

  if (totalTransactionsEl) totalTransactionsEl.textContent = totalTransactionsCount;
  if (totalRevenueEl) totalRevenueEl.textContent = formatRupiah(totalRevenue);
}

function renderProductTable() {
  const tbody = document.getElementById('admin-product-table-body');
  const emptyState = document.getElementById('admin-table-empty-state');
  if (!tbody) return;

  tbody.innerHTML = '';

  const filtered = PRODUCTS.filter(p => {
    if (adminSelectedCategory !== 'Semua' && p.category !== adminSelectedCategory) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return p.name.toLowerCase().includes(q) || (p.category && p.category.toLowerCase().includes(q));
  });

  if (filtered.length === 0) {
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }
  if (emptyState) emptyState.classList.add('hidden');

  filtered.forEach(p => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-white/5 transition-colors border-b border-white/5';

    const variantBadges = p.variants.map(v => {
      const isOut = v.stock === 0;
      return `<span class="inline-block px-2 py-0.5 rounded text-xs font-semibold mr-1 mb-1 ${isOut ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-zinc-800 text-amber-300 border border-white/10'}">
        ${v.size}: ${formatRupiah(v.price)} (${v.stock} unit)
      </span>`;
    }).join('');

    tr.innerHTML = `
      <td class="p-4">
        <img src="${p.image || 'assets/americano.png'}" alt="${p.name}" onerror="this.onerror=null;this.src='assets/americano.png';" class="w-12 h-12 object-cover rounded-lg border border-white/10 bg-zinc-900">
      </td>
      <td class="p-4 font-bold text-zinc-100">${p.name}</td>
      <td class="p-4"><span class="px-2 py-1 bg-amber-400/10 text-amber-400 text-xs rounded-md border border-amber-500/20 font-semibold">${p.category}</span></td>
      <td class="p-4">${variantBadges}</td>
      <td class="p-4 text-right space-x-2">
        <button onclick="editProduct('${p.id}')" class="px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20 rounded-lg text-xs font-semibold transition-colors cursor-pointer">Edit</button>
        <button onclick="deleteProduct('${p.id}')" class="px-3 py-1.5 bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-600 hover:text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer">Hapus</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ==================== MODAL ADD / EDIT PRODUCT & IMAGE UPLOAD ====================

function handleImageFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    currentFormImageDataUrl = e.target.result;
    const preview = document.getElementById('form-image-preview');
    const placeholder = document.getElementById('form-image-placeholder');
    if (preview) {
      preview.src = currentFormImageDataUrl;
      preview.classList.remove('hidden');
    }
    if (placeholder) {
      placeholder.classList.add('hidden');
    }
  };
  reader.readAsDataURL(file);
}

function openProductModal(product = null) {
  const modal = document.getElementById('product-modal');
  const overlay = document.getElementById('product-modal-overlay');
  const content = document.getElementById('product-modal-content');
  const title = document.getElementById('modal-title');
  const form = document.getElementById('product-form');
  const preview = document.getElementById('form-image-preview');
  const placeholder = document.getElementById('form-image-placeholder');
  const fileInput = document.getElementById('form-product-image-file');

  if (!modal) return;

  form.reset();
  if (fileInput) fileInput.value = '';
  document.getElementById('form-variants-container').innerHTML = '';

  if (product) {
    title.textContent = 'Edit Menu Produk';
    document.getElementById('form-product-id').value = product.id;
    document.getElementById('form-product-name').value = product.name;
    populateCategorySelect(product.category);
    document.getElementById('form-product-desc').value = product.description || '';
    currentFormImageDataUrl = product.image || 'assets/americano.png';

    if (product.variants && product.variants.length > 0) {
      product.variants.forEach(v => addVariantRow(v.size, v.price, v.stock));
    } else {
      addVariantRow('Ice', 25000, 10);
      addVariantRow('Hot', 20000, 10);
    }
  } else {
    title.textContent = 'Tambah Produk Baru';
    document.getElementById('form-product-id').value = '';
    populateCategorySelect();
    currentFormImageDataUrl = 'assets/americano.png';
    addVariantRow('Ice', 25000, 15);
    addVariantRow('Hot', 22000, 10);
  }

  if (preview) {
    preview.src = currentFormImageDataUrl;
    preview.onerror = function () {
      this.onerror = null;
      this.src = 'assets/americano.png';
    };
    preview.classList.remove('hidden');
  }
  if (placeholder) {
    placeholder.classList.add('hidden');
  }

  modal.classList.remove('hidden', 'pointer-events-none');
  setTimeout(() => {
    overlay.classList.remove('opacity-0');
    content.classList.remove('translate-y-8', 'opacity-0', 'scale-95');
  }, 10);
}

function closeProductModal() {
  const modal = document.getElementById('product-modal');
  const overlay = document.getElementById('product-modal-overlay');
  const content = document.getElementById('product-modal-content');

  if (!modal) return;
  overlay.classList.add('opacity-0');
  content.classList.add('translate-y-8', 'opacity-0', 'scale-95');

  setTimeout(() => {
    modal.classList.add('hidden', 'pointer-events-none');
  }, 300);
}

function addVariantRow(size = 'Ice', price = 25000, stock = 10) {
  const container = document.getElementById('form-variants-container');
  if (!container) return;

  const row = document.createElement('div');
  row.className = 'variant-row flex items-center space-x-2 bg-zinc-800 p-2 rounded-xl border border-white/5';
  row.innerHTML = `
    <div class="flex-1">
      <input type="text" class="form-variant-size w-full bg-zinc-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-amber-400" placeholder="Ice / Hot" value="${size}" required>
    </div>
    <div class="w-32">
      <input type="number" class="form-variant-price w-full bg-zinc-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-amber-400" placeholder="Harga (Rp)" value="${price}" required min="0">
    </div>
    <div class="w-24">
      <input type="number" class="form-variant-stock w-full bg-zinc-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-amber-400" placeholder="Stok" value="${stock}" required min="0">
    </div>
    <button type="button" onclick="this.closest('.variant-row').remove()" class="p-1.5 text-red-400 hover:text-red-300 transition-colors shrink-0 cursor-pointer">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    </button>
  `;
  container.appendChild(row);
}

function handleProductFormSubmit(event) {
  event.preventDefault();

  const idInput = document.getElementById('form-product-id').value;
  const name = document.getElementById('form-product-name').value.trim();
  const catInput = document.getElementById('kategori') || document.getElementById('form-product-category');
  const category = catInput ? catInput.value : 'Coffe';
  const description = document.getElementById('form-product-desc').value.trim();

  const variantRows = document.querySelectorAll('.variant-row');
  const variants = [];

  variantRows.forEach(row => {
    const size = row.querySelector('.form-variant-size').value.trim() || 'Ice';
    const price = parseInt(row.querySelector('.form-variant-price').value) || 0;
    const stock = parseInt(row.querySelector('.form-variant-stock').value) || 0;
    const label = stock === 0 ? 'Habis' : (stock <= 5 ? `Sisa ${stock} unit` : 'Ready Stock');
    variants.push({ size, price, stock, label });
  });

  if (variants.length === 0) {
    alert('Tambahkan minimal satu varian (Ice/Hot)!');
    return;
  }

  const imagePath = currentFormImageDataUrl || 'assets/americano.png';

  if (idInput) {
    const index = PRODUCTS.findIndex(p => p.id === idInput);
    if (index !== -1) {
      PRODUCTS[index] = {
        ...PRODUCTS[index],
        name,
        category,
        image: imagePath,
        description,
        variants,
        badge: variants.every(v => v.stock === 0) ? 'Habis' : 'Ready Stock',
        badgeClass: variants.every(v => v.stock === 0) ? 'bg-zinc-600' : 'pulse-green',
        isReady: variants.some(v => v.stock > 0)
      };
    }
  } else {
    const newId = name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.floor(Math.random() * 1000);
    const newProd = {
      id: newId,
      name,
      category,
      image: imagePath,
      description,
      badge: 'Ready Stock',
      badgeClass: 'pulse-green',
      isReady: true,
      variants
    };
    PRODUCTS.push(newProd);
  }

  localStorage.setItem('cafe_store_products', JSON.stringify(PRODUCTS));
  localStorage.setItem('parfum_store_products', JSON.stringify(PRODUCTS));
  closeProductModal();
  renderAdminDashboard();
}

window.editProduct = function (id) {
  const prod = PRODUCTS.find(p => p.id === id);
  if (prod) openProductModal(prod);
};

window.deleteProduct = function (id) {
  if (confirm('Apakah Anda yakin ingin menghapus produk ini?')) {
    PRODUCTS = PRODUCTS.filter(p => p.id !== id);
    localStorage.setItem('cafe_store_products', JSON.stringify(PRODUCTS));
    localStorage.setItem('parfum_store_products', JSON.stringify(PRODUCTS));
    renderAdminDashboard();
  }
};

// ==================== TRANSAKSI & STRUKS ====================

function renderTransactionHistory(customList = null) {
  const tbody = document.getElementById('transaction-table-body');
  const emptyState = document.getElementById('transaction-table-empty-state');
  const counterBadge = document.getElementById('stat-total-transactions-counter');
  if (!tbody) return;

  tbody.innerHTML = '';
  const transactions = customList !== null ? customList : getTransactionsFromStorage();

  if (counterBadge) {
    counterBadge.textContent = `${transactions.length} Transaksi`;
  }

  if (transactions.length === 0) {
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }
  if (emptyState) emptyState.classList.add('hidden');

  const sorted = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));

  sorted.forEach(o => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-white/5 transition-colors border-b border-white/5';

    let dateStr = '-';
    try {
      const d = new Date(o.date);
      dateStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    } catch (e) { dateStr = o.date || '-'; }

    tr.innerHTML = `
      <td class="p-4 text-xs font-mono text-zinc-400">${dateStr}</td>
      <td class="p-4 font-mono text-amber-400 font-bold">#${o.id}</td>
      <td class="p-4 font-semibold text-zinc-200">${o.customer_name || 'Pelanggan'}</td>
      <td class="p-4 text-xs text-zinc-300">
        <div>${o.ratio_notes || '-'}</div>
        <div class="text-[10px] text-zinc-500 mt-0.5">Metode: <span class="text-amber-400 font-medium">${o.metode_pembayaran || 'Cash'}</span></div>
      </td>
      <td class="p-4 text-right font-extrabold text-amber-400 font-mono">${formatRupiah(o.total_price)}</td>
      <td class="p-4 text-right">
        <button onclick="viewReceiptAdmin('${o.id}')" class="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-white/10 rounded-lg text-xs font-semibold transition-colors cursor-pointer">Cetak Struk</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function filterTransactionsByDate() {
  const startDateVal = document.getElementById('start-date-input')?.value;
  const endDateVal = document.getElementById('end-date-input')?.value;

  if (!startDateVal || !endDateVal) {
    alert("Silakan pilih tanggal 'Dari' dan 'Sampai' terlebih dahulu.");
    return;
  }

  const startDate = new Date(startDateVal);
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(endDateVal);
  endDate.setHours(23, 59, 59, 999);

  const allTx = getTransactionsFromStorage();
  const filtered = allTx.filter(tx => {
    const txDate = new Date(tx.date);
    return !isNaN(txDate.getTime()) && txDate >= startDate && txDate <= endDate;
  });

  renderTransactionHistory(filtered);
}

function resetTransactionDateFilter() {
  if (document.getElementById('start-date-input')) document.getElementById('start-date-input').value = '';
  if (document.getElementById('end-date-input')) document.getElementById('end-date-input').value = '';
  renderTransactionHistory();
}

function simulateTransaction() {
  const orderId = 'ORD-' + Math.floor(100000 + Math.random() * 900000);
  const sampleOrder = {
    id: orderId,
    date: new Date().toISOString(),
    customer_name: 'Simulasi Kasir (Budi)',
    total_price: 47000,
    status: 'selesai',
    metode_pembayaran: 'Cash',
    ratio_notes: 'AMERICANO (Ice) x1, MOCHA LATTE (Hot) x1',
    items: [
      { product_name: 'AMERICANO', variant_size: 'Ice', price: 25000, quantity: 1 },
      { product_name: 'MOCHA LATTE', variant_size: 'Hot', price: 22000, quantity: 1 }
    ]
  };

  saveTransactionToStorage(sampleOrder);
  renderAdminDashboard();
}

function clearTransactions() {
  if (confirm('Apakah Anda yakin ingin menghapus seluruh riwayat transaksi?')) {
    localStorage.removeItem('transactions');
    localStorage.removeItem('cafe_orders');
    localStorage.removeItem('cafe_order_details');
    localStorage.removeItem('em_parfume_orders');
    localStorage.removeItem('em_parfume_order_details');
    renderAdminDashboard();
    alert('Seluruh riwayat transaksi berhasil dikosongkan.');
  }
}

window.viewReceiptAdmin = function (orderId) {
  const txs = getTransactionsFromStorage();
  const order = txs.find(o => o.id === orderId);
  if (!order) return;

  const items = (order.items && order.items.length > 0)
    ? order.items
    : [{
      product_name: order.ratio_notes || 'Menu Cafe',
      quantity: 1,
      price: order.total_price,
      variant_size: 'Ice'
    }];

  showReceipt(order, items);
};

function showReceipt(transactionData, itemsData) {
  const modal = document.getElementById('receipt-modal');
  if (!modal) return;

  const invEl = document.getElementById('receipt-invoice');
  const dateEl = document.getElementById('receipt-date');
  const custEl = document.getElementById('receipt-customer');
  const methodEl = document.getElementById('receipt-method');
  const totalEl = document.getElementById('receipt-total');
  const itemsContainer = document.getElementById('receipt-items');

  if (invEl) invEl.textContent = `#${transactionData.id}`;
  const dateObj = new Date(transactionData.date || new Date());
  if (dateEl) {
    dateEl.textContent = `${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${dateObj.getFullYear()} ${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;
  }

  if (custEl) custEl.textContent = transactionData.customer_name || 'Pelanggan';
  if (methodEl) methodEl.textContent = (transactionData.metode_pembayaran || 'Cash').toUpperCase();
  if (totalEl) totalEl.textContent = formatRupiah(transactionData.total_price);

  if (itemsContainer) {
    itemsContainer.innerHTML = '';
    itemsData.forEach(item => {
      const itemRow = document.createElement('div');
      itemRow.className = 'flex justify-between font-bold text-xs mt-1';
      const pName = item.product_name || 'Menu Cafe';
      const pQty = item.quantity || 1;
      const pPrice = item.price || transactionData.total_price;
      const vSize = item.variant_size || '';

      itemRow.innerHTML = `
        <div>
          <div>${pName} ${vSize ? `(${vSize})` : ''}</div>
          <div class="text-zinc-600 font-normal text-[10px]">${pQty} x ${formatRupiah(pPrice)}</div>
        </div>
        <span>${formatRupiah(pPrice * pQty)}</span>
      `;
      itemsContainer.appendChild(itemRow);
    });
  }

  modal.classList.remove('hidden');
  setTimeout(() => modal.classList.remove('opacity-0'), 10);
}

function printReceipt() {
  window.print();
}

function closeReceiptModal() {
  const modal = document.getElementById('receipt-modal');
  if (!modal) return;
  modal.classList.add('opacity-0');
  setTimeout(() => modal.classList.add('hidden'), 300);
}

// Global functions attached to window
window.getTransactionsFromStorage = getTransactionsFromStorage;
window.saveTransactionToStorage = saveTransactionToStorage;
window.filterTransactionsByDate = filterTransactionsByDate;
window.resetTransactionDateFilter = resetTransactionDateFilter;
window.clearTransactions = clearTransactions;
window.simulateTransaction = simulateTransaction;
window.showReceipt = showReceipt;
window.printReceipt = printReceipt;
window.closeReceiptModal = closeReceiptModal;
window.openCategoryModal = openCategoryModal;
window.closeCategoryModal = closeCategoryModal;
window.handleAddCategory = handleAddCategory;
window.deleteCategory = deleteCategory;
window.resetCategoriesToDefault = resetCategoriesToDefault;
window.getKollaboraCategories = getKollaboraCategories;
window.populateCategorySelect = populateCategorySelect;

// Listen to storage event across tabs
window.addEventListener('storage', (e) => {
  if (e.key === 'kollabora_kategori') {
    renderCategoryList();
    populateCategorySelect();
    renderAdminCategoryChips();
    renderProductTable();
  }
});

// Initialization
document.addEventListener('DOMContentLoaded', () => {
  // Pastikan kategori awal tersimpan
  getKollaboraCategories();

  checkAuthSession();

  document.getElementById('login-form')?.addEventListener('submit', handleLogin);
  document.getElementById('logout-btn')?.addEventListener('click', handleLogout);

  document.getElementById('admin-search-input')?.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderProductTable();
  });

  document.getElementById('time-filter')?.addEventListener('change', renderStats);

  document.getElementById('form-product-image-file')?.addEventListener('change', handleImageFileUpload);

  document.getElementById('add-product-btn')?.addEventListener('click', () => openProductModal(null));
  document.getElementById('modal-close-x')?.addEventListener('click', closeProductModal);
  document.getElementById('modal-cancel-btn')?.addEventListener('click', closeProductModal);
  document.getElementById('product-modal-overlay')?.addEventListener('click', closeProductModal);
  document.getElementById('add-variant-row-btn')?.addEventListener('click', () => addVariantRow('Ice', 25000, 10));
  document.getElementById('product-form')?.addEventListener('submit', handleProductFormSubmit);

  // Kategori Modal & Form Listeners
  document.getElementById('manage-category-btn')?.addEventListener('click', openCategoryModal);
  document.getElementById('nav-manage-category-btn')?.addEventListener('click', openCategoryModal);
  document.getElementById('category-modal-close-x')?.addEventListener('click', closeCategoryModal);
  document.getElementById('category-modal-close-btn')?.addEventListener('click', closeCategoryModal);
  document.getElementById('category-modal-overlay')?.addEventListener('click', closeCategoryModal);
  document.getElementById('add-category-form')?.addEventListener('submit', handleAddCategory);

  document.getElementById('btn-simulate-transaction')?.addEventListener('click', simulateTransaction);
  document.getElementById('btn-clear-transactions')?.addEventListener('click', clearTransactions);
});