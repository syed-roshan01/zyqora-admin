import { NextResponse } from 'next/server';
import { requireAuth, requireSuper } from '@/lib/auth';
import { getConfig, saveConfig, appendLog } from '@/lib/waOnboarding';

export const dynamic = 'force-dynamic';

export async function GET(req) {
    const { error, status, session } = await requireAuth(req); if (error) return NextResponse.json({ error }, { status });
    if (!['super', 'admin'].includes(session.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ statuses: await getConfig() });
}
// Super admin only: edit the customer-facing wording of each status (keys are fixed). Audited.
export async function PUT(req) {
    const { error, status, session } = await requireSuper(req); if (error) return NextResponse.json({ error }, { status });
    const b = await req.json().catch(() => ({}));
    const statuses = await saveConfig(b.statuses || {}); await appendLog('WA_ONBOARDING_CONFIG_UPDATED', session, {});
    return NextResponse.json({ statuses });
}
