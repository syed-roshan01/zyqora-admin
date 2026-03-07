import { NextResponse } from 'next/server';
import { requireSuper } from '@/lib/auth';
import { getLicense, deleteLicense } from '@/lib/kv';

export async function POST(req) {
    const { error, status } = await requireSuper(req);
    if (error) return NextResponse.json({ error }, { status });

    const { key } = await req.json();
    if (!key) return NextResponse.json({ error: 'key required' }, { status: 400 });

    const license = await getLicense(key);
    if (!license) return NextResponse.json({ error: 'License not found' }, { status: 404 });

    await deleteLicense(license);
    return NextResponse.json({ success: true });
}
