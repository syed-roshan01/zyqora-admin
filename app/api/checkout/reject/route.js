import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getOrder, saveOrder } from '@/lib/checkout';

// ADMIN: mark a UPI order as rejected (e.g. payment not found).
export async function POST(req) {
    const { error, status, session } = await requireAuth(req);
    if (error) return NextResponse.json({ error }, { status });
    try {
        const { orderId, reason } = await req.json();
        const order = await getOrder(orderId);
        if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        if (order.status === 'approved') return NextResponse.json({ error: 'Already approved — cannot reject.' }, { status: 400 });
        order.status = 'rejected';
        order.rejectedReason = String(reason || '').slice(0, 200);
        order.rejectedBy = session.sub;
        order.updatedAt = Math.floor(Date.now() / 1000);
        await saveOrder(order);
        return NextResponse.json({ ok: true });
    } catch (e) {
        return NextResponse.json({ error: e.message || 'Could not reject' }, { status: 500 });
    }
}
