'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import { apiFetch } from '@/lib/apiFetch';

function fmtDate(ts) {
    if (!ts) return '—';
    return new Date(ts * 1000).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const MODE_OPTIONS = [
    { value: 'desktop', label: 'PC / Desktop', sub: 'Bound to Machine ID'     },
    { value: 'cloud',   label: 'Cloud',        sub: 'No machine binding'       },
    { value: 'app',     label: 'Android App',  sub: 'Bound to Android ID'      },
];

const MODE_STYLE = {
    desktop: { background: 'rgba(139,146,176,.15)', color: '#8b93b0' },
    cloud:   { background: 'rgba(37,211,102,.15)',  color: '#25D366' },
    app:     { background: 'rgba(74,158,255,.15)',  color: '#4a9eff' },
};

function ModeBadge({ mode }) {
    const opt = MODE_OPTIONS.find(m => m.value === mode);
    return (
        <span className="badge" style={MODE_STYLE[mode] || MODE_STYLE.desktop}>
            {opt ? opt.label : mode}
        </span>
    );
}

function ModeCheckboxes({ value, onChange }) {
    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {MODE_OPTIONS.map(({ value: m, label, sub }) => {
                const on = value.includes(m);
                return (
                    <label key={m} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '8px 10px', borderRadius: 8, border: '1px solid', borderColor: on ? '#7c3aed' : '#252d42', background: on ? 'rgba(124,58,237,.1)' : 'transparent', transition: 'all .15s', userSelect: 'none' }}>
                        <input type="checkbox" checked={on}
                            onChange={() => onChange(m)}
                            style={{ accentColor: '#7c3aed', width: 14, height: 14, flexShrink: 0 }} />
                        <span style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            <span style={{ fontSize: 12.5, fontWeight: 600, color: on ? '#e2e8f0' : '#4a5980' }}>{label}</span>
                            <span style={{ fontSize: 10.5, color: '#3a4560' }}>{sub}</span>
                        </span>
                    </label>
                );
            })}
        </div>
    );
}

const EMPTY_FORM = {
    name: '', username: '', password: '',
    phone: '', email: '',
    businessName: '', businessCategory: '', website: '',
    notes: '',
    allowedModes: ['desktop'],
    licenseLimit: '50',
};

