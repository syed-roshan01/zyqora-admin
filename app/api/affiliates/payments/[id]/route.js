import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getPayment, savePayment } from '@/lib/kv';

export async function PUT(req, { params }) {
    const { error, status, session } = await requireAuth(req);
    if (error) return NextResponse.json({ error }, { status });

    if (session.role !== 'super' && session.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const existing = await getPayment(params.id);
    if (!existing) return NextResponse.json({ error: 'Payment not found' }, { status: 404 });

    const body = await req.json().catch(() => ({}));

    const amount = parseFloat(body.amount);
    if (!amount || amount <= 0) {
        return NextResponse.json({ error: 'Amount must be greater than 0' }, { status: 400 });
    }

    const updated = {
        ...existing,
        amount,
        note: (body.note ?? existing.note ?? '').toString().trim().slice(0, 200),
        paidAt: body.paidAt ? Number(body.paidAt) : existing.paidAt,
        updatedAt: Math.floor(Date.now() / 1000),
        updatedBy: session.sub,
        updatedByName: session.name || session.username || session.sub,
    };

    await savePayment(updated);
    return NextResponse.json({ success: true, payment: updated });
}
