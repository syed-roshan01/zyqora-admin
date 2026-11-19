import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import crypto from 'crypto';
import { queueKey, MAX_BODY_BYTES, QUEUE_CAP, TTL_SEC } from '@/lib/waRelay';

export const dynamic = 'force-dynamic';

// Zyqora-owned Meta App endpoint (Tech Provider / Embedded Signup path). DISABLED until Meta approval:
// requires META_APP_SECRET + META_WEBHOOK_VERIFY_TOKEN. Verifies Meta's signature, then routes by WABA id to the owning mailbox.
const enabled = () => !!process.env.META_APP_SECRET && !!process.env.META_WEBHOOK_VERIFY_TOKEN;

export async function GET(req) {
    if (!enabled()) return new NextResponse('Not activated', { status: 404 });
    const u = new URL(req.url);
    if (u.searchParams.get('hub.mode') === 'subscribe' && u.searchParams.get('hub.verify_token') === process.env.META_WEBHOOK_VERIFY_TOKEN && u.searchParams.get('hub.challenge'))
        return new NextResponse(u.searchParams.get('hub.challenge'), { status: 200, headers: { 'Content-Type': 'text/plain' } });
    return new NextResponse('Forbidden', { status: 403 });
}
export async function POST(req) {
    if (!enabled()) return new NextResponse('Not activated', { status: 404 });
    const body = await req.text(); if (Buffer.byteLength(body) > MAX_BODY_BYTES) return new NextResponse('Too large', { status: 413 });
    const sig = req.headers.get('x-hub-signature-256') || '';
    const want = 'sha256=' + crypto.createHmac('sha256', process.env.META_APP_SECRET).update(body).digest('hex');
    if (sig.length !== want.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return new NextResponse('Bad signature', { status: 403 });
    let payload; try { payload = JSON.parse(body); } catch { return new NextResponse('Bad JSON', { status: 400 }); }
    const wabas = [...new Set((payload.entry || []).map((e) => String(e.id)))];
    for (const w of wabas) {
        const id = await kv.get(`walr:waba:${w}`); if (!id) continue;
        const n = await kv.rpush(queueKey(id), { i: crypto.randomUUID(), t: Date.now(), s: sig, b: body });
        if (n === 1) await kv.expire(queueKey(id), TTL_SEC); if (n > QUEUE_CAP) await kv.ltrim(queueKey(id), n - QUEUE_CAP, -1);
    }
    return NextResponse.json({ ok: true });
}
