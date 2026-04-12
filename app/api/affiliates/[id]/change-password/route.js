import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { requireSuper } from '@/lib/auth';
import { getAffiliate, saveAffiliate } from '@/lib/kv';

export async function POST(req, { params }) {
    const { error, status } = await requireSuper(req);
    if (error) return NextResponse.json({ error }, { status });

    const body = await req.json();
    const password = (body?.password || '').trim();
    if (!password || password.length < 6) {
        return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const affiliate = await getAffiliate(params.id);
    if (!affiliate) return NextResponse.json({ error: 'Affiliate not found' }, { status: 404 });

    const passwordHash = await bcrypt.hash(password, 12);
    await saveAffiliate({ ...affiliate, passwordHash });
    return NextResponse.json({ success: true });
}
