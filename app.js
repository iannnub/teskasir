
const DEFAULT_PRODUCTS = [
  {
    id: 'aetheria',
    name: 'AMERICANO',
    category: 'Coffe',
    image: 'assets/americano.png',
    description: 'Kopi espresso racikan khas cafe dengan keharuman aroma yang manis dan lembut.',
    badge: 'Ready Stock di Toko',
    badgeClass: 'pulse-green',
    isReady: true,
    variants: [
      { size: 'Ice', price: 25000, stock: 15, label: 'Ready Stock (15 unit)' },
      { size: 'Hot', price: 22000, stock: 10, label: 'Ready Stock (10 unit)' }
    ]
  },
  {
    id: 'oud-nocturne',
    name: 'MOCHA LATTE',
    category: 'Coklat',
    image: 'assets/Mocha Latte.png',
    description: 'Coklat hangat/dingin premium dengan perpaduan rempah manis nan kaya rasa.',
    badge: 'Ready Stock di Toko',
    badgeClass: 'pulse-green',
    isReady: true,
    variants: [
      { size: 'Ice', price: 28000, stock: 12, label: 'Ready Stock (12 unit)' },
      { size: 'Hot', price: 25000, stock: 8, label: 'Ready Stock (8 unit)' }
    ]
  },
  {
    id: 'thalassa',
    name: 'CARBONARA',
    category: 'Makanan',
    image: 'assets/carbonara.png',
    description: 'Kesegaran pasta gurih berkrim spesial khas resep dapur cafe.',
    badge: 'Ready Stock di Toko',
    badgeClass: 'pulse-green',
    isReady: true,
    variants: [
      { size: 'Ice', price: 24000, stock: 15, label: 'Ready Stock' },
      { size: 'Hot', price: 20000, stock: 10, label: 'Ready Stock' }
    ]
  },
  {
    id: 'solstice',
    name: 'FRENCH FRIES',
    category: 'Camilan',
    image: 'assets/french fries.png',
    description: 'Camilan kentang goreng renyah dengan taburan bumbu gurih spesial.',
    badge: 'Ready Stock di Toko',
    badgeClass: 'pulse-green',
    isReady: true,
    variants: [
      { size: 'Ice', price: 22000, stock: 18, label: 'Ready Stock' },
      { size: 'Hot', price: 18000, stock: 10, label: 'Ready Stock' }
    ]
  }
];

const escapeHtml = (typeof KollaboraDB !== 'undefined' && KollaboraDB.escapeHtml)
  ? KollaboraDB.escapeHtml
  : function (str) {
      if (str === null || str === undefined) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    };

function loadProductsFromStorage() {
  if (typeof KollaboraDB !== 'undefined') {
    return KollaboraDB.getProducts();
  }
  let stored = null;
  try {
    stored = JSON.parse(localStorage.getItem('cafe_store_products'));
  } catch (e) {
    stored = null;
  }
  return stored || DEFAULT_PRODUCTS;
}

const DEFAULT_CATEGORIES = ["Coffe", "Coklat", "Makanan", "Camilan"];

function getKollaboraCategories() {
  if (typeof KollaboraDB !== 'undefined') {
    return KollaboraDB.getCategories();
  }
  try {
    const raw = localStorage.getItem('kollabora_kategori');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) { /* ignore */ }
  return [...DEFAULT_CATEGORIES];
}

let PRODUCTS = loadProductsFromStorage();

function getTransactionsFromStorage(guestOnly = false) {
  if (typeof KollaboraDB !== 'undefined') {
    return KollaboraDB.getTransactions(guestOnly);
  }
  let txs = [];
  try {
    const raw = localStorage.getItem('transactions');
    if (raw) txs = JSON.parse(raw);
  } catch (e) { console.error(e); }
  return txs;
}

function saveTransactionToStorage(newTx) {
  if (typeof KollaboraDB !== 'undefined') {
    return KollaboraDB.saveTransaction(newTx);
  }
  const txs = getTransactionsFromStorage(false);
  txs.push(newTx);
  localStorage.setItem('transactions', JSON.stringify(txs));
  localStorage.setItem('cafe_orders', JSON.stringify(txs));
}

function initDatabase() {
  getTransactionsFromStorage(false);
}

initDatabase();

// App State
let state = {
  myOrderIds: JSON.parse(localStorage.getItem('buyer_order_ids')) || [],
  selectedCategory: 'Semua',
  searchQuery: '',
  onlyReady: false,
  activeProduct: null,
  activeVariant: null,
  activeMixIngredients: []
};

let posCart = [];
let selectedPaymentMethod = 'Cash';

const productGrid = document.getElementById('product-grid');
const searchInput = document.getElementById('search-input');
const categoryChips = document.getElementById('category-chips');
const readyFilterToggle = document.getElementById('ready-filter-toggle');
const cartFloatingBtn = document.getElementById('cart-floating-btn');
const cartBadge = document.getElementById('cart-badge');

const detailDrawer = document.getElementById('detail-drawer');
const detailOverlay = document.getElementById('detail-overlay');
const detailSheet = document.getElementById('detail-sheet');

const cartDrawer = document.getElementById('cart-drawer');
const cartOverlay = document.getElementById('cart-overlay');
const cartSheet = document.getElementById('cart-sheet');

function formatRupiah(amount) {
  return 'Rp ' + (amount || 0).toLocaleString('id-ID');
}

