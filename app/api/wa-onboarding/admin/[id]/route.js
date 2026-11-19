import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { requireAuth } from '@/lib/auth';
import { getRecord, saveRecord, getConfig, getAdmin, STATUS_KEYS, appendLog, scanForSecrets } from '@/lib/waOnboarding';

export const dynamic = 'force-dynamic';
const SUPER_ONLY = new Set(['suspend', 'unsuspend', 'disconnect']);
const text = (v, n) => String(v == null ? '' : v).trim().slice(0, n);

async function guard(req) {
    const { error, status, session } = await requireAuth(req); if (error) return { res: NextResponse.json({ error }, { status }) };
    if (!['super', 'admin'].includes(session.role)) return { res: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
    return { session };
}
export async function GET(req, { params }) {
    const g = await guard(req); if (g.res) return g.res;
    const rec = await getRecord(params.id); if (!rec) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ request: rec, statuses: await getConfig() });
}

// One endpoint for every admin action; each change is appended to the request's audit history.
export async function PATCH(req, { params }) {
    const g = await guard(req); if (g.res) return g.res; const { session } = g;
    const b = await req.json().catch(() => ({})); const action = String(b.action || '');
    if (SUPER_ONLY.has(action) && session.role !== 'super') return NextResponse.json({ error: 'Forbidden — super admin only' }, { status: 403 });
    const rec = await getRecord(params.id); if (!rec) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const now = Date.now(); const by = { by: session.sub, byName: session.username };
    const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

    if (action === 'status') {
        const to = String(b.status || ''); if (!STATUS_KEYS.includes(to)) return bad('Unknown status.');
        if (to === 'connected' && !(rec.ids.wabaId && rec.ids.phoneNumberId)) return bad('Record the WhatsApp Business Account ID and Phone Number ID before marking Connected.');
        if (rec.suspended) return bad('This request is on hold. Resume it first.');
        const from = rec.status; rec.status = to; rec.customerAction = null;
        rec.history.push({ at: now, type: 'status', ...by, from, to, detail: text(b.reason, 300) });
        if (b.customerNote) { const tx = text(b.customerNote, 600); if (scanForSecrets(tx)) return bad('Do not put credentials or tokens in notes.'); rec.notes.push({ id: crypto.randomUUID(), at: now, visibility: 'customer', text: tx, ...by }); }
    } else if (action === 'assign') {
        if (!b.adminId) { rec.assignedTo = null; rec.history.push({ at: now, type: 'assign', ...by, detail: 'Unassigned' }); }
        else { const id = b.adminId === 'me' ? session.sub : String(b.adminId); const a = await getAdmin(id); if (!a || a.active === false) return bad('That admin does not exist.'); rec.assignedTo = { id: a.id, name: a.name || a.username }; rec.history.push({ at: now, type: 'assign', ...by, detail: `Assigned to ${rec.assignedTo.name}` }); }
    } else if (action === 'note') {
        const vis = b.visibility === 'customer' ? 'customer' : 'internal'; const tx = text(b.text, 1000); if (!tx) return bad('Write a note.');
        if (vis === 'customer' && scanForSecrets(tx)) return bad('Do not put credentials or tokens in customer-visible notes.');
        rec.notes.push({ id: crypto.randomUUID(), at: now, visibility: vis, text: tx, ...by }); rec.history.push({ at: now, type: 'note', ...by, detail: vis === 'customer' ? 'Customer-visible note' : 'Internal note' });
    } else if (action === 'request_info') {
        const m = text(b.message, 500); if (!m) return bad('Write what you need from the customer.');
        const from = rec.status; rec.status = 'awaiting_customer_info'; rec.customerAction = { type: 'info', message: m, requestedAt: now };
        rec.history.push({ at: now, type: 'status', ...by, from, to: rec.status, detail: 'Information requested' });
    } else if (action === 'ids') {
        const i = b.ids || {};
        const dig = (v, label) => { const s = text(v, 30); if (s && !/^\d{5,25}$/.test(s)) throw new Error(`${label} must be digits only.`); return s; };
        const dt = (v, label) => { if (!v) return null; const d = Date.parse(v); if (!Number.isFinite(d)) throw new Error(`${label} is not a valid date.`); return new Date(d).toISOString(); };
        try { rec.ids = { wabaId: dig(i.wabaId, 'WABA ID'), phoneNumberId: dig(i.phoneNumberId, 'Phone Number ID'), businessPortfolioId: dig(i.businessPortfolioId, 'Business Portfolio ID'), verificationSubmittedAt: dt(i.verificationSubmittedAt, 'Verification submitted date'), verificationApprovedAt: dt(i.verificationApprovedAt, 'Verification approved date') }; } catch (e) { return bad(e.message); }
        rec.history.push({ at: now, type: 'ids', ...by, detail: 'Updated Meta identifiers / verification dates' });
    } else if (action === 'failed_attempt') {
        rec.failedAttempts.push({ at: now, message: text(b.message, 400), ...by }); rec.history.push({ at: now, type: 'failed_attempt', ...by, detail: text(b.message, 120) });
    } else if (action === 'retry') {
        rec.retries++; rec.history.push({ at: now, type: 'retry', ...by, detail: `Retry #${rec.retries}${b.message ? ': ' + text(b.message, 120) : ''}` });
    } else if (action === 'suspend') { rec.suspended = true; rec.history.push({ at: now, type: 'suspend', ...by, detail: text(b.reason, 200) });
    } else if (action === 'unsuspend') { rec.suspended = false; rec.history.push({ at: now, type: 'unsuspend', ...by });
    } else if (action === 'disconnect') {
        const from = rec.status; rec.status = 'cancelled'; rec.customerAction = null; rec.history.push({ at: now, type: 'status', ...by, from, to: 'cancelled', detail: 'Disconnected by admin: ' + text(b.reason, 200) });
    } else return bad('Unknown action.');

    await saveRecord(rec); await appendLog('WA_ONBOARDING_' + action.toUpperCase(), session, { id: rec.id, status: rec.status });
    return NextResponse.json({ request: rec });
}
