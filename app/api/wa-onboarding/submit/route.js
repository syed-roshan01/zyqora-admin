import { NextResponse } from 'next/server';
import { authCustomerLicense, validateForm, getByLicense, saveRecord, newRecord, getConfig, customerView, appendLog } from '@/lib/waOnboarding';
import { allow, clientIp } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

// PUBLIC (license-authenticated): customer submits an assisted-setup request.
export async function POST(req) {
    const b = await req.json().catch(() => ({}));
    const a = await authCustomerLicense(b.licenseKey, b.machineId);
    if (!a.ok) return NextResponse.json({ ok: false, error: a.error }, { status: a.status });
    const { errors, form } = validateForm(b.form);
    if (errors.length) return NextResponse.json({ ok: false, error: errors[0], errors }, { status: 400 });
    if (!(await allow(`waob:submit:${a.key}`, 8, 3600)) || !(await allow(`waob:submitip:${clientIp(req)}`, 30, 3600))) return NextResponse.json({ ok: false, error: 'Too many requests. Please try again later.' }, { status: 429 });
    const existing = await getByLicense(a.key);
    if (existing && existing.status !== 'cancelled') return NextResponse.json({ ok: false, error: 'You already have an open request. Check its status instead.', request: customerView(existing, await getConfig()) }, { status: 409 });
    const rec = await saveRecord(newRecord({ licenseKey: a.key, machineId: a.machineId, license: a.license, form }));
    await appendLog('WA_ONBOARDING_SUBMITTED', null, { id: rec.id, key: a.key, business: form.businessLegalName });
    return NextResponse.json({ ok: true, request: customerView(rec, await getConfig()) }, { status: 201 });
}
