import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { requireSuper } from '@/lib/auth';
import { getAffiliate, saveAffiliate } from '@/lib/kv';

export async function POST(req, { params }) {
    const { error, status } = await requireSuper(req);
    if (error) return NextResponse.json({ error }, { status });

    const body = await req.json();
    const commission = parseFloat(body?.commission);
    if (!Number.isFinite(commission) || commission < 0 || commission > 100) {
        return NextResponse.json({ error: 'Commission must be 0–100' }, { status: 400 });
    }

    const affiliate = await getAffiliate(params.id);
    if (!affiliate) return NextResponse.json({ error: 'Affiliate not found' }, { status: 404 });

    await saveAffiliate({ ...affiliate, commission });
    return NextResponse.json({ success: true, commission });
}
