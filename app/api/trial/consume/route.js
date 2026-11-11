import { NextResponse } from 'next/server';
import { consumeTrial, getDemoSettings, trialLimitFrom } from '@/lib/kv';
import { MACHINE_ID_RE, isSellableMode } from '@/lib/checkout';

// PUBLIC: atomically reserve N free-trial sends for this machine. The app calls
// this right before every outbound message while unlicensed. ok:false => blocked.
export async function POST(req) {
    try {
        const body = await req.json().catch(() => ({}));
        const machineId = String(body.machineId || '').trim().toUpperCase();
        const mode = String(body.mode || 'desktop');
        let count = parseInt(body.count, 10);
        if (!Number.isFinite(count) || count < 1) count = 1;
        if (count > 50) count = 50;
        if (!MACHINE_ID_RE.test(machineId) || !isSellableMode(mode))
            return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });
        const limit = await trialLimitFrom(await getDemoSettings());
        const result = await consumeTrial(machineId, count, limit);
        return NextResponse.json(result);
    } catch {
        return NextResponse.json({ ok: false, error: 'error' }, { status: 500 });
    }
}
