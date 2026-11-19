import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { pullSecretValid, queueKey, nextPollSec, PULL_BATCH } from '@/lib/waRelay';

export const dynamic = 'force-dynamic';

// PUBLIC (binding-authenticated, STATELESS auth): returns up to 50 queued raw events, oldest first.
// `ack` = number of events from the previous pull the app has fully handled (FIFO list => ltrim). 1 KV command on an idle poll.
export async function POST(req) {
    const b = await req.json().catch(() => ({}));
    if (!pullSecretValid(b.bindingId, b.pullSecret)) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    const id = b.bindingId; const ack = Math.max(0, Math.min(PULL_BATCH, parseInt(b.ack, 10) || 0)); const seq = parseInt(b.seq, 10) || 0;
    try {
        const p = kv.pipeline();
        if (ack > 0) p.ltrim(queueKey(id), ack, -1);
        p.lrange(queueKey(id), 0, PULL_BATCH - 1);
        const checkRevoked = seq % 5 === 0; if (checkRevoked) p.exists(`walr:rev:${id}`);
        const res = await p.exec();
        const items = res[ack > 0 ? 1 : 0] || [];
        if (checkRevoked && res[res.length - 1] === 1) return NextResponse.json({ ok: false, error: 'revoked' }, { status: 403 });
        const events = items.map((e) => (typeof e === 'string' ? JSON.parse(e) : e)).map((e) => ({ id: e.i, at: e.t, sig: e.s, body: e.b }));
        return NextResponse.json({ ok: true, events, count: events.length, nextPollSec: nextPollSec({ gotEvents: events.length > 0, streak: b.streak, active: b.active === true }) });
    } catch {
        return NextResponse.json({ ok: false, error: 'temporarily_unavailable', nextPollSec: 120 }, { status: 503 });
    }
}
