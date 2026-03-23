import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { listAllExpenses, listAdminExpenses, saveExpense } from '@/lib/kv';

function toNum(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : NaN;
}

export async function GET(req) {
    const { error, status, session } = await requireAuth(req);
    if (error) return NextResponse.json({ error }, { status });

    const list = session.role === 'super'
        ? await listAllExpenses()
        : await listAdminExpenses(session.sub);

    const result = list
        .map(e => ({
            id: e.id,
            title: e.title,
            amount: e.amount,
            category: e.category || '',
            location: e.location || '',
            notes: e.notes || '',
            spentBy: e.spentBy,
            spentByName: e.spentByName,
            spentAt: e.spentAt,
            createdAt: e.createdAt,
        }))
        .sort((a, b) => (b.spentAt || 0) - (a.spentAt || 0));

    return NextResponse.json(result);
}

export async function POST(req) {
    const { error, status, session } = await requireAuth(req);
    if (error) return NextResponse.json({ error }, { status });

    const body = await req.json();
    const title = (body?.title || '').trim();
    const category = (body?.category || '').trim();
    const location = (body?.location || '').trim();
    const notes = (body?.notes || '').trim();
    const amount = toNum(body?.amount);
    const spentAt = toNum(body?.spentAt) || Math.floor(Date.now() / 1000);

    if (!title) {
        return NextResponse.json({ error: 'Expense title is required' }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json({ error: 'Amount must be greater than 0' }, { status: 400 });
    }

    const expense = {
        id: crypto.randomUUID(),
        title,
        amount,
        category,
        location,
        notes,
        spentBy: session.sub,
        spentByName: session.username,
        spentAt,
        createdAt: Math.floor(Date.now() / 1000),
    };

    await saveExpense(expense);
    return NextResponse.json({ success: true, expense });
}
