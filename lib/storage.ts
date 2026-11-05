import { Product, Transaction } from './types';
import { eventEmitter } from './events';
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

function readLocalDB(): LocalDB {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      return {
        products: Array.isArray(parsed.products) && parsed.products.length > 0
          ? parsed.products
          : JSON.parse(JSON.stringify(DEFAULT_PRODUCTS)),
        categories: Array.isArray(parsed.categories) && parsed.categories.length > 0
          ? parsed.categories
          : [...DEFAULT_CATEGORIES],
        orders: Array.isArray(parsed.orders)
          ? parsed.orders
          : []
      };
    }
  } catch (e) {
    console.error('Error reading local db:', e);
  }

  const initial: LocalDB = {
    products: JSON.parse(JSON.stringify(DEFAULT_PRODUCTS)),
    categories: [...DEFAULT_CATEGORIES],
    orders: []
  };
  writeLocalDB(initial);
  return initial;
}

function writeLocalDB(data: LocalDB) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error writing local db:', e);
  }
}

// ==================== EXPORTED STORAGE API ====================

export async function getProducts(): Promise<Product[]> {
  if (KV_URL && KV_TOKEN) {
    const cloudProducts = await kvGet<Product[]>('kollabora_products');
    if (cloudProducts && Array.isArray(cloudProducts) && cloudProducts.length > 0) {
      return cloudProducts;
    }
    await kvSet('kollabora_products', DEFAULT_PRODUCTS);
    return DEFAULT_PRODUCTS;
  }

  const db = readLocalDB();
  return db.products;
}

export async function saveProducts(products: Product[]): Promise<Product[]> {
  const db = readLocalDB();
  db.products = products;
  if (KV_URL && KV_TOKEN) {
    await kvSet('kollabora_products', products);
  }
  writeLocalDB(db);
  eventEmitter.broadcast('products_updated', { count: products.length });
  return products;
}

export async function saveProduct(product: Product): Promise<Product> {
  const db = readLocalDB();
  const index = db.products.findIndex(p => p.id === product.id);
  if (index !== -1) {
    db.products[index] = { ...db.products[index], ...product };
  } else {
    db.products.push(product);
  }
  if (KV_URL && KV_TOKEN) {
    await kvSet('kollabora_products', db.products);
  }
  writeLocalDB(db);
  eventEmitter.broadcast('products_updated', { id: product.id });
  return product;
}

export async function deleteProduct(productId: string): Promise<boolean> {
  const db = readLocalDB();
  db.products = db.products.filter(p => p.id !== productId);
  if (KV_URL && KV_TOKEN) {
    await kvSet('kollabora_products', db.products);
  }
  writeLocalDB(db);
  eventEmitter.broadcast('products_updated', { deleted: productId });
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

  const db = readLocalDB();
  return db.categories;
}

export async function saveCategories(categories: string[]): Promise<string[]> {
  const db = readLocalDB();
  db.categories = categories;
  if (KV_URL && KV_TOKEN) {
    await kvSet('kollabora_categories', categories);
  }
  writeLocalDB(db);
  eventEmitter.broadcast('categories_updated', { categories });
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
    const db = readLocalDB();
    allOrders = db.orders || [];
  }

  if (guestId) {
    return allOrders.filter(o => o.guest_id === guestId);
  }
  return allOrders;
}

export async function saveOrder(order: Transaction): Promise<Transaction> {
  const db = readLocalDB();
  if (!db.orders) db.orders = [];
  db.orders.unshift(order);

  // Automatically deduct stock
  if (order.items && Array.isArray(order.items)) {
    for (const item of order.items) {
      const prod = db.products.find(p => p.id === item.product_id || p.name === item.product_name);
      if (prod && prod.variants) {
        const variant = prod.variants.find(v => v.size === item.variant_size);
        if (variant && variant.stock >= item.quantity) {
          variant.stock -= item.quantity;
          variant.label = variant.stock === 0 ? 'Habis' : (variant.stock <= 5 ? `Sisa ${variant.stock} unit` : 'Ready Stock');
        }
      }
    }
  }

  if (KV_URL && KV_TOKEN) {
    await kvSet('kollabora_orders', db.orders);
    await kvSet('kollabora_products', db.products);
  }
  writeLocalDB(db);

  eventEmitter.broadcast('orders_updated', { orderId: order.id });
  eventEmitter.broadcast('products_updated', { deducted: true });
  return order;
}

export async function clearOrders(): Promise<boolean> {
  const db = readLocalDB();
  db.orders = [];
  if (KV_URL && KV_TOKEN) {
    await kvSet('kollabora_orders', []);
  }
  writeLocalDB(db);
  eventEmitter.broadcast('orders_updated', { cleared: true });
  return true;
}
