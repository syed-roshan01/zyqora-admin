import { NextResponse } from 'next/server';
import { requireSuper } from '@/lib/auth';
import { getLicense, deleteLicense } from '@/lib/kv';
import { saveLog } from '@/lib/logs';

// ADMIN (super only): delete many licenses at once (e.g. clearing out revoked keys).
export async function POST(req) {
    const { error, status, session } = await requireSuper(req);
    if (error) return NextResponse.json({ error }, { status });

    const { keys } = await req.json();
    if (!Array.isArray(keys) || keys.length === 0)
        return NextResponse.json({ error: 'keys required' }, { status: 400 });
    if (keys.length > 1000)
        return NextResponse.json({ error: 'Too many at once (max 1000)' }, { status: 400 });

    const now = Math.floor(Date.now() / 1000);
    let deleted = 0;
    for (const key of keys) {
        try {
            const license = await getLicense(key);
            if (!license) continue;
            const price = Math.max(0, parseFloat(license.price) || 0);
            const discounted = license.discountedPrice !== undefined && license.discountedPrice !== null
                ? Math.min(price, Math.max(0, parseFloat(license.discountedPrice) || 0))
                : price;
            await deleteLicense(license);
            deleted++;
            await saveLog({
                id: crypto.randomUUID(),
                action: 'LICENSE_DELETED',
                actorId: session.sub,
                actorName: session.username,
                actorRole: session.role,
                ts: now,
                flag: price > 0 ? 'warning' : null,
                meta: {
                    key: license.key, clientName: license.clientName || '', clientPhone: license.clientPhone || '',
                    plan: license.plan || '', price, discountedPrice: discounted,
                    issuedByName: license.issuedByName || '', issuedAt: license.issuedAt || null,
                    revoked: license.revoked || false, revokedReason: license.revokedReason || '', bulk: true,
                    note: price > 0 ? `License had amount ₹${discounted} — removed from sales totals (bulk delete).` : null,
                },
            });
        } catch { /* skip individual failures */ }
    }
    return NextResponse.json({ success: true, deleted });
}
