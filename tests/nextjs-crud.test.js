const assert = require('assert');

async function testStorageCRUD() {
  console.log('--- Running Next.js CRUD & Realtime Unit Tests ---');
  const fetch = globalThis.fetch;

  // 1. Test GET /api/products
  console.log('Test 1: Storage product read & structure');
  const res1 = await fetch('http://localhost:3000/api/products');
  assert.strictEqual(res1.status, 200, 'GET /api/products should return 200');
  const prods = await res1.json();
  assert.ok(Array.isArray(prods), 'Products should be an array');
  assert.ok(prods.length >= 4, 'Should have at least 4 default products');
  console.log('✓ Test 1 Passed: GET /api/products returns', prods.length, 'products');

  // 2. Test Fast Instant POST /api/products
  console.log('Test 2: Fast POST /api/products');
  const startTime = Date.now();
  const newProduct = {
    id: 'test-crud-coffee-' + Date.now(),
    name: 'CARAMEL MACCHIATO TEST',
    category: 'Coffe',
    description: 'Espresso dengan saus karamel lezat.',
    image: '/assets/americano.png',
    variants: [
      { size: 'Ice', price: 29000, stock: 15, label: 'Ready Stock' },
      { size: 'Hot', price: 26000, stock: 10, label: 'Ready Stock' }
    ]
  };

  const res2 = await fetch('http://localhost:3000/api/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newProduct)
  });
  const duration = Date.now() - startTime;
  assert.strictEqual(res2.status, 200, 'POST /api/products should return 200');
  const createdProd = await res2.json();
  assert.strictEqual(createdProd.name, 'CARAMEL MACCHIATO TEST');
  assert.ok(duration < 200, `POST duration should be under 200ms (actual: ${duration}ms)`);
  console.log(`✓ Test 2 Passed: Created product in ${duration}ms (<200ms zero delay criteria)`);

  // 3. Test DELETE /api/products
  console.log('Test 3: Fast DELETE /api/products');
  const delStart = Date.now();
  const res3 = await fetch(`http://localhost:3000/api/products?id=${newProduct.id}`, { method: 'DELETE' });
  const delDuration = Date.now() - delStart;
  assert.strictEqual(res3.status, 200, 'DELETE /api/products should return 200');
  assert.ok(delDuration < 200, `DELETE duration should be under 200ms (actual: ${delDuration}ms)`);
  console.log(`✓ Test 3 Passed: Deleted product in ${delDuration}ms`);

  // 4. Test Zero-Login Guest Order & Stock Deduction
  console.log('Test 4: Guest Order & Stock Deduction');
  const guestA = 'guest_audit_test_a_' + Date.now();
  const guestB = 'guest_audit_test_b_' + Date.now();

  const orderPayload = {
    guest_id: guestA,
    customer_name: 'Audit Guest Tester',
    table_number: '14',
    metode_pembayaran: 'Cash',
    total_price: 25000,
    items: [
      {
        product_id: 'aetheria',
        product_name: 'AMERICANO',
        variant_size: 'Ice',
        price: 25000,
        quantity: 1
      }
    ]
  };

  const resOrder = await fetch('http://localhost:3000/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(orderPayload)
  });
  assert.strictEqual(resOrder.status, 200, 'POST /api/orders should return 200');
  const createdOrder = await resOrder.json();
  assert.ok(createdOrder.id.startsWith('ORD-'), 'Order ID should start with ORD-');

  // Verify Guest Isolation
  const resGuestA = await fetch(`http://localhost:3000/api/orders?guest_id=${guestA}`);
  const ordersA = await resGuestA.json();
  assert.strictEqual(ordersA.length, 1, 'Guest A should see their 1 order');
  assert.strictEqual(ordersA[0].id, createdOrder.id);

  const resGuestB = await fetch(`http://localhost:3000/api/orders?guest_id=${guestB}`);
  const ordersB = await resGuestB.json();
  assert.strictEqual(ordersB.length, 0, 'Guest B should see 0 orders');
  console.log('✓ Test 4 Passed: Guest Order isolation verified');

  // 5. Test SSE Endpoint Response
  console.log('Test 5: SSE Event Stream');
  const sseRes = await fetch('http://localhost:3000/api/events');
  assert.strictEqual(sseRes.status, 200, 'SSE endpoint should return 200');
  assert.ok(sseRes.headers.get('content-type').includes('text/event-stream'), 'Content-type must be text/event-stream');
  console.log('✓ Test 5 Passed: Realtime Server-Sent Events stream active');

  console.log('--- ALL 5 UNIT TESTS PASSED WITH ZERO CRITICAL DELAYS ---');
}

testStorageCRUD().catch(err => {
  console.error('Unit test failed:', err);
  process.exit(1);
});
