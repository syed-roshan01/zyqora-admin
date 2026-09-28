import { NextResponse } from 'next/server';
import { requireSuper } from '@/lib/auth';
import { getWhitelabel, listAdminLicenses, countIssuedLicenses } from '@/lib/kv';

// Super-admin drill-down: every license a whitelabel client has issued.
export async function GET(req, { params }) {
    const { error, status } = await requireSuper(req);
    if (error) return NextResponse.json({ error }, { status });

    const whitelabel = await getWhitelabel(params.id);
    if (!whitelabel) return NextResponse.json({ error: 'Whitelabel client not found' }, { status: 404 });

    const [licenses, used] = await Promise.all([
        listAdminLicenses(params.id),
        countIssuedLicenses(params.id),
    ]);
    licenses.sort((a, b) => (b.issuedAt || 0) - (a.issuedAt || 0));

    return NextResponse.json({
        whitelabel: {
            id: whitelabel.id,
            username: whitelabel.username,
            name: whitelabel.name,
            allowedModes: whitelabel.allowedModes,
            licenseLimit: whitelabel.licenseLimit,
        },
        usage: { used, limit: whitelabel.licenseLimit, remaining: Math.max(0, (whitelabel.licenseLimit || 0) - used) },
        licenses,
    });
}
