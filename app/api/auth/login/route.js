import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { signToken } from '@/lib/auth';
import { getAdminByUsername, saveAdmin, listAdmins, getAffiliateByUsername } from '@/lib/kv';

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

        // Try admin first, then affiliate
        let account = await getAdminByUsername(username);
        let isAffiliate = false;

        if (!account) {
            account = await getAffiliateByUsername(username);
            isAffiliate = !!account;
        }

        if (!account || !account.active)
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });

        const valid = await bcrypt.compare(password, account.passwordHash);
        if (!valid)
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });

        const role = isAffiliate ? 'affiliate' : account.role;
        const token = await signToken({ sub: account.id, username: account.username, role });
        return NextResponse.json({ token, username: account.username, role, name: account.name || null });
    } catch (err) {
        console.error('Login error:', err);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
