import { NextResponse } from 'next/server';
import { requireSuper } from '@/lib/auth';
import { getAdmin, listAdminLicenses } from '@/lib/kv';

export async function GET(req, { params }) {
    const { error, status } = await requireSuper(req);
    if (error) return NextResponse.json({ error }, { status });

    const admin = await getAdmin(params.id);
    if (!admin) return NextResponse.json({ error: 'Admin not found' }, { status: 404 });

    const licenses = await listAdminLicenses(params.id);
    licenses.sort((a, b) => (b.issuedAt || 0) - (a.issuedAt || 0));

    return NextResponse.json({ admin: { id: admin.id, username: admin.username, role: admin.role }, licenses });
}
