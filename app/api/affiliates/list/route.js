import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { listAffiliates } from '@/lib/kv';

export async function GET(req) {
    const { error, status, session } = await requireAuth(req);
    if (error) return NextResponse.json({ error }, { status });

    // Affiliates themselves cannot call this; only admin/super
    if (session.role === 'affiliate') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const list = await listAffiliates();
    const result = list
        .map(a => ({
            id: a.id,
            username: a.username,
            name: a.name,
            commission: a.commission,
            active: a.active,
            createdBy: a.createdBy,
            createdByName: a.createdByName,
            createdAt: a.createdAt,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json(result);
}
