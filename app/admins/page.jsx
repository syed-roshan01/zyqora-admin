'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import { apiFetch } from '@/lib/apiFetch';

const DEFAULT_FORM = { username: '', password: '', role: 'admin' };

function fmtDate(ts) {
    if (!ts) return '—';
    return new Date(ts * 1000).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getDaysLeft(l) {
    if (l.isLifetime) return null;
    return Math.floor((l.expiryTs - Math.floor(Date.now() / 1000)) / 86400);
}

export default function AdminsPage() {
    const router   = useRouter();
    const [user,    setUser]    = useState(null);
    const [admins,  setAdmins]  = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [form,    setForm]    = useState(DEFAULT_FORM);
    const [busy,    setBusy]    = useState(false);
    const [err,     setErr]     = useState('');
    const [togBusy, setTogBusy] = useState('');
    const [viewAdmin,  setViewAdmin]  = useState(null); // { id, username, role }
    const [adminLics,  setAdminLics]  = useState([]);
    const [licsLoading,setLicsLoading]= useState(false);
    const [copiedKey,  setCopiedKey]  = useState('');
    const [revModal,   setRevModal]   = useState(null); // { key, clientName }
    const [revReason,  setRevReason]  = useState('');
    const [revBusy,    setRevBusy]    = useState(false);
    const [delModal,   setDelModal]   = useState(null); // { key, clientName }
    const [delBusy,    setDelBusy]    = useState(false);
    const [pwModal,    setPwModal]    = useState(null); // { id, username }
    const [newPw,      setNewPw]      = useState('');
    const [pwBusy,     setPwBusy]     = useState(false);
    const [pwErr,      setPwErr]      = useState('');

    useEffect(() => {
        const cached = localStorage.getItem('zyqora_admin_user');
        if (cached) {
            try {
                const u = JSON.parse(cached);
                setUser(u);
                if (u.role !== 'super') { router.replace('/dashboard'); return; }
            } catch {}
        }
        load();
    }, []);

    const load = async () => {
        setLoading(true);
        const r = await apiFetch('/api/admins/list');
        if (r?.ok) setAdmins(r.data);
        setLoading(false);
    };

    const create = async (e) => {
        e.preventDefault();
        setBusy(true);
        setErr('');
        const r = await apiFetch('/api/admins/create', { method: 'POST', body: form });
        if (!r) return;
        if (!r.ok) { setErr(r.data.error || 'Failed'); setBusy(false); return; }
        setShowCreate(false);
        setForm(DEFAULT_FORM);
        load();
        setBusy(false);
    };

    const toggle = async (id) => {
        setTogBusy(id);
        const r = await apiFetch(`/api/admins/${id}/toggle`, { method: 'POST' });
        if (r?.ok) load();
        setTogBusy('');
    };

    const openLicenses = async (a) => {
        setViewAdmin({ id: a.id, username: a.username, role: a.role });
        setAdminLics([]);
        setLicsLoading(true);
        const r = await apiFetch(`/api/admins/${a.id}/licenses`);
        if (r?.ok) setAdminLics(r.data.licenses || []);
        setLicsLoading(false);
    };

    const copyKey = (key) => {
        navigator.clipboard.writeText(key);
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(''), 1800);
    };

    const revokeFromModal = (l) => { setRevModal({ key: l.key, clientName: l.clientName }); setRevReason(''); };

    const confirmRevoke = async () => {
        setRevBusy(true);
        const r = await apiFetch('/api/licenses/revoke', { method: 'POST', body: { key: revModal.key, reason: revReason } });
        if (r?.ok) {
            setRevModal(null);
            const r2 = await apiFetch(`/api/admins/${viewAdmin.id}/licenses`);
            if (r2?.ok) setAdminLics(r2.data.licenses || []);
        }
        setRevBusy(false);
    };

    const deleteFromModal = (l) => setDelModal({ key: l.key, clientName: l.clientName });

    const confirmDelete = async () => {
        setDelBusy(true);
        const r = await apiFetch('/api/licenses/delete', { method: 'POST', body: { key: delModal.key } });
        if (r?.ok) {
            setDelModal(null);
            const r2 = await apiFetch(`/api/admins/${viewAdmin.id}/licenses`);
            if (r2?.ok) setAdminLics(r2.data.licenses || []);
            load(); // refresh admin list to update license count
        }
        setDelBusy(false);
    };

    const changePassword = async (e) => {
        e.preventDefault();
        setPwBusy(true);
        setPwErr('');
        const r = await apiFetch(`/api/admins/${pwModal.id}/change-password`, { method: 'POST', body: { password: newPw } });
        if (!r) { setPwBusy(false); return; }
        if (!r.ok) { setPwErr(r.data?.error || 'Failed'); setPwBusy(false); return; }
        setPwModal(null);
        setNewPw('');
        setPwBusy(false);
    };

    return (
        <AppLayout>
            <div className="page">
                <div className="page-header">
                    <div>
                        <div className="page-title">Admins</div>
                        <div className="page-subtitle">{admins.length} admin accounts</div>
                    </div>
                    <button className="btn btn-primary" onClick={() => { setShowCreate(true); setForm(DEFAULT_FORM); setErr(''); }}>
                        + Create Admin
                    </button>
                </div>

                <div className="page-body">
                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>Username</th>
                                    <th>Role</th>
                                    <th>Created By</th>
                                    <th>Created At</th>
                                    <th>Licenses Issued</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={7} className="empty">Loading…</td></tr>
                                ) : admins.length === 0 ? (
                                    <tr><td colSpan={7} className="empty">No admins yet</td></tr>
                                ) : admins.map(a => (
                                    <tr key={a.id}>
                                        <td>
                                            <span className="bold">{a.username}</span>
                                            {a.id === user?.id && <span style={{ marginLeft: 6, fontSize: 10, color: '#4a5980' }}>(you)</span>}
                                        </td>
                                        <td>
                                            <span className={`badge ${a.role === 'super' ? 'badge-super' : 'badge-admin'}`}>
                                                {a.role}
                                            </span>
                                        </td>
                                        <td>{a.createdByName || <span style={{ color: '#3a4560' }}>system</span>}</td>
                                        <td>{fmtDate(a.createdAt)}</td>
                                        <td style={{ textAlign: 'center' }}>
                                            <span style={{ fontWeight: 700, color: '#e2e8f0' }}>{a.licenseCount ?? 0}</span>
                                        </td>
                                        <td>
                                            <span className={`badge ${a.active ? 'badge-active' : 'badge-revoked'}`}>
                                                {a.active ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 6 }}>
                                                <button
                                                    className="btn btn-ghost btn-sm"
                                                    onClick={() => openLicenses(a)}
                                                >
                                                    View Licenses
                                                </button>
                                                <button
                                                    className="btn btn-ghost btn-sm"
                                                    onClick={() => { setPwModal({ id: a.id, username: a.username }); setNewPw(''); setPwErr(''); }}
                                                >
                                                    Change Password
                                                </button>
                                                {a.username !== user?.username && (
                                                    <button
                                                        className={`btn btn-sm ${a.active ? 'btn-danger' : 'btn-ghost'}`}
                                                        disabled={togBusy === a.id}
                                                        onClick={() => toggle(a.id)}
                                                    >
                                                        {togBusy === a.id ? '…' : a.active ? 'Deactivate' : 'Activate'}
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* ── View Licenses Modal ────────────────────────────────────── */}
            {viewAdmin && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setViewAdmin(null)}>
                    <div className="modal" style={{ maxWidth: 900, width: '95vw' }}>
                        <div className="modal-header">
                            <div>
                                <span className="modal-title">Licenses issued by </span>
                                <span className="modal-title" style={{ color: '#7c3aed' }}>{viewAdmin.username}</span>
                                <span style={{ marginLeft: 8, fontSize: 11, color: '#4a5980' }}>({viewAdmin.role})</span>
                            </div>
                            <button className="modal-close" onClick={() => setViewAdmin(null)}>×</button>
                        </div>
                        {!licsLoading && adminLics.length > 0 && (() => {
                            const todayStart = Math.floor(new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime() / 1000);
                            const activeC   = adminLics.filter(l => !l.revoked && (l.isLifetime || getDaysLeft(l) >= 0)).length;
                            const revokedC  = adminLics.filter(l => l.revoked).length;
                            const expiredC  = adminLics.filter(l => !l.revoked && !l.isLifetime && getDaysLeft(l) < 0).length;
                            const todayC    = adminLics.filter(l => (l.issuedAt || 0) >= todayStart).length;
                            return (
                                <div style={{ display: 'flex', borderBottom: '1px solid #1e2640' }}>
                                    {[
                                        { label: 'Total',        value: adminLics.length, color: '#e2e8f0' },
                                        { label: 'Active',       value: activeC,          color: '#22c55e' },
                                        { label: 'Revoked',      value: revokedC,         color: '#ef4444' },
                                        { label: 'Expired',      value: expiredC,         color: '#64748b' },
                                        { label: 'Issued Today', value: todayC,           color: '#f59e0b' },
                                    ].map(s => (
                                        <div key={s.label} style={{ flex: 1, padding: '10px 0', borderRight: '1px solid #1e2640', textAlign: 'center' }}>
                                            <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
                                            <div style={{ fontSize: 10, color: '#4a5980', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px' }}>{s.label}</div>
                                        </div>
                                    ))}
                                </div>
                            );
                        })()}
                        <div className="modal-body" style={{ padding: 0, maxHeight: '70vh', overflowY: 'auto' }}>
                            {licsLoading ? (
                                <div style={{ padding: '32px', textAlign: 'center', color: '#3a4560' }}>Loading…</div>
                            ) : adminLics.length === 0 ? (
                                <div style={{ padding: '32px', textAlign: 'center', color: '#3a4560' }}>No licenses issued by this admin yet.</div>
                            ) : (
                                <div className="table-wrap" style={{ margin: 0, borderRadius: 0 }}>
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>#</th>
                                                <th>Client</th>
                                                <th>Key</th>
                                                <th>Plan</th>
                                                <th>Devices</th>
                                                <th>Machine ID</th>
                                                <th>Expiry / Days Left</th>
                                                <th>Issued At</th>
                                                <th>Status</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {adminLics.map((l, i) => {
                                                const days = getDaysLeft(l);
                                                const isExpired = !l.isLifetime && days !== null && days < 0;
                                                return (
                                                    <tr key={l.key}>
                                                        <td style={{ color: '#4a5980', fontSize: 12 }}>{i + 1}</td>
                                                        <td>
                                                            <div className="bold">{l.clientName}</div>
                                                            {l.clientPhone && <div className="dim">{l.clientPhone}</div>}
                                                        </td>
                                                        <td>
                                                            <span
                                                                className="mono copy-key"
                                                                title="Click to copy"
                                                                onClick={() => copyKey(l.key)}
                                                                style={{ cursor: 'pointer' }}
                                                            >
                                                                {copiedKey === l.key ? '✓ Copied!' : l.key.slice(0, 23) + '…'}
                                                            </span>
                                                        </td>
                                                        <td><span className={`badge badge-plan-${l.plan}`}>{l.plan}</span></td>
                                                        <td style={{ textAlign: 'center' }}>{l.deviceLimit}</td>
                                                        <td>
                                                            {l.machineId
                                                                ? <span className="mono" style={{ fontSize: 11, color: '#4a9eff' }}>{l.machineId.slice(0, 16)}{l.machineId.length > 16 ? '…' : ''}</span>
                                                                : <span style={{ color: '#3a4560' }}>—</span>}
                                                        </td>
                                                        <td>
                                                            {l.isLifetime ? (
                                                                <span style={{ color: '#a78bfa', fontWeight: 600 }}>Lifetime</span>
                                                            ) : (
                                                                <>
                                                                    <div>{fmtDate(l.expiryTs)}</div>
                                                                    <div className="dim" style={{ color: days !== null && days < 7 && days >= 0 ? '#f59e0b' : '' }}>
                                                                        {days !== null && days >= 0 ? `${days}d left` : days !== null ? 'Expired' : ''}
                                                                    </div>
                                                                </>
                                                            )}
                                                        </td>
                                                        <td>{fmtDate(l.issuedAt)}</td>
                                                        <td>
                                                            {l.revoked   && <span className="badge badge-revoked">Revoked</span>}
                                                            {!l.revoked && isExpired && <span className="badge badge-expired">Expired</span>}
                                                            {!l.revoked && !isExpired && <span className="badge badge-active">Active</span>}
                                                        </td>
                                                        <td>
                                                            {!l.revoked && (
                                                                <button
                                                                    className="btn btn-danger btn-sm"
                                                                    onClick={() => revokeFromModal(l)}
                                                                >
                                                                    Revoke
                                                                </button>
                                                            )}
                                                            <button
                                                                className="btn btn-ghost btn-sm"
                                                                style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,.3)', marginLeft: l.revoked ? 0 : 6 }}
                                                                onClick={() => deleteFromModal(l)}
                                                            >
                                                                Delete
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
                            <span style={{ color: '#4a5980', fontSize: 12 }}>
                                {adminLics.length} license{adminLics.length !== 1 ? 's' : ''} issued
                            </span>
                            <button className="btn btn-ghost" onClick={() => setViewAdmin(null)}>Close</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Change Password Modal ──────────────────────────────────── */}
            {pwModal && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && !pwBusy && setPwModal(null)}>
                    <div className="modal" style={{ maxWidth: 420 }}>
                        <div className="modal-header">
                            <span className="modal-title">Change Password</span>
                            <button className="modal-close" onClick={() => setPwModal(null)} disabled={pwBusy}>×</button>
                        </div>
                        <form onSubmit={changePassword}>
                            <div className="modal-body">
                                <p style={{ color: '#94a3b8', fontSize: 13 }}>
                                    Set a new password for <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{pwModal.username}</span>.
                                </p>
                                <div className="form-group">
                                    <label className="form-label">New Password *</label>
                                    <input
                                        type="password"
                                        className="form-input"
                                        required
                                        minLength={6}
                                        placeholder="Min. 6 characters"
                                        value={newPw}
                                        onChange={e => setNewPw(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                                {pwErr && <div className="form-error">{pwErr}</div>}
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-ghost" onClick={() => setPwModal(null)} disabled={pwBusy}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={pwBusy}>
                                    {pwBusy ? 'Saving…' : 'Update Password'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Delete Confirmation (from Admin modal) ───────────────── */}
            {delModal && (
                <div className="modal-overlay" style={{ zIndex: 200 }} onClick={e => e.target === e.currentTarget && !delBusy && setDelModal(null)}>
                    <div className="modal" style={{ maxWidth: 420 }}>
                        <div className="modal-header">
                            <span className="modal-title">Delete License</span>
                            <button className="modal-close" onClick={() => setDelModal(null)} disabled={delBusy}>×</button>
                        </div>
                        <div className="modal-body">
                            <p style={{ color: '#94a3b8', fontSize: 13 }}>
                                Permanently delete license for <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{delModal.clientName}</span>?<br />
                                <span style={{ fontSize: 12, color: '#ef4444' }}>This removes the record entirely and cannot be undone.</span>
                            </p>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setDelModal(null)} disabled={delBusy}>Cancel</button>
                            <button className="btn btn-danger" onClick={confirmDelete} disabled={delBusy}>
                                {delBusy ? 'Deleting…' : 'Delete Permanently'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Revoke Confirmation (from Admin modal) ────────────────── */}
            {revModal && (
                <div className="modal-overlay" style={{ zIndex: 200 }} onClick={e => e.target === e.currentTarget && !revBusy && setRevModal(null)}>
                    <div className="modal" style={{ maxWidth: 420 }}>
                        <div className="modal-header">
                            <span className="modal-title">Revoke License</span>
                            <button className="modal-close" onClick={() => setRevModal(null)} disabled={revBusy}>×</button>
                        </div>
                        <div className="modal-body">
                            <p style={{ color: '#94a3b8', fontSize: 13 }}>
                                Revoke license for <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{revModal.clientName}</span>?<br />
                                <span style={{ fontSize: 12, color: '#4a5980' }}>This cannot be undone.</span>
                            </p>
                            <div className="form-group">
                                <label className="form-label">Reason (optional)</label>
                                <input
                                    className="form-input"
                                    placeholder="e.g. payment dispute"
                                    value={revReason}
                                    onChange={e => setRevReason(e.target.value)}
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setRevModal(null)} disabled={revBusy}>Cancel</button>
                            <button className="btn btn-danger" onClick={confirmRevoke} disabled={revBusy}>
                                {revBusy ? 'Revoking…' : 'Revoke License'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Create Admin Modal ─────────────────────────────────────── */}
            {showCreate && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowCreate(false)}>
                    <div className="modal" style={{ maxWidth: 420 }}>
                        <div className="modal-header">
                            <span className="modal-title">Create Admin</span>
                            <button className="modal-close" onClick={() => setShowCreate(false)}>×</button>
                        </div>
                        <form onSubmit={create}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Username *</label>
                                    <input className="form-input" required value={form.username}
                                        onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                                        placeholder="e.g. reseller1" autoFocus />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Password *</label>
                                    <input type="password" className="form-input" required value={form.password}
                                        onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                                        placeholder="Strong password" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Role</label>
                                    <select className="form-select" value={form.role}
                                        onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                                        <option value="admin">Admin (can issue licenses only)</option>
                                        <option value="super">Super Admin (full access)</option>
                                    </select>
                                </div>
                                {err && <div className="form-error">{err}</div>}
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={busy}>
                                    {busy ? 'Creating…' : 'Create Admin'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
