import { NextResponse } from 'next/server';
import { authCustomerLicense, getByLicense, saveRecord, getConfig, customerView, appendLog } from '@/lib/waOnboarding';

export const dynamic = 'force-dynamic';

// PUBLIC (license-authenticated): customer cancels their own open request.
export async function POST(req) {
    const b = await req.json().catch(() => ({}));
    const a = await authCustomerLicense(b.licenseKey, b.machineId);
    if (!a.ok) return NextResponse.json({ ok: false, error: a.error }, { status: a.status });
    const rec = await getByLicense(a.key);
    if (!rec) return NextResponse.json({ ok: false, error: 'No request found.' }, { status: 404 });
    if (['connected', 'cancelled'].includes(rec.status)) return NextResponse.json({ ok: false, error: `A ${rec.status} request cannot be cancelled.` }, { status: 409 });
    rec.history.push({ at: Date.now(), type: 'status', byName: 'customer', from: rec.status, to: 'cancelled' }); rec.status = 'cancelled'; rec.customerAction = null;
    await saveRecord(rec); await appendLog('WA_ONBOARDING_CANCELLED', null, { id: rec.id });
    return NextResponse.json({ ok: true, request: customerView(rec, await getConfig()) });
}