function showToast(msg) {
  let toast = document.getElementById('pos-toast-notification');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'pos-toast-notification';
    toast.className = 'fixed bottom-20 left-1/2 -translate-x-1/2 z-[110] bg-zinc-900 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-2xl transition-all duration-300 opacity-0 pointer-events-none flex items-center space-x-2 border border-zinc-700';
    document.body.appendChild(toast);
  }
  toast.innerHTML = `<span>${msg}</span>`;
  toast.classList.remove('opacity-0', 'pointer-events-none');

  if (window.toastTimeout) clearTimeout(window.toastTimeout);
  window.toastTimeout = setTimeout(() => {
    toast.classList.add('opacity-0', 'pointer-events-none');
  }, 2500);
}

function updateCartBadge() {
  const orders = getTransactionsFromStorage();
  const activeCount = orders.filter(o => state.myOrderIds.includes(o.id) && (o.status === 'pending' || o.status === 'proses')).length;

  if (state.myOrderIds.length > 0 && cartBadge && cartFloatingBtn) {
    if (activeCount > 0) {
      cartBadge.textContent = activeCount;
      cartBadge.classList.remove('hidden');
      cartFloatingBtn.classList.remove('translate-y-24');
    } else {
      cartBadge.classList.add('hidden');
      cartFloatingBtn.classList.remove('translate-y-24');
    }
  } else if (cartBadge && cartFloatingBtn) {
    cartBadge.classList.add('hidden');
    cartFloatingBtn.classList.add('translate-y-24');
  }
}

function reloadProductsFromStorage() {
  PRODUCTS = loadProductsFromStorage();
}

function openOrderPanel() {
  const layout = document.getElementById('pos-layout');
  if (layout) layout.classList.add('pos-active');
}

function closeOrderPanel() {
  const layout = document.getElementById('pos-layout');
  if (layout) layout.classList.remove('pos-active');
}

function clearPosCart() {
  posCart = [];
  selectedPaymentMethod = 'Cash';
  renderPosCart();
  initPaymentMethodSelector();
  closeOrderPanel();
  showToast('Daftar pesanan dibersihkan');
}

function initPaymentMethodSelector() {
  const paymentBtns = document.querySelectorAll('.pos-payment-btn');
  paymentBtns.forEach(btn => {
    const method = btn.getAttribute('data-method');
    if (method === selectedPaymentMethod) {
      btn.className = 'pos-payment-btn py-1.5 px-2 rounded-lg text-xs font-semibold border border-amber-500 bg-amber-50 text-amber-800 transition-all text-center cursor-pointer';
    } else {
      btn.className = 'pos-payment-btn py-1.5 px-2 rounded-lg text-xs font-semibold border border-zinc-200 bg-white text-zinc-600 transition-all text-center cursor-pointer';
    }

    btn.onclick = () => {
      selectedPaymentMethod = btn.getAttribute('data-method') || 'Cash';
      initPaymentMethodSelector();
      showToast(`Metode Pembayaran: ${selectedPaymentMethod}`);
    };
  });
}

function addToPosCart(product, variant = null, ratioNotes = '', mixDetails = null) {
  reloadProductsFromStorage();
  const freshProduct = PRODUCTS.find(p => p.id === product.id) || product;

  if (!variant) {
    variant = freshProduct.variants.find(v => v.stock > 0) || freshProduct.variants[0];
  }

  if (variant.stock <= 0) {
    showToast(`Stok ${freshProduct.name} (${variant.size}) sedang habis!`);
    return;
  }

  const existingItem = posCart.find(i =>
    i.productId === freshProduct.id &&
    i.variantSize === variant.size &&
    i.ratioNotes === ratioNotes
  );

  if (existingItem) {
    if (existingItem.quantity + 1 > variant.stock) {
      showToast(`Stok ${freshProduct.name} tersisa ${variant.stock} unit!`);
      return;
    }
    existingItem.quantity += 1;
  } else {
    posCart.push({
      cartId: 'CART-' + Math.random().toString(36).substr(2, 9),
      productId: freshProduct.id,
      name: freshProduct.name,
      image: freshProduct.image,
      category: freshProduct.category,
      variantSize: variant.size,
      price: variant.price,
      quantity: 1,
      ratioNotes: ratioNotes,
      mixDetails: mixDetails
    });
  }

  openOrderPanel();
  renderPosCart();
  showToast(`+ ${freshProduct.name} (${variant.size}) ditambahkan`);
}

