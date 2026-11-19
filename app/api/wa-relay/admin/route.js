import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { requireAuth } from '@/lib/auth';
import { mgetMany } from '@/lib/kv';
import { relayEnabled } from '@/lib/waRelay';

export const dynamic = 'force-dynamic';

// Admin/super only: relay health + mailbox overview. No event bodies are ever returned.
export async function GET(req) {
    const { error, status, session } = await requireAuth(req);
    if (error) return NextResponse.json({ error }, { status });
    if (!['super', 'admin'].includes(session.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const ids = (await kv.smembers('walr:bindings')) || [];
    const recs = (await mgetMany(ids.map((i) => `walr:b:${i}`))).filter(Boolean);
    const lens = await Promise.all(recs.slice(0, 200).map((r) => kv.llen(`walr:q:${r.id}`).catch(() => null)));
    return NextResponse.json({ enabled: relayEnabled(), globalEndpointActive: !!process.env.META_APP_SECRET && !!process.env.META_WEBHOOK_VERIFY_TOKEN,
        bindings: recs.slice(0, 200).map((r, i) => ({ id: r.id.slice(0, 6) + '…', licenseKey: r.licenseKey, wabaId: r.wabaId, phoneNumberId: r.phoneNumberId, createdAt: r.createdAt, queued: lens[i] })) });
}
