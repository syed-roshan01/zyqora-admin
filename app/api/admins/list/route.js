import { NextResponse } from 'next/server';
import { requireSuper } from '@/lib/auth';
import { listAdmins, getAdminLicenseKeys } from '@/lib/kv';

export async function GET(req) {
    const { error, status } = await requireSuper(req);
    if (error) return NextResponse.json({ error }, { status });

    const admins = await listAdmins();

    const result = await Promise.all(
        admins.map(async (a) => {
            const keys = await getAdminLicenseKeys(a.id);
            const { passwordHash, ...safe } = a;
            return { ...safe, licenseCount: keys.length };
        })
    );

    // Newest first
    result.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return NextResponse.json(result);
}
