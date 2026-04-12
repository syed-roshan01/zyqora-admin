import { NextResponse } from 'next/server';
import { requireSuper } from '@/lib/auth';
import { getAffiliate, deleteAffiliate } from '@/lib/kv';

export async function POST(req, { params }) {
    const { error, status } = await requireSuper(req);
    if (error) return NextResponse.json({ error }, { status });

    const affiliate = await getAffiliate(params.id);
    if (!affiliate) return NextResponse.json({ error: 'Affiliate not found' }, { status: 404 });

    await deleteAffiliate(affiliate);
    return NextResponse.json({ success: true });
}