function renderPosCart() {
  const itemsContainer = document.getElementById('pos-cart-items');
  const countBadge = document.getElementById('pos-cart-count-badge');
  const subtotalEl = document.getElementById('pos-subtotal-price');
  const totalEl = document.getElementById('pos-total-price');
  const checkoutBtn = document.getElementById('pos-checkout-btn');

  if (!itemsContainer) return;

  const totalItems = posCart.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = posCart.reduce((sum, i) => sum + (i.price * i.quantity), 0);

  if (countBadge) countBadge.textContent = totalItems;
  if (subtotalEl) subtotalEl.textContent = formatRupiah(totalPrice);
  if (totalEl) totalEl.textContent = formatRupiah(totalPrice);

  if (posCart.length === 0) {
    itemsContainer.innerHTML = `
      <div class="py-16 text-center text-zinc-400 flex flex-col items-center justify-center">
        <div class="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center text-amber-500 mb-3 border border-amber-200/50">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
          </svg>
        </div>
        <p class="text-sm font-bold text-zinc-700 font-display">Belum ada menu dipilih</p>
        <p class="text-xs text-zinc-500 mt-1 max-w-[220px]">Klik menu apapun dari katalog di sebelah kiri untuk langsung menambah pesanan.</p>
      </div>
    `;
    if (checkoutBtn) {
      checkoutBtn.disabled = true;
      checkoutBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }
    return;
  }

  if (checkoutBtn) {
    checkoutBtn.disabled = false;
    checkoutBtn.classList.remove('opacity-50', 'cursor-not-allowed');
  }

  itemsContainer.innerHTML = '';

  posCart.forEach(item => {
    const prod = PRODUCTS.find(p => p.id === item.productId);
    const variants = prod ? prod.variants : [{ size: item.variantSize, price: item.price }];

    const variantOptionsHtml = variants.map(v =>
      `<option value="${v.size}" ${v.size === item.variantSize ? 'selected' : ''}>${v.size} (${formatRupiah(v.price)})</option>`
    ).join('');

    const itemCard = document.createElement('div');
    itemCard.className = 'bg-zinc-50 border border-zinc-200 rounded-xl p-3 flex space-x-3 items-center animate-cart-item relative group shadow-sm';
    itemCard.innerHTML = `
      <img src="${item.image || 'assets/americano.png'}" alt="${escapeHtml(item.name)}" onerror="this.onerror=null;this.src='assets/americano.png';" class="w-14 h-14 object-cover rounded-lg border border-zinc-200 shrink-0 bg-white">
      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between">
          <h4 class="text-xs font-extrabold text-zinc-900 truncate">${escapeHtml(item.name)}</h4>
          <button onclick="removePosCartItem('${escapeHtml(item.cartId)}')" class="text-zinc-400 hover:text-red-500 p-1 transition-colors cursor-pointer" title="Hapus item">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
        
        <div class="flex items-center space-x-1.5 mt-1">
          <span class="text-[10px] text-zinc-500 font-medium">Suhu:</span>
          <select onchange="updatePosCartItemVariant('${escapeHtml(item.cartId)}', this.value)" class="bg-white border border-zinc-200 rounded-md text-[10px] text-zinc-800 py-0.5 px-1 font-semibold focus:outline-none focus:border-amber-500 cursor-pointer">
            ${variantOptionsHtml}
          </select>
        </div>

        ${item.ratioNotes ? `<p class="text-[9px] text-amber-600 font-medium italic mt-0.5 truncate">${escapeHtml(item.ratioNotes)}</p>` : ''}

        <div class="flex items-center justify-between mt-2 pt-1.5 border-t border-zinc-200/60">
          <span class="text-xs font-bold text-amber-600">${formatRupiah(item.price * item.quantity)}</span>
          
          <div class="flex items-center space-x-1.5 bg-white border border-zinc-200 rounded-lg px-1.5 py-0.5 shadow-sm">
            <button onclick="updatePosCartQuantity('${escapeHtml(item.cartId)}', -1)" class="w-5 h-5 flex items-center justify-center text-zinc-600 hover:text-zinc-900 font-extrabold text-xs active:scale-95 transition-all cursor-pointer">-</button>
            <span class="text-xs font-bold text-zinc-900 w-5 text-center">${item.quantity}</span>
            <button onclick="updatePosCartQuantity('${escapeHtml(item.cartId)}', 1)" class="w-5 h-5 flex items-center justify-center text-zinc-600 hover:text-zinc-900 font-extrabold text-xs active:scale-95 transition-all cursor-pointer">+</button>
          </div>
        </div>
      </div>
    `;

    itemsContainer.appendChild(itemCard);
  });
}

function updatePosCartQuantity(cartId, delta) {
  const item = posCart.find(i => i.cartId === cartId);
  if (!item) return;

  const newQty = item.quantity + delta;
  if (newQty <= 0) {
    removePosCartItem(cartId);
  } else {
    const prod = PRODUCTS.find(p => p.id === item.productId);
    const variant = prod ? prod.variants.find(v => v.size === item.variantSize) : null;
    if (variant && newQty > variant.stock) {
      showToast(`Stok ${item.name} (${item.variantSize}) hanya tersisa ${variant.stock}!`);
      return;
    }
    item.quantity = newQty;
    renderPosCart();
  }
}

function updatePosCartItemVariant(cartId, newSize) {
  const item = posCart.find(i => i.cartId === cartId);
  if (!item) return;

  const prod = PRODUCTS.find(p => p.id === item.productId);
  const variant = prod ? prod.variants.find(v => v.size === newSize) : null;
  if (variant) {
    if (variant.stock <= 0) {
      showToast(`Varian ${newSize} sedang habis!`);
      renderPosCart();
      return;
    }
    item.variantSize = variant.size;
    item.price = variant.price;
    renderPosCart();
  }
}

function removePosCartItem(cartId) {
  posCart = posCart.filter(i => i.cartId !== cartId);
  renderPosCart();
  if (posCart.length === 0) {
    closeOrderPanel();
  }
}

