import { NextResponse } from 'next/server';
import { requireSuper } from '@/lib/auth';
import { getAdmin, saveAdmin } from '@/lib/kv';

export async function POST(req, { params }) {
    const { error, status } = await requireSuper(req);
    if (error) return NextResponse.json({ error }, { status });

    const admin = await getAdmin(params.id);
    if (!admin) return NextResponse.json({ error: 'Admin not found' }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const sharePercent = parseFloat(body.sharePercent);

    if (!Number.isFinite(sharePercent) || sharePercent < 0 || sharePercent > 100)
        return NextResponse.json({ error: 'sharePercent must be 0–100' }, { status: 400 });

    const updated = { ...admin, sharePercent };
    await saveAdmin(updated);

    const { passwordHash: _, ...safe } = updated;
    return NextResponse.json({ success: true, admin: safe });
}
