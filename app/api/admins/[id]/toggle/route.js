import { NextResponse } from 'next/server';
import { requireSuper } from '@/lib/auth';
import { getAdmin, saveAdmin } from '@/lib/kv';

export async function POST(req, { params }) {
    const { error, status, session } = await requireSuper(req);
    if (error) return NextResponse.json({ error }, { status });

    const admin = await getAdmin(params.id);
    if (!admin) return NextResponse.json({ error: 'Admin not found' }, { status: 404 });

    if (admin.id === session.sub)
        return NextResponse.json({ error: 'Cannot deactivate your own account' }, { status: 400 });

    const updated = { ...admin, active: !admin.active };
    await saveAdmin(updated);
    return NextResponse.json({ success: true, active: updated.active });
}