function checkoutPosOrder() {
  reloadProductsFromStorage();

  if (posCart.length === 0) {
    showToast('Daftar pesanan masih kosong!');
    return;
  }

  const custInput = document.getElementById('pos-customer-name');
  const customerName = custInput ? custInput.value.trim() : '';

  if (!customerName) {
    showToast('Harap masukkan Nama Pelanggan / No. Meja!');
    if (custInput) custInput.focus();
    return;
  }

  const orderNotes = document.getElementById('pos-order-notes')?.value.trim() || '';

  let stockFail = false;
  const stockItemsToDeduct = [];

  for (const cartItem of posCart) {
    const prod = PRODUCTS.find(p => p.id === cartItem.productId);
    const variant = prod ? prod.variants.find(v => v.size === cartItem.variantSize) : null;

    if (!variant || variant.stock < cartItem.quantity) {
      showToast(`Stok ${cartItem.name} (${cartItem.variantSize}) tidak mencukupi!`);
      stockFail = true;
      break;
    }
    stockItemsToDeduct.push({ product: prod, variant: variant, qty: cartItem.quantity });
  }

  if (stockFail) return;

  stockItemsToDeduct.forEach(item => {
    item.variant.stock -= item.qty;
    if (item.variant.stock === 0) {
      item.variant.label = 'Habis';
    } else if (item.variant.stock <= 5) {
      item.variant.label = `Sisa ${item.variant.stock} unit`;
    } else {
      item.variant.label = 'Ready Stock';
    }
  });
  localStorage.setItem('cafe_store_products', JSON.stringify(PRODUCTS));

  const orderId = 'ORD-' + Math.floor(100000 + Math.random() * 900000);
  const totalPrice = posCart.reduce((sum, i) => sum + (i.price * i.quantity), 0);
  const ratioNotesSummary = posCart.map(i => `${i.name} (${i.variantSize}) x${i.quantity}`).join(', ') + (orderNotes ? ` | Catatan: ${orderNotes}` : '');

  const dbDetails = JSON.parse(localStorage.getItem('cafe_order_details')) || [];
  const receiptItems = [];

  posCart.forEach(item => {
    const detailObj = {
      id: 'DET-' + Math.floor(100000 + Math.random() * 900000),
      order_id: orderId,
      product_id: item.productId,
      product_name: item.name,
      variant_size: item.variantSize,
      price: item.price,
      quantity: item.quantity,
      ratio: '100'
    };
    dbDetails.push(detailObj);
    receiptItems.push(detailObj);
  });
  localStorage.setItem('cafe_order_details', JSON.stringify(dbDetails));

  const newTransaction = {
    id: orderId,
    date: new Date().toISOString(),
    customer_name: customerName,
    total_price: totalPrice,
    status: 'selesai',
    metode_pembayaran: selectedPaymentMethod,
    ratio_notes: ratioNotesSummary,
    items: receiptItems
  };

  saveTransactionToStorage(newTransaction);

  state.myOrderIds.push(orderId);
  localStorage.setItem('buyer_order_ids', JSON.stringify(state.myOrderIds));

  posCart = [];
  renderPosCart();
  closeOrderPanel();
  if (custInput) custInput.value = '';
  if (document.getElementById('pos-order-notes')) document.getElementById('pos-order-notes').value = '';

  renderProducts();
  updateCartBadge();

  showToast(`Transaksi ${orderId} berhasil! Struk siap dicetak.`);

  showReceipt(newTransaction, receiptItems);
}

function renderCategoryChips() {
  const container = document.getElementById('category-chips');
  if (!container) return;

  const storedCategories = getKollaboraCategories();
  const categories = ['Semua', ...storedCategories];

  if (!categories.includes(state.selectedCategory)) {
    state.selectedCategory = 'Semua';
  }

  container.innerHTML = categories.map(cat => {
    const isActive = state.selectedCategory === cat;
    return `
      <button type="button" class="px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${isActive
        ? 'bg-amber-500 text-white shadow-sm'
        : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-100'
      }">
        ${cat}
      </button>
    `;
  }).join('');

  const chips = container.querySelectorAll('button');
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      state.selectedCategory = chip.textContent.trim();
      renderCategoryChips();
      renderProducts();
    });
  });
}

function renderProducts() {
  reloadProductsFromStorage();
  if (!productGrid) return;
  productGrid.innerHTML = '';

  const filtered = PRODUCTS.filter(p => {
    if (state.selectedCategory !== 'Semua' && p.category !== state.selectedCategory) return false;
    if (state.searchQuery && !p.name.toLowerCase().includes(state.searchQuery.toLowerCase())) return false;
    if (state.onlyReady) {
      const hasStock = p.variants.some(v => v.stock > 0);
      if (!hasStock) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    productGrid.innerHTML = `
      <div class="col-span-2 sm:col-span-3 lg:col-span-4 py-12 text-center text-zinc-500">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto mb-3 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p class="font-medium text-sm">Tidak ada menu yang cocok</p>
        <p class="text-xs mt-1">Coba sesuaikan kata kunci atau filter Anda</p>
      </div>
    `;
    return;
  }

  filtered.forEach(p => {
    const prices = p.variants.map(v => v.price);
    const minPrice = Math.min(...prices);

    const card = document.createElement('div');
    card.className = 'glass-card rounded-2xl overflow-hidden flex flex-col group cursor-pointer border border-zinc-200/60 hover:border-amber-500/50 transition-all shadow-sm bg-white text-zinc-900';
  
    card.innerHTML = `
      <div class="relative aspect-[4/3] sm:aspect-[4/5] bg-zinc-100 overflow-hidden">
        <img src="${p.image || 'assets/americano.png'}" alt="${p.name}" onerror="this.onerror=null;this.src='assets/americano.png';" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300">
      </div>
      <div class="p-3 flex-1 flex flex-col justify-between">
        <div>
          <span class="text-[10px] text-amber-600 uppercase tracking-widest font-semibold">${p.category}</span>
          <h3 class="text-sm sm:text-base font-bold text-zinc-900 mt-0.5 leading-snug truncate">${p.name}</h3>
        </div>

        <div class="mt-2 pt-2 border-t border-zinc-100 flex items-center justify-between">
          <div>
            <p class="text-[9px] text-zinc-400 font-medium">Mulai Dari</p>
            <p class="text-xs sm:text-sm font-extrabold text-zinc-950">${formatRupiah(minPrice)}</p>
          </div>
          
          <button class="add-to-cart-btn px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-sm active:scale-95 transition-all flex items-center space-x-1 cursor-pointer">
            <span>+ Pesan</span>
          </button>
        </div>
      </div>
    `;

    const addBtn = card.querySelector('.add-to-cart-btn');
    if (addBtn) {
      addBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        addToPosCart(p);
      });
    }

    card.addEventListener('click', () => {
      addToPosCart(p);
    });

    productGrid.appendChild(card);
  });
}

