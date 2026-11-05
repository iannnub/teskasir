'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import useSWR, { mutate } from 'swr';
import { Product, ProductVariant, Transaction } from '@/lib/types';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Gagal mengambil data dari server');
  return res.json();
};

function formatRupiah(amount: number) {
  return 'Rp ' + (Number(amount) || 0).toLocaleString('id-ID');
}

export default function AdminPage() {
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authChecked, setAuthChecked] = useState<boolean>(false);
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [loginError, setLoginError] = useState<string>('');

  // SWR Data Fetching with Fast Revalidation & Deduping
  const { data: serverProducts = [], error: prodError } = useSWR<Product[]>('/api/products', fetcher, {
    refreshInterval: 3000,
    revalidateOnFocus: true,
    dedupingInterval: 1000
  });

  // Local Reconciliation: Mencegah produk hilang-muncul (flickering) akibat pergantian worker di Vercel serverless
  const [localCustomProducts, setLocalCustomProducts] = useState<Product[]>([]);
  const [deletedProductIds, setDeletedProductIds] = useState<string[]>([]);

  useEffect(() => {
    try {
      const savedCustom = localStorage.getItem('kollabora_custom_products');
      if (savedCustom) setLocalCustomProducts(JSON.parse(savedCustom));
      const savedDeleted = localStorage.getItem('kollabora_deleted_ids');
      if (savedDeleted) setDeletedProductIds(JSON.parse(savedDeleted));
    } catch (_) {}
  }, []);

  const products = useMemo(() => {
    const map = new Map<string, Product>();
    for (const p of serverProducts) {
      if (!deletedProductIds.includes(p.id)) {
        map.set(p.id, p);
      }
    }
    for (const p of localCustomProducts) {
      if (!deletedProductIds.includes(p.id)) {
        map.set(p.id, p);
      }
    }
    return Array.from(map.values());
  }, [serverProducts, localCustomProducts, deletedProductIds]);
  const { data: categories = [], error: catError } = useSWR<string[]>('/api/categories', fetcher, {
    refreshInterval: 4000,
    revalidateOnFocus: true,
    dedupingInterval: 1000
  });
  const { data: orders = [], error: orderError } = useSWR<Transaction[]>('/api/orders', fetcher, {
    refreshInterval: 2500,
    revalidateOnFocus: true,
    dedupingInterval: 400
  });

  // Filters & Search
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');
  const [productSearch, setProductSearch] = useState<string>('');
  const [timeFilter, setTimeFilter] = useState<'today' | 'yesterday' | '7days' | '30days' | 'all'>('30days');
  const [txSearch, setTxSearch] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Modals
  const [isProductModalOpen, setIsProductModalOpen] = useState<boolean>(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState<boolean>(false);
  const [activeReceipt, setActiveReceipt] = useState<Transaction | null>(null);

  // Form State for Product Add / Edit
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [formName, setFormName] = useState<string>('');
  const [formCategory, setFormCategory] = useState<string>('');
  const [formDesc, setFormDesc] = useState<string>('');
  const [formImage, setFormImage] = useState<string>('/assets/americano.png');
  const [formVariants, setFormVariants] = useState<ProductVariant[]>([
    { size: 'Ice', price: 25000, stock: 15 },
    { size: 'Hot', price: 20000, stock: 10 }
  ]);
  const [newCategoryName, setNewCategoryName] = useState<string>('');
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const showNotice = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 3000);
  };

  // Check login on mount + Setup SSE & BroadcastChannel for 0-delay real-time
  useEffect(() => {
    const sessionAuth = sessionStorage.getItem('kollabora_admin_auth');
    if (sessionAuth === 'true') {
      setIsAuthenticated(true);
    }
    setAuthChecked(true);

    // 1. Cross-tab BroadcastChannel for 0ms same-browser sync
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('kollabora_sync_channel');
      bc.onmessage = (ev) => {
        if (ev.data?.type === 'products') mutate('/api/products');
        if (ev.data?.type === 'orders') mutate('/api/orders');
        if (ev.data?.type === 'categories') mutate('/api/categories');
      };
    } catch (e) {}

    // 2. Server-Sent Events (SSE) for instant cross-device sync (<50ms)
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/events');
      eventSource.addEventListener('products_updated', () => {
        mutate('/api/products');
      });
      eventSource.addEventListener('orders_updated', () => {
        mutate('/api/orders');
      });
      eventSource.addEventListener('categories_updated', () => {
        mutate('/api/categories');
      });
    } catch (e) {}

    return () => {
      if (bc) bc.close();
      if (eventSource) eventSource.close();
    };
  }, []);

  const broadcastLocalChange = (type: string) => {
    try {
      const bc = new BroadcastChannel('kollabora_sync_channel');
      bc.postMessage({ type });
      bc.close();
    } catch (e) {}
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput.trim() === 'admin123') {
      sessionStorage.setItem('kollabora_admin_auth', 'true');
      setIsAuthenticated(true);
      setLoginError('');
      showNotice('Berhasil masuk ke Dashboard Admin');
    } else {
      setLoginError('Password salah! Gunakan password: admin123');
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('kollabora_admin_auth');
    setIsAuthenticated(false);
  };

  // Filtered Orders for Stats & Transactions List
  const filteredOrders = useMemo(() => {
    let result = [...orders];

    if (timeFilter !== 'all') {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      result = result.filter(order => {
        const orderDate = new Date(order.date);
        if (isNaN(orderDate.getTime())) return true;

        if (timeFilter === 'today') {
          return orderDate >= startOfToday;
        } else if (timeFilter === 'yesterday') {
          const startOfYesterday = new Date(startOfToday);
          startOfYesterday.setDate(startOfYesterday.getDate() - 1);
          return orderDate >= startOfYesterday && orderDate < startOfToday;
        } else if (timeFilter === '7days') {
          const sevenDaysAgo = new Date(startOfToday);
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          return orderDate >= sevenDaysAgo;
        } else if (timeFilter === '30days') {
          const thirtyDaysAgo = new Date(startOfToday);
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          return orderDate >= thirtyDaysAgo;
        }
        return true;
      });
    }

    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      result = result.filter(order => {
        const orderDate = new Date(order.date);
        return orderDate >= start && orderDate <= end;
      });
    }

    if (txSearch.trim()) {
      const q = txSearch.toLowerCase();
      result = result.filter(o =>
        o.id.toLowerCase().includes(q) ||
        (o.customer_name && o.customer_name.toLowerCase().includes(q))
      );
    }

    return result;
  }, [orders, timeFilter, startDate, endDate, txSearch]);

  const totalStockCount = useMemo(() => {
    return products.reduce((sum, p) => {
      const variantsSum = p.variants?.reduce((vSum, v) => vSum + (v.stock || 0), 0) || 0;
      return sum + variantsSum;
    }, 0);
  }, [products]);

  const totalRevenue = useMemo(() => {
    return filteredOrders.reduce((sum, o) => sum + (Number(o.total_price) || 0), 0);
  }, [filteredOrders]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      if (selectedCategory !== 'Semua' && p.category.toLowerCase() !== selectedCategory.toLowerCase()) {
        return false;
      }
      if (productSearch.trim()) {
        const q = productSearch.toLowerCase();
        return p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
      }
      return true;
    });
  }, [products, selectedCategory, productSearch]);

  const handleOpenAddProduct = () => {
    setEditingProductId(null);
    setFormName('');
    setFormCategory(categories[0] || 'Coffe');
    setFormDesc('');
    setFormImage('/assets/americano.png');
    setFormVariants([
      { size: 'Ice', price: 25000, stock: 15 },
      { size: 'Hot', price: 20000, stock: 10 }
    ]);
    setIsProductModalOpen(true);
  };

  const handleOpenEditProduct = (prod: Product) => {
    setEditingProductId(prod.id);
    setFormName(prod.name);
    setFormCategory(prod.category);
    setFormDesc(prod.description || '');
    setFormImage(prod.image || '/assets/americano.png');
    setFormVariants(prod.variants && prod.variants.length > 0 ? JSON.parse(JSON.stringify(prod.variants)) : [
      { size: 'Ice', price: 25000, stock: 10 }
    ]);
    setIsProductModalOpen(true);
  };

  const [isCompressingImage, setIsCompressingImage] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('File yang dipilih bukan gambar yang valid!');
        return;
      }
      try {
        setIsCompressingImage(true);
        // Otomatis kompresi gambar di client: max 600px, JPEG 0.75 (~35KB)
        // Mencegah error Vercel 4.5MB Payload limit dan mempercepat load gambar
        const compressed = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = () => reject(new Error('Gagal membaca file gambar'));
          reader.onload = (ev) => {
            const img = new Image();
            img.onerror = () => reject(new Error('Gagal memuat gambar'));
            img.onload = () => {
              const maxWidth = 600;
              const maxHeight = 600;
              let width = img.width;
              let height = img.height;

              if (width > height) {
                if (width > maxWidth) {
                  height = Math.round((height * maxWidth) / width);
                  width = maxWidth;
                }
              } else {
                if (height > maxHeight) {
                  width = Math.round((width * maxHeight) / height);
                  height = maxHeight;
                }
              }

              const canvas = document.createElement('canvas');
              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');
              if (!ctx) {
                resolve(ev.target?.result as string);
                return;
              }

              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, width, height);
              ctx.drawImage(img, 0, 0, width, height);

              const compressedData = canvas.toDataURL('image/jpeg', 0.75);
              resolve(compressedData);
            };
            img.src = ev.target?.result as string;
          };
          reader.readAsDataURL(file);
        });

        setFormImage(compressed);
      } catch (err: any) {
        console.error('Error compressing image:', err);
        alert('Gagal mengompresi gambar: ' + (err?.message || 'Format tidak didukung'));
      } finally {
        setIsCompressingImage(false);
      }
    }
  };

  const handleAddVariantRow = () => {
    setFormVariants(prev => [...prev, { size: 'Regular', price: 20000, stock: 10 }]);
  };

  const handleUpdateVariant = (index: number, field: keyof ProductVariant, value: any) => {
    setFormVariants(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleRemoveVariant = (index: number) => {
    if (formVariants.length <= 1) {
      alert('Minimal harus memiliki 1 varian menu!');
      return;
    }
    setFormVariants(prev => prev.filter((_, i) => i !== index));
  };

  // Save Product with 0ms Optimistic UI Update
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      alert('Nama produk tidak boleh kosong!');
      return;
    }

    const cleanedVariants = formVariants.map(v => ({
      ...v,
      size: (v.size || 'Regular').trim(),
      price: Math.max(0, Number(v.price) || 0),
      stock: Math.max(0, Number(v.stock) || 0),
      label: Number(v.stock) === 0 ? 'Habis' : (Number(v.stock) <= 5 ? `Sisa ${v.stock} unit` : 'Ready Stock')
    }));

    const allOutOfStock = cleanedVariants.every(v => v.stock === 0);
    const safeSlug = formName.trim().toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'menu';
    const finalId = editingProductId || `${safeSlug}-${Date.now().toString(36)}`;

    const productPayload: Product = {
      id: finalId,
      name: formName.trim().toUpperCase(),
      category: formCategory || 'Coffe',
      description: formDesc.trim(),
      image: formImage || '/assets/americano.png',
      badge: allOutOfStock ? 'Habis' : 'Ready Stock',
      badgeClass: allOutOfStock ? 'bg-zinc-600' : 'pulse-green',
      isReady: !allOutOfStock,
      variants: cleanedVariants
    };

    // 1. Instant Optimistic UI & Local Persistence (0ms delay & no disappearing)
    setIsProductModalOpen(false);
    showNotice(editingProductId ? 'Produk berhasil diperbarui!' : 'Produk baru berhasil ditambahkan!');

    // Persist to local custom products so SWR never drops it on worker switch
    setLocalCustomProducts(prev => {
      const next = prev.filter(p => p.id !== finalId);
      next.push(productPayload);
      try {
        localStorage.setItem('kollabora_custom_products', JSON.stringify(next));
      } catch (_) {}
      return next;
    });
    setDeletedProductIds(prev => {
      const next = prev.filter(id => id !== finalId);
      try {
        localStorage.setItem('kollabora_deleted_ids', JSON.stringify(next));
      } catch (_) {}
      return next;
    });

    // Ensure filter reveals the new/updated product immediately
    if (selectedCategory !== 'Semua' && selectedCategory.toLowerCase() !== (formCategory || '').toLowerCase()) {
      setSelectedCategory('Semua');
    }

    const optimisticProducts = editingProductId
      ? products.map(p => p.id === editingProductId ? productPayload : p)
      : [...products.filter(p => p.id !== finalId), productPayload];

    mutate('/api/products', optimisticProducts, false);
    broadcastLocalChange('products');

    // 2. Background Sync to Server
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productPayload)
      });
      if (!res.ok) {
        let errMsg = `Gagal menyimpan produk (Status ${res.status})`;
        try {
          const errData = await res.json();
          if (errData?.error) errMsg = errData.error;
        } catch (_) {
          if (res.status === 413) {
            errMsg = 'Ukuran gambar/data terlalu besar untuk server (Batas Vercel 4.5MB). Harap gunakan foto dengan resolusi lebih kecil.';
          }
        }
        throw new Error(errMsg);
      }
      const savedFromServer = await res.json();
      mutate('/api/products', (current: Product[] = []) => {
        const idx = current.findIndex(p => p.id === finalId);
        if (idx !== -1) {
          const clone = [...current];
          clone[idx] = savedFromServer;
          return clone;
        }
        return [...current, savedFromServer];
      }, false);
    } catch (err: any) {
      alert('Gagal menyimpan perubahan ke server: ' + err.message);
      mutate('/api/products');
    }
  };

  // Delete Product with 0ms Optimistic UI Update
  const handleDeleteProduct = async (productId: string, productName: string) => {
    if (!confirm(`Yakin ingin menghapus menu "${productName}"?`)) return;

    // 1. Instant Optimistic UI & Local Persistence (0ms delay)
    setDeletedProductIds(prev => {
      const next = [...prev.filter(id => id !== productId), productId];
      try {
        localStorage.setItem('kollabora_deleted_ids', JSON.stringify(next));
      } catch (_) {}
      return next;
    });
    setLocalCustomProducts(prev => {
      const next = prev.filter(p => p.id !== productId);
      try {
        localStorage.setItem('kollabora_custom_products', JSON.stringify(next));
      } catch (_) {}
      return next;
    });

    const optimisticProducts = products.filter(p => p.id !== productId);
    mutate('/api/products', optimisticProducts, false);
    broadcastLocalChange('products');
    showNotice(`Menu "${productName}" dihapus.`);

    // 2. Background Sync
    try {
      const res = await fetch(`/api/products?id=${productId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Gagal menghapus produk');
      mutate('/api/products');
    } catch (err: any) {
      alert('Gagal menghapus dari server: ' + err.message);
      mutate('/api/products');
    }
  };

  // Add Category with 0ms Optimistic Update
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newCategoryName.trim();
    if (!name) return;

    if (categories.some(c => c.toLowerCase() === name.toLowerCase())) {
      alert(`Kategori "${name}" sudah ada!`);
      return;
    }

    const updatedCategories = [...categories, name];
    setNewCategoryName('');
    mutate('/api/categories', updatedCategories, false);
    broadcastLocalChange('categories');
    showNotice(`Kategori "${name}" ditambahkan.`);

    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedCategories)
      });
      if (!res.ok) throw new Error('Gagal menambahkan kategori');
      mutate('/api/categories');
    } catch (err: any) {
      alert(err.message);
      mutate('/api/categories');
    }
  };

  // Delete Category with 0ms Optimistic Update
  const handleDeleteCategory = async (catToDelete: string) => {
    const usedCount = products.filter(p => p.category.toLowerCase() === catToDelete.toLowerCase()).length;
    let msg = `Hapus kategori "${catToDelete}"?`;
    if (usedCount > 0) {
      msg = `Kategori "${catToDelete}" digunakan oleh ${usedCount} produk.\nTetap hapus?`;
    }
    if (!confirm(msg)) return;

    const updatedCategories = categories.filter(c => c.toLowerCase() !== catToDelete.toLowerCase());
    mutate('/api/categories', updatedCategories, false);
    broadcastLocalChange('categories');
    showNotice(`Kategori "${catToDelete}" dihapus.`);

    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedCategories)
      });
      if (!res.ok) throw new Error('Gagal menghapus kategori');
      mutate('/api/categories');
    } catch (err: any) {
      alert(err.message);
      mutate('/api/categories');
    }
  };

  const handleResetCategories = async () => {
    if (!confirm('Pulihkan daftar kategori ke default (Coffe, Coklat, Makanan, Camilan)?')) return;
    const defaults = ["Coffe", "Coklat", "Makanan", "Camilan"];
    mutate('/api/categories', defaults, false);
    broadcastLocalChange('categories');
    showNotice('Kategori dipulihkan ke default.');

    try {
      await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(defaults)
      });
      mutate('/api/categories');
    } catch (err: any) {
      alert(err.message);
      mutate('/api/categories');
    }
  };

  // Simulate Test Order with 0ms Optimistic Update
  const handleSimulateOrder = async () => {
    const randomCustomer = ['Rian Pratama', 'Siti Rahma', 'Budi Santoso', 'Dewi Lestari', 'Agus Setiawan'][Math.floor(Math.random() * 5)];
    const randomTable = String(Math.floor(Math.random() * 12) + 1);
    const mockOrder: Transaction = {
      id: 'ORD-' + Math.floor(100000 + Math.random() * 900000),
      guest_id: 'guest_simulated',
      customer_name: randomCustomer,
      table_number: randomTable,
      date: new Date().toISOString(),
      metode_pembayaran: Math.random() > 0.5 ? 'QRIS' : 'Cash',
      ratio_notes: `Meja #${randomTable} • Test Order Otomatis`,
      status: 'selesai',
      items: [
        {
          product_id: 'aetheria',
          product_name: 'AMERICANO',
          variant_size: 'Ice',
          price: 25000,
          quantity: 2
        }
      ],
      total_price: 50000,
      cash_paid: 50000,
      change_due: 0
    };

    mutate('/api/orders', [mockOrder, ...orders], false);
    broadcastLocalChange('orders');
    showNotice(`Pesanan #${mockOrder.id} (${randomCustomer}) dibuat!`);

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockOrder)
      });
      if (!res.ok) throw new Error('Gagal simulasi order');
      mutate('/api/orders');
      mutate('/api/products');
    } catch (err: any) {
      alert(err.message);
      mutate('/api/orders');
    }
  };

  const handleClearAllOrders = async () => {
    if (!confirm('Peringatan: Apakah Anda yakin ingin MENGHAPUS SEMUA riwayat transaksi? Tindakan ini tidak dapat dibatalkan.')) return;
    mutate('/api/orders', [], false);
    broadcastLocalChange('orders');
    showNotice('Semua riwayat transaksi dibersihkan.');

    try {
      const res = await fetch('/api/orders', { method: 'DELETE' });
      if (!res.ok) throw new Error('Gagal membersihkan transaksi');
      mutate('/api/orders');
    } catch (err: any) {
      alert(err.message);
      mutate('/api/orders');
    }
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-zinc-400">
        Memeriksa sesi login...
      </div>
    );
  }

  // ==================== LOGIN VIEW ====================
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-black text-zinc-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-zinc-800 border border-[#d4af37]/30 text-[#d4af37] mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white uppercase">KollaBora Cafe</h1>
            <p className="text-xs text-zinc-400 mt-1">Portal Autentikasi Pengelola & Kasir</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                Username
              </label>
              <input
                type="text"
                defaultValue="admin"
                disabled
                className="w-full bg-zinc-800/60 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-zinc-400 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                Password Admin
              </label>
              <input
                type="password"
                placeholder="Masukkan password admin..."
                value={passwordInput}
                onChange={e => setPasswordInput(e.target.value)}
                autoFocus
                className="w-full bg-zinc-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-[#d4af37] transition-colors"
              />
            </div>

            {loginError && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3 bg-[#d4af37] text-black font-extrabold rounded-xl hover:bg-[#b8952b] transition-all cursor-pointer text-sm shadow-md"
            >
              Masuk Dashboard
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-xs text-zinc-500">
            <span>Default: <code className="text-amber-400 font-mono">admin123</code></span>
            <Link href="/" className="text-zinc-400 hover:text-white underline">
              Kembali ke Menu Kasir &rarr;
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ==================== DASHBOARD VIEW ====================
  return (
    <div className="min-h-screen bg-black text-zinc-100 pb-16">
      {/* Toast Notice */}
      {actionNotice && (
        <div className="fixed top-4 right-4 z-50 bg-[#d4af37] text-black px-4 py-2.5 rounded-xl font-bold text-xs shadow-xl flex items-center space-x-2 transition-all">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-zinc-900 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-zinc-800 border border-[#d4af37]/30 flex items-center justify-center text-[#d4af37] font-black text-sm">
              KB
            </div>
            <div>
              <h1 className="text-base font-extrabold tracking-tight text-white leading-none">
                KOLLABORA <span className="text-[#d4af37]">CAFE</span>
              </h1>
              <span className="text-[10px] text-zinc-400 font-medium">Panel Pengelola & Manajemen Menu</span>
            </div>
          </div>

          <div className="flex items-center space-x-2.5">
            <Link
              href="/"
              className="hidden sm:inline-flex items-center space-x-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-white/10 rounded-xl text-xs font-semibold transition-colors"
            >
              <span>Buka Menu Kasir</span>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </Link>

            <button
              onClick={handleLogout}
              className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              Keluar
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-8">
        {/* Metric Cards & Filter */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Ringkasan Kinerja Kasir</h2>
              <p className="text-xs text-zinc-400">Sinkronisasi instan realtime tanpa delay ke seluruh perangkat pelanggan</p>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-xs text-zinc-400">Rentang Waktu:</span>
              <select
                value={timeFilter}
                onChange={e => setTimeFilter(e.target.value as any)}
                className="bg-zinc-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-[#d4af37]"
              >
                <option value="today">Hari Ini</option>
                <option value="yesterday">Kemarin</option>
                <option value="7days">7 Hari Terakhir</option>
                <option value="30days">30 Hari Terakhir</option>
                <option value="all">Semua Waktu</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Total Menu */}
            <div className="bg-zinc-900 border border-white/10 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between text-zinc-400 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">Total Menu</span>
                <span className="p-2 rounded-xl bg-zinc-800 text-[#d4af37]">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </span>
              </div>
              <div className="text-2xl font-black text-white font-mono">{products.length}</div>
              <div className="text-[11px] text-zinc-500 mt-1">Item aktif terdaftar di sistem</div>
            </div>

            {/* Card 2: Total Stok */}
            <div className="bg-zinc-900 border border-white/10 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between text-zinc-400 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">Total Unit Stok</span>
                <span className="p-2 rounded-xl bg-zinc-800 text-blue-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </span>
              </div>
              <div className="text-2xl font-black text-white font-mono">{totalStockCount}</div>
              <div className="text-[11px] text-zinc-500 mt-1">Akumulasi seluruh varian menu</div>
            </div>

            {/* Card 3: Total Transaksi */}
            <div className="bg-zinc-900 border border-white/10 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between text-zinc-400 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">Total Transaksi</span>
                <span className="p-2 rounded-xl bg-zinc-800 text-emerald-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </span>
              </div>
              <div className="text-2xl font-black text-white font-mono">{filteredOrders.length}</div>
              <div className="text-[11px] text-zinc-500 mt-1">Pesanan selesai terkonfirmasi</div>
            </div>

            {/* Card 4: Total Pendapatan */}
            <div className="bg-zinc-900 border border-[#d4af37]/30 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between text-zinc-400 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#d4af37]">Total Omzet</span>
                <span className="p-2 rounded-xl bg-zinc-800 text-[#d4af37]">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </span>
              </div>
              <div className="text-xl sm:text-2xl font-black text-[#d4af37] font-mono">
                {formatRupiah(totalRevenue)}
              </div>
              <div className="text-[11px] text-zinc-500 mt-1">Berdasarkan filter waktu terpilih</div>
            </div>
          </div>
        </section>

        {/* Section 2: Products Management */}
        <section className="bg-zinc-900 border border-white/10 rounded-2xl p-5 sm:p-6 space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Katalog & Manajemen Stok Menu</h2>
              <p className="text-xs text-zinc-400">Perubahan data menu langsung sinkron ke seluruh user seketika</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setIsCategoryModalOpen(true)}
                className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-white/10 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Kelola Kategori ({categories.length})
              </button>

              <button
                onClick={handleOpenAddProduct}
                className="px-4 py-2 bg-[#d4af37] text-black font-extrabold rounded-xl hover:bg-[#b8952b] transition-all text-xs cursor-pointer shadow-sm flex items-center space-x-1.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                <span>Tambah Menu Baru</span>
              </button>
            </div>
          </div>

          {/* Filter Bar & Chips */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-white/5">
            <div className="flex items-center space-x-2 overflow-x-auto pb-1 sm:pb-0">
              <button
                onClick={() => setSelectedCategory('Semua')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  selectedCategory === 'Semua'
                    ? 'bg-[#d4af37] text-black font-bold'
                    : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Semua
              </button>
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                    selectedCategory.toLowerCase() === cat.toLowerCase()
                      ? 'bg-[#d4af37] text-black font-bold'
                      : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="w-full sm:w-64">
              <input
                type="text"
                placeholder="Cari nama menu..."
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
                className="w-full bg-zinc-800 border border-white/10 rounded-xl px-3.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-[#d4af37]"
              />
            </div>
          </div>

          {/* Product Table */}
          <div className="overflow-x-auto rounded-xl border border-white/5">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-800/80 text-zinc-400 uppercase tracking-wider font-semibold border-b border-white/10">
                <tr>
                  <th className="p-3.5">Gambar</th>
                  <th className="p-3.5">Nama & Deskripsi</th>
                  <th className="p-3.5">Kategori</th>
                  <th className="p-3.5">Varian, Harga & Stok</th>
                  <th className="p-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-zinc-200">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-zinc-500">
                      Tidak ada menu ditemukan. Silakan tambahkan menu baru.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map(prod => (
                    <tr key={prod.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-3.5 w-16">
                        <img
                          src={prod.image || '/assets/americano.png'}
                          alt={prod.name}
                          onError={(e: any) => { e.target.src = '/assets/americano.png'; }}
                          className="w-12 h-12 object-cover rounded-xl bg-zinc-800 border border-white/10"
                        />
                      </td>
                      <td className="p-3.5 max-w-xs">
                        <div className="font-extrabold text-sm text-white tracking-wide">{prod.name}</div>
                        <div className="text-[11px] text-zinc-400 line-clamp-1 mt-0.5">{prod.description || '-'}</div>
                      </td>
                      <td className="p-3.5">
                        <span className="px-2.5 py-1 rounded-md bg-zinc-800 border border-white/10 text-amber-300 font-semibold text-[11px]">
                          {prod.category}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <div className="flex flex-wrap gap-1.5">
                          {prod.variants?.map((v, i) => {
                            const isOut = v.stock === 0;
                            return (
                              <span
                                key={i}
                                className={`px-2 py-0.5 rounded text-[11px] font-mono font-medium border ${
                                  isOut
                                    ? 'bg-red-500/10 text-red-400 border-red-500/30'
                                    : 'bg-zinc-800 text-zinc-200 border-white/10'
                                }`}
                              >
                                {v.size}: <strong className="text-[#d4af37]">{formatRupiah(v.price)}</strong> ({v.stock} unit)
                              </span>
                            );
                          })}
                        </div>
                      </td>
                      <td className="p-3.5 text-right space-x-2 whitespace-nowrap">
                        <button
                          onClick={() => handleOpenEditProduct(prod)}
                          className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(prod.id, prod.name)}
                          className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                        >
                          Hapus
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 3: Orders & Transactions */}
        <section className="bg-zinc-900 border border-white/10 rounded-2xl p-5 sm:p-6 space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Riwayat Transaksi Penjualan</h2>
              <p className="text-xs text-zinc-400">Daftar pesanan masuk dari kasir maupun pemesanan mandiri tamu</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleSimulateOrder}
                className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center space-x-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>Simulasi Order Test</span>
              </button>

              <button
                onClick={handleClearAllOrders}
                className="px-3.5 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Hapus Semua Riwayat
              </button>
            </div>
          </div>

          {/* Date Range & Search */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-white/5">
            <div>
              <label className="block text-[11px] text-zinc-400 mb-1">Dari Tanggal:</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full bg-zinc-800 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-[#d4af37]"
              />
            </div>
            <div>
              <label className="block text-[11px] text-zinc-400 mb-1">Sampai Tanggal:</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full bg-zinc-800 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-[#d4af37]"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] text-zinc-400 mb-1">Cari No. Invoice / Pelanggan:</label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  placeholder="Ketik invoice atau nama..."
                  value={txSearch}
                  onChange={e => setTxSearch(e.target.value)}
                  className="w-full bg-zinc-800 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-[#d4af37]"
                />
                {(startDate || endDate || txSearch) && (
                  <button
                    onClick={() => { setStartDate(''); setEndDate(''); setTxSearch(''); }}
                    className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-xl text-xs"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="overflow-x-auto rounded-xl border border-white/5">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-800/80 text-zinc-400 uppercase tracking-wider font-semibold border-b border-white/10">
                <tr>
                  <th className="p-3.5">Waktu</th>
                  <th className="p-3.5">No. Invoice</th>
                  <th className="p-3.5">Pelanggan</th>
                  <th className="p-3.5">Item & Metode</th>
                  <th className="p-3.5 text-right">Total</th>
                  <th className="p-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-zinc-200">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-zinc-500">
                      Belum ada transaksi pada periode ini.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map(order => {
                    const dateObj = new Date(order.date);
                    const formattedDate = !isNaN(dateObj.getTime())
                      ? `${dateObj.toLocaleDateString('id-ID')} ${dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`
                      : order.date;

                    return (
                      <tr key={order.id} className="hover:bg-white/5 transition-colors">
                        <td className="p-3.5 font-mono text-[11px] text-zinc-400 whitespace-nowrap">
                          {formattedDate}
                        </td>
                        <td className="p-3.5 font-mono font-bold text-[#d4af37] whitespace-nowrap">
                          #{order.id}
                        </td>
                        <td className="p-3.5">
                          <div className="font-bold text-white">{order.customer_name || 'Tamu'}</div>
                          {order.table_number && (
                            <div className="text-[10px] text-zinc-400">Meja #{order.table_number}</div>
                          )}
                        </td>
                        <td className="p-3.5 max-w-xs">
                          <div className="text-zinc-300 font-medium line-clamp-1">
                            {order.ratio_notes || order.items?.map(it => `${it.product_name} (${it.quantity}x)`).join(', ')}
                          </div>
                          <div className="text-[10px] text-zinc-400 mt-0.5">
                            Metode: <span className="text-amber-400 font-semibold">{order.metode_pembayaran || 'Cash'}</span>
                          </div>
                        </td>
                        <td className="p-3.5 text-right font-mono font-extrabold text-[#d4af37]">
                          {formatRupiah(order.total_price)}
                        </td>
                        <td className="p-3.5 text-right">
                          <button
                            onClick={() => setActiveReceipt(order)}
                            className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-white/10 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                          >
                            Struk
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* ==================== MODAL: ADD / EDIT PRODUCT ==================== */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-zinc-900 border border-white/10 rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-base font-extrabold text-white">
                {editingProductId ? 'Edit Menu Produk' : 'Tambah Menu Produk Baru'}
              </h3>
              <button
                onClick={() => setIsProductModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Nama Menu *</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: ESPRESSO DOUBLE"
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    className="w-full bg-zinc-800 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-[#d4af37]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Kategori Menu *</label>
                  <select
                    value={formCategory}
                    onChange={e => setFormCategory(e.target.value)}
                    className="w-full bg-zinc-800 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-[#d4af37]"
                  >
                    {categories.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Deskripsi Menu</label>
                <textarea
                  rows={2}
                  placeholder="Deskripsi singkat rasa atau komposisi..."
                  value={formDesc}
                  onChange={e => setFormDesc(e.target.value)}
                  className="w-full bg-zinc-800 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-[#d4af37]"
                />
              </div>

              {/* Foto Produk */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Foto Menu</label>
                <div className="flex items-center space-x-4">
                  <img
                    src={formImage}
                    alt="Preview"
                    onError={(e: any) => { e.target.src = '/assets/americano.png'; }}
                    className="w-16 h-16 object-cover rounded-xl bg-zinc-800 border border-white/10"
                  />
                  <div className="flex-1 space-y-2">
                    <input
                      type="file"
                      accept="image/*"
                      disabled={isCompressingImage}
                      onChange={handleImageUpload}
                      className="block w-full text-xs text-zinc-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-zinc-800 file:text-zinc-200 hover:file:bg-zinc-700 cursor-pointer disabled:opacity-50"
                    />
                    {isCompressingImage && (
                      <p className="text-[11px] text-[#d4af37] animate-pulse">Mengompresi gambar otomatis...</p>
                    )}
                    <input
                      type="text"
                      placeholder="Atau masukkan URL / path gambar..."
                      value={formImage}
                      onChange={e => setFormImage(e.target.value)}
                      className="w-full bg-zinc-800 border border-white/10 rounded-xl px-3.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-[#d4af37]"
                    />
                  </div>
                </div>
              </div>

              {/* Varian Dinamis */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-zinc-300">
                    Varian Ukuran, Harga (Rp) & Stok Unit
                  </label>
                  <button
                    type="button"
                    onClick={handleAddVariantRow}
                    className="text-[11px] text-[#d4af37] hover:underline font-bold"
                  >
                    + Tambah Varian
                  </button>
                </div>

                <div className="space-y-2">
                  {formVariants.map((v, idx) => (
                    <div key={idx} className="flex items-center space-x-2 bg-zinc-800/80 p-2 rounded-xl border border-white/5">
                      <div className="flex-1">
                        <input
                          type="text"
                          placeholder="Varian (Ice / Hot / Regular)"
                          value={v.size}
                          onChange={e => handleUpdateVariant(idx, 'size', e.target.value)}
                          className="w-full bg-zinc-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-[#d4af37]"
                          required
                        />
                      </div>
                      <div className="w-32">
                        <input
                          type="number"
                          placeholder="Harga (Rp)"
                          value={v.price}
                          onChange={e => handleUpdateVariant(idx, 'price', e.target.value)}
                          className="w-full bg-zinc-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-[#d4af37]"
                          required
                          min={0}
                        />
                      </div>
                      <div className="w-24">
                        <input
                          type="number"
                          placeholder="Stok"
                          value={v.stock}
                          onChange={e => handleUpdateVariant(idx, 'stock', e.target.value)}
                          className="w-full bg-zinc-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-[#d4af37]"
                          required
                          min={0}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveVariant(idx)}
                        className="p-1.5 text-red-400 hover:text-red-300 cursor-pointer"
                        title="Hapus varian ini"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded-xl text-xs font-semibold hover:bg-zinc-700"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#d4af37] text-black font-extrabold rounded-xl hover:bg-[#b8952b] text-xs shadow-md"
                >
                  Simpan Menu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL: MANAGE CATEGORIES ==================== */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-base font-extrabold text-white">Kelola Kategori Menu</h3>
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddCategory} className="flex space-x-2">
              <input
                type="text"
                placeholder="Nama kategori baru..."
                value={newCategoryName}
                onChange={e => setNewCategoryName(e.target.value)}
                className="flex-1 bg-zinc-800 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-[#d4af37]"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-[#d4af37] text-black font-bold rounded-xl text-xs hover:bg-[#b8952b]"
              >
                Tambah
              </button>
            </form>

            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {categories.map(cat => {
                const count = products.filter(p => p.category.toLowerCase() === cat.toLowerCase()).length;
                return (
                  <div key={cat} className="flex items-center justify-between p-3 bg-zinc-800/80 rounded-xl border border-white/5">
                    <div className="flex items-center space-x-2">
                      <span className="w-2 h-2 rounded-full bg-[#d4af37]"></span>
                      <span className="text-sm font-semibold text-white">{cat}</span>
                      <span className="text-[10px] text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded-full font-mono">
                        {count} Produk
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteCategory(cat)}
                      className="text-zinc-500 hover:text-red-400 p-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={handleResetCategories}
                className="text-xs text-zinc-400 hover:text-amber-400 underline"
              >
                Reset ke Default
              </button>
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                className="px-4 py-1.5 bg-zinc-800 text-zinc-200 rounded-xl text-xs hover:bg-zinc-700"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL: RECEIPT MODAL ==================== */}
      {activeReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white text-black rounded-2xl p-6 shadow-2xl space-y-4 font-mono text-xs max-h-[90vh] overflow-y-auto">
            <div className="text-center pb-2 border-b border-dashed border-gray-400">
              <div className="font-black text-sm tracking-widest uppercase">KOLLABORA CAFE</div>
              <div className="text-[10px] text-gray-600">Jl. Kopi Sejati No. 88, Jakarta</div>
              <div className="text-[10px] text-gray-600">Telp: 0812-3456-7890</div>
            </div>

            <div className="text-[11px] space-y-1 pb-2 border-b border-dashed border-gray-300">
              <div className="flex justify-between">
                <span>No. Nota:</span>
                <span className="font-bold">#{activeReceipt.id}</span>
              </div>
              <div className="flex justify-between">
                <span>Waktu:</span>
                <span>{new Date(activeReceipt.date).toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between">
                <span>Pelanggan:</span>
                <span className="font-bold">{activeReceipt.customer_name || 'Tamu'}</span>
              </div>
              {activeReceipt.table_number && (
                <div className="flex justify-between">
                  <span>Meja:</span>
                  <span>#{activeReceipt.table_number}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Metode:</span>
                <span>{activeReceipt.metode_pembayaran || 'Cash'}</span>
              </div>
            </div>

            {/* Items */}
            <div className="space-y-1 pb-2 border-b border-dashed border-gray-300">
              {activeReceipt.items?.map((it, idx) => (
                <div key={idx} className="flex justify-between items-start">
                  <div>
                    <div className="font-bold">{it.product_name}</div>
                    <div className="text-[10px] text-gray-500">
                      {it.quantity}x @ {formatRupiah(it.price)} ({it.variant_size})
                    </div>
                  </div>
                  <div className="font-bold">{formatRupiah(it.price * it.quantity)}</div>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="space-y-1 pb-2 border-b border-dashed border-gray-400 font-bold">
              <div className="flex justify-between text-sm">
                <span>TOTAL:</span>
                <span>{formatRupiah(activeReceipt.total_price)}</span>
              </div>
              <div className="flex justify-between text-[11px] font-normal text-gray-700">
                <span>Tunai / Bayar:</span>
                <span>{formatRupiah(activeReceipt.cash_paid || activeReceipt.total_price)}</span>
              </div>
              <div className="flex justify-between text-[11px] font-normal text-gray-700">
                <span>Kembali:</span>
                <span>{formatRupiah(activeReceipt.change_due || 0)}</span>
              </div>
            </div>

            <div className="text-center text-[10px] text-gray-600 pt-1">
              *** TERIMA KASIH ATAS KUNJUNGANNYA ***<br />
              WiFi: KollaBoraCafe / Pass: ngopidulu
            </div>

            <div className="flex space-x-2 pt-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2 bg-black text-white rounded-xl font-bold hover:bg-gray-800 transition-colors"
              >
                Cetak Struk
              </button>
              <button
                onClick={() => setActiveReceipt(null)}
                className="py-2 px-4 bg-gray-200 text-black rounded-xl font-bold hover:bg-gray-300 transition-colors"
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
