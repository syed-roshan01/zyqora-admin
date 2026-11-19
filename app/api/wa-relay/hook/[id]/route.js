import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import crypto from 'crypto';
import { bindingIdValid, verifyTokenFor, queueKey, MAX_BODY_BYTES, QUEUE_CAP, TTL_SEC } from '@/lib/waRelay';

export const dynamic = 'force-dynamic';

// Meta webhook verification (GET). Stateless: no KV access.
export async function GET(req, { params }) {
    const id = decodeURIComponent(params.id || '');
    const u = new URL(req.url);
    if (!bindingIdValid(id)) return new NextResponse('Forbidden', { status: 403 });
    if (u.searchParams.get('hub.mode') === 'subscribe' && u.searchParams.get('hub.verify_token') === verifyTokenFor(id) && u.searchParams.get('hub.challenge'))
        return new NextResponse(u.searchParams.get('hub.challenge'), { status: 200, headers: { 'Content-Type': 'text/plain' } });
    return new NextResponse('Forbidden', { status: 403 });
}

// Event intake (POST). Stores raw body + signature; responds immediately.
export async function POST(req, { params }) {
    const id = decodeURIComponent(params.id || '');
    if (!bindingIdValid(id)) return new NextResponse('Forbidden', { status: 403 });
    const len = Number(req.headers.get('content-length') || 0);
    if (len > MAX_BODY_BYTES) return new NextResponse('Too large', { status: 413 });
    const body = await req.text();
    if (Buffer.byteLength(body) > MAX_BODY_BYTES) return new NextResponse('Too large', { status: 413 });
    const sig = req.headers.get('x-hub-signature-256') || '';
    if (!/^sha256=[0-9a-f]{64}$/i.test(sig)) return new NextResponse('Bad signature header', { status: 400 });
    try {
        const n = await kv.rpush(queueKey(id), { i: crypto.randomUUID(), t: Date.now(), s: sig, b: body });
        if (n === 1) await kv.expire(queueKey(id), TTL_SEC);
        if (n > QUEUE_CAP) await kv.ltrim(queueKey(id), n - QUEUE_CAP, -1);
    } catch {
        return new NextResponse('Temporarily unavailable', { status: 503 });      // Meta retries for up to 7 days
    }
    return NextResponse.json({ ok: true });
}
