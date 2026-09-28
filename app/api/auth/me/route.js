import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getAdmin, getWhitelabel, countIssuedLicenses } from '@/lib/kv';

export async function GET(req) {
    const { error, status, session } = await requireAuth(req);
    if (error) return NextResponse.json({ error }, { status });
    const admin = await getAdmin(session.sub);
    if (admin) {
        const { passwordHash, ...safe } = admin;
        return NextResponse.json(safe);
    }
    // Whitelabel clients use the same panel — return their live record plus
    // current quota usage so the UI can reflect super-admin changes instantly.
    const whitelabel = await getWhitelabel(session.sub);
    if (whitelabel) {
        const { passwordHash, ...safe } = whitelabel;
        const used = await countIssuedLicenses(whitelabel.id);
        const limit = whitelabel.licenseLimit || 0;
        return NextResponse.json({
            ...safe,
            usage: { used, limit, remaining: Math.max(0, limit - used) },
        });
    }
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
