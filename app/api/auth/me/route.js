import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getAdmin, getWhitelabel, countIssuedLicenses } from '@/lib/kv';

export async function GET(req) {
    const { error, status, session } = await requireAuth(req);
    if (error) return NextResponse.json({ error }, { status });
    const admin = await getAdmin(session.sub);
    if (admin) {
        const { passwordHash, ...safe } = admin;
        // role comes from the verified JWT — whitelabel/affiliate records
        // don't store one, and clients cache this response as their session
        // user, so it must always be present.
        return NextResponse.json({ ...safe, role: session.role });
    }
    // Whitelabel clients use the same panel — return their live record plus
    // current quota usage and partnership countdown so the UI can reflect
    // super-admin changes instantly.
    const whitelabel = await getWhitelabel(session.sub);
    if (whitelabel?.id && whitelabel.username) {
        const { passwordHash, ...safe } = whitelabel;
        const used = await countIssuedLicenses(whitelabel.id);
        const limit = whitelabel.licenseLimit || 0;
        const now = Math.floor(Date.now() / 1000);
        const endTs = whitelabel.partnershipEndTs || null;
        return NextResponse.json({
            ...safe,
            role: session.role,
            usage: { used, limit, remaining: Math.max(0, limit - used) },
            partnership: {
                startTs: whitelabel.partnershipStartTs || null,
                endTs,
                months: whitelabel.partnershipMonths || null,
                daysLeft: endTs ? Math.max(0, Math.ceil((endTs - now) / 86400)) : null,
                expired: endTs ? endTs <= now : false,
            },
        });
    }
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
