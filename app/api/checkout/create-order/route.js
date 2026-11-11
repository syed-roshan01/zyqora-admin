import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { PLANS } from '@/lib/plans';
import { newOrderId, saveOrder, indexOrder, isSellableMode, MACHINE_ID_RE } from '@/lib/checkout';
import { allow, clientIp } from '@/lib/rateLimit';

// PUBLIC: the /buy page calls this after the customer has paid the UPI QR and
// entered their payment reference. It only RECORDS a pending order — no license
// is created until an admin approves it in the Orders screen, so this endpoint
// grants nothing on its own.
export async function POST(req) {
    if (!(await allow(`order:${clientIp(req)}`, 20, 3600)))
        return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 });

    let body;
    try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }

    const planId    = String(body.planId || '');
    const mode      = String(body.mode || 'desktop');
    const machineId = String(body.machineId || '').trim().toUpperCase();
    const name      = String(body.name || '').trim().slice(0, 80);
    const phone     = String(body.phone || '').replace(/\D/g, '');
    const email     = String(body.email || '').trim().slice(0, 120);
    const utr       = String(body.utr || '').trim().replace(/\s+/g, '').slice(0, 40);

    const plan = PLANS[planId];
    if (!plan) return NextResponse.json({ error: 'Choose a plan' }, { status: 400 });
    if (!isSellableMode(mode)) return NextResponse.json({ error: 'Invalid license type' }, { status: 400 });
    if (!MACHINE_ID_RE.test(machineId))
        return NextResponse.json({ error: 'Enter your 16-character Machine ID exactly as shown in the app' }, { status: 400 });
    if (name.length < 2)  return NextResponse.json({ error: 'Enter your name' }, { status: 400 });
    if (phone.length < 10 || phone.length > 15) return NextResponse.json({ error: 'Enter a valid phone number with country code' }, { status: 400 });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: 'Enter a valid email' }, { status: 400 });
    if (!/^[A-Za-z0-9]{6,40}$/.test(utr)) return NextResponse.json({ error: 'Enter the UPI reference / UTR number from your payment' }, { status: 400 });

    const now = Math.floor(Date.now() / 1000);
    const orderId = newOrderId();
    const order = {
        orderId, planId, planName: plan.name, mode, machineId,
        amount: plan.price,
        customer: { name, phone, email },
        utr,
        status: 'pending',
        licenseKey: null,
        createdAt: now,
        updatedAt: now,
    };
    await saveOrder(order);
    await indexOrder(order);
    // Latest order from this device → lets the app poll /claim and auto-activate once approved.
    await kv.set(`claim:${mode}:${machineId}`, orderId, { ex: 60 * 60 * 24 * 120 });

    return NextResponse.json({ ok: true, orderId, status: 'pending' });
}
