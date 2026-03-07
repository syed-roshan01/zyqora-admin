import { NextResponse } from 'next/server';
import { requireSuper } from '@/lib/auth';
import { getAdminByUsername, saveAdmin } from '@/lib/kv';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

export async function POST(req) {
    const { error, status, session } = await requireSuper(req);
    if (error) return NextResponse.json({ error }, { status });

    const { username, password, role } = await req.json();
    if (!username?.trim() || !password)
        return NextResponse.json({ error: 'username and password are required' }, { status: 400 });

    const existing = await getAdminByUsername(username.trim());
    if (existing)
        return NextResponse.json({ error: 'Username already exists' }, { status: 409 });

    const passwordHash = await bcrypt.hash(password, 12);
    const admin = {
        id:            randomUUID(),
        username:      username.trim().toLowerCase(),
        passwordHash,
        role:          role === 'super' ? 'super' : 'admin',
        createdBy:     session.sub,
        createdByName: session.username,
        createdAt:     Math.floor(Date.now() / 1000),
        active:        true,
    };

    await saveAdmin(admin);
    const { passwordHash: _, ...safe } = admin;
    return NextResponse.json({ success: true, admin: safe }, { status: 201 });
}
