import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { listRecords, getConfig } from '@/lib/waOnboarding';

export const dynamic = 'force-dynamic';

// Admin/super only. Lists requests (search + filters). Whitelabel/affiliate sessions are refused.
export async function GET(req) {
    const { error, status, session } = await requireAuth(req); if (error) return NextResponse.json({ error }, { status });
    if (!['super', 'admin'].includes(session.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const u = new URL(req.url); const q = (u.searchParams.get('q') || '').toLowerCase().trim(); const st = u.searchParams.get('status'); const as = u.searchParams.get('assignee');
    let rows = await listRecords();
    if (st) rows = rows.filter((r) => r.status === st);
    if (as === 'me') rows = rows.filter((r) => r.assignedTo && r.assignedTo.id === session.sub); else if (as === 'unassigned') rows = rows.filter((r) => !r.assignedTo); else if (as) rows = rows.filter((r) => r.assignedTo && r.assignedTo.id === as);
    if (q) rows = rows.filter((r) => `${r.form.businessLegalName} ${r.form.businessEmail} ${r.form.contactPhone} ${r.licenseKey} ${r.customer.name} ${r.ids.wabaId} ${r.ids.phoneNumberId}`.toLowerCase().includes(q));
    rows.sort((a, b) => b.updatedAt - a.updatedAt);
    return NextResponse.json({ statuses: await getConfig(), total: rows.length, requests: rows.slice(0, 500).map((r) => ({ id: r.id, businessLegalName: r.form.businessLegalName, businessEmail: r.form.businessEmail, country: r.form.country, status: r.status, assignedTo: r.assignedTo, suspended: r.suspended, licenseKey: r.licenseKey, failedAttempts: r.failedAttempts.length, createdAt: r.createdAt, updatedAt: r.updatedAt })) });
}
