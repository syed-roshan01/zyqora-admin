import { NextResponse } from 'next/server';
import { requireSuper } from '@/lib/auth';
import { getWhitelabel, saveWhitelabel } from '@/lib/kv';

// Blocks the client from logging in and from generating new licenses.
// Existing tokens are also rejected at generation time via the active check.
export async function POST(req, { params }) {
    const { error, status } = await requireSuper(req);
    if (error) return NextResponse.json({ error }, { status });

    const whitelabel = await getWhitelabel(params.id);
    if (!whitelabel) return NextResponse.json({ error: 'Whitelabel client not found' }, { status: 404 });
    if (whitelabel.id !== params.id || !whitelabel.username)
        return NextResponse.json({ error: 'This client record is corrupted. Delete and re-create the client to fix it.' }, { status: 500 });

    const updated = { ...whitelabel, active: !whitelabel.active };
    await saveWhitelabel(updated);
    return NextResponse.json({ success: true, active: updated.active });
}
