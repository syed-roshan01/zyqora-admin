import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { pullSecretValid, queueKey } from '@/lib/waRelay';

export const dynamic = 'force-dynamic';

// PUBLIC (binding-authenticated): the customer removes their webhook mailbox (disconnect). Queue is deleted.
export async function POST(req) {
    const b = await req.json().catch(() => ({}));
    if (!pullSecretValid(b.bindingId, b.pullSecret)) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    const id = b.bindingId; const rec = await kv.get(`walr:b:${id}`);
    await Promise.all([kv.del(queueKey(id), `walr:b:${id}`, ...(rec ? [`walr:idx:${rec.licenseKey}:${rec.machineId}`, `walr:waba:${rec.wabaId}`] : [])), kv.srem('walr:bindings', id), kv.set(`walr:rev:${id}`, 1, { ex: 30 * 86400 })]);
    return NextResponse.json({ ok: true });
}
