'use client';
import { useEffect, useMemo, useState, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import Modal from '@/components/Modal';
import { apiFetch } from '@/lib/apiFetch';
import { TableSkeleton } from '@/components/Skeleton';
import { useToast } from '@/components/Toast';

const fmt = (ts) => (ts ? new Date(ts).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const TONE = { connected: 'badge-active', cancelled: 'badge-expired', rejected_needs_attention: 'badge-revoked', awaiting_customer_info: 'badge-plan-trial' };

export default function WhatsAppApiAdmin() {
    const toast = useToast();
    const [me, setMe] = useState(null);
    const [tab, setTab] = useState('requests');
    const [rows, setRows] = useState([]); const [statuses, setStatuses] = useState([]); const [loading, setLoading] = useState(true);
    const [q, setQ] = useState(''); const [status, setStatus] = useState(''); const [assignee, setAssignee] = useState('');
    const [openId, setOpenId] = useState(null);

    useEffect(() => { try { setMe(JSON.parse(localStorage.getItem('zyqora_admin_user') || 'null')); } catch {} }, []);
    const load = useCallback(async () => {
        const p = new URLSearchParams(); if (q) p.set('q', q); if (status) p.set('status', status); if (assignee) p.set('assignee', assignee);
        const r = await apiFetch('/api/wa-onboarding/admin?' + p.toString());
        if (r?.ok) { setRows(r.data.requests || []); setStatuses(r.data.statuses || []); } else if (r) toast.error(r.data?.error || 'Could not load requests');
        setLoading(false);
    }, [q, status, assignee]);
    useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
    const label = (k) => statuses.find((s) => s.key === k)?.label || k;
    const isSuper = me?.role === 'super';
    const denied = me && !['super', 'admin'].includes(me.role);

    if (denied) return <AppLayout><div className="page-body"><div className="card" style={{ padding: 24 }}>You do not have access to this page.</div></div></AppLayout>;
    return (
        <AppLayout>
            <div className="page-body">
                <div className="page-header">
                    <div><div className="page-title">Official WhatsApp API</div><div className="page-subtitle">Assisted onboarding requests, status wording and webhook relay</div></div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                    {[['requests', 'Requests'], ['statuses', 'Statuses'], ['relay', 'Webhook relay']].map(([k, l]) => (
                        <button key={k} className={`btn btn-sm ${tab === k ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab(k)}>{l}</button>))}
                </div>
                {tab === 'requests' && (<>
                    <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
                        <input className="form-input" style={{ maxWidth: 280 }} placeholder="Search business, email, license, WABA…" value={q} onChange={(e) => setQ(e.target.value)} />
                        <select className="form-select" style={{ maxWidth: 240 }} value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{statuses.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select>
                        <select className="form-select" style={{ maxWidth: 180 }} value={assignee} onChange={(e) => setAssignee(e.target.value)}><option value="">Any assignee</option><option value="me">Assigned to me</option><option value="unassigned">Unassigned</option></select>
                    </div>
                    {loading ? <TableSkeleton rows={6} cols={5} /> : rows.length === 0 ? <div className="card" style={{ padding: 28, textAlign: 'center', color: '#6b7a99' }}>No onboarding requests match.</div> : (
                        <div className="table-wrap"><table className="table"><thead><tr><th>Business</th><th>Status</th><th>Assigned</th><th>License</th><th>Updated</th></tr></thead><tbody>
                            {rows.map((r) => (<tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => setOpenId(r.id)}>
                                <td><div style={{ fontWeight: 600 }}>{r.businessLegalName}</div><div style={{ fontSize: 12, color: '#6b7a99' }}>{r.businessEmail} · {r.country}</div></td>
                                <td><span className={`badge ${TONE[r.status] || 'badge-admin'}`}>{label(r.status)}</span>{r.suspended && <span className="badge badge-revoked" style={{ marginLeft: 6 }}>On hold</span>}{r.failedAttempts > 0 && <span className="badge badge-plan-weekly" style={{ marginLeft: 6 }}>{r.failedAttempts} failed</span>}</td>
                                <td>{r.assignedTo?.name || <span style={{ color: '#6b7a99' }}>Unassigned</span>}</td><td style={{ fontFamily: 'monospace', fontSize: 11 }}>{r.licenseKey}</td><td>{fmt(r.updatedAt)}</td></tr>))}
                        </tbody></table></div>)}
                </>)}
                {tab === 'statuses' && <StatusConfig isSuper={isSuper} statuses={statuses} onSaved={setStatuses} />}
                {tab === 'relay' && <RelayPanel />}
            </div>
            {openId && <Detail id={openId} isSuper={isSuper} onClose={() => { setOpenId(null); load(); }} />}
        </AppLayout>
    );
}

function Detail({ id, isSuper, onClose }) {
    const toast = useToast(); const [rec, setRec] = useState(null); const [cfg, setCfg] = useState([]); const [busy, setBusy] = useState(false);
    const [note, setNote] = useState(''); const [vis, setVis] = useState('internal'); const [info, setInfo] = useState(''); const [fail, setFail] = useState(''); const [newStatus, setNewStatus] = useState(''); const [reason, setReason] = useState(''); const [custNote, setCustNote] = useState('');
    const [ids, setIds] = useState({}); const [admins, setAdmins] = useState([]);
    const load = async () => { const r = await apiFetch('/api/wa-onboarding/admin/' + id); if (r?.ok) { setRec(r.data.request); setCfg(r.data.statuses); setNewStatus(r.data.request.status); setIds({ ...r.data.request.ids, verificationSubmittedAt: (r.data.request.ids.verificationSubmittedAt || '').slice(0, 10), verificationApprovedAt: (r.data.request.ids.verificationApprovedAt || '').slice(0, 10) }); } else if (r) { toast.error(r.data?.error || 'Failed to load'); onClose(); } };
    useEffect(() => { load(); if (isSuper) apiFetch('/api/admins/list').then((r) => { if (r?.ok) setAdmins((Array.isArray(r.data) ? r.data : r.data.admins || []).filter((a) => a.active !== false)); }); }, [id]);
    const act = async (body, okMsg) => { setBusy(true); const r = await apiFetch('/api/wa-onboarding/admin/' + id, { method: 'PATCH', body }); setBusy(false); if (r?.ok) { setRec(r.data.request); toast.success(okMsg || 'Saved'); return true; } toast.error(r?.data?.error || 'Action failed'); return false; };
    if (!rec) return <Modal title="Request" onClose={onClose} maxWidth={760}><div style={{ padding: 24 }}>Loading…</div></Modal>;
    const f = rec.form; const lbl = (k) => cfg.find((s) => s.key === k)?.label || k;
    const row = (k, v) => v ? <div style={{ display: 'flex', gap: 10, fontSize: 13, padding: '3px 0' }}><div style={{ width: 170, color: '#6b7a99', flexShrink: 0 }}>{k}</div><div style={{ wordBreak: 'break-word' }}>{v}</div></div> : null;
    return (
        <Modal title={`${f.businessLegalName}`} onClose={onClose} maxWidth={820} busy={busy}>
            <div style={{ padding: '4px 4px 16px', display: 'grid', gap: 18 }}>
                <section><h4 style={{ margin: '0 0 8px' }}>Customer submission</h4>
                    {row('Display name', f.businessDisplayName)}{row('Email', f.businessEmail)}{row('Contact phone', f.contactPhone)}{row('Country', f.country)}{row('Website', f.website)}{row('Category', f.businessCategory)}{row('Business type', f.businessType)}{row('Address', f.businessAddress)}
                    {row('Number to connect', f.whatsappNumber)}{row('Meta Business Portfolio', f.metaPortfolio)}{row('Existing WABA ID', f.existingWabaId)}{row('Number status', f.numberStatus)}{row('Verification', f.verificationStatus)}{row('Preferred contact', f.preferredContact)}{row('Customer notes', f.notes)}{row('License', rec.licenseKey)}
                </section>
                <section><h4 style={{ margin: '0 0 8px' }}>Status</h4>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <select className="form-select" style={{ maxWidth: 280 }} value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>{cfg.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select>
                        <input className="form-input" style={{ maxWidth: 220 }} placeholder="Reason (internal audit)" value={reason} onChange={(e) => setReason(e.target.value)} />
                        <input className="form-input" style={{ maxWidth: 260 }} placeholder="Note shown to customer (optional)" value={custNote} onChange={(e) => setCustNote(e.target.value)} />
                        <button className="btn btn-primary btn-sm" disabled={busy || newStatus === rec.status} onClick={async () => { if (await act({ action: 'status', status: newStatus, reason, customerNote: custNote }, 'Status updated')) { setReason(''); setCustNote(''); } }}>Update</button>
                    </div>
                    <div style={{ marginTop: 8, fontSize: 12, color: '#6b7a99' }}>Current: {lbl(rec.status)}{rec.suspended ? ' · ON HOLD' : ''} · Retries: {rec.retries}</div>
                </section>
                <section><h4 style={{ margin: '0 0 8px' }}>Assignment</h4>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ fontSize: 13 }}>{rec.assignedTo ? rec.assignedTo.name : 'Unassigned'}</span>
                        <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => act({ action: 'assign', adminId: 'me' }, 'Assigned to you')}>Assign to me</button>
                        {isSuper && admins.length > 0 && <select className="form-select" style={{ maxWidth: 200 }} value="" onChange={(e) => e.target.value && act({ action: 'assign', adminId: e.target.value }, 'Assigned')}><option value="">Assign to…</option>{admins.map((a) => <option key={a.id} value={a.id}>{a.name || a.username}</option>)}</select>}
                        {rec.assignedTo && <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => act({ action: 'assign', adminId: null }, 'Unassigned')}>Unassign</button>}
                    </div>
                </section>
                <section><h4 style={{ margin: '0 0 8px' }}>Meta identifiers & verification</h4>
                    <div className="form-row">{[['wabaId', 'WABA ID'], ['phoneNumberId', 'Phone Number ID'], ['businessPortfolioId', 'Business Portfolio ID']].map(([k, l]) => <div className="form-group" key={k}><label className="form-label">{l}</label><input className="form-input" value={ids[k] || ''} onChange={(e) => setIds({ ...ids, [k]: e.target.value })} /></div>)}
                        {[['verificationSubmittedAt', 'Verification submitted'], ['verificationApprovedAt', 'Verification approved']].map(([k, l]) => <div className="form-group" key={k}><label className="form-label">{l}</label><input type="date" className="form-input" value={ids[k] || ''} onChange={(e) => setIds({ ...ids, [k]: e.target.value })} /></div>)}</div>
                    <button className="btn btn-primary btn-sm" style={{ marginTop: 8 }} disabled={busy} onClick={() => act({ action: 'ids', ids }, 'Identifiers saved')}>Save identifiers</button>
                </section>
                <section><h4 style={{ margin: '0 0 8px' }}>Ask the customer for information</h4>
                    <div style={{ display: 'flex', gap: 8 }}><input className="form-input" placeholder="What do you need from them? (never ask for passwords/OTPs)" value={info} onChange={(e) => setInfo(e.target.value)} /><button className="btn btn-ghost btn-sm" disabled={busy || !info.trim()} onClick={async () => { if (await act({ action: 'request_info', message: info }, 'Request sent')) setInfo(''); }}>Request info</button></div>
                    {rec.customerMessages.length > 0 && <div style={{ marginTop: 8, fontSize: 13 }}>{rec.customerMessages.slice(-5).map((m, i) => <div key={i} style={{ padding: '4px 0', borderTop: '1px solid #1e2740' }}><span style={{ color: '#6b7a99' }}>{fmt(m.at)} · customer: </span>{m.text}</div>)}</div>}
                </section>
                <section><h4 style={{ margin: '0 0 8px' }}>Notes</h4>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><select className="form-select" style={{ maxWidth: 190 }} value={vis} onChange={(e) => setVis(e.target.value)}><option value="internal">Internal (staff only)</option><option value="customer">Visible to customer</option></select>
                        <input className="form-input" style={{ flex: 1, minWidth: 200 }} placeholder="Write a note…" value={note} onChange={(e) => setNote(e.target.value)} /><button className="btn btn-ghost btn-sm" disabled={busy || !note.trim()} onClick={async () => { if (await act({ action: 'note', visibility: vis, text: note }, 'Note added')) setNote(''); }}>Add</button></div>
                    {rec.notes.slice().reverse().map((n) => <div key={n.id} style={{ marginTop: 8, padding: 8, borderRadius: 8, background: n.visibility === 'internal' ? 'rgba(245,158,11,.08)' : 'rgba(74,158,255,.08)', fontSize: 13 }}><div style={{ fontSize: 11, color: '#6b7a99' }}>{n.visibility === 'internal' ? 'INTERNAL' : 'CUSTOMER-VISIBLE'} · {n.byName} · {fmt(n.at)}</div>{n.text}</div>)}
                </section>
                <section><h4 style={{ margin: '0 0 8px' }}>Failed attempts & retries</h4>
                    <div style={{ display: 'flex', gap: 8 }}><input className="form-input" placeholder="What failed? (e.g. Meta rejected documents)" value={fail} onChange={(e) => setFail(e.target.value)} /><button className="btn btn-ghost btn-sm" disabled={busy || !fail.trim()} onClick={async () => { if (await act({ action: 'failed_attempt', message: fail }, 'Logged')) setFail(''); }}>Log failure</button><button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => act({ action: 'retry' }, 'Retry recorded')}>Record retry</button></div>
                    {rec.failedAttempts.map((a, i) => <div key={i} style={{ fontSize: 12, marginTop: 6 }}>{fmt(a.at)} · {a.byName}: {a.message}</div>)}
                </section>
                {isSuper && <section><h4 style={{ margin: '0 0 8px' }}>Danger zone (super admin)</h4>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {rec.suspended ? <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => act({ action: 'unsuspend' }, 'Resumed')}>Resume</button> : <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => { const r = window.prompt('Reason for suspending this request?'); if (r) act({ action: 'suspend', reason: r }, 'Suspended'); }}>Suspend</button>}
                        <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => { if (window.confirm('Disconnect and cancel this request? The customer will see it as cancelled.')) { const r = window.prompt('Reason?') || ''; act({ action: 'disconnect', reason: r }, 'Disconnected'); } }}>Disconnect</button>
                    </div></section>}
                <section><h4 style={{ margin: '0 0 8px' }}>History (audit trail)</h4>
                    <div style={{ maxHeight: 220, overflowY: 'auto', fontSize: 12 }}>{rec.history.slice().reverse().map((h, i) => <div key={i} style={{ padding: '4px 0', borderTop: '1px solid #1e2740' }}><span style={{ color: '#6b7a99' }}>{fmt(h.at)} · {h.byName || 'system'}</span> — {h.type === 'status' ? `${lbl(h.from)} → ${lbl(h.to)}` : h.type}{h.detail ? `: ${h.detail}` : ''}</div>)}</div>
                </section>
            </div>
        </Modal>
    );
}

function StatusConfig({ isSuper, statuses, onSaved }) {
    const toast = useToast(); const [draft, setDraft] = useState({}); const [busy, setBusy] = useState(false);
    useEffect(() => { const d = {}; statuses.forEach((s) => { d[s.key] = { label: s.label, description: s.description, nextStep: s.nextStep, customerAction: s.customerAction || '' }; }); setDraft(d); }, [statuses]);
    const save = async () => { setBusy(true); const r = await apiFetch('/api/wa-onboarding/config', { method: 'PUT', body: { statuses: Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, { ...v, customerAction: v.customerAction || null }])) } }); setBusy(false); if (r?.ok) { onSaved(r.data.statuses); toast.success('Status wording saved'); } else toast.error(r?.data?.error || 'Save failed'); };
    return (<div className="card" style={{ padding: 16 }}>
        <div style={{ fontSize: 13, color: '#6b7a99', marginBottom: 12 }}>These words are shown to customers. Do not promise Meta approval or timelines. {isSuper ? '' : 'Only a super admin can edit them.'}</div>
        {statuses.map((s) => <div key={s.key} style={{ borderTop: '1px solid #1e2740', padding: '10px 0', display: 'grid', gap: 6 }}>
            <div style={{ fontSize: 11, color: '#6b7a99', fontFamily: 'monospace' }}>{s.key}</div>
            <div className="form-row"><input className="form-input" disabled={!isSuper} value={draft[s.key]?.label || ''} onChange={(e) => setDraft({ ...draft, [s.key]: { ...draft[s.key], label: e.target.value } })} /><input className="form-input" disabled={!isSuper} placeholder="Customer action (optional)" value={draft[s.key]?.customerAction || ''} onChange={(e) => setDraft({ ...draft, [s.key]: { ...draft[s.key], customerAction: e.target.value } })} /></div>
            <input className="form-input" disabled={!isSuper} value={draft[s.key]?.description || ''} onChange={(e) => setDraft({ ...draft, [s.key]: { ...draft[s.key], description: e.target.value } })} /><input className="form-input" disabled={!isSuper} placeholder="Next step" value={draft[s.key]?.nextStep || ''} onChange={(e) => setDraft({ ...draft, [s.key]: { ...draft[s.key], nextStep: e.target.value } })} /></div>)}
        {isSuper && <button className="btn btn-primary" style={{ marginTop: 12 }} disabled={busy} onClick={save}>Save wording</button>}
    </div>);
}

function RelayPanel() {
    const [d, setD] = useState(null);
    useEffect(() => { apiFetch('/api/wa-relay/admin').then((r) => { if (r?.ok) setD(r.data); else setD(false); }); }, []);
    if (d === null) return <TableSkeleton rows={4} cols={4} />; if (d === false) return <div className="card" style={{ padding: 20 }}>Could not load relay status.</div>;
    return (<div style={{ display: 'grid', gap: 14 }}>
        <div className="card" style={{ padding: 16, fontSize: 13, lineHeight: 1.6 }}>
            <div><b>Relay:</b> {d.enabled ? 'enabled' : 'DISABLED — set WA_RELAY_SECRET'}</div>
            <div><b>Zyqora-app (Tech Provider) endpoint:</b> {d.globalEndpointActive ? 'active' : 'off — needs Meta approval, META_APP_SECRET and META_WEBHOOK_VERIFY_TOKEN'}</div>
            <div style={{ color: '#6b7a99', marginTop: 6 }}>Mailboxes hold raw events for up to 7 days (max 200). App Secrets are never stored here; customers' apps verify signatures locally.</div></div>
        {d.bindings.length === 0 ? <div className="card" style={{ padding: 24, textAlign: 'center', color: '#6b7a99' }}>No customers have registered a webhook mailbox yet.</div> :
            <div className="table-wrap"><table className="table"><thead><tr><th>Mailbox</th><th>License</th><th>WABA</th><th>Phone Number ID</th><th>Queued</th><th>Registered</th></tr></thead><tbody>{d.bindings.map((b) => <tr key={b.id}><td style={{ fontFamily: 'monospace' }}>{b.id}</td><td style={{ fontFamily: 'monospace', fontSize: 11 }}>{b.licenseKey}</td><td>{b.wabaId}</td><td>{b.phoneNumberId}</td><td>{b.queued ?? '—'}</td><td>{fmt(b.createdAt)}</td></tr>)}</tbody></table></div>}
    </div>);
}
