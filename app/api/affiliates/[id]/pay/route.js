import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getAffiliate, savePayment } from '@/lib/kv';

export async function POST(req, { params }) {
    const { error, status, session } = await requireAuth(req);
    if (error) return NextResponse.json({ error }, { status });

    if (session.role !== 'super' && session.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const affiliate = await getAffiliate(params.id);
    if (!affiliate) return NextResponse.json({ error: 'Affiliate not found' }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const amount = parseFloat(body.amount);
    if (!amount || amount <= 0) {
        return NextResponse.json({ error: 'Amount must be greater than 0' }, { status: 400 });
    }

    const payment = {
        id: `pay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        affiliateId: affiliate.id,
        affiliateName: affiliate.name,
        amount,
        note: (body.note || '').trim().slice(0, 200),
        paidBy: session.sub,
        paidByName: session.name || session.username || session.sub,
        paidAt: Math.floor(Date.now() / 1000),
    };

    await savePayment(payment);
    return NextResponse.json({ success: true, payment });
}
