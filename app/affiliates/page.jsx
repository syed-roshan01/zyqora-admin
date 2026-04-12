'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import { apiFetch } from '@/lib/apiFetch';

function fmtDate(ts) {
    if (!ts) return '—';
    return new Date(ts * 1000).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const EMPTY_FORM = { username: '', name: '', password: '', commission: '' };

export default function AffiliatesPage() {
    const router = useRouter();
    const [user, setUser] = useState(null);
    const [affiliates, setAffiliates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState(EMPTY_FORM);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const [showForm, setShowForm] = useState(false);

    // Change password modal
    const [pwAffiliate, setPwAffiliate] = useState(null);
    const [newPw, setNewPw] = useState('');
    const [pwBusy, setPwBusy] = useState(false);
    const [pwErr, setPwErr] = useState('');

    // Edit commission modal
    const [commAffiliate, setCommAffiliate] = useState(null);
    const [newComm, setNewComm] = useState('');
    const [commBusy, setCommBusy] = useState(false);
    const [commErr, setCommErr] = useState('');

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
        const r = await apiFetch('/api/affiliates/list');
        if (r?.ok) setAffiliates(r.data || []);
        setLoading(false);
    };

    const createAffiliate = async (e) => {
        e.preventDefault();
        setBusy(true);
        setErr('');
        const r = await apiFetch('/api/affiliates/create', { method: 'POST', body: form });
        if (!r?.ok) { setErr(r?.data?.error || 'Failed to create affiliate'); setBusy(false); return; }
        setForm(EMPTY_FORM);
        setShowForm(false);
        setBusy(false);
        load();
    };

    const toggleAffiliate = async (id) => {
        await apiFetch(`/api/affiliates/${id}/toggle`, { method: 'POST' });
        load();
    };

    const changePassword = async (e) => {
        e.preventDefault();
        setPwBusy(true);
        setPwErr('');
        const r = await apiFetch(`/api/affiliates/${pwAffiliate.id}/change-password`, { method: 'POST', body: { password: newPw } });
        if (!r?.ok) { setPwErr(r?.data?.error || 'Failed'); setPwBusy(false); return; }
        setPwAffiliate(null);
        setNewPw('');
        setPwBusy(false);
    };

    const updateCommission = async (e) => {
        e.preventDefault();
        setCommBusy(true);
        setCommErr('');
        const r = await apiFetch(`/api/affiliates/${commAffiliate.id}/update-commission`, { method: 'POST', body: { commission: newComm } });
        if (!r?.ok) { setCommErr(r?.data?.error || 'Failed'); setCommBusy(false); return; }
        setCommAffiliate(null);
        setNewComm('');
        setCommBusy(false);
        load();
    };

    return (
    <>
        <AppLayout>
            <div className="page">
                <div className="page-header">
                    <div>
                        <div className="page-title">Affiliates</div>
                        <div className="page-subtitle">Manage affiliate accounts and commissions</div>
                    </div>
                    <button
                        className={`btn ${showForm ? 'btn-ghost' : 'btn-primary'}`}
                        onClick={() => { setShowForm(v => !v); setErr(''); }}
                    >
                        {showForm ? 'Close' : '+ Add Affiliate'}
                    </button>
                </div>

                <div className="page-body">
                    {showForm && (
                        <div className="card" style={{ marginBottom: 20 }}>
                            <div style={{ fontWeight: 700, color: '#e2e8f0', marginBottom: 14 }}>New Affiliate</div>
                            <form onSubmit={createAffiliate}>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Display Name *</label>
                                        <input className="form-input" required value={form.name}
                                            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                            placeholder="e.g. Rahul Meta Ads" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Username (login) *</label>
                                        <input className="form-input" required value={form.username}
                                            onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                                            placeholder="e.g. rahul_ads" />
                                    </div>
                                </div>
                                <div className="form-row" style={{ marginTop: 12 }}>
                                    <div className="form-group">
                                        <label className="form-label">Password *</label>
                                        <input className="form-input" type="password" required value={form.password}
                                            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                                            placeholder="Min 6 characters" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Commission % *</label>
                                        <input className="form-input" type="number" min="0" max="100" step="0.1" required value={form.commission}
                                            onChange={e => setForm(f => ({ ...f, commission: e.target.value }))}
                                            placeholder="e.g. 15" />
                                    </div>
                                </div>
                                {err && <div className="form-error" style={{ marginTop: 10 }}>{err}</div>}
                                <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
                                    <button className="btn btn-primary" type="submit" disabled={busy}>
                                        {busy ? 'Creating…' : 'Create Affiliate'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {loading ? (
                        <div className="empty">Loading…</div>
                    ) : affiliates.length === 0 ? (
                        <div className="empty">No affiliates yet. Add one above.</div>
                    ) : (
                        <div className="table-wrap">
                            <table>
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Name</th>
                                        <th>Username</th>
                                        <th>Commission</th>
                                        <th>Status</th>
                                        <th>Created</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {affiliates.map((a, i) => (
                                        <tr key={a.id}>
                                            <td style={{ color: '#3a4560', fontSize: 12 }}>{i + 1}</td>
                                            <td style={{ fontWeight: 700 }}>{a.name}</td>
                                            <td style={{ fontFamily: 'Courier New, monospace', fontSize: 12 }}>{a.username}</td>
                                            <td>
                                                <span style={{ color: '#22c55e', fontWeight: 700 }}>{a.commission}%</span>
                                            </td>
                                            <td>
                                                <span className={`badge ${a.active ? 'badge-active' : 'badge-revoked'}`}>
                                                    {a.active ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                            <td style={{ fontSize: 12, color: '#64748b' }}>{fmtDate(a.createdAt)}</td>
                                            <td>
                                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                                    <button className="btn btn-sm btn-ghost"
                                                        onClick={() => { setCommAffiliate(a); setNewComm(String(a.commission)); setCommErr(''); }}>
                                                        Edit %
                                                    </button>
                                                    <button className="btn btn-sm btn-ghost"
                                                        onClick={() => { setPwAffiliate(a); setNewPw(''); setPwErr(''); }}>
                                                        Change Pw
                                                    </button>
                                                    <button
                                                        className="btn btn-sm btn-ghost"
                                                        style={{ color: a.active ? '#ef4444' : '#22c55e', borderColor: a.active ? 'rgba(239,68,68,.3)' : 'rgba(34,197,94,.3)' }}
                                                        onClick={() => toggleAffiliate(a.id)}
                                                    >
                                                        {a.active ? 'Deactivate' : 'Activate'}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </AppLayout>

        {/* Change Password Modal */}
        {pwAffiliate && (
            <div className="modal-overlay" onClick={() => setPwAffiliate(null)}>
                <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
                    <div className="modal-header">
                        <div style={{ fontWeight: 700 }}>Change Password — {pwAffiliate.name}</div>
                        <button className="btn btn-ghost btn-sm" onClick={() => setPwAffiliate(null)}>✕</button>
                    </div>
                    <form onSubmit={changePassword}>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">New Password *</label>
                                <input className="form-input" type="password" required value={newPw}
                                    onChange={e => setNewPw(e.target.value)} placeholder="Min 6 characters" />
                            </div>
                            {pwErr && <div className="form-error" style={{ marginTop: 8 }}>{pwErr}</div>}
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-ghost" onClick={() => setPwAffiliate(null)}>Cancel</button>
                            <button type="submit" className="btn btn-primary" disabled={pwBusy}>
                                {pwBusy ? 'Saving…' : 'Update Password'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )}

        {/* Edit Commission Modal */}
        {commAffiliate && (
            <div className="modal-overlay" onClick={() => setCommAffiliate(null)}>
                <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
                    <div className="modal-header">
                        <div style={{ fontWeight: 700 }}>Edit Commission — {commAffiliate.name}</div>
                        <button className="btn btn-ghost btn-sm" onClick={() => setCommAffiliate(null)}>✕</button>
                    </div>
                    <form onSubmit={updateCommission}>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">Commission %</label>
                                <input className="form-input" type="number" min="0" max="100" step="0.1" required value={newComm}
                                    onChange={e => setNewComm(e.target.value)} />
                            </div>
                            {commErr && <div className="form-error" style={{ marginTop: 8 }}>{commErr}</div>}
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-ghost" onClick={() => setCommAffiliate(null)}>Cancel</button>
                            <button type="submit" className="btn btn-primary" disabled={commBusy}>
                                {commBusy ? 'Saving…' : 'Update'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )}
    </>
    );
}
