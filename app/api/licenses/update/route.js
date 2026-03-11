import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getLicense, saveLicense } from '@/lib/kv';

export async function POST(req) {
    const { error, status } = await requireAuth(req);
    if (error) return NextResponse.json({ error }, { status });

    const { key, price, notes } = await req.json();
    if (!key) return NextResponse.json({ error: 'key is required' }, { status: 400 });

    const license = await getLicense(key.trim().toUpperCase());
    if (!license) return NextResponse.json({ error: 'License not found' }, { status: 404 });

    const updated = {
        ...license,
        price: parseFloat(price) || 0,
        notes: (notes || '').trim(),
    };
    await saveLicense(updated);
    return NextResponse.json({ success: true, license: updated });
}
