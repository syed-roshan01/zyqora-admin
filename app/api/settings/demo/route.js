import { NextResponse } from 'next/server';
import { getDemoSettings, saveDemoSettings } from '@/lib/kv';
import { requireAuth } from '@/lib/auth';

export async function GET() {
    const settings = await getDemoSettings();
    return NextResponse.json({ enabled: settings.enabled !== false });
}

export async function POST(req) {
    const { error, status, session } = await requireAuth(req);
    if (error) return NextResponse.json({ error }, { status });
    if (session.role !== 'super') return NextResponse.json({ error: 'Forbidden - super admin only' }, { status: 403 });

    const body = await req.json();
    const settings = await saveDemoSettings({ enabled: body.enabled === true, updatedAt: Math.floor(Date.now() / 1000), updatedBy: session.username });
    return NextResponse.json({ success: true, enabled: settings.enabled });
}