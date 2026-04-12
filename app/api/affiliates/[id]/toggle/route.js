import { NextResponse } from 'next/server';
import { requireSuper } from '@/lib/auth';
import { getAffiliate, saveAffiliate } from '@/lib/kv';

export async function POST(req, { params }) {
    const { error, status, session } = await requireSuper(req);
    if (error) return NextResponse.json({ error }, { status });

    const affiliate = await getAffiliate(params.id);
    if (!affiliate) return NextResponse.json({ error: 'Affiliate not found' }, { status: 404 });

    if (affiliate.id === session.sub) {
        return NextResponse.json({ error: 'Cannot deactivate yourself' }, { status: 400 });
    }

    const updated = { ...affiliate, active: !affiliate.active };
    await saveAffiliate(updated);
    return NextResponse.json({ success: true, active: updated.active });
}
