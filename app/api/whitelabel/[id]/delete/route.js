import { NextResponse } from 'next/server';
import { requireSuper } from '@/lib/auth';
import { getWhitelabel, deleteWhitelabel, countIssuedLicenses } from '@/lib/kv';
import { saveLog } from '@/lib/logs';

// Super admin permanently removes a whitelabel client account. Licenses the
// client issued stay in the records (sales history is never erased); only the
// account, its login and its quota disappear.
export async function POST(req, { params }) {
    const { error, status, session } = await requireSuper(req);
    if (error) return NextResponse.json({ error }, { status });

    const whitelabel = await getWhitelabel(params.id);
    if (!whitelabel) return NextResponse.json({ error: 'Whitelabel client not found' }, { status: 404 });

    const issuedLicenses = await countIssuedLicenses(whitelabel.id);
    await deleteWhitelabel(whitelabel);

    await saveLog({
        id: crypto.randomUUID(),
        action: 'WHITELABEL_DELETED',
        actorId: session.sub,
        actorName: session.username,
        actorRole: session.role,
        ts: Math.floor(Date.now() / 1000),
        flag: issuedLicenses > 0 ? 'warning' : null,
        meta: {
            whitelabelId: whitelabel.id,
            clientName: whitelabel.name || '',
            username: whitelabel.username || '',
            issuedLicenses,
        },
    });

    return NextResponse.json({ success: true, issuedLicenses });
}