function openProductDetail(product) {
  reloadProductsFromStorage();

  const freshProduct = PRODUCTS.find(p => p.id === product.id) || product;
  state.activeProduct = freshProduct;

  const defaultVar = freshProduct.variants.find(v => v.stock > 0) || freshProduct.variants[0];
  state.activeVariant = defaultVar;

  const drawerImg = document.getElementById('drawer-img');
  if (drawerImg) {
    drawerImg.src = freshProduct.image || 'assets/americano.png';
    drawerImg.onerror = function () {
      this.onerror = null;
      this.src = 'assets/americano.png';
    };
  }

  if (document.getElementById('drawer-name')) document.getElementById('drawer-name').textContent = freshProduct.name;
  if (document.getElementById('drawer-category')) document.getElementById('drawer-category').textContent = freshProduct.category;
  if (document.getElementById('drawer-desc')) document.getElementById('drawer-desc').textContent = freshProduct.description;

  renderVariantSelector();
  updateDetailPriceAndStock();

  const mixToggle = document.getElementById('mix-toggle');
  if (mixToggle) {
    mixToggle.checked = false;
    const mixSec = document.getElementById('mix-section-content');
    if (mixSec) mixSec.classList.add('hidden');
  }
  state.activeMixIngredients = [];
  if (document.getElementById('customer-name-input')) document.getElementById('customer-name-input').value = '';
  if (document.getElementById('mix-notes')) document.getElementById('mix-notes').value = '';

  populateMixDropdown();
  renderMixIngredients();

  if (detailDrawer) detailDrawer.classList.remove('pointer-events-none');
  if (detailOverlay) detailOverlay.classList.remove('opacity-0');
  if (detailSheet) detailSheet.classList.remove('translate-y-full');

  document.body.style.overflow = 'hidden';
}

function closeProductDetail() {
  if (detailSheet) detailSheet.classList.add('translate-y-full');
  if (detailOverlay) detailOverlay.classList.add('opacity-0');
  setTimeout(() => {
    if (detailDrawer) detailDrawer.classList.add('pointer-events-none');
    document.body.style.overflow = '';
  }, 300);
}

// Render Ice / Hot variant selector
function renderVariantSelector() {
  const container = document.getElementById('variant-chips-container');
  if (!container) return;
  container.innerHTML = '';

  state.activeProduct.variants.forEach(v => {
    const isSelected = state.activeVariant.size === v.size;
    const isOutOfStock = v.stock === 0;

    const btn = document.createElement('button');
    btn.className = `flex-1 py-2 px-1 text-center rounded-xl text-xs font-semibold border transition-all duration-200 cursor-pointer ${isSelected
      ? 'border-amber-500 bg-amber-50 text-amber-800 font-bold shadow-sm'
      : isOutOfStock
        ? 'border-zinc-200 bg-zinc-100 text-zinc-400'
        : 'border-zinc-200 bg-white text-zinc-700 hover:border-amber-300'
      } ${isOutOfStock ? 'line-through' : ''}`;
    btn.innerHTML = `
      <div>${v.size}</div>
      <div class="text-[9px] font-normal ${isSelected ? 'text-amber-700 font-semibold' : isOutOfStock ? 'text-zinc-400' : 'text-zinc-500'}">${v.stock > 0 ? `${v.stock} ready` : 'Habis'}</div>
    `;

    btn.addEventListener('click', () => {
      state.activeVariant = v;
      renderVariantSelector();
      updateDetailPriceAndStock();
    });

    container.appendChild(btn);
  });
}

function updateDetailPriceAndStock() {
  const v = state.activeVariant;
  const priceEl = document.getElementById('drawer-price');
  const actionBtn = document.getElementById('drawer-action-btn');
  const waBtn = document.getElementById('drawer-wa-btn');

  if (priceEl) priceEl.textContent = formatRupiah(v.price);

  if (actionBtn && waBtn) {
    if (v.stock === 0) {
      actionBtn.disabled = true;
      actionBtn.className = 'w-full py-3 px-4 rounded-xl text-sm font-semibold bg-zinc-200 text-zinc-500 cursor-not-allowed';
      actionBtn.innerHTML = 'Stok Habis di Toko';
      waBtn.classList.remove('hidden');
      waBtn.innerHTML = `Tanya Stok via WhatsApp`;
    } else {
      actionBtn.disabled = false;
      actionBtn.className = 'w-full py-3 px-4 rounded-xl text-sm font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-md active:scale-95 transition-all cursor-pointer';
      actionBtn.innerHTML = `Tambahkan ke Pesanan`;
    }
  }
}

