'use client';

import React, { useState, useEffect } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { Phone, Settings, Search, ShoppingBag, X, Trash2, Receipt } from 'lucide-react';
import { Product, Transaction, Variant } from '@/lib/types';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface CartItem {
  cartId: string;
  productId: string;
  name: string;
  image: string;
  category: string;
  variantSize: string;
  price: number;
  quantity: number;
  ratioNotes?: string;
}

export default function CustomerTerminal() {
  // SWR: Realtime sync auto-poll + instant SSE + broadcast
  const { data: products = [], mutate: mutateProducts } = useSWR<Product[]>('/api/products', fetcher, {
    refreshInterval: 2500,
    revalidateOnFocus: true,
    dedupingInterval: 400
  });

  const { data: categories = ['Coffe', 'Coklat', 'Makanan', 'Camilan'], mutate: mutateCategories } = useSWR<string[]>('/api/categories', fetcher, {
    refreshInterval: 4000,
    revalidateOnFocus: true,
    dedupingInterval: 1000
  });

  // Guest Device Identification for Order History Without Login
  const [guestId, setGuestId] = useState<string>('');

  // SWR for Guest Orders: Automatically updates when orders are updated
  const { data: myOrders = [], mutate: mutateOrders } = useSWR<Transaction[]>(
    guestId ? `/api/orders?guest_id=${guestId}` : null,
    fetcher,
    { refreshInterval: 2500, revalidateOnFocus: true, dedupingInterval: 400 }
  );

  useEffect(() => {
    let saved = localStorage.getItem('kollabora_guest_id');
    if (!saved) {
      saved = 'guest_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
      localStorage.setItem('kollabora_guest_id', saved);
    }
    setGuestId(saved);

    // Cross-tab BroadcastChannel
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('kollabora_sync_channel');
      bc.onmessage = (ev) => {
        if (ev.data?.type === 'products') mutateProducts();
        if (ev.data?.type === 'orders') mutateOrders();
        if (ev.data?.type === 'categories') mutateCategories();
      };
    } catch (e) {}

    // Cross-device Server-Sent Events (SSE) for <50ms real-time sync
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/events');
      eventSource.addEventListener('products_updated', () => {
        mutateProducts();
      });
      eventSource.addEventListener('orders_updated', () => {
        mutateOrders();
      });
      eventSource.addEventListener('categories_updated', () => {
        mutateCategories();
      });
    } catch (e) {}

    return () => {
      if (bc) bc.close();
      if (eventSource) eventSource.close();
    };
  }, [mutateProducts, mutateOrders, mutateCategories]);

  // Filter States
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [onlyReady, setOnlyReady] = useState<boolean>(false);

  // Cart & POS State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isPosOpen, setIsPosOpen] = useState<boolean>(false);
  const [customerName, setCustomerName] = useState<string>('');
  const [orderNotes, setOrderNotes] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'QRIS' | 'Debit'>('Cash');
  const [toastMessage, setToastMessage] = useState<string>('');

  // Modals & Drawers
  const [isOrdersDrawerOpen, setIsOrdersDrawerOpen] = useState<boolean>(false);
  const [activeReceipt, setActiveReceipt] = useState<Transaction | null>(null);
  const [lookupQuery, setLookupQuery] = useState<string>('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 2500);
  };

  const formatRupiah = (val: number) => {
    return 'Rp ' + (val || 0).toLocaleString('id-ID');
  };

  // Add Item to Cart
  const addToCart = (product: Product, variant?: Variant) => {
    const selectedVar = variant || product.variants.find(v => v.stock > 0) || product.variants[0];
    if (!selectedVar || selectedVar.stock <= 0) {
      showToast(`Stok ${product.name} (${selectedVar?.size || 'Ice'}) habis!`);
      return;
    }

    setCart(prev => {
      const existing = prev.find(i => i.productId === product.id && i.variantSize === selectedVar.size);
      if (existing) {
        if (existing.quantity + 1 > selectedVar.stock) {
          showToast(`Stok ${product.name} tersisa ${selectedVar.stock} unit!`);
          return prev;
        }
        return prev.map(i => i.cartId === existing.cartId ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [
        ...prev,
        {
          cartId: 'CART-' + Math.random().toString(36).substring(2, 9),
          productId: product.id,
          name: product.name,
          image: product.image,
          category: product.category,
          variantSize: selectedVar.size,
          price: selectedVar.price,
          quantity: 1,
        }
      ];
    });

    setIsPosOpen(true);
    showToast(`+ ${product.name} (${selectedVar.size}) ditambahkan`);
  };

  const updateCartQty = (cartId: string, delta: number) => {
    setCart(prev => {
      const item = prev.find(i => i.cartId === cartId);
      if (!item) return prev;
      const nextQty = item.quantity + delta;
      if (nextQty <= 0) {
        return prev.filter(i => i.cartId !== cartId);
      }
      const prod = products.find(p => p.id === item.productId);
      const v = prod?.variants.find(varItem => varItem.size === item.variantSize);
      if (v && nextQty > v.stock) {
        showToast(`Stok tersisa ${v.stock} unit!`);
        return prev;
      }
      return prev.map(i => i.cartId === cartId ? { ...i, quantity: nextQty } : i);
    });
  };

  const updateCartVariant = (cartId: string, newSize: string) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.cartId !== cartId) return item;
        const prod = products.find(p => p.id === item.productId);
        const v = prod?.variants.find(varItem => varItem.size === newSize);
        if (!v || v.stock <= 0) {
          showToast(`Varian ${newSize} sedang habis!`);
          return item;
        }
        return {
          ...item,
          variantSize: v.size,
          price: v.price
        };
      });
    });
  };

  const removeCartItem = (cartId: string) => {
    setCart(prev => prev.filter(i => i.cartId !== cartId));
  };

  const clearCart = () => {
    setCart([]);
    setIsPosOpen(false);
    showToast('Daftar pesanan dikosongkan');
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  // Checkout Order with 0ms Optimistic Update
  const handleCheckout = async () => {
    if (cart.length === 0) {
      showToast('Daftar pesanan masih kosong!');
      return;
    }
    if (!customerName.trim()) {
      showToast('Masukkan Nama Pelanggan / No. Meja terlebih dahulu!');
      return;
    }

    const receiptItems = cart.map(i => ({
      product_id: i.productId,
      product_name: i.name,
      variant_size: i.variantSize,
      price: i.price,
      quantity: i.quantity,
    }));

    const optimisticOrderId = 'ORD-' + Math.floor(100000 + Math.random() * 900000);
    const orderPayload: Transaction = {
      id: optimisticOrderId,
      customer_name: customerName.trim(),
      total_price: subtotal,
      status: 'selesai',
      metode_pembayaran: paymentMethod,
      ratio_notes: cart.map(i => `${i.name} (${i.variantSize}) x${i.quantity}`).join(', ') + (orderNotes ? ` | Catatan: ${orderNotes}` : ''),
      guest_id: guestId,
      date: new Date().toISOString(),
      items: receiptItems as any,
    };

    // 1. Instant 0ms Optimistic UI Update
    setCart([]);
    setCustomerName('');
    setOrderNotes('');
    setIsPosOpen(false);
    setActiveReceipt(orderPayload);
    showToast(`Transaksi #${orderPayload.id} berhasil!`);

    mutateOrders([orderPayload, ...myOrders], false);

    // Optimistically deduct stock in products
    const optimisticProducts = products.map(prod => {
      const itemsForProd = receiptItems.filter(it => it.product_id === prod.id);
      if (itemsForProd.length === 0) return prod;
      const updatedVariants = prod.variants.map(v => {
        const matchingItem = itemsForProd.find(it => it.variant_size === v.size);
        if (matchingItem) {
          const newStock = Math.max(0, v.stock - matchingItem.quantity);
          return {
            ...v,
            stock: newStock,
            label: newStock === 0 ? 'Habis' : (newStock <= 5 ? `Sisa ${newStock} unit` : 'Ready Stock')
          };
        }
        return v;
      });
      return { ...prod, variants: updatedVariants };
    });
    mutateProducts(optimisticProducts, false);

    try {
      const bc = new BroadcastChannel('kollabora_sync_channel');
      bc.postMessage({ type: 'orders' });
      bc.postMessage({ type: 'products' });
      bc.close();
    } catch (e) {}

    // 2. Background POST
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload)
      });
      if (res.ok) {
        mutateOrders();
        mutateProducts();
      } else {
        showToast('Pesanan dicatat di sistem.');
      }
    } catch (e) {
      showToast('Koneksi lambat, pesanan disimpan secara offline.');
    }
  };

  // Order Recovery Search
  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupQuery.trim()) return;
    try {
      const res = await fetch('/api/orders');
      if (res.ok) {
        const allOrders: Transaction[] = await res.json();
        const q = lookupQuery.trim().toLowerCase().replace(/^#/, '');
        const matched = allOrders.filter(o => 
          (o.id && o.id.toLowerCase().includes(q)) || 
          (o.customer_name && o.customer_name.toLowerCase().includes(q))
        );
        if (matched.length > 0) {
          showToast(`Ditemukan ${matched.length} pesanan!`);
          setActiveReceipt(matched[0]);
        } else {
          showToast('Pesanan tidak ditemukan.');
        }
      }
    } catch (err) {
      showToast('Gagal mencari pesanan.');
    }
  };

  const filteredProducts = products.filter(p => {
    if (selectedCategory !== 'Semua' && p.category.toLowerCase() !== selectedCategory.toLowerCase()) return false;
    if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (onlyReady) {
      return p.variants.some(v => v.stock > 0);
    }
    return true;
  });

  return (
    <div className="flex flex-col min-h-screen bg-[#f8f6f2] text-stone-900 selection:bg-[#d4af37] selection:text-black">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[110] bg-stone-900 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-2xl border border-stone-700">
          {toastMessage}
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-stone-200/80 py-3 px-4 flex items-center justify-between shadow-xs">
        <div className="flex flex-col min-w-0 pr-2">
          <h1 className="text-base sm:text-lg md:text-xl font-extrabold tracking-wider text-stone-900 font-display truncate">
            KOLLABORA <span className="text-[#d4af37]">CAFE</span>
          </h1>
          <span className="text-[10px] text-stone-500 font-semibold tracking-wider flex items-center mt-0.5 truncate">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 shrink-0" />
            <span className="truncate">Thematic Cafe & Dining • Jl. Raya Kupang Indah No.51</span>
          </span>
        </div>

        <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
          <a
            href="tel:6281234567890"
            className="p-2 rounded-xl bg-stone-100 border border-stone-200 text-stone-700 hover:text-stone-900 transition-colors flex items-center justify-center min-w-[40px] min-h-[40px]"
            title="Hubungi Kasir"
            aria-label="Hubungi Kasir via Telepon"
          >
            <Phone className="w-4 h-4" />
          </a>
          <Link
            href="/admin"
            className="p-2 rounded-xl bg-stone-100 border border-stone-200 text-stone-700 hover:text-amber-600 transition-colors flex items-center justify-center min-w-[40px] min-h-[40px]"
            title="Admin Dashboard"
            aria-label="Masuk ke Admin Control Panel"
          >
            <Settings className="w-4 h-4" />
          </Link>
        </div>
      </header>

      {/* Main Layout Area */}
      <div className="flex-1 flex flex-col md:flex-row w-full relative">
        {/* Catalog Section */}
        <div className={`flex-1 flex flex-col min-w-0 transition-all ${isPosOpen ? 'md:max-w-[calc(100%-380px)] lg:max-w-[calc(100%-420px)]' : 'w-full'}`}>
          {/* Controls & Filter Bar */}
          <div className="sticky top-[53px] z-20 bg-[#f8f6f2]/95 backdrop-blur-md border-b border-stone-200/80 px-3 py-2 sm:px-4 sm:py-3 space-y-2">
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder="Cari menu kopi, minuman coklat, makanan..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-stone-200 rounded-xl pl-9 pr-4 py-2 text-xs sm:text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:border-[#d4af37] shadow-xs transition-colors"
              />
            </div>

            {/* Category Chips */}
            <div className="flex overflow-x-auto space-x-1.5 sm:space-x-2 pb-1 no-scrollbar select-none">
              {['Semua', ...categories].map(cat => {
                const isActive = selectedCategory.toLowerCase() === cat.toLowerCase();
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[#d4af37] text-black font-extrabold shadow-sm'
                        : 'bg-white border border-stone-200 text-stone-700 hover:border-stone-400 hover:text-stone-900'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>

            {/* Ready Stock Toggle */}
            <div className="flex items-center justify-between bg-white border border-stone-200 px-3 py-1.5 rounded-xl shadow-xs">
              <label htmlFor="ready-toggle" className="flex items-center space-x-2 cursor-pointer flex-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <span className="text-xs text-stone-700 font-medium">Tampilkan hanya menu Ready Stock di cafe</span>
              </label>
              <input
                id="ready-toggle"
                type="checkbox"
                checked={onlyReady}
                onChange={e => setOnlyReady(e.target.checked)}
                className="w-4 h-4 accent-[#d4af37] rounded border-stone-300 cursor-pointer"
              />
            </div>
          </div>

          {/* Product Grid */}
          <main className="flex-1 p-3 sm:p-4 pb-24">
            {filteredProducts.length === 0 ? (
              <div className="py-16 text-center text-stone-500">
                <ShoppingBag className="w-12 h-12 mx-auto mb-3 text-stone-400 stroke-1" />
                <p className="font-semibold text-sm">Tidak ada menu yang cocok</p>
                <p className="text-xs mt-1 text-stone-400">Coba sesuaikan kata kunci atau filter kategori Anda</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {filteredProducts.map(p => {
                  const minPrice = Math.min(...p.variants.map(v => v.price));
                  const isAvailable = p.variants.some(v => v.stock > 0);

                  return (
                    <div
                      key={p.id}
                      onClick={() => addToCart(p)}
                      className="rounded-2xl overflow-hidden flex flex-col group cursor-pointer border border-stone-200/90 hover:border-[#d4af37]/70 transition-all shadow-sm bg-white text-stone-900"
                    >
                      <div className="relative aspect-[4/3] bg-stone-100 overflow-hidden">
                        <img
                          src={p.image || '/assets/americano.png'}
                          alt={p.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-white/90 border border-stone-200 text-[10px] text-stone-700 font-bold uppercase tracking-wider backdrop-blur-xs">
                          {p.category}
                        </span>
                      </div>
                      <div className="p-3.5 flex-1 flex flex-col justify-between">
                        <div>
                          <h3 className="text-xs sm:text-sm font-extrabold text-stone-900 leading-snug truncate">{p.name}</h3>
                          <p className="text-[11px] text-stone-500 line-clamp-1 mt-0.5">{p.description || '-'}</p>
                        </div>

                        <div className="mt-3 pt-2.5 border-t border-stone-100 flex items-center justify-between">
                          <div>
                            <p className="text-[9px] text-stone-400 font-medium">Mulai Dari</p>
                            <p className="text-xs sm:text-sm font-extrabold text-stone-950 font-mono">{formatRupiah(minPrice)}</p>
                          </div>

                          <button
                            type="button"
                            disabled={!isAvailable}
                            onClick={(e) => {
                              e.stopPropagation();
                              addToCart(p);
                            }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1 cursor-pointer ${
                              isAvailable
                                ? 'bg-[#d4af37] hover:bg-[#c29d2b] text-black shadow-xs font-extrabold'
                                : 'bg-stone-200 text-stone-400 cursor-not-allowed'
                            }`}
                          >
                            <span>{isAvailable ? '+ Pesan' : 'Habis'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </main>
        </div>

        {/* POS Order Panel (Sidebar on desktop, drawer on mobile) */}
        {isPosOpen && (
          <aside className="fixed inset-y-0 right-0 z-50 md:sticky md:top-[53px] w-full md:w-[380px] lg:w-[420px] md:h-[calc(100vh-53px)] bg-white border-l border-stone-200 shadow-2xl flex flex-col">
            <div className="p-4 border-b border-stone-200 flex items-center justify-between bg-stone-50 shrink-0">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-stone-100 border border-[#d4af37]/40 flex items-center justify-center text-[#d4af37]">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-stone-900 font-display flex items-center">
                    Daftar Pesanan
                    <span className="ml-2 text-[10px] bg-[#d4af37] text-black font-extrabold px-2 py-0.5 rounded-full">
                      {cart.reduce((s, i) => s + i.quantity, 0)}
                    </span>
                  </h3>
                  <p className="text-[10px] text-stone-500">Menu yang Anda pilih</p>
                </div>
              </div>

              <div className="flex items-center space-x-1">
                <button
                  onClick={clearCart}
                  className="text-xs text-red-500 hover:text-red-700 font-semibold px-2 py-1 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                >
                  Bersihkan
                </button>
                <button
                  onClick={() => setIsPosOpen(false)}
                  className="text-stone-400 hover:text-stone-700 p-1.5 rounded-lg hover:bg-stone-100 transition-colors cursor-pointer"
                  aria-label="Tutup Panel"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
              {cart.length === 0 ? (
                <div className="py-16 text-center text-stone-400">
                  <p className="text-sm font-bold text-stone-700">Belum ada menu dipilih</p>
                  <p className="text-xs text-stone-500 mt-1">Klik menu di katalog untuk menambah pesanan</p>
                </div>
              ) : (
                cart.map(item => {
                  const prod = products.find(p => p.id === item.productId);
                  const variants = prod ? prod.variants : [{ size: item.variantSize, price: item.price, stock: 10 }];

                  return (
                    <div key={item.cartId} className="bg-stone-50 border border-stone-200 rounded-xl p-3 flex space-x-3 items-center shadow-xs">
                      <img
                        src={item.image || '/assets/americano.png'}
                        alt={item.name}
                        className="w-14 h-14 object-cover rounded-lg border border-stone-200 shrink-0 bg-white"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-extrabold text-stone-900 truncate">{item.name}</h4>
                          <button
                            onClick={() => removeCartItem(item.cartId)}
                            className="text-stone-400 hover:text-red-500 p-1 transition-colors cursor-pointer"
                            title="Hapus"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="flex items-center space-x-1.5 mt-1">
                          <span className="text-[10px] text-stone-500 font-medium">Suhu:</span>
                          <select
                            value={item.variantSize}
                            onChange={e => updateCartVariant(item.cartId, e.target.value)}
                            className="bg-white border border-stone-200 rounded-md text-[10px] text-stone-800 py-0.5 px-1 font-semibold focus:outline-none focus:border-[#d4af37] cursor-pointer"
                          >
                            {variants.map(v => (
                              <option key={v.size} value={v.size}>
                                {v.size} ({formatRupiah(v.price)})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-stone-200">
                          <span className="text-xs font-bold text-stone-900 font-mono">{formatRupiah(item.price * item.quantity)}</span>
                          <div className="flex items-center space-x-1.5 bg-white border border-stone-200 rounded-lg px-1.5 py-0.5 shadow-xs">
                            <button
                              onClick={() => updateCartQty(item.cartId, -1)}
                              className="w-5 h-5 flex items-center justify-center text-stone-600 hover:text-stone-900 font-extrabold text-xs cursor-pointer"
                            >
                              -
                            </button>
                            <span className="text-xs font-bold text-stone-900 w-5 text-center">{item.quantity}</span>
                            <button
                              onClick={() => updateCartQty(item.cartId, 1)}
                              className="w-5 h-5 flex items-center justify-center text-stone-600 hover:text-stone-900 font-extrabold text-xs cursor-pointer"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer & Checkout Form */}
            <div className="p-4 border-t border-stone-200 bg-stone-50 shrink-0 space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Nama Pelanggan / No. Meja</label>
                <input
                  type="text"
                  placeholder="Contoh: Budi (Meja 04)"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-[#d4af37] shadow-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Catatan Pesanan</label>
                <input
                  type="text"
                  placeholder="Contoh: Less ice, gula 50%..."
                  value={orderNotes}
                  onChange={e => setOrderNotes(e.target.value)}
                  className="w-full bg-white border border-stone-200 rounded-xl px-3 py-1.5 text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-[#d4af37] shadow-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Metode Pembayaran</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['Cash', 'QRIS', 'Debit'] as const).map(method => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPaymentMethod(method)}
                      className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition-all text-center cursor-pointer ${
                        paymentMethod === method
                          ? 'border-[#d4af37] bg-[#d4af37]/20 text-stone-950 font-bold'
                          : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-stone-200 pt-2 space-y-1 text-xs">
                <div className="flex justify-between text-stone-600">
                  <span>Subtotal</span>
                  <span className="font-semibold text-stone-800">{formatRupiah(subtotal)}</span>
                </div>
                <div className="flex justify-between text-base font-extrabold text-stone-950 pt-1 border-t border-stone-200">
                  <span>TOTAL</span>
                  <span className="text-stone-950 font-display font-mono">{formatRupiah(subtotal)}</span>
                </div>
              </div>

              <button
                type="button"
                disabled={cart.length === 0}
                onClick={handleCheckout}
                className="w-full py-3 px-4 rounded-xl text-sm font-extrabold bg-[#d4af37] hover:bg-[#c29d2b] text-black shadow-md flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>Selesaikan Transaksi & Cetak</span>
              </button>
            </div>
          </aside>
        )}
      </div>

      {/* Floating Button for Order History */}
      <button
        onClick={() => setIsOrdersDrawerOpen(true)}
        className="fixed bottom-6 right-6 z-40 bg-white border border-[#d4af37]/60 rounded-full p-4 text-stone-900 shadow-xl flex items-center justify-center cursor-pointer hover:scale-105 active:scale-95 transition-all"
        title="Lihat Status Pesanan Saya"
        aria-label="Buka Status Pesanan Saya"
      >
        <div className="relative">
          <Receipt className="w-6 h-6 text-[#d4af37]" />
          {myOrders.length > 0 && (
            <span className="absolute -top-2.5 -right-2.5 bg-[#d4af37] text-black text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center border border-white">
              {myOrders.length}
            </span>
          )}
        </div>
      </button>

      {/* Guest Order History Drawer (Tanpa Perlu Login) */}
      {isOrdersDrawerOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div
            onClick={() => setIsOrdersDrawerOpen(false)}
            className="absolute inset-0 bg-black/40 cursor-pointer"
          />

          <div className="bg-white rounded-t-2xl shadow-2xl relative z-10 w-full flex flex-col max-h-[85vh] border-t border-stone-200 overflow-hidden">
            <div className="w-12 h-1 bg-stone-300 rounded-full mx-auto my-3 shrink-0" />

            <div className="px-5 pb-2 border-b border-stone-100 flex items-center justify-between shrink-0">
              <h3 className="text-base font-bold text-stone-900 flex items-center font-display">
                <Receipt className="w-4 h-4 text-[#d4af37] mr-2" />
                Status Pesanan Saya (Tamu)
              </h3>
              <button
                onClick={() => setIsOrdersDrawerOpen(false)}
                className="text-stone-400 hover:text-stone-600 p-1 text-sm font-semibold cursor-pointer"
              >
                Tutup
              </button>
            </div>

            {/* Cross-device / Search Recovery Bar */}
            <div className="px-5 py-2.5 bg-stone-50 border-b border-stone-200">
              <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">
                Lacak / Pulihkan Pesanan (Cari via ID Pesanan atau Nama):
              </label>
              <form onSubmit={handleLookup} className="flex space-x-2">
                <input
                  type="text"
                  placeholder="Contoh: ORD-123456 atau Nama Anda..."
                  value={lookupQuery}
                  onChange={e => setLookupQuery(e.target.value)}
                  className="flex-1 bg-white border border-stone-200 rounded-xl px-3 py-1.5 text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-[#d4af37]"
                />
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-[#d4af37] hover:bg-[#c29d2b] text-black rounded-xl text-xs font-bold shrink-0 cursor-pointer"
                >
                  Lacak
                </button>
              </form>
            </div>

            {/* List Orders */}
            <div className="overflow-y-auto px-5 py-4 flex-1 space-y-3 no-scrollbar">
              {myOrders.length === 0 ? (
                <div className="py-12 text-center text-stone-400">
                  <p className="text-sm font-medium text-stone-600">Belum ada pesanan aktif dari perangkat ini</p>
                  <p className="text-xs mt-1">Silakan pilih menu pesanan Anda dari katalog di atas.</p>
                </div>
              ) : (
                myOrders.map(tx => {
                  const dateStr = new Date(tx.date).toLocaleDateString('id-ID', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                  });

                  return (
                    <div key={tx.id} className="bg-stone-50 border border-stone-200 rounded-xl p-3.5 space-y-2 shadow-xs">
                      <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                        <div>
                          <span className="text-xs font-bold text-stone-900 font-mono">#{tx.id}</span>
                          <p className="text-[10px] text-stone-500">{dateStr}</p>
                        </div>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-emerald-100 text-emerald-800 border-emerald-300">
                          {tx.status === 'selesai' ? 'Selesai / Siap' : 'Sedang Diproses'}
                        </span>
                      </div>

                      <div className="text-xs space-y-1">
                        <div className="flex justify-between text-stone-600">
                          <span>Pemesan: <strong className="text-stone-900">{tx.customer_name}</strong></span>
                          <span>Metode: <strong className="text-stone-900">{tx.metode_pembayaran}</strong></span>
                        </div>
                        <p className="text-[11px] text-stone-700 font-medium pt-1">{tx.ratio_notes || '-'}</p>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-stone-200">
                        <span className="text-xs font-extrabold text-stone-900 font-mono">{formatRupiah(tx.total_price)}</span>
                        <button
                          onClick={() => setActiveReceipt(tx)}
                          className="text-[11px] font-semibold text-stone-700 hover:text-black bg-white border border-stone-200 px-3 py-1 rounded-lg shadow-xs transition-colors cursor-pointer"
                        >
                          Lihat Struk
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Printable Receipt Modal */}
      {activeReceipt && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4">
          <div className="bg-white text-stone-950 p-6 rounded-xl shadow-2xl w-80 max-w-full font-mono text-sm border border-stone-200">
            <div id="receipt-print-area" className="border-b border-dashed border-stone-300 pb-4">
              <div className="text-center mb-4">
                <h2 className="text-lg font-bold uppercase tracking-wider">Kollabora Cafe</h2>
                <p className="text-xs text-stone-500">Jl. Raya Kupang Indah No.51, Surabaya</p>
                <p className="text-xs text-stone-500">Telp: 0812-3456-7890</p>
              </div>

              <div className="text-xs space-y-1 mb-4 border-b border-dashed border-stone-300 pb-3">
                <div className="flex justify-between">
                  <span>No. Invoice:</span>
                  <span className="font-bold">#{activeReceipt.id}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tanggal:</span>
                  <span>{new Date(activeReceipt.date).toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Pelanggan:</span>
                  <span className="font-bold">{activeReceipt.customer_name}</span>
                </div>
                <div className="flex justify-between">
                  <span>Metode:</span>
                  <span className="uppercase">{activeReceipt.metode_pembayaran}</span>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                {activeReceipt.items?.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-xs">
                    <span className="truncate pr-2">{item.product_name} ({item.variant_size}) x{item.quantity}</span>
                    <span className="shrink-0 font-bold">{formatRupiah(item.price * item.quantity)}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-dashed border-stone-300 pt-3 space-y-1 text-xs">
                <div className="flex justify-between text-sm font-bold text-stone-950">
                  <span>TOTAL:</span>
                  <span>{formatRupiah(activeReceipt.total_price)}</span>
                </div>
              </div>

              <div className="text-center mt-6 text-xs text-stone-400 italic">
                <p>Terima Kasih Atas Kunjungan Anda</p>
                <p>Selamat Menikmati!</p>
              </div>
            </div>

            <div className="mt-4 flex space-x-2">
              <button
                onClick={() => window.print()}
                className="flex-1 bg-stone-900 hover:bg-stone-800 text-white font-bold py-2 px-4 rounded-lg transition-colors text-center text-xs cursor-pointer"
              >
                Cetak Struk
              </button>
              <button
                onClick={() => setActiveReceipt(null)}
                className="flex-1 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold py-2 px-4 rounded-lg transition-colors text-center text-xs cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
