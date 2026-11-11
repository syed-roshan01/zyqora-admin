import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { listOrders } from '@/lib/checkout';

// ADMIN: all checkout orders (pending first by nature of the screen), newest first.
export async function GET(req) {
    const { error, status } = await requireAuth(req);
    if (error) return NextResponse.json({ error }, { status });
    const orders = await listOrders(300);
    return NextResponse.json({ orders });
}
