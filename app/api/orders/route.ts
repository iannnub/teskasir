import { NextResponse } from 'next/server';
import { getOrders, saveOrder, clearOrders } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const guestId = searchParams.get('guest_id') || undefined;
    const orders = await getOrders(guestId);
    return NextResponse.json(orders);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.customer_name || !body.items || !Array.isArray(body.items)) {
      return NextResponse.json({ error: 'Customer name and items are required' }, { status: 400 });
    }

    if (!body.id) {
      body.id = 'ORD-' + Math.floor(100000 + Math.random() * 900000);
    }
    if (!body.date) {
      body.date = new Date().toISOString();
    }
    if (!body.status) {
      body.status = 'selesai';
    }

    const saved = await saveOrder(body);
    return NextResponse.json(saved);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await clearOrders();
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to clear orders' }, { status: 500 });
  }
}
