import { NextResponse } from 'next/server';
import { requireSuper } from '@/lib/auth';
import { getLicense, deleteLicense } from '@/lib/kv';
import { saveLog } from '@/lib/logs';

export async function POST(req) {
    const { error, status, session } = await requireSuper(req);
    if (error) return NextResponse.json({ error }, { status });

    const { key } = await req.json();
    if (!key) return NextResponse.json({ error: 'key required' }, { status: 400 });

    const license = await getLicense(key);
    if (!license) return NextResponse.json({ error: 'License not found' }, { status: 404 });

    const price = Math.max(0, parseFloat(license.price) || 0);
    const discounted = license.discountedPrice !== undefined && license.discountedPrice !== null
        ? Math.min(price, Math.max(0, parseFloat(license.discountedPrice) || 0))
        : price;

    await deleteLicense(license);

    await saveLog({
        id: crypto.randomUUID(),
        action: 'LICENSE_DELETED',
        actorId: session.sub,
        actorName: session.username,
        actorRole: session.role,
        ts: Math.floor(Date.now() / 1000),
        flag: price > 0 ? 'warning' : null,
        meta: {
            key: license.key,
            clientName: license.clientName || '',
            clientPhone: license.clientPhone || '',
            plan: license.plan || '',
            price,
            discountedPrice: discounted,
            issuedByName: license.issuedByName || '',
            issuedAt: license.issuedAt || null,
            revoked: license.revoked || false,
            revokedReason: license.revokedReason || '',
            note: price > 0
                ? `License had amount ₹${discounted} — this figure is now removed from sales totals.`
                : null,
        },
    });

    return NextResponse.json({ success: true });
}
