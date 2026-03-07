import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { listAllLicenses, listAdminLicenses } from '@/lib/kv';

export async function GET(req) {
    const { error, status, session } = await requireAuth(req);
    if (error) return NextResponse.json({ error }, { status });

    const list = session.role === 'super'
        ? await listAllLicenses()
        : await listAdminLicenses(session.sub);

    // Newest first
    list.sort((a, b) => (b.issuedAt || 0) - (a.issuedAt || 0));
    return NextResponse.json(list);
}
