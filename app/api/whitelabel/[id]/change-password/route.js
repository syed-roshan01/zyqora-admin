import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { requireSuper } from '@/lib/auth';
import { getWhitelabel, saveWhitelabel } from '@/lib/kv';

export async function POST(req, { params }) {
    const { error, status } = await requireSuper(req);
    if (error) return NextResponse.json({ error }, { status });

    const body = await req.json().catch(() => ({}));
    const password = (body?.password || '').trim();
    if (!password || password.length < 6)
        return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });

    const whitelabel = await getWhitelabel(params.id);
    if (!whitelabel) return NextResponse.json({ error: 'Whitelabel client not found' }, { status: 404 });
    if (whitelabel.id !== params.id || !whitelabel.username)
        return NextResponse.json({ error: 'This client record is corrupted. Delete and re-create the client to fix it.' }, { status: 500 });

    const passwordHash = await bcrypt.hash(password, 12);
    await saveWhitelabel({ ...whitelabel, passwordHash });
    return NextResponse.json({ success: true });
}