function populateMixDropdown() {
  const select = document.getElementById('add-mix-select');
  if (!select) return;
  select.innerHTML = '';

  const addedIds = state.activeMixIngredients.map(item => item.productId);
  const available = PRODUCTS.filter(p => p.id !== state.activeProduct.id && !addedIds.includes(p.id));

  const addBtn = document.getElementById('add-mix-btn');
  if (available.length === 0) {
    select.innerHTML = '<option value="">Semua varian ditambahkan</option>';
    if (addBtn) addBtn.disabled = true;
    return;
  }

  if (addBtn) addBtn.disabled = false;
  available.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = `${p.name} (${p.category})`;
    select.appendChild(opt);
  });
}

function renderMixIngredients() {
  const container = document.getElementById('mix-ingredients-container');
  if (!container) return;
  container.innerHTML = '';

  const additionalSum = state.activeMixIngredients.reduce((sum, item) => sum + item.ratio, 0);
  let baseRatio = 100 - additionalSum;
  if (baseRatio < 0) baseRatio = 0;

  const baseRow = document.createElement('div');
  baseRow.className = 'flex items-center space-x-2 bg-zinc-100 p-2.5 rounded-xl border border-zinc-200';
  baseRow.innerHTML = `
    <span class="text-xs text-zinc-800 flex-1 font-semibold">${state.activeProduct.name} (Utama)</span>
    <div class="w-20">
      <input type="number" value="${baseRatio}" readonly class="w-full bg-zinc-200 border border-zinc-300 rounded-lg px-2 py-1 text-xs text-zinc-700 text-center font-bold">
    </div>
    <span class="text-zinc-500 text-xs font-semibold px-1">%</span>
  `;
  container.appendChild(baseRow);

  state.activeMixIngredients.forEach((ingredient, index) => {
    const prod = PRODUCTS.find(p => p.id === ingredient.productId);
    if (!prod) return;

    const row = document.createElement('div');
    row.className = 'flex items-center space-x-2 bg-zinc-100 p-2.5 rounded-xl border border-zinc-200';
    row.innerHTML = `
      <span class="text-xs text-zinc-800 flex-1">${prod.name}</span>
      <div class="w-20">
        <input type="number" min="1" max="100" value="${ingredient.ratio}" oninput="updateMixIngredientRatio(${index}, this.value)" class="w-full bg-white border border-zinc-300 rounded-lg px-2 py-1 text-xs text-zinc-800 text-center font-bold focus:outline-none focus:border-amber-500">
      </div>
      <span class="text-zinc-500 text-xs font-semibold px-1">%</span>
      <button onclick="removeMixIngredient(${index})" class="text-zinc-400 hover:text-red-500 p-1 transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    `;
    container.appendChild(row);
  });
}

function updateMixIngredientRatio(index, val) {
  let num = parseInt(val) || 0;
  if (num < 1) num = 1;
  if (num > 100) num = 100;
  state.activeMixIngredients[index].ratio = num;

  const currentSum = state.activeMixIngredients.reduce((s, item) => s + item.ratio, 0);
  const ratioLabel = document.getElementById('mix-total-ratio-label');
  if (ratioLabel) {
    ratioLabel.textContent = currentSum + '%';
    if (currentSum > 100) {
      ratioLabel.className = 'text-red-600 font-bold';
    } else {
      ratioLabel.className = 'text-amber-600';
    }
  }
}

function removeMixIngredient(index) {
  state.activeMixIngredients.splice(index, 1);
  renderMixIngredients();
  populateMixDropdown();
  updateMixTotalRatio();
}

function updateMixTotalRatio() {
  const currentSum = state.activeMixIngredients.reduce((s, item) => s + item.ratio, 0);
  const ratioLabel = document.getElementById('mix-total-ratio-label');
  if (ratioLabel) {
    ratioLabel.textContent = currentSum + '%';
  }
}

