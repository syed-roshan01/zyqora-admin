import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { signToken } from '@/lib/auth';
import { getAdminByUsername, saveAdmin, listAdmins } from '@/lib/kv';

// Lazy-seed: creates super admin from env vars if no admins exist yet
async function ensureSuperAdmin() {
    const existing = await listAdmins();
    if (existing.length === 0) {
        const username = (process.env.SUPER_ADMIN_USER || 'admin').toLowerCase();
        const pass     = process.env.SUPER_ADMIN_PASS || 'changeme123';
        const passwordHash = await bcrypt.hash(pass, 12);
        await saveAdmin({
            id: randomUUID(),
            username,
            passwordHash,
            role: 'super',
            createdBy: null,
            createdByName: null,
            createdAt: Math.floor(Date.now() / 1000),
            active: true,
        });
    }
}

export async function POST(req) {
    try {
        const { username, password } = await req.json();
        if (!username || !password)
            return NextResponse.json({ error: 'Username and password required' }, { status: 400 });

        await ensureSuperAdmin();

        const admin = await getAdminByUsername(username);
        if (!admin || !admin.active)
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });

        const valid = await bcrypt.compare(password, admin.passwordHash);
        if (!valid)
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });

        const token = await signToken({ sub: admin.id, username: admin.username, role: admin.role });
        return NextResponse.json({ token, username: admin.username, role: admin.role });
    } catch (err) {
        console.error('Login error:', err);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
