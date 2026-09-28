import { NextResponse } from 'next/server';
import { requireAuth, requireSuper } from '@/lib/auth';
import { listAllWithdrawals, listAdminWithdrawals, saveWithdrawal, getAdmin } from '@/lib/kv';

export async function GET(req) {
    const { error, status, session } = await requireAuth(req);
    if (error) return NextResponse.json({ error }, { status });

    // Owner/staff bookkeeping — super and admin only
    if (session.role !== 'super' && session.role !== 'admin')
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const list = session.role === 'super'
        ? await listAllWithdrawals()
        : await listAdminWithdrawals(session.sub);
    return NextResponse.json(list);
}

export async function POST(req) {
    const { error, status, session } = await requireSuper(req);
    if (error) return NextResponse.json({ error }, { status });

    const body = await req.json().catch(() => ({}));
    const adminId       = (body.adminId || '').trim();
    const amount        = parseFloat(body.amount);
    const note          = (body.note || '').trim().slice(0, 300);
    const withdrawnAt   = Number.isFinite(Number(body.withdrawnAt))
        ? Math.floor(Number(body.withdrawnAt))
        : Math.floor(Date.now() / 1000);

    if (!adminId)
        return NextResponse.json({ error: 'adminId is required' }, { status: 400 });
    if (!amount || amount <= 0)
        return NextResponse.json({ error: 'Amount must be greater than 0' }, { status: 400 });

    // Resolve the admin's username server-side — a client-supplied name can be
    // spoofed and would corrupt the ledger's audit trail.
    const admin = await getAdmin(adminId);
    if (!admin)
        return NextResponse.json({ error: 'Admin not found' }, { status: 404 });

    const withdrawal = {
        id:              `wd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        adminId,
        adminUsername:   admin.username,
        amount,
        note,
        withdrawnAt,
        recordedBy:      session.sub,
        recordedByName:  session.name || session.username || session.sub,
        createdAt:       Math.floor(Date.now() / 1000),
    };

    await saveWithdrawal(withdrawal);
    return NextResponse.json({ success: true, withdrawal }, { status: 201 });
}
