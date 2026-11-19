import { NextResponse } from 'next/server';
import { authCustomerLicense, getByLicense, saveRecord, getConfig, customerView, scanForSecrets, SECRET_MSG, appendLog } from '@/lib/waOnboarding';
import { allow } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

// PUBLIC (license-authenticated): customer answers an information request. Credentials are refused.
export async function POST(req) {
    const b = await req.json().catch(() => ({}));
    const a = await authCustomerLicense(b.licenseKey, b.machineId);
    if (!a.ok) return NextResponse.json({ ok: false, error: a.error }, { status: a.status });
    if (!(await allow(`waob:respond:${a.key}`, 30, 3600))) return NextResponse.json({ ok: false, error: 'Too many messages. Please wait.' }, { status: 429 });
    const text = String(b.message || '').trim().slice(0, 1000);
    if (!text) return NextResponse.json({ ok: false, error: 'Write a message first.' }, { status: 400 });
    if (scanForSecrets(text)) return NextResponse.json({ ok: false, error: SECRET_MSG }, { status: 400 });
    const rec = await getByLicense(a.key); if (!rec || rec.status === 'cancelled') return NextResponse.json({ ok: false, error: 'No open request.' }, { status: 404 });
    rec.customerMessages.push({ at: Date.now(), text }); if (rec.customerMessages.length > 100) rec.customerMessages.shift();
    rec.history.push({ at: Date.now(), type: 'customer_message', byName: 'customer', detail: text.slice(0, 120) });
    if (rec.status === 'awaiting_customer_info') { rec.history.push({ at: Date.now(), type: 'status', byName: 'customer', from: rec.status, to: 'under_review' }); rec.status = 'under_review'; rec.customerAction = null; }
    await saveRecord(rec); await appendLog('WA_ONBOARDING_CUSTOMER_REPLY', null, { id: rec.id });
    return NextResponse.json({ ok: true, request: customerView(rec, await getConfig()) });
}