// Inisialisasi Event Listeners Utama saat DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  renderCategoryChips();
  renderProducts();
  updateCartBadge();
  initPaymentMethodSelector();

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      renderProducts();
    });
  }

  if (readyFilterToggle) {
    readyFilterToggle.addEventListener('change', (e) => {
      state.onlyReady = e.target.checked;
      renderProducts();
    });
  }

  const checkoutBtn = document.getElementById('pos-checkout-btn');
  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', checkoutPosOrder);
  }

  const clearCartBtn = document.getElementById('clear-pos-cart-btn');
  if (clearCartBtn) {
    clearCartBtn.addEventListener('click', clearPosCart);
  }

  const closeOrderPanelBtn = document.getElementById('close-order-panel-btn');
  if (closeOrderPanelBtn) {
    closeOrderPanelBtn.addEventListener('click', closeOrderPanel);
  }

  if (cartFloatingBtn) {
    cartFloatingBtn.addEventListener('click', () => {
      if (cartDrawer) cartDrawer.classList.remove('pointer-events-none');
      if (cartOverlay) cartOverlay.classList.remove('opacity-0');
      if (cartSheet) cartSheet.classList.remove('translate-y-full');
      document.body.style.overflow = 'hidden';
      renderBuyerOrdersStatus();
    });
  }

  const closeCartDrawer = () => {
    if (cartSheet) cartSheet.classList.add('translate-y-full');
    if (cartOverlay) cartOverlay.classList.add('opacity-0');
    setTimeout(() => {
      if (cartDrawer) cartDrawer.classList.add('pointer-events-none');
      document.body.style.overflow = '';
    }, 300);
  };

  const cartCloseBtn = document.getElementById('cart-close-btn');
  const cartOverlayEl = document.getElementById('cart-overlay');
  if (cartCloseBtn) cartCloseBtn.addEventListener('click', closeCartDrawer);
  if (cartOverlayEl) cartOverlayEl.addEventListener('click', closeCartDrawer);

  window.closeCart = closeCartDrawer;

  const detailCloseBtn = document.getElementById('detail-close-btn');
  const detailOverlayEl = document.getElementById('detail-overlay');
  if (detailCloseBtn) detailCloseBtn.addEventListener('click', closeProductDetail);
  if (detailOverlayEl) detailOverlayEl.addEventListener('click', closeProductDetail);

  const drawerActionBtn = document.getElementById('drawer-action-btn');
  if (drawerActionBtn) {
    drawerActionBtn.addEventListener('click', () => {
      if (!state.activeProduct || !state.activeVariant) return;

      const custNameInput = document.getElementById('customer-name-input');
      const custName = custNameInput ? custNameInput.value.trim() : '';

      if (!custName) {
        showToast('Masukkan Nama Pelanggan terlebih dahulu!');
        if (custNameInput) custNameInput.focus();
        return;
      }

      const notes = document.getElementById('mix-notes')?.value.trim() || '';
      let ratioNotes = '';

      const isMixActive = document.getElementById('mix-toggle')?.checked;
      let mixDetails = null;

      if (isMixActive && state.activeMixIngredients.length > 0) {
        const parts = state.activeMixIngredients.map(i => {
          const pObj = PRODUCTS.find(prod => prod.id === i.productId);
          return `${pObj ? pObj.name : 'Mix'} (${i.ratio}%)`;
        });
        const addSum = state.activeMixIngredients.reduce((s, i) => s + i.ratio, 0);
        let baseR = 100 - addSum;
        if (baseR < 0) baseR = 0;
        ratioNotes = `Mix: ${state.activeProduct.name} (${baseR}%) + ` + parts.join(', ');
        mixDetails = {
          baseRatio: baseR,
          ingredients: state.activeMixIngredients
        };
      }

      if (notes) {
        ratioNotes = ratioNotes ? ratioNotes + ` | Catatan: ${notes}` : `Catatan: ${notes}`;
      }

      addToPosCart(state.activeProduct, state.activeVariant, ratioNotes, mixDetails);

      const posCustInput = document.getElementById('pos-customer-name');
      if (posCustInput && !posCustInput.value) {
        posCustInput.value = custName;
      }

      closeProductDetail();
    });
  }

  const mixToggle = document.getElementById('mix-toggle');
  if (mixToggle) {
    mixToggle.addEventListener('change', (e) => {
      const mixSec = document.getElementById('mix-section-content');
      if (mixSec) {
        if (e.target.checked) {
          mixSec.classList.remove('hidden');
        } else {
          mixSec.classList.add('hidden');
        }
      }
    });
  }

  const addMixBtn = document.getElementById('add-mix-btn');
  if (addMixBtn) {
    addMixBtn.addEventListener('click', () => {
      const select = document.getElementById('add-mix-select');
      if (!select) return;
      const prodId = select.value;
      if (!prodId) return;

      state.activeMixIngredients.push({
        productId: prodId,
        ratio: 20
      });
      renderMixIngredients();
      populateMixDropdown();
      updateMixTotalRatio();
    });
  }

  // Real-time synchronization listeners (KollaboraDB Broadcast & Cloud)
  if (typeof KollaboraDB !== 'undefined') {
    KollaboraDB.on('products', (updatedProducts) => {
      PRODUCTS = updatedProducts || KollaboraDB.getProducts();
      renderProducts();
    });

    KollaboraDB.on('categories', () => {
      renderCategoryChips();
      renderProducts();
    });

    KollaboraDB.on('orders', () => {
      updateCartBadge();
      const cartSheetEl = document.getElementById('cart-sheet');
      if (cartSheetEl && !cartSheetEl.classList.contains('translate-y-full')) {
        renderBuyerOrdersStatus();
      }
    });
  }

  // Order recovery without login handler
  const lookupBtn = document.getElementById('order-lookup-btn');
  const lookupInput = document.getElementById('order-lookup-input');
  if (lookupBtn && lookupInput) {
    const handleLookup = () => {
      const query = lookupInput.value.trim();
      if (!query) {
        showToast('Masukkan ID Pesanan atau Nama Pemesan');
        return;
      }
      const matches = (typeof KollaboraDB !== 'undefined') ? KollaboraDB.lookupOrder(query) : [];
      if (matches.length === 0) {
        showToast('Pesanan tidak ditemukan dengan kata kunci tersebut');
        return;
      }
      matches.forEach(m => {
        if (typeof KollaboraDB !== 'undefined') KollaboraDB.linkOrderToGuest(m.id);
        if (!state.myOrderIds.includes(m.id)) state.myOrderIds.push(m.id);
      });
      localStorage.setItem('buyer_order_ids', JSON.stringify(state.myOrderIds));
      renderBuyerOrdersStatus();
      updateCartBadge();
      showToast(`Ditemukan ${matches.length} pesanan & ditambahkan ke riwayat Anda!`);
      lookupInput.value = '';
    };

    lookupBtn.addEventListener('click', handleLookup);
    lookupInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleLookup();
    });
  }
});