export default function WhitelabelPage() {
    const router = useRouter();
    const [user, setUser] = useState(null);
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);

    // Create modal
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const [created, setCreated] = useState(null); // { username, password } shown once after creation

    // Edit modal
    const [editTarget, setEditTarget] = useState(null);
    const [editForm, setEditForm] = useState(null);
    const [editBusy, setEditBusy] = useState(false);
    const [editErr, setEditErr] = useState('');
    const [editSaved, setEditSaved] = useState(false);

    // Reset password modal
    const [pwTarget, setPwTarget] = useState(null);
    const [newPw, setNewPw] = useState('');
    const [pwBusy, setPwBusy] = useState(false);
    const [pwErr, setPwErr] = useState('');

    // Licenses drill-down modal
    const [viewTarget, setViewTarget] = useState(null);
    const [viewData, setViewData] = useState(null);
    const [licsLoading, setLicsLoading] = useState(false);

    useEffect(() => {
        try {
            const u = localStorage.getItem('zyqora_admin_user');
            if (u) {
                const parsed = JSON.parse(u);
                setUser(parsed);
                if (parsed.role !== 'super') { router.replace('/dashboard'); return; }
            }
        } catch {}
        load();
    }, []);

    const load = async () => {
        setLoading(true);
        const r = await apiFetch('/api/whitelabel/list');
        if (r?.ok) setClients(r.data || []);
        setLoading(false);
    };

    const openCreate = () => {
        setForm(EMPTY_FORM);
        setErr('');
        setCreated(null);
        setShowCreate(true);
    };

    const toggleFormMode = (m) => {
        setForm(f => ({
            ...f,
            allowedModes: f.allowedModes.includes(m)
                ? f.allowedModes.filter(x => x !== m)
                : [...f.allowedModes, m],
        }));
    };

    const create = async (e) => {
        e.preventDefault();
        setBusy(true);
        setErr('');
        const r = await apiFetch('/api/whitelabel/create', {
            method: 'POST',
            body: {
                ...form,
                licenseLimit: parseInt(form.licenseLimit) || 0,
            },
        });
        if (!r?.ok) { setErr(r?.data?.error || 'Failed to create'); setBusy(false); return; }
        setCreated({ username: form.username, password: form.password, name: form.name });
        setBusy(false);
        load();
    };

    const openEdit = (c) => {
        setEditTarget(c);
        setEditForm({
            name: c.name || '',
            phone: c.phone || '',
            email: c.email || '',
            businessName: c.businessName || '',
            businessCategory: c.businessCategory || '',
            website: c.website || '',
            notes: c.notes || '',
            allowedModes: [...(c.allowedModes || [])],
            licenseLimit: String(c.licenseLimit ?? ''),
        });
        setEditErr('');
        setEditSaved(false);
    };

    const toggleEditMode = (m) => {
        setEditForm(f => ({
            ...f,
            allowedModes: f.allowedModes.includes(m)
                ? f.allowedModes.filter(x => x !== m)
                : [...f.allowedModes, m],
        }));
    };

    const saveEdit = async (e) => {
        e.preventDefault();
        setEditBusy(true);
        setEditErr('');
        setEditSaved(false);
        const r = await apiFetch(`/api/whitelabel/${editTarget.id}/update`, {
            method: 'POST',
            body: {
                name: editForm.name,
                phone: editForm.phone,
                email: editForm.email,
                businessName: editForm.businessName,
                businessCategory: editForm.businessCategory,
                website: editForm.website,
                notes: editForm.notes,
                allowedModes: editForm.allowedModes,
                licenseLimit: parseInt(editForm.licenseLimit) || 0,
            },
        });
        if (!r?.ok) { setEditErr(r?.data?.error || 'Failed to update'); setEditBusy(false); return; }
        setEditSaved(true);
        setEditBusy(false);
        load();
    };

    const toggleActive = async (c) => {
        const r = await apiFetch(`/api/whitelabel/${c.id}/toggle`, { method: 'POST' });
        if (r?.ok) load();
    };

    const changePw = async (e) => {
        e.preventDefault();
        setPwBusy(true);
        setPwErr('');
        const r = await apiFetch(`/api/whitelabel/${pwTarget.id}/change-password`, {
            method: 'POST',
            body: { password: newPw },
        });
        if (!r?.ok) { setPwErr(r?.data?.error || 'Failed'); setPwBusy(false); return; }
        setPwBusy(false);
        setPwTarget(null);
        setNewPw('');
    };

    const viewLicenses = async (c) => {
        setViewTarget(c);
        setViewData(null);
        setLicsLoading(true);
        const r = await apiFetch(`/api/whitelabel/${c.id}/licenses`);
        if (r?.ok) setViewData(r.data);
        setLicsLoading(false);
    };

    const totalClients = clients.length;
    const activeClients = clients.filter(c => c.active).length;
    const totalIssued = clients.reduce((s, c) => s + (c.usedLicenses || 0), 0);
    const totalCapacity = clients.reduce((s, c) => s + (c.remainingLicenses || 0), 0);

    return (
        <AppLayout>
            <div className="page">
                <div className="page-header">
                    <div>
                        <div className="page-title">Whitelabel Clients</div>
                        <div className="page-subtitle">Reseller accounts that log into this panel and generate licenses under your limits</div>
                    </div>
                    <button className="btn btn-primary" onClick={openCreate}>+ Add Whitelabel Client</button>
                </div>

                <div className="page-body">
                    {/* Stats */}
                    <div className="stats-grid">
                        <div className="stat-card">
                            <div className="stat-label">Whitelabel Clients</div>
                            <div className="stat-value stat-accent">{totalClients}</div>
                            <div className="stat-sub">{activeClients} active</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-label">Licenses Issued by Clients</div>
                            <div className="stat-value stat-blue">{totalIssued}</div>
                            <div className="stat-sub">Across all whitelabel accounts</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-label">Remaining Capacity</div>
                            <div className="stat-value stat-green">{totalCapacity}</div>
                            <div className="stat-sub">Unused license slots</div>
                        </div>
                    </div>

                    {/* Table */}
                    {loading ? (
                        <div className="empty">Loading…</div>
                    ) : clients.length === 0 ? (
                        <div className="empty">
                            No whitelabel clients yet.<br />
                            <span style={{ fontSize: 12 }}>Create one to give a reseller their own login, allowed license types and a generation limit.</span>
                        </div>
                    ) : (
                        <div className="table-wrap">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Client</th>
                                        <th>Contact</th>
                                        <th>Business</th>
                                        <th>Allowed Types</th>
                                        <th>Limit</th>
                                        <th>Used</th>
                                        <th>Remaining</th>
                                        <th>Status</th>
                                        <th>Created</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {clients.map(c => {
                                        const remaining = c.remainingLicenses ?? 0;
                                        return (
                                            <tr key={c.id}>
                                                <td>
                                                    <div className="bold" style={{ cursor: 'pointer', color: '#a78bfa', textDecoration: 'underline', textDecorationStyle: 'dotted' }} onClick={() => viewLicenses(c)}>
                                                        {c.name}
                                                    </div>
                                                    <div className="dim">@{c.username}</div>
                                                </td>
                                                <td>
                                                    {c.phone && <div style={{ fontSize: 12 }}>{c.phone}</div>}
                                                    {c.email && <div className="dim">{c.email}</div>}
                                                    {!c.phone && !c.email && <span className="dim">—</span>}
                                                </td>
                                                <td>
                                                    <div style={{ fontSize: 12 }}>{c.businessName || '—'}</div>
                                                    {c.businessCategory && <div className="dim">{c.businessCategory}</div>}
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                                        {(c.allowedModes || []).map(m => <ModeBadge key={m} mode={m} />)}
                                                    </div>
                                                </td>
                                                <td style={{ fontWeight: 700, color: '#e2e8f0' }}>{c.licenseLimit}</td>
                                                <td>{c.usedLicenses}</td>
                                                <td>
                                                    <span style={{
                                                        fontWeight: 700,
                                                        color: remaining <= 0 ? '#ef4444' : remaining <= 5 ? '#f59e0b' : '#22c55e',
                                                    }}>
                                                        {remaining}
                                                    </span>
                                                </td>
                                                <td>
                                                    {c.active
                                                        ? <span className="badge badge-active">Active</span>
                                                        : <span className="badge badge-revoked">Disabled</span>}
                                                </td>
                                                <td>{fmtDate(c.createdAt)}</td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: 6 }}>
                                                        <button className="btn btn-ghost btn-sm" onClick={() => viewLicenses(c)} title="View licenses">📋</button>
                                                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(c)} title="Edit details, types & limit">✎</button>
                                                        <button className="btn btn-ghost btn-sm" onClick={() => { setPwTarget(c); setNewPw(''); setPwErr(''); }} title="Reset password">🔑</button>
                                                        <button
                                                            className="btn btn-danger btn-sm"
                                                            onClick={() => toggleActive(c)}
                                                        >
                                                            {c.active ? 'Disable' : 'Enable'}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Create Modal ─────────────────────────────────────────── */}
            {showCreate && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && !busy && !created && setShowCreate(false)}>
                    <div className="modal" style={{ maxWidth: 580 }}>
                        <div className="modal-header">
                            <span className="modal-title">{created ? '✓ Whitelabel Client Created' : 'Add Whitelabel Client'}</span>
                            <button className="modal-close" onClick={() => setShowCreate(false)} disabled={busy}>×</button>
                        </div>

                        {created ? (
                            <div className="modal-body">
                                <div style={{ background: 'rgba(34,197,94,.08)', border: '1px solid rgba(34,197,94,.35)', borderRadius: 10, padding: '16px 18px' }}>
                                    <div style={{ color: '#22c55e', fontWeight: 700, marginBottom: 10 }}>Share these credentials with {created.name}:</div>
                                    <div style={{ fontFamily: 'Courier New, monospace', fontSize: 14, color: '#e2e8f0', lineHeight: 1.9 }}>
                                        URL:      <span style={{ color: '#a78bfa' }}>{typeof window !== 'undefined' ? window.location.origin : ''}/login</span><br />
                                        Username: <span style={{ color: '#a78bfa' }}>{created.username}</span><br />
                                        Password: <span style={{ color: '#a78bfa' }}>{created.password}</span>
                                    </div>
                                    <div style={{ fontSize: 11.5, color: '#4a5980', marginTop: 10 }}>
                                        They log into this same admin panel and can generate the license types and up to the limit you set. You can change types, limits and details any time — updates apply to their session automatically.
                                    </div>
                                </div>
                                <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setShowCreate(false)}>Done</button>
                            </div>
                        ) : (
                            <form onSubmit={create}>
                                <div className="modal-body">
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label className="form-label">Client / Business Name *</label>
                                            <input className="form-input" required value={form.name}
                                                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Acme Softwares" autoFocus />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Username *</label>
                                            <input className="form-input" required value={form.username}
                                                onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="login username" />
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Password *</label>
                                        <input className="form-input" type="text" required minLength={6} value={form.password}
                                            onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Min 6 characters — share with the client" />
                                    </div>
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label className="form-label">Phone / WhatsApp</label>
                                            <input className="form-input" value={form.phone}
                                                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+91 9876543210" />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Email</label>
                                            <input className="form-input" type="email" value={form.email}
                                                onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="contact@acme.com" />
                                        </div>
                                    </div>
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label className="form-label">Business Name</label>
                                            <input className="form-input" value={form.businessName}
                                                onChange={e => setForm(f => ({ ...f, businessName: e.target.value }))} placeholder="Registered / brand name" />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Business Category</label>
                                            <input className="form-input" value={form.businessCategory}
                                                onChange={e => setForm(f => ({ ...f, businessCategory: e.target.value }))} placeholder="e.g. IT Services, Reseller" />
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Website</label>
                                        <input className="form-input" value={form.website}
                                            onChange={e => setForm(f => ({ ...f, website: e.target.value }))} placeholder="https://example.com" />
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label" style={{ marginBottom: 8 }}>Allowed License Types * </label>
                                        <ModeCheckboxes value={form.allowedModes} onChange={toggleFormMode} />
                                        <span style={{ fontSize: 11, color: '#3a4560' }}>Which license types this client can generate — enforced live on their account.</span>
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label">License Limit *</label>
                                        <input className="form-input" type="number" min={1} max={999999} required value={form.licenseLimit}
                                            onChange={e => setForm(f => ({ ...f, licenseLimit: e.target.value }))} placeholder="e.g. 50" />
                                        <span style={{ fontSize: 11, color: '#3a4560' }}>
                                            Maximum licenses the client can generate in total. Trial→paid conversions don't consume extra slots; deleted licenses free their slot back.
                                        </span>
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label">Notes</label>
                                        <textarea className="form-textarea" value={form.notes}
                                            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                                            placeholder="Internal notes about this client" style={{ minHeight: 56 }} />
                                    </div>

                                    {err && <div className="form-error">{err}</div>}
                                </div>
                                <div className="modal-footer">
                                    <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)} disabled={busy}>Cancel</button>
                                    <button type="submit" className="btn btn-primary" disabled={busy}>
                                        {busy ? 'Creating…' : 'Create Client'}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {/* ── Edit Modal ───────────────────────────────────────────── */}
            {editTarget && editForm && (
                <div className="modal-overlay">
                    <div className="modal" style={{ maxWidth: 580 }}>
                        <div className="modal-header">
                            <span className="modal-title">✎ Edit — {editTarget.name}</span>
                            <button className="modal-close" onClick={() => setEditTarget(null)} disabled={editBusy}>×</button>
                        </div>
                        <form onSubmit={saveEdit}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Username (login)</label>
                                    <input className="form-input" value={editTarget.username} disabled style={{ opacity: .6 }} />
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Client / Business Name *</label>
                                        <input className="form-input" required value={editForm.name}
                                            onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} autoFocus />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Phone / WhatsApp</label>
                                        <input className="form-input" value={editForm.phone}
                                            onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Email</label>
                                        <input className="form-input" type="email" value={editForm.email}
                                            onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Business Name</label>
                                        <input className="form-input" value={editForm.businessName}
                                            onChange={e => setEditForm(f => ({ ...f, businessName: e.target.value }))} />
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Business Category</label>
                                        <input className="form-input" value={editForm.businessCategory}
                                            onChange={e => setEditForm(f => ({ ...f, businessCategory: e.target.value }))} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Website</label>
                                        <input className="form-input" value={editForm.website}
                                            onChange={e => setEditForm(f => ({ ...f, website: e.target.value }))} />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="form-label" style={{ marginBottom: 8 }}>Allowed License Types *</label>
                                    <ModeCheckboxes value={editForm.allowedModes} onChange={toggleEditMode} />
                                </div>

                                <div className="form-group">
                                    <label className="form-label">License Limit *</label>
                                    <input className="form-input" type="number" min={1} max={999999} required value={editForm.licenseLimit}
                                        onChange={e => setEditForm(f => ({ ...f, licenseLimit: e.target.value }))} />
                                    <span style={{ fontSize: 11, color: '#3a4560' }}>
                                        Currently used: {editTarget.usedLicenses ?? 0} licenses. Raising or lowering the limit and changing allowed types applies to the client's panel immediately — no re-login needed.
                                    </span>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Notes</label>
                                    <textarea className="form-textarea" value={editForm.notes}
                                        onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                                        style={{ minHeight: 56 }} />
                                </div>

                                {editSaved && <div style={{ background: 'rgba(34,197,94,.1)', border: '1px solid rgba(34,197,94,.3)', borderRadius: 7, padding: '8px 12px', color: '#22c55e', fontSize: 13 }}>✓ Saved — live on the client's account.</div>}
                                {editErr && <div className="form-error">{editErr}</div>}
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-ghost" onClick={() => setEditTarget(null)} disabled={editBusy}>Close</button>
                                <button type="submit" className="btn btn-primary" disabled={editBusy}>
                                    {editBusy ? 'Saving…' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Reset Password Modal ─────────────────────────────────── */}
            {pwTarget && (
                <div className="modal-overlay">
                    <div className="modal" style={{ maxWidth: 420 }}>
                        <div className="modal-header">
                            <span className="modal-title">🔑 Reset Password — {pwTarget.name}</span>
                            <button className="modal-close" onClick={() => setPwTarget(null)} disabled={pwBusy}>×</button>
                        </div>
                        <form onSubmit={changePw}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">New Password *</label>
                                    <input className="form-input" type="text" required minLength={6} value={newPw}
                                        onChange={e => setNewPw(e.target.value)} placeholder="Min 6 characters" autoFocus />
                                    <span style={{ fontSize: 11, color: '#3a4560' }}>Takes effect on their next login. Active sessions keep working until their token expires.</span>
                                </div>
                                {pwErr && <div className="form-error">{pwErr}</div>}
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-ghost" onClick={() => setPwTarget(null)} disabled={pwBusy}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={pwBusy}>
                                    {pwBusy ? 'Saving…' : 'Reset Password'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Client Licenses Modal ────────────────────────────────── */}
            {viewTarget && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setViewTarget(null)}>
                    <div className="modal" style={{ maxWidth: 900 }}>
                        <div className="modal-header">
                            <span className="modal-title">Licenses issued by {viewTarget.name}</span>
                            <button className="modal-close" onClick={() => setViewTarget(null)}>×</button>
                        </div>
                        <div className="modal-body">
                            {viewData ? (
                                <>
                                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
                                        <div style={{ background: '#161c2d', border: '1px solid #252d42', borderRadius: 8, padding: '8px 16px' }}>
                                            <div style={{ fontSize: 10.5, color: '#4a5980', fontWeight: 600 }}>QUOTA USED</div>
                                            <div style={{ fontSize: 18, fontWeight: 800, color: '#a78bfa' }}>
                                                {viewData.usage.used} / {viewData.usage.limit}
                                            </div>
                                        </div>
                                        <div style={{ background: '#161c2d', border: '1px solid #252d42', borderRadius: 8, padding: '8px 16px' }}>
                                            <div style={{ fontSize: 10.5, color: '#4a5980', fontWeight: 600 }}>REMAINING</div>
                                            <div style={{ fontSize: 18, fontWeight: 800, color: viewData.usage.remaining > 0 ? '#22c55e' : '#ef4444' }}>
                                                {viewData.usage.remaining}
                                            </div>
                                        </div>
                                        <div style={{ background: '#161c2d', border: '1px solid #252d42', borderRadius: 8, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
                                            {(viewData.whitelabel.allowedModes || []).map(m => <ModeBadge key={m} mode={m} />)}
                                        </div>
                                    </div>
                                    {viewData.licenses.length === 0 ? (
                                        <div className="empty">This client hasn't generated any licenses yet.</div>
                                    ) : (
                                        <div className="table-wrap">
                                            <table>
                                                <thead>
                                                    <tr>
                                                        <th>#</th>
                                                        <th>Client</th>
                                                        <th>Key</th>
                                                        <th>Type</th>
                                                        <th>Plan</th>
                                                        <th>Price</th>
                                                        <th>Status</th>
                                                        <th>Issued</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {viewData.licenses.map((l, i) => {
                                                        const expired = !l.isLifetime && (l.expiryTs || 0) <= Math.floor(Date.now() / 1000);
                                                        return (
                                                            <tr key={l.key}>
                                                                <td style={{ color: '#3a4560', fontSize: 12 }}>{i + 1}</td>
                                                                <td>
                                                                    <div className="bold">{l.clientName}</div>
                                                                    {l.clientPhone && <div className="dim">{l.clientPhone}</div>}
                                                                </td>
                                                                <td><span className="mono" style={{ fontSize: 10 }}>{l.key}</span></td>
                                                                <td><ModeBadge mode={l.licenseMode || 'desktop'} /></td>
                                                                <td><span className={`badge badge-plan-${l.plan}`}>{l.plan}</span></td>
                                                                <td style={{ fontWeight: 700, color: (l.discountedPrice ?? l.price) > 0 ? '#22c55e' : '#3a4560' }}>
                                                                    {(l.discountedPrice ?? l.price) > 0 ? `₹${l.discountedPrice ?? l.price}` : '—'}
                                                                </td>
                                                                <td>
                                                                    {l.revoked   && <span className="badge badge-revoked">Revoked</span>}
                                                                    {!l.revoked && expired && <span className="badge badge-expired">Expired</span>}
                                                                    {!l.revoked && !expired && <span className="badge badge-active">Active</span>}
                                                                </td>
                                                                <td>{fmtDate(l.issuedAt)}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </>
                            ) : licsLoading ? (
                                <div className="empty">Loading licenses…</div>
                            ) : (
                                <div className="empty">Failed to load licenses.</div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setViewTarget(null)}>Close</button>
                            <button className="btn btn-primary" onClick={() => { setViewTarget(null); openEdit(viewTarget); }}>✎ Edit Client</button>
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
