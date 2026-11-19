import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { getLicense } from '@/lib/kv';
import { authCustomerLicense } from '@/lib/waOnboarding';
import { allow, clientIp } from '@/lib/rateLimit';
import { relayEnabled, newBindingId, pullSecretFor, verifyTokenFor, publicBase } from '@/lib/waRelay';

export const dynamic = 'force-dynamic';
const DIGITS = /^\d{5,25}$/;

// PUBLIC (license-authenticated): creates (or returns) this customer's webhook mailbox.
export async function POST(req) {
    if (!relayEnabled()) return NextResponse.json({ ok: false, error: 'relay_unavailable' }, { status: 503 });
    const b = await req.json().catch(() => ({}));
    const a = await authCustomerLicense(b.licenseKey, b.machineId);
    if (!a.ok) return NextResponse.json({ ok: false, error: a.error }, { status: a.status });
    if (a.license.features && a.license.features.officialApi === false) return NextResponse.json({ ok: false, error: 'Official API is not included in this plan.' }, { status: 403 });
    if (!DIGITS.test(String(b.wabaId || '')) || !DIGITS.test(String(b.phoneNumberId || ''))) return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });
    if (!(await allow(`walr:reg:${a.key}`, 10, 3600)) || !(await allow(`walr:regip:${clientIp(req)}`, 30, 3600))) return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 });
    const idxKey = `walr:idx:${a.key}:${a.machineId}`;
    let id = await kv.get(idxKey); let rec = id ? await kv.get(`walr:b:${id}`) : null;
    if (rec && (rec.wabaId !== String(b.wabaId))) { await kv.del(`walr:q:${id}`, `walr:b:${id}`, `walr:waba:${rec.wabaId}`); await kv.srem('walr:bindings', id); rec = null; id = null; }
    if (!rec) { id = newBindingId(); }
    const next = { id, licenseKey: a.key, machineId: a.machineId, wabaId: String(b.wabaId), phoneNumberId: String(b.phoneNumberId), createdAt: rec ? rec.createdAt : Date.now(), updatedAt: Date.now() };
    await Promise.all([kv.set(`walr:b:${id}`, next), kv.set(idxKey, id), kv.sadd('walr:bindings', id), kv.set(`walr:waba:${next.wabaId}`, id), kv.del(`walr:rev:${id}`)]);
    return NextResponse.json({ ok: true, bindingId: id, callbackUrl: `${publicBase(req)}/api/wa-relay/hook/${encodeURIComponent(id)}`, verifyToken: verifyTokenFor(id), pullSecret: pullSecretFor(id), nextPollSec: 30 });
}
