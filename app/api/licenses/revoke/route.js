import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getLicense, saveLicense } from '@/lib/kv';

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

    await saveLicense({
        ...license,
        revoked:       true,
        revokedBy:     session.sub,
        revokedByName: session.username,
        revokedAt:     Math.floor(Date.now() / 1000),
        revokedReason: (reason || '').trim(),
    });

    return NextResponse.json({ success: true });
}
