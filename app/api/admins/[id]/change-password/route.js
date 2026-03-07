import { NextResponse } from 'next/server';
import { requireSuper } from '@/lib/auth';
import { getAdmin, saveAdmin } from '@/lib/kv';
import bcrypt from 'bcryptjs';

export async function POST(req, { params }) {
    const { error, status } = await requireSuper(req);
    if (error) return NextResponse.json({ error }, { status });

    const { password } = await req.json();
    if (!password || password.length < 6)
        return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });

    const admin = await getAdmin(params.id);
    if (!admin) return NextResponse.json({ error: 'Admin not found' }, { status: 404 });

    const passwordHash = await bcrypt.hash(password, 12);
    await saveAdmin({ ...admin, passwordHash });

    return NextResponse.json({ success: true });
}
