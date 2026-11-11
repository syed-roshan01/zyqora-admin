import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { getOrder, isSellableMode, MACHINE_ID_RE } from '@/lib/checkout';

// PUBLIC: the desktop/app polls this with {machineId, mode}. Returns the issued
// key once an admin has approved this machine's most recent order. A key is
// returned only for an APPROVED order bound to this same machineId+mode.
export async function POST(req) {
    try {
        const body = await req.json().catch(() => ({}));
        const mode = String(body.mode || 'desktop');
        const machineId = String(body.machineId || '').trim().toUpperCase();
        if (!isSellableMode(mode) || !MACHINE_ID_RE.test(machineId)) return NextResponse.json({ found: false });

        const orderId = await kv.get(`claim:${mode}:${machineId}`);
        if (!orderId) return NextResponse.json({ found: false });

        const order = await getOrder(orderId);
        if (!order || order.machineId !== machineId || order.mode !== mode) return NextResponse.json({ found: false });
        if (order.status === 'approved' && order.licenseKey) return NextResponse.json({ found: true, key: order.licenseKey });
        return NextResponse.json({ found: false, status: order.status });
    } catch {
        return NextResponse.json({ found: false });
    }
}
