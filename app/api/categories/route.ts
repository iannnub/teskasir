import { NextResponse } from 'next/server';
import { getCategories, saveCategories } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const categories = await getCategories();
    return NextResponse.json(categories);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!Array.isArray(body)) {
      return NextResponse.json({ error: 'Array of categories expected' }, { status: 400 });
    }
    const saved = await saveCategories(body);
    return NextResponse.json(saved);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save categories' }, { status: 500 });
  }
}
