import { Product, Transaction } from './types';
import fs from 'fs';
import path from 'path';

export const DEFAULT_CATEGORIES = ["Coffe", "Coklat", "Makanan", "Camilan"];

export const DEFAULT_PRODUCTS: Product[] = [
  {
    id: 'aetheria',
    name: 'AMERICANO',
    category: 'Coffe',
    image: '/assets/americano.png',
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
    image: '/assets/Mocha Latte.png',
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
    image: '/assets/carbonara.png',
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
    image: '/assets/french fries.png',
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

// Check for Vercel KV / Upstash Redis env vars
const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

async function kvGet<T>(key: string): Promise<T | null> {
  if (!KV_URL || !KV_TOKEN) return null;
  try {
    const res = await fetch(`${KV_URL}/get/${key}`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` },
      cache: 'no-store'
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.result) return null;
    return typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
  } catch (e) {
    console.error('KV get error:', e);
    return null;
  }
}

async function kvSet<T>(key: string, value: T): Promise<boolean> {
  if (!KV_URL || !KV_TOKEN) return false;
  try {
    const valStr = JSON.stringify(value);
    const res = await fetch(`${KV_URL}/set/${key}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KV_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([valStr])
    });
    return res.ok;
  } catch (e) {
    console.error('KV set error:', e);
    return false;
  }
}

// Local Fallback Store File
const DATA_DIR = path.join(process.cwd(), '.data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');

interface LocalDB {
  products: Product[];
  categories: string[];
  orders: Transaction[];
}

// In-memory fallback
let memoryDB: LocalDB = {
  products: JSON.parse(JSON.stringify(DEFAULT_PRODUCTS)),
  categories: [...DEFAULT_CATEGORIES],
  orders: []
};

function readLocalDB(): LocalDB {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (e) { /* ignore */ }
  return memoryDB;
}

function writeLocalDB(data: LocalDB) {
  memoryDB = data;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) { /* serverless readonly filesystem fallback to memory */ }
}

// ==================== EXPORTED STORAGE API ====================

export async function getProducts(): Promise<Product[]> {
  if (KV_URL && KV_TOKEN) {
    const cloudProducts = await kvGet<Product[]>('kollabora_products');
    if (cloudProducts && Array.isArray(cloudProducts) && cloudProducts.length > 0) {
      return cloudProducts;
    }
    // Seed default if empty
    await kvSet('kollabora_products', DEFAULT_PRODUCTS);
    return DEFAULT_PRODUCTS;
  }

  const local = readLocalDB();
  if (!local.products || local.products.length === 0) {
    local.products = JSON.parse(JSON.stringify(DEFAULT_PRODUCTS));
    writeLocalDB(local);
  }
  return local.products;
}

export async function saveProducts(products: Product[]): Promise<Product[]> {
  if (KV_URL && KV_TOKEN) {
    await kvSet('kollabora_products', products);
    return products;
  }
  const local = readLocalDB();
  local.products = products;
  writeLocalDB(local);
  return products;
}

export async function saveProduct(product: Product): Promise<Product> {
  const products = await getProducts();
  const index = products.findIndex(p => p.id === product.id);
  if (index !== -1) {
    products[index] = { ...products[index], ...product };
  } else {
    products.push(product);
  }
  await saveProducts(products);
  return product;
}

export async function deleteProduct(productId: string): Promise<boolean> {
  const products = await getProducts();
  const filtered = products.filter(p => p.id !== productId);
  await saveProducts(filtered);
  return true;
}

export async function getCategories(): Promise<string[]> {
  if (KV_URL && KV_TOKEN) {
    const cloudCategories = await kvGet<string[]>('kollabora_categories');
    if (cloudCategories && Array.isArray(cloudCategories) && cloudCategories.length > 0) {
      return cloudCategories;
    }
    await kvSet('kollabora_categories', DEFAULT_CATEGORIES);
    return DEFAULT_CATEGORIES;
  }
  const local = readLocalDB();
  if (!local.categories || local.categories.length === 0) {
    local.categories = [...DEFAULT_CATEGORIES];
    writeLocalDB(local);
  }
  return local.categories;
}

export async function saveCategories(categories: string[]): Promise<string[]> {
  if (KV_URL && KV_TOKEN) {
    await kvSet('kollabora_categories', categories);
    return categories;
  }
  const local = readLocalDB();
  local.categories = categories;
  writeLocalDB(local);
  return categories;
}

export async function getOrders(guestId?: string): Promise<Transaction[]> {
  let allOrders: Transaction[] = [];
  if (KV_URL && KV_TOKEN) {
    const cloudOrders = await kvGet<Transaction[]>('kollabora_orders');
    if (cloudOrders && Array.isArray(cloudOrders)) {
      allOrders = cloudOrders;
    }
  } else {
    const local = readLocalDB();
    allOrders = local.orders || [];
  }

  if (guestId) {
    return allOrders.filter(o => o.guest_id === guestId);
  }
  return allOrders;
}

export async function saveOrder(order: Transaction): Promise<Transaction> {
  // 1. Save order
  let allOrders: Transaction[] = [];
  if (KV_URL && KV_TOKEN) {
    const cloudOrders = await kvGet<Transaction[]>('kollabora_orders');
    if (cloudOrders && Array.isArray(cloudOrders)) allOrders = cloudOrders;
    allOrders.unshift(order);
    await kvSet('kollabora_orders', allOrders);
  } else {
    const local = readLocalDB();
    if (!local.orders) local.orders = [];
    local.orders.unshift(order);
    writeLocalDB(local);
    allOrders = local.orders;
  }

  // 2. Automatically deduct stock
  if (order.items && Array.isArray(order.items)) {
    const products = await getProducts();
    let changed = false;

    for (const item of order.items) {
      const prod = products.find(p => p.id === item.product_id || p.name === item.product_name);
      if (prod && prod.variants) {
        const variant = prod.variants.find(v => v.size === item.variant_size);
        if (variant && variant.stock >= item.quantity) {
          variant.stock -= item.quantity;
          variant.label = variant.stock === 0 ? 'Habis' : (variant.stock <= 5 ? `Sisa ${variant.stock} unit` : 'Ready Stock');
          changed = true;
        }
      }
    }

    if (changed) {
      await saveProducts(products);
    }
  }

  return order;
}

export async function clearOrders(): Promise<boolean> {
  if (KV_URL && KV_TOKEN) {
    await kvSet('kollabora_orders', []);
    return true;
  }
  const local = readLocalDB();
  local.orders = [];
  writeLocalDB(local);
  return true;
}
