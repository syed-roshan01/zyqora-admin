import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { requireSuper } from '@/lib/auth';
import { getAffiliateByUsername, saveAffiliate } from '@/lib/kv';

export async function POST(req) {
    const { error, status, session } = await requireSuper(req);
    if (error) return NextResponse.json({ error }, { status });

    const body = await req.json();
    const username = (body?.username || '').trim().toLowerCase();
    const name = (body?.name || '').trim();
    const password = (body?.password || '').trim();
    const commission = Math.max(0, Math.min(100, parseFloat(body?.commission) || 0));

    if (!username) return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    if (!name) return NextResponse.json({ error: 'Display name is required' }, { status: 400 });
    if (!password || password.length < 6) return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });

    const existing = await getAffiliateByUsername(username);
    if (existing) return NextResponse.json({ error: 'Username already taken' }, { status: 409 });

    const passwordHash = await bcrypt.hash(password, 12);

    const affiliate = {
        id: randomUUID(),
        username,
        name,
        passwordHash,
        commission,
        active: true,
        createdBy: session.sub,
        createdByName: session.username,
        createdAt: Math.floor(Date.now() / 1000),
    };

    await saveAffiliate(affiliate);

    const { passwordHash: _, ...safe } = affiliate;
    return NextResponse.json({ success: true, affiliate: safe }, { status: 201 });
}
