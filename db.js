/**
 * KOLLABORA CAFE - Unified Data & Synchronization Layer
 * Handles local storage, guest isolation, cross-tab real-time sync,
 * and plug-and-play Cloud Database integration (Firebase / REST API).
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.KollaboraDB = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  const STORAGE_KEYS = {
    PRODUCTS: 'cafe_store_products',
    LEGACY_PRODUCTS: 'parfum_store_products',
    CATEGORIES: 'kollabora_kategori',
    TRANSACTIONS: 'transactions',
    LEGACY_ORDERS: 'cafe_orders',
    ORDER_DETAILS: 'cafe_order_details',
    GUEST_ID: 'kollabora_guest_id',
    MY_ORDER_IDS: 'buyer_order_ids',
    ADMIN_SESSION: 'admin_logged_in',
    CLOUD_CONFIG: 'kollabora_cloud_config'
  };

  const DEFAULT_CATEGORIES = ["Coffe", "Coklat", "Makanan", "Camilan"];

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
      badge: 'Ready Stock',
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
      badge: 'Ready Stock',
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
      badge: 'Ready Stock',
      badgeClass: 'pulse-green',
      isReady: true,
      variants: [
        { size: 'Ice', price: 22000, stock: 18, label: 'Ready Stock' },
        { size: 'Hot', price: 18000, stock: 10, label: 'Ready Stock' }
      ]
    }
  ];

  // In-memory fallback if localStorage is disabled or in non-browser env
  const memoryStore = {};

  function getItem(key) {
    try {
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(key);
      }
    } catch (e) { /* ignore */ }
    return memoryStore[key] || null;
  }

  function setItem(key, val) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, val);
      }
    } catch (e) { /* ignore */ }
    memoryStore[key] = val;
  }

  function removeItem(key) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
      }
    } catch (e) { /* ignore */ }
    delete memoryStore[key];
  }

  // Security: HTML sanitizer against XSS
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Cross-Tab Broadcast Channel (Sync across open tabs in same browser)
  let broadcastChannel = null;
  const listeners = {
    products: new Set(),
    categories: new Set(),
    orders: new Set()
  };

  try {
    if (typeof BroadcastChannel !== 'undefined') {
      broadcastChannel = new BroadcastChannel('kollabora_sync_channel');
      broadcastChannel.onmessage = (event) => {
        const { type, data } = event.data || {};
        if (type && listeners[type]) {
          listeners[type].forEach(cb => {
            try { cb(data); } catch (e) { console.error(e); }
          });
        }
      };
    }
  } catch (e) { /* BroadcastChannel not supported */ }

  function emitChange(type, data) {
    if (broadcastChannel) {
      try {
        broadcastChannel.postMessage({ type, data });
      } catch (e) { /* ignore */ }
    }
    if (listeners[type]) {
      listeners[type].forEach(cb => {
        try { cb(data); } catch (e) { console.error(e); }
      });
    }
  }

  // Guest Device Identification (User without login)
  function getGuestId() {
    let guestId = getItem(STORAGE_KEYS.GUEST_ID);
    if (!guestId) {
      guestId = 'guest_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
      setItem(STORAGE_KEYS.GUEST_ID, guestId);
    }
    return guestId;
  }

  // Products
  function getProducts() {
    let stored = null;
    try {
      const raw = getItem(STORAGE_KEYS.PRODUCTS);
      if (raw) stored = JSON.parse(raw);
    } catch (e) {
      stored = null;
    }

    if (!stored || !Array.isArray(stored) || stored.length === 0 || stored.some(p => p.variants && p.variants.some(v => v.size && v.size.includes('ml')))) {
      stored = JSON.parse(JSON.stringify(DEFAULT_PRODUCTS));
      setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(stored));
      setItem(STORAGE_KEYS.LEGACY_PRODUCTS, JSON.stringify(stored));
    } else {
      // Normalize image paths if necessary
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
        setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(stored));
      }
    }
    return stored;
  }

  function saveProducts(products) {
    setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
    setItem(STORAGE_KEYS.LEGACY_PRODUCTS, JSON.stringify(products));
    emitChange('products', products);
    // Cloud sync hook
    cloudSync.pushProducts(products);
    return products;
  }

  function saveProduct(product) {
    const products = getProducts();
    const index = products.findIndex(p => p.id === product.id);
    if (index !== -1) {
      products[index] = { ...products[index], ...product };
    } else {
      products.push(product);
    }
    return saveProducts(products);
  }

  function deleteProduct(productId) {
    const products = getProducts().filter(p => p.id !== productId);
    return saveProducts(products);
  }

  // Categories
  function getCategories() {
    try {
      const raw = getItem(STORAGE_KEYS.CATEGORIES);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) { /* ignore */ }

    const defaults = [...DEFAULT_CATEGORIES];
    setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(defaults));
    return defaults;
  }

  function saveCategories(categories) {
    setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
    emitChange('categories', categories);
    cloudSync.pushCategories(categories);
    return categories;
  }

  // Transactions / Orders
  function getTransactions(guestOnly = false) {
    let txs = [];
    try {
      const raw = getItem(STORAGE_KEYS.TRANSACTIONS);
      if (raw) txs = JSON.parse(raw);
    } catch (e) { txs = []; }

    if (!Array.isArray(txs) || txs.length === 0) {
      try {
        const oldRaw = getItem(STORAGE_KEYS.LEGACY_ORDERS);
        if (oldRaw) {
          const oldOrders = JSON.parse(oldRaw);
          if (Array.isArray(oldOrders) && oldOrders.length > 0) {
            txs = oldOrders;
            setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(txs));
          }
        }
      } catch (e) { /* ignore */ }
    }

    if (!guestOnly) {
      return txs;
    }

    // Guest Isolation: return orders belonging to this guest
    const guestId = getGuestId();
    let myIds = [];
    try {
      const rawIds = getItem(STORAGE_KEYS.MY_ORDER_IDS);
      if (rawIds) myIds = JSON.parse(rawIds);
    } catch (e) { myIds = []; }

    return txs.filter(t => t.guest_id === guestId || myIds.includes(t.id));
  }

  function saveTransaction(newTx) {
    const txs = getTransactions(false);
    const guestId = getGuestId();

    if (!newTx.guest_id) {
      newTx.guest_id = guestId;
    }
    if (!newTx.date) {
      newTx.date = new Date().toISOString();
    }

    txs.push(newTx);
    setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(txs));
    setItem(STORAGE_KEYS.LEGACY_ORDERS, JSON.stringify(txs));

    // Save to guest's order IDs
    let myIds = [];
    try {
      const rawIds = getItem(STORAGE_KEYS.MY_ORDER_IDS);
      if (rawIds) myIds = JSON.parse(rawIds);
    } catch (e) { myIds = []; }

    if (!myIds.includes(newTx.id)) {
      myIds.push(newTx.id);
      setItem(STORAGE_KEYS.MY_ORDER_IDS, JSON.stringify(myIds));
    }

    emitChange('orders', newTx);
    cloudSync.pushOrder(newTx);
    return newTx;
  }

  function clearAllTransactions() {
    removeItem(STORAGE_KEYS.TRANSACTIONS);
    removeItem(STORAGE_KEYS.LEGACY_ORDERS);
    removeItem(STORAGE_KEYS.ORDER_DETAILS);
    emitChange('orders', null);
  }

  // Lookup order by invoice ID or customer name (For guest recovery without login)
  function lookupOrder(query) {
    if (!query) return [];
    const q = query.trim().toLowerCase();
    const cleanQ = q.replace(/^#/, '');
    const all = getTransactions(false);
    return all.filter(t => {
      const idMatch = t.id && t.id.toLowerCase().includes(cleanQ);
      const nameMatch = t.customer_name && t.customer_name.toLowerCase().includes(q);
      return idMatch || nameMatch;
    });
  }

  function linkOrderToGuest(orderId) {
    let myIds = [];
    try {
      const rawIds = getItem(STORAGE_KEYS.MY_ORDER_IDS);
      if (rawIds) myIds = JSON.parse(rawIds);
    } catch (e) { myIds = []; }

    if (!myIds.includes(orderId)) {
      myIds.push(orderId);
      setItem(STORAGE_KEYS.MY_ORDER_IDS, JSON.stringify(myIds));
      emitChange('orders', { id: orderId });
      return true;
    }
    return false;
  }

  // ==================== CLOUD DATABASE SYNC ADAPTER ====================
  // Ready-to-use plug-and-play Cloud Sync (Firebase Firestore / Supabase / REST)
  const cloudSync = {
    config: null,
    db: null,
    isInitialized: false,

    init(config) {
      if (!config) {
        try {
          const saved = getItem(STORAGE_KEYS.CLOUD_CONFIG);
          if (saved) config = JSON.parse(saved);
        } catch (e) { /* ignore */ }
      }
      if (!config) return;

      this.config = config;
      setItem(STORAGE_KEYS.CLOUD_CONFIG, JSON.stringify(config));

      // If Firebase SDK is present on window
      if (typeof window !== 'undefined' && window.firebase && config.apiKey) {
        try {
          if (!window.firebase.apps.length) {
            window.firebase.initializeApp(config);
          }
          this.db = window.firebase.firestore();
          this.isInitialized = true;
          this.listenToCloud();
          console.log('[KollaboraDB] Cloud Sync: Firebase Firestore Connected');
        } catch (e) {
          console.warn('[KollaboraDB] Firebase init failed, continuing with LocalStorage:', e);
        }
      }
    },

    listenToCloud() {
      if (!this.db) return;
      try {
        // Real-time listener for products
        this.db.collection('products').onSnapshot(snapshot => {
          const products = [];
          snapshot.forEach(doc => products.push(doc.data()));
          if (products.length > 0) {
            setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
            emitChange('products', products);
          }
        });

        // Real-time listener for categories
        this.db.collection('settings').doc('categories').onSnapshot(doc => {
          if (doc.exists && Array.isArray(doc.data().list)) {
            const list = doc.data().list;
            setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(list));
            emitChange('categories', list);
          }
        });

        // Real-time listener for orders (admin view)
        this.db.collection('orders').orderBy('date', 'desc').limit(100).onSnapshot(snapshot => {
          const orders = [];
          snapshot.forEach(doc => orders.push(doc.data()));
          if (orders.length > 0) {
            setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(orders));
            emitChange('orders', orders);
          }
        });
      } catch (e) {
        console.warn('[KollaboraDB] Cloud listener warning:', e);
      }
    },

    pushProducts(products) {
      if (!this.db) return;
      try {
        const batch = this.db.batch();
        products.forEach(p => {
          const ref = this.db.collection('products').doc(p.id);
          batch.set(ref, p, { merge: true });
        });
        batch.commit();
      } catch (e) { console.error('Cloud pushProducts error:', e); }
    },

    pushCategories(categories) {
      if (!this.db) return;
      try {
        this.db.collection('settings').doc('categories').set({ list: categories });
      } catch (e) { console.error('Cloud pushCategories error:', e); }
    },

    pushOrder(order) {
      if (!this.db) return;
      try {
        this.db.collection('orders').doc(order.id).set(order);
      } catch (e) { console.error('Cloud pushOrder error:', e); }
    }
  };

  // Subscribe to changes
  function on(type, callback) {
    if (listeners[type]) {
      listeners[type].add(callback);
    }
    return () => {
      if (listeners[type]) listeners[type].delete(callback);
    };
  }

  // Auto-init cloud if config exists
  cloudSync.init();

  return {
    STORAGE_KEYS,
    DEFAULT_PRODUCTS,
    DEFAULT_CATEGORIES,
    escapeHtml,
    getGuestId,
    getProducts,
    saveProducts,
    saveProduct,
    deleteProduct,
    getCategories,
    saveCategories,
    getTransactions,
    saveTransaction,
    clearAllTransactions,
    lookupOrder,
    linkOrderToGuest,
    on,
    cloudSync
  };
});
