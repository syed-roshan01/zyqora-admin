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
                                            {a.username !== user?.username && (
                                                <button
                                                    className={`btn btn-sm ${a.active ? 'btn-danger' : 'btn-ghost'}`}
                                                    disabled={togBusy === a.id}
                                                    onClick={() => toggle(a.id)}
                                                >
                                                    {togBusy === a.id ? '…' : a.active ? 'Deactivate' : 'Activate'}
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

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
