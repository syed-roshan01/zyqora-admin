import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getExpense, listAllExpenses, listAdminExpenses, saveExpense } from '@/lib/kv';

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
            editedAt: e.editedAt || null,
            editedBy: e.editedBy || null,
            editedByName: e.editedByName || null,
            originalValues: e.originalValues || null,
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

export async function PATCH(req) {
    const { error, status, session } = await requireAuth(req);
    if (error) return NextResponse.json({ error }, { status });

    const body = await req.json();
    const id = (body?.id || '').trim();
    if (!id) return NextResponse.json({ error: 'Expense ID required' }, { status: 400 });

    const existing = await getExpense(id);
    if (!existing) return NextResponse.json({ error: 'Expense not found' }, { status: 404 });

    if (session.role !== 'super' && existing.spentBy !== session.sub) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const title = (body?.title || '').trim();
    const category = (body?.category || '').trim();
    const location = (body?.location || '').trim();
    const notes = (body?.notes || '').trim();
    const amount = toNum(body?.amount);
    const spentAt = toNum(body?.spentAt) || existing.spentAt;

    if (!title) return NextResponse.json({ error: 'Expense title is required' }, { status: 400 });
    if (!Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json({ error: 'Amount must be greater than 0' }, { status: 400 });
    }

    const originalValues = {
        title: existing.title,
        amount: existing.amount,
        category: existing.category || '',
        location: existing.location || '',
        notes: existing.notes || '',
        spentAt: existing.spentAt,
    };

    const updated = {
        ...existing,
        title,
        amount,
        category,
        location,
        notes,
        spentAt,
        editedAt: Math.floor(Date.now() / 1000),
        editedBy: session.sub,
        editedByName: session.username,
        originalValues,
    };

    await saveExpense(updated);
    return NextResponse.json({ success: true, expense: updated });
}
