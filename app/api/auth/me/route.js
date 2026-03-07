import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getAdmin } from '@/lib/kv';

export async function GET(req) {
    const { error, status, session } = await requireAuth(req);
    if (error) return NextResponse.json({ error }, { status });
    const admin = await getAdmin(session.sub);
    if (!admin) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const { passwordHash, ...safe } = admin;
    return NextResponse.json(safe);
}
