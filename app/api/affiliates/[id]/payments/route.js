import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { listAffiliatePayments } from '@/lib/kv';

export async function GET(req, { params }) {
    const { error, status, session } = await requireAuth(req);
    if (error) return NextResponse.json({ error }, { status });

    // Super, admin can view any affiliate's payments; affiliate can only view their own
    if (session.role === 'affiliate' && session.sub !== params.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (session.role !== 'super' && session.role !== 'admin' && session.role !== 'affiliate') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const payments = await listAffiliatePayments(params.id);
    return NextResponse.json({ payments });
}
