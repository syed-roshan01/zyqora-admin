import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getLicense, saveLicense } from '@/lib/kv';
import { saveLog } from '@/lib/logs';

export async function POST(req) {
    const { error, status, session } = await requireAuth(req);
    if (error) return NextResponse.json({ error }, { status });

    const { key, reason } = await req.json();
    if (!key) return NextResponse.json({ error: 'key required' }, { status: 400 });

    const license = await getLicense(key);
    if (!license) return NextResponse.json({ error: 'License not found' }, { status: 404 });

    // Admins can only revoke their own licenses
    if (session.role !== 'super' && license.issuedBy !== session.sub)
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const revokedAt = Math.floor(Date.now() / 1000);
    await saveLicense({
        ...license,
        revoked:       true,
        revokedBy:     session.sub,
        revokedByName: session.username,
        revokedAt,
        revokedReason: (reason || '').trim(),
    });

    await saveLog({
        id: crypto.randomUUID(),
        action: 'LICENSE_REVOKED',
        actorId: session.sub,
        actorName: session.username,
        actorRole: session.role,
        ts: revokedAt,
        flag: null,
        meta: {
            key: license.key,
            clientName: license.clientName || '',
            clientPhone: license.clientPhone || '',
            plan: license.plan || '',
            price: Math.max(0, parseFloat(license.price) || 0),
            issuedByName: license.issuedByName || '',
            reason: (reason || '').trim(),
        },
    });

    return NextResponse.json({ success: true });
}
