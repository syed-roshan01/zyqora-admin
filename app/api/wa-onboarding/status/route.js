import { NextResponse } from 'next/server';
import { authCustomerLicense, getByLicense, getConfig, customerView } from '@/lib/waOnboarding';
import { allow } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

// PUBLIC (license-authenticated): customer-safe view of their own request. Internal notes are never included.
export async function POST(req) {
    const b = await req.json().catch(() => ({}));
    const a = await authCustomerLicense(b.licenseKey, b.machineId);
    if (!a.ok) return NextResponse.json({ ok: false, error: a.error }, { status: a.status });
    if (!(await allow(`waob:status:${a.key}`, 120, 3600))) return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 });
    const rec = await getByLicense(a.key); const cfg = await getConfig();
    return NextResponse.json({ ok: true, request: rec ? customerView(rec, cfg) : null, officialApiIncluded: !(a.license.features && a.license.features.officialApi === false) });
}
