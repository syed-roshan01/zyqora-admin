import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { listAllPayments } from '@/lib/kv';

export async function GET(req) {
    const { error, status, session } = await requireAuth(req);
    if (error) return NextResponse.json({ error }, { status });

    if (session.role !== 'super' && session.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const payments = await listAllPayments();
    return NextResponse.json({ payments });
}
