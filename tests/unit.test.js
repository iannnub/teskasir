const test = require('node:test');
const assert = require('node:assert');
const KollaboraDB = require('../db.js');

test('KollaboraDB - escapeHtml sanitizes dangerous XSS payloads', () => {
  const unsafe1 = '<script>alert("xss")</script>';
  assert.strictEqual(KollaboraDB.escapeHtml(unsafe1), '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');

  const unsafe2 = 'Customer "<b>O\'Reilly</b>" & Sons';
  assert.strictEqual(KollaboraDB.escapeHtml(unsafe2), 'Customer &quot;&lt;b&gt;O&#039;Reilly&lt;/b&gt;&quot; &amp; Sons');

  assert.strictEqual(KollaboraDB.escapeHtml(null), '');
  assert.strictEqual(KollaboraDB.escapeHtml(undefined), '');
});

test('KollaboraDB - Products retrieval and defaults', () => {
  const products = KollaboraDB.getProducts();
  assert(Array.isArray(products));
  assert(products.length >= 4);

  const americano = products.find(p => p.id === 'aetheria');
  assert(americano !== undefined);
  assert.strictEqual(americano.name, 'AMERICANO');
  assert(Array.isArray(americano.variants));
  assert(americano.variants.length > 0);
});

test('KollaboraDB - Add, update, and delete product', () => {
  const newProduct = {
    id: 'test-latte-1',
    name: 'Caramel Macchiato',
    category: 'Coffe',
    image: 'assets/americano.png',
    description: 'Espresso with caramel drizzle',
    variants: [{ size: 'Ice', price: 30000, stock: 20 }]
  };

  KollaboraDB.saveProduct(newProduct);
  let products = KollaboraDB.getProducts();
  let found = products.find(p => p.id === 'test-latte-1');
  assert(found !== undefined);
  assert.strictEqual(found.name, 'Caramel Macchiato');

  // Update
  newProduct.name = 'Caramel Macchiato Special';
  KollaboraDB.saveProduct(newProduct);
  products = KollaboraDB.getProducts();
  found = products.find(p => p.id === 'test-latte-1');
  assert.strictEqual(found.name, 'Caramel Macchiato Special');

  // Delete
  KollaboraDB.deleteProduct('test-latte-1');
  products = KollaboraDB.getProducts();
  found = products.find(p => p.id === 'test-latte-1');
  assert.strictEqual(found, undefined);
});

test('KollaboraDB - Categories management', () => {
  const initial = KollaboraDB.getCategories();
  assert(initial.includes('Coffe'));
  assert(initial.includes('Makanan'));

  const updated = [...initial, 'Mocktail'];
  KollaboraDB.saveCategories(updated);
  const reloaded = KollaboraDB.getCategories();
  assert(reloaded.includes('Mocktail'));

  // Cleanup
  KollaboraDB.saveCategories(initial);
});

test('KollaboraDB - Guest session and order isolation without login', () => {
  const guestId = KollaboraDB.getGuestId();
  assert(typeof guestId === 'string' && guestId.startsWith('guest_'));

  const orderId = 'ORD-TEST-' + Math.floor(Math.random() * 10000);
  const newTx = {
    id: orderId,
    customer_name: 'Dewi Sartika',
    total_price: 50000,
    status: 'selesai',
    metode_pembayaran: 'QRIS',
    items: [{ product_name: 'AMERICANO', variant_size: 'Ice', price: 25000, quantity: 2 }]
  };

  KollaboraDB.saveTransaction(newTx);

  // Guest view sees their own order
  const guestOrders = KollaboraDB.getTransactions(true);
  const foundInGuest = guestOrders.find(o => o.id === orderId);
  assert(foundInGuest !== undefined);
  assert.strictEqual(foundInGuest.customer_name, 'Dewi Sartika');

  // Admin view sees it too
  const allOrders = KollaboraDB.getTransactions(false);
  const foundInAll = allOrders.find(o => o.id === orderId);
  assert(foundInAll !== undefined);
});

test('KollaboraDB - Order lookup by invoice number and customer name', () => {
  const orderId = 'ORD-SEARCH-99';
  KollaboraDB.saveTransaction({
    id: orderId,
    customer_name: 'Bambang Pamungkas',
    total_price: 28000,
    status: 'selesai',
    items: []
  });

  const byInvoice = KollaboraDB.lookupOrder('SEARCH-99');
  assert(byInvoice.length > 0);
  assert.strictEqual(byInvoice[0].id, orderId);

  const byName = KollaboraDB.lookupOrder('Bambang');
  assert(byName.length > 0);
  assert.strictEqual(byName[0].customer_name, 'Bambang Pamungkas');

  const notFound = KollaboraDB.lookupOrder('NonExistentOrderXYZ');
  assert.strictEqual(notFound.length, 0);
});
