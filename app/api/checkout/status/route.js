import { NextResponse } from 'next/server';
import { getOrder } from '@/lib/checkout';
import { allow, clientIp } from '@/lib/rateLimit';

// PUBLIC: the /buy/success page polls this by order_id to show progress
// (pending → approved). Returns the key only once the order is approved.
export async function GET(req) {
    if (!(await allow(`status:${clientIp(req)}`, 120, 600)))
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

    const orderId = new URL(req.url).searchParams.get('order_id') || '';
    const order = await getOrder(orderId);
    if (!order) return NextResponse.json({ status: 'unknown' }, { status: 404 });

    if (order.status === 'approved' && order.licenseKey)
        return NextResponse.json({ status: 'approved', key: order.licenseKey, planName: order.planName, mode: order.mode });
    if (order.status === 'rejected')
        return NextResponse.json({ status: 'rejected' });
    return NextResponse.json({ status: 'pending' });
}
