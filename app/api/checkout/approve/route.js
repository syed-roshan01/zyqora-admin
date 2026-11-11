import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getOrder, saveOrder, issueLicenseForOrder } from '@/lib/checkout';
import { sendKeyEmail } from '@/lib/email';

// ADMIN: confirm a UPI payment and issue the license. Idempotent — approving an
// already-approved order just returns its existing key.
export async function POST(req) {
    const { error, status, session } = await requireAuth(req);
    if (error) return NextResponse.json({ error }, { status });
    try {
        const { orderId } = await req.json();
        const order = await getOrder(orderId);
        if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        if (order.status === 'rejected') return NextResponse.json({ error: 'This order was rejected. Ask the customer to submit again.' }, { status: 400 });
        if (order.status === 'approved' && order.licenseKey) return NextResponse.json({ ok: true, key: order.licenseKey });

        const license = await issueLicenseForOrder(order, session);
        order.status = 'approved';
        order.licenseKey = license.key;
        order.approvedBy = session.sub;
        order.approvedByName = session.username;
        order.updatedAt = Math.floor(Date.now() / 1000);
        await saveOrder(order);

        // Best-effort email; the app also picks up the key by polling /claim.
        sendKeyEmail({
            to: order.customer?.email,
            name: order.customer?.name,
            key: license.key,
            planName: order.planName,
            expiryText: new Date(license.expiryTs * 1000).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
            invoice: {
                invoiceId: `INV-${String(license.key).slice(0, 8)}`,
                date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
                plan: order.planName,
                amount: order.amount || license.price,
                deviceLimit: license.deviceLimit,
                machineId: license.machineId,
                paymentRef: order.utr || '',
                validity: `${new Date(license.issuedAt * 1000).toLocaleDateString('en-IN')} to ${new Date(license.expiryTs * 1000).toLocaleDateString('en-IN')}`,
            },
        });
        return NextResponse.json({ ok: true, key: license.key });
    } catch (e) {
        return NextResponse.json({ error: e.message || 'Could not approve' }, { status: 500 });
    }
}
