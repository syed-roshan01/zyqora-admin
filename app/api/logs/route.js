import { NextResponse } from 'next/server';
import { requireSuper } from '@/lib/auth';
import { listLogs, clearLogs } from '@/lib/logs';

export async function GET(req) {
    const { error, status } = await requireSuper(req);
    if (error) return NextResponse.json({ error }, { status });

    const logs = await listLogs(300);
    return NextResponse.json(logs);
}

export async function DELETE(req) {
    const { error, status } = await requireSuper(req);
    if (error) return NextResponse.json({ error }, { status });

    await clearLogs();
    return NextResponse.json({ success: true });
}
