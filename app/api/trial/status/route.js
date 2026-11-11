import { NextResponse } from 'next/server';
import { getTrialUsed, getDemoSettings, trialLimitFrom } from '@/lib/kv';
import { MACHINE_ID_RE, isSellableMode } from '@/lib/checkout';

// PUBLIC: the desktop/app asks how many free-trial messages this machine has left.
export async function POST(req) {
    try {
        const body = await req.json().catch(() => ({}));
        const machineId = String(body.machineId || '').trim().toUpperCase();
        const mode = String(body.mode || 'desktop');
        if (!MACHINE_ID_RE.test(machineId) || !isSellableMode(mode))
            return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });
        const limit = await trialLimitFrom(await getDemoSettings());
        const used = await getTrialUsed(machineId);
        return NextResponse.json({ ok: true, used, remaining: Math.max(0, limit - used), limit });
    } catch {
        return NextResponse.json({ ok: false, error: 'error' }, { status: 500 });
    }
}