function renderBuyerOrdersStatus() {
  const emptyState = document.getElementById('cart-empty-state');
  const contentState = document.getElementById('cart-content-state');
  const container = document.getElementById('cart-items-container');

  if (!container) return;

  const myTxs = (typeof KollaboraDB !== 'undefined')
    ? KollaboraDB.getTransactions(true).reverse()
    : getTransactionsFromStorage(true).filter(o => state.myOrderIds.includes(o.id)).reverse();

  if (myTxs.length === 0) {
    if (emptyState) emptyState.classList.remove('hidden');
    if (contentState) contentState.classList.add('hidden');
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');
  if (contentState) contentState.classList.remove('hidden');
  container.innerHTML = '';

  myTxs.forEach(tx => {
    const dateStr = new Date(tx.date).toLocaleDateString('id-ID', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

    let statusBadgeClass = 'bg-amber-100 text-amber-800 border-amber-300';
    let statusText = 'Sedang Diproses';
    if (tx.status === 'selesai') {
      statusBadgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-300';
      statusText = 'Selesai / Siap';
    }

    const card = document.createElement('div');
    card.className = 'bg-zinc-50 border border-zinc-200 rounded-xl p-3.5 space-y-2 shadow-sm';
    card.innerHTML = `
      <div class="flex items-center justify-between border-b border-zinc-200 pb-2">
        <div>
          <span class="text-xs font-bold text-zinc-900">${escapeHtml(tx.id)}</span>
          <p class="text-[10px] text-zinc-500">${escapeHtml(dateStr)}</p>
        </div>
        <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full border ${statusBadgeClass}">${statusText}</span>
      </div>
      
      <div class="text-xs space-y-1">
        <div class="flex justify-between text-zinc-600">
          <span>Pemesan: <strong class="text-zinc-800">${escapeHtml(tx.customer_name)}</strong></span>
          <span>Metode: <strong class="text-zinc-800">${escapeHtml(tx.metode_pembayaran || 'Cash')}</strong></span>
        </div>
        <p class="text-[11px] text-zinc-700 font-medium pt-1">${escapeHtml(tx.ratio_notes || '-')}</p>
      </div>

      <div class="flex items-center justify-between pt-2 border-t border-zinc-200/60">
        <span class="text-xs font-extrabold text-amber-600">${formatRupiah(tx.total_price)}</span>
        <button onclick="showReceiptModalById('${escapeHtml(tx.id)}')" class="text-[11px] font-semibold text-zinc-700 hover:text-amber-600 bg-white border border-zinc-200 px-3 py-1 rounded-lg shadow-xs transition-colors cursor-pointer">
          Lihat Struk
        </button>
      </div>
    `;
    container.appendChild(card);
  });
}

function showReceipt(transaction, items) {
  const modal = document.getElementById('receipt-modal');
  if (!modal) return;

  document.getElementById('receipt-invoice').textContent = transaction.id;
  document.getElementById('receipt-date').textContent = new Date(transaction.date).toLocaleString('id-ID');
  document.getElementById('receipt-customer').textContent = transaction.customer_name;
  document.getElementById('receipt-method').textContent = transaction.metode_pembayaran || 'CASH';
  document.getElementById('receipt-total').textContent = formatRupiah(transaction.total_price);

  const itemsContainer = document.getElementById('receipt-items');
  if (itemsContainer) {
    itemsContainer.innerHTML = '';
    items.forEach(item => {
      const row = document.createElement('div');
      row.className = 'flex justify-between text-xs mb-1';
      row.innerHTML = `
        <span class="truncate pr-2">${item.product_name} (${item.variant_size}) x${item.quantity}</span>
        <span class="shrink-0 font-bold">${formatRupiah(item.price * item.quantity)}</span>
      `;
      itemsContainer.appendChild(row);
    });
  }

  modal.classList.remove('hidden');
  setTimeout(() => {
    modal.classList.remove('opacity-0');
  }, 10);
}

function showReceiptModalById(orderId) {
  const txs = getTransactionsFromStorage();
  const tx = txs.find(t => t.id === orderId);
  if (!tx) {
    showToast('Data transaksi tidak ditemukan');
    return;
  }
  showReceipt(tx, tx.items || []);
}

function closeReceiptModal() {
  const modal = document.getElementById('receipt-modal');
  if (!modal) return;
  modal.classList.add('opacity-0');
  setTimeout(() => {
    modal.classList.add('hidden');
  }, 300);
}

function printReceipt() {
  const printArea = document.getElementById('receipt-print-area');
  if (!printArea) return;
  const win = window.open('', '_blank');
  win.document.write(`
    <html>
      <head>
        <title>Cetak Struk - Kollabora Cafe</title>
        <style>
          body { font-family: monospace; font-size: 12px; padding: 15px; color: #000; width: 280px; }
          .text-center { text-align: center; }
          .flex { display: flex; justify-content: space-between; }
          .border-b { border-bottom: 1px dashed #333; padding-bottom: 8px; margin-bottom: 8px; }
          .font-bold { font-weight: bold; }
        </style>
      </head>
      <body>
        ${printArea.innerHTML}
      </body>
    </html>
  `);
  win.document.close();
  win.focus();
  setTimeout(() => {
    win.print();
    win.close();
  }, 300);
}