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
    const [licenses, setLicenses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [commissionMap, setCommissionMap] = useState({}); // affiliateId → total commission earned
    const [paidMap, setPaidMap] = useState({});             // affiliateId → total paid out
    const [form, setForm] = useState(EMPTY_FORM);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const [showForm, setShowForm] = useState(false);

    // Detail modal
    const [detailAffiliate, setDetailAffiliate] = useState(null);

    // Pay modal
    const [payAffiliate, setPayAffiliate] = useState(null);
    const [payAmount, setPayAmount] = useState('');
    const [payNote, setPayNote] = useState('');
    const [payBusy, setPayBusy] = useState(false);
    const [payErr, setPayErr] = useState('');

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

    // Delete state: { id, step } step: 1=first confirm, 2=second confirm
    const [deleteState, setDeleteState] = useState(null);
    const [deleteBusy, setDeleteBusy] = useState(false);

    useEffect(() => {
        try {
            const u = localStorage.getItem('zyqora_admin_user');
            if (u) {
                const parsed = JSON.parse(u);
                setUser(parsed);
                if (parsed.role !== 'super' && parsed.role !== 'admin') { router.replace('/dashboard'); return; }
            }
        } catch {}
        load();
    }, []);

    const load = async () => {
        setLoading(true);
        const [affRes, licRes, payRes] = await Promise.all([
            apiFetch('/api/affiliates/list'),
            apiFetch('/api/licenses/list'),
            apiFetch('/api/affiliates/payments/list'),
        ]);
        const affs = affRes?.ok ? (affRes.data || []) : [];
        const lics = licRes?.ok ? (licRes.data || []) : [];
        const pays = payRes?.ok ? (payRes.data?.payments || []) : [];
        setAffiliates(affs);
        setLicenses(lics);
        // commission map with dynamic fallback for old licenses
        const pctMap = Object.fromEntries(affs.map(a => [a.id, a.commission || 0]));
        const commMap = {};
        for (const l of lics) {
            if (l.affiliateId && !l.revoked) {
                const stored = parseFloat(l.affiliateCommissionAmount);
                const revenue = parseFloat(l.discountedPrice ?? l.price) || 0;
                const pct = pctMap[l.affiliateId] || 0;
                const amt = (stored > 0) ? stored : (revenue * pct / 100);
                commMap[l.affiliateId] = (commMap[l.affiliateId] || 0) + amt;
            }
        }
        setCommissionMap(commMap);
        // paid map: sum all payments per affiliate
        const pm = {};
        for (const p of pays) {
            pm[p.affiliateId] = (pm[p.affiliateId] || 0) + (parseFloat(p.amount) || 0);
        }
        setPaidMap(pm);
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

    const deleteAffiliate = async () => {
        setDeleteBusy(true);
        const r = await apiFetch(`/api/affiliates/${deleteState.id}/delete`, { method: 'POST' });
        if (r?.ok) {
            setDeleteState(null);
            load();
        }
        setDeleteBusy(false);
    };

    const submitPay = async (e) => {
        e.preventDefault();
        setPayBusy(true);
        setPayErr('');
        const r = await apiFetch(`/api/affiliates/${payAffiliate.id}/pay`, { method: 'POST', body: { amount: payAmount, note: payNote } });
        if (!r?.ok) { setPayErr(r?.data?.error || 'Failed'); setPayBusy(false); return; }
        setPayAffiliate(null);
        setPayAmount('');
        setPayNote('');
        setPayBusy(false);
        load();
    };

    return (
    <>
        <AppLayout>
            <div className="page">
                <div className="page-header">
                    <div>
                        <div className="page-title">Affiliates</div>
                        <div className="page-subtitle">{user?.role === 'super' ? 'Manage affiliate accounts and commissions' : 'View affiliate accounts and commission totals'}</div>
                    </div>
                    {user?.role === 'super' && (
                    <button
                        className={`btn ${showForm ? 'btn-ghost' : 'btn-primary'}`}
                        onClick={() => { setShowForm(v => !v); setErr(''); }}
                    >
                        {showForm ? '✕ Close' : '+ Add Affiliate'}
                    </button>
                    )}
                </div>

                <div className="page-body">
                    {/* Add Affiliate Form */}
                    {showForm && (
                        <div className="card" style={{ marginBottom: 24, borderColor: '#7c3aed44' }}>
                            <div style={{ fontWeight: 700, color: '#e2e8f0', marginBottom: 16, fontSize: 15 }}>New Affiliate</div>
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
                                <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
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
                        <div className="empty">No affiliates yet.{user?.role === 'super' ? ' Add one above.' : ''}</div>
                    ) : (
                    <>
                        {/* Totals row */}
                        {(() => {
                            const totalEarned = affiliates.reduce((s, a) => s + (commissionMap[a.id] || 0), 0);
                            const totalPaid   = affiliates.reduce((s, a) => s + (paidMap[a.id] || 0), 0);
                            const totalBal    = Math.max(0, totalEarned - totalPaid);
                            const fmt = v => '₹' + v.toLocaleString('en-IN', { maximumFractionDigits: 0 });
                            return (
                                <div style={{ display: 'flex', gap: 24, marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid #1e2640', flexWrap: 'wrap' }}>
                                    <div><span style={{ fontSize: 12, color: '#4a5980' }}>Affiliates </span><span style={{ fontWeight: 700, color: '#e2e8f0' }}>{affiliates.length}</span></div>
                                    <div><span style={{ fontSize: 12, color: '#4a5980' }}>Total Earned </span><span style={{ fontWeight: 700, color: '#f59e0b' }}>{fmt(totalEarned)}</span></div>
                                    <div><span style={{ fontSize: 12, color: '#4a5980' }}>Paid Out </span><span style={{ fontWeight: 700, color: '#22c55e' }}>{fmt(totalPaid)}</span></div>
                                    <div><span style={{ fontSize: 12, color: '#4a5980' }}>Balance Owed </span><span style={{ fontWeight: 700, color: totalBal > 0 ? '#ef4444' : '#64748b' }}>{fmt(totalBal)}</span></div>
                                </div>
                            );
                        })()}

                        <div className="table-wrap">
                            <table>
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Name</th>
                                        <th>Username</th>
                                        <th>Commission</th>
                                        <th>Earned</th>
                                        <th>Paid Out</th>
                                        <th>Balance</th>
                                        <th>Status</th>
                                        <th>Joined</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {affiliates.map((a, i) => {
                                        const earned  = commissionMap[a.id] || 0;
                                        const paid    = paidMap[a.id] || 0;
                                        const balance = Math.max(0, earned - paid);
                                        const fmt = v => '₹' + v.toLocaleString('en-IN', { maximumFractionDigits: 0 });
                                        const isDeleting = deleteState?.id === a.id;
                                        return (
                                            <tr key={a.id}>
                                                <td style={{ color: '#3a4560', fontSize: 12 }}>{i + 1}</td>
                                                <td>
                                                    <button style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#e2e8f0', fontWeight: 600, fontSize: 13, textAlign: 'left' }}
                                                        onClick={() => setDetailAffiliate(a)}>
                                                        {a.name}
                                                    </button>
                                                </td>
                                                <td style={{ fontFamily: 'Courier New, monospace', fontSize: 12, color: '#64748b' }}>{a.username}</td>
                                                <td style={{ fontWeight: 600, color: '#22c55e' }}>{a.commission}%</td>
                                                <td style={{ fontWeight: 600, color: '#f59e0b' }}>{fmt(earned)}</td>
                                                <td style={{ fontWeight: 600, color: '#22c55e' }}>{fmt(paid)}</td>
                                                <td style={{ fontWeight: balance > 0 ? 700 : 400, color: balance > 0 ? '#ef4444' : '#3a4560' }}>{fmt(balance)}</td>
                                                <td>
                                                    <span className={`badge ${a.active ? 'badge-active' : 'badge-revoked'}`}>
                                                        {a.active ? 'Active' : 'Inactive'}
                                                    </span>
                                                </td>
                                                <td style={{ fontSize: 12, color: '#64748b' }}>{fmtDate(a.createdAt)}</td>
                                                <td>
                                                    {isDeleting ? (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                            {deleteState.step === 1 ? (
                                                            <>
                                                                <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600 }}>Sure?</span>
                                                                <button className="btn btn-sm btn-ghost" style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,.3)' }}
                                                                    onClick={() => setDeleteState({ id: a.id, step: 2 })}>Yes</button>
                                                                <button className="btn btn-sm btn-ghost" onClick={() => setDeleteState(null)}>No</button>
                                                            </>
                                                            ) : (
                                                            <>
                                                                <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 700 }}>Permanent!</span>
                                                                <button className="btn btn-sm btn-ghost" style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,.3)' }}
                                                                    onClick={deleteAffiliate} disabled={deleteBusy}>{deleteBusy ? '…' : 'Confirm'}</button>
                                                                <button className="btn btn-sm btn-ghost" onClick={() => setDeleteState(null)} disabled={deleteBusy}>Cancel</button>
                                                            </>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div style={{ display: 'flex', gap: 6 }}>
                                                            <button className="btn btn-sm btn-ghost" style={{ color: '#22c55e', borderColor: 'rgba(34,197,94,.3)' }}
                                                                onClick={() => { setPayAffiliate(a); setPayAmount(''); setPayNote(''); setPayErr(''); }}>
                                                                Pay
                                                            </button>
                                                            {user?.role === 'super' && (
                                                            <>
                                                                <button className="btn btn-sm btn-ghost"
                                                                    onClick={() => { setCommAffiliate(a); setNewComm(String(a.commission)); setCommErr(''); }}>
                                                                    Edit %
                                                                </button>
                                                                <button className="btn btn-sm btn-ghost"
                                                                    onClick={() => { setPwAffiliate(a); setNewPw(''); setPwErr(''); }}>
                                                                    Change Pw
                                                                </button>
                                                                <button className="btn btn-sm btn-ghost"
                                                                    style={{ color: a.active ? '#ef4444' : '#22c55e', borderColor: a.active ? 'rgba(239,68,68,.3)' : 'rgba(34,197,94,.3)' }}
                                                                    onClick={() => toggleAffiliate(a.id)}>
                                                                    {a.active ? 'Deactivate' : 'Activate'}
                                                                </button>
                                                                <button className="btn btn-sm btn-ghost" style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,.3)' }}
                                                                    onClick={() => setDeleteState({ id: a.id, step: 1 })}>
                                                                    Delete
                                                                </button>
                                                            </>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </>
                    )}
                </div>
            </div>
        </AppLayout>

        {/* ─── Pay Modal ──────────────────────────────────────────────── */}
        {payAffiliate && (() => {
            const earned  = commissionMap[payAffiliate.id] || 0;
            const paid    = paidMap[payAffiliate.id] || 0;
            const balance = Math.max(0, earned - paid);
            const fmt = v => '₹' + v.toLocaleString('en-IN', { maximumFractionDigits: 2 });
            return (
                <div className="modal-overlay" onClick={() => setPayAffiliate(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
                        <div className="modal-header">
                            <div>
                                <div style={{ fontWeight: 700, fontSize: 16 }}>Pay Affiliate</div>
                                <div style={{ fontSize: 12, color: '#4a5980', marginTop: 2 }}>{payAffiliate.name} · @{payAffiliate.username}</div>
                            </div>
                            <button className="btn btn-ghost btn-sm" onClick={() => setPayAffiliate(null)}>✕</button>
                        </div>
                        <form onSubmit={submitPay}>
                            <div className="modal-body">
                                {/* summary mini-cards */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                                    {[['Total Earned', fmt(earned), '#f59e0b'],
                                      ['Paid Out', fmt(paid), '#22c55e'],
                                      ['Balance Owed', fmt(balance), balance > 0 ? '#ef4444' : '#3a4560']].map(([l, v, c]) => (
                                        <div key={l} style={{ background: '#0a0d14', border: `1px solid ${c === '#ef4444' && balance > 0 ? 'rgba(239,68,68,.2)' : '#1a2035'}`, borderRadius: 10, padding: '12px', textAlign: 'center' }}>
                                            <div style={{ fontSize: 10, color: '#4a5980', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 6 }}>{l}</div>
                                            <div style={{ fontWeight: 800, color: c, fontSize: 16 }}>{v}</div>
                                        </div>
                                    ))}
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Amount to Pay (₹) *</label>
                                    <input className="form-input" type="number" min="1" step="0.01" required
                                        value={payAmount} onChange={e => setPayAmount(e.target.value)}
                                        placeholder={`e.g. ${balance > 0 ? Math.round(balance) : '500'}`}
                                        style={{ fontSize: 18, fontWeight: 700 }} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Note (optional)</label>
                                    <input className="form-input" value={payNote}
                                        onChange={e => setPayNote(e.target.value)}
                                        placeholder="e.g. Bank transfer, UPI, cheque…" />
                                </div>
                                {payErr && <div className="form-error">{payErr}</div>}
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-ghost" onClick={() => setPayAffiliate(null)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={payBusy}>
                                    {payBusy ? 'Processing…' : 'Confirm Payment'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            );
        })()}

        {/* ─── Change Password Modal ───────────────────────────────────── */}
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

        {/* ─── Affiliate Detail Modal ─────────────────────────────────── */}
        {detailAffiliate && (() => {
            const now = Math.floor(Date.now() / 1000);
            const aLics = licenses.filter(l => l.affiliateId === detailAffiliate.id && !l.revoked);
            const pct = detailAffiliate.commission || 0;
            const totalClients = aLics.length;
            const demoClients = aLics.filter(l => l.plan === 'trial' || l.plan === 'trial1day' || (parseFloat(l.discountedPrice ?? l.price) || 0) === 0).length;
            const convertedClients = aLics.filter(l => l.plan !== 'trial' && l.plan !== 'trial1day' && (parseFloat(l.discountedPrice ?? l.price) || 0) > 0).length;
            const totalRevenue = aLics.filter(l => l.plan !== 'trial' && l.plan !== 'trial1day').reduce((s, l) => s + (parseFloat(l.discountedPrice ?? l.price) || 0), 0);
            const commAmt  = commissionMap[detailAffiliate.id] || 0;
            const paidAmt  = paidMap[detailAffiliate.id] || 0;
            const balAmt   = Math.max(0, commAmt - paidAmt);
            const initial  = (detailAffiliate.name || 'A')[0].toUpperCase();
            return (
                <div className="modal-overlay" onClick={() => setDetailAffiliate(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 700, maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>
                        {/* Header with avatar */}
                        <div className="modal-header" style={{ gap: 14 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'linear-gradient(135deg, #7c3aed44, #7c3aed22)', border: '2px solid #7c3aed55', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, fontWeight: 800, color: '#a78bfa', flexShrink: 0 }}>
                                    {initial}
                                </div>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: 16 }}>{detailAffiliate.name}</div>
                                    <div style={{ fontSize: 12, color: '#4a5980', marginTop: 1 }}>
                                        @{detailAffiliate.username}
                                        <span style={{ marginLeft: 10, color: '#22c55e', fontWeight: 600 }}>{pct}% commission</span>
                                        <span style={{ marginLeft: 10 }}><span className={`badge ${detailAffiliate.active ? 'badge-active' : 'badge-revoked'}`}>{detailAffiliate.active ? 'Active' : 'Inactive'}</span></span>
                                    </div>
                                </div>
                            </div>
                            <button className="btn btn-ghost btn-sm" onClick={() => setDetailAffiliate(null)}>✕</button>
                        </div>
                        <div className="modal-body" style={{ overflowY: 'auto', gap: 14 }}>
                            {/* 4 count stats */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                                {[['Total Clients', totalClients, '#a78bfa'], ['Demo / Trial', demoClients, '#f59e0b'], ['Converted', convertedClients, '#22c55e'], ['Revenue', '₹' + totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 }), '#22c55e']].map(([label, val, color]) => (
                                    <div key={label} style={{ background: '#0a0d14', border: '1px solid #1a2035', borderRadius: 10, padding: '12px 14px' }}>
                                        <div style={{ fontSize: 10, color: '#4a5980', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 6 }}>{label}</div>
                                        <div style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1 }}>{val}</div>
                                    </div>
                                ))}
                            </div>
                            {/* Commission financials */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                                {[['Commission Earned', '₹' + commAmt.toLocaleString('en-IN', { maximumFractionDigits: 2 }), '#f59e0b'],
                                  ['Paid Out', '₹' + paidAmt.toLocaleString('en-IN', { maximumFractionDigits: 2 }), '#22c55e'],
                                  ['Balance Owed', '₹' + balAmt.toLocaleString('en-IN', { maximumFractionDigits: 2 }), balAmt > 0 ? '#ef4444' : '#3a4560']].map(([label, val, color]) => (
                                    <div key={label} style={{ background: '#0a0d14', border: `1px solid ${color === '#ef4444' && balAmt > 0 ? 'rgba(239,68,68,.2)' : '#1a2035'}`, borderRadius: 10, padding: '12px 14px' }}>
                                        <div style={{ fontSize: 10, color: '#4a5980', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 6 }}>{label}</div>
                                        <div style={{ fontSize: 20, fontWeight: 800, color, lineHeight: 1 }}>{val}</div>
                                    </div>
                                ))}
                            </div>
                            {/* License list */}
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', marginBottom: 4 }}>
                                Licenses ({aLics.length})
                            </div>
                            {aLics.length === 0 ? (
                                <div style={{ color: '#4a5980', textAlign: 'center', padding: '24px 0', fontSize: 13 }}>No active licenses under this affiliate.</div>
                            ) : (
                                <div className="table-wrap" style={{ maxHeight: 280, overflowY: 'auto' }}>
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>#</th>
                                                <th>Client</th>
                                                <th>Plan</th>
                                                <th>Price</th>
                                                <th>Commission</th>
                                                <th>Status</th>
                                                <th>Issued</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {aLics.map((l, idx) => {
                                                const price = parseFloat(l.discountedPrice ?? l.price) || 0;
                                                const stored = parseFloat(l.affiliateCommissionAmount);
                                                const comm = (stored > 0) ? stored : (price * pct / 100);
                                                const isExpired = !l.isLifetime && (l.expiryTs || 0) <= now;
                                                return (
                                                    <tr key={l.key}>
                                                        <td style={{ color: '#3a4560', fontSize: 12 }}>{idx + 1}</td>
                                                        <td>
                                                            <div style={{ fontWeight: 600, fontSize: 13 }}>{l.clientName}</div>
                                                            {l.clientPhone && <div style={{ fontSize: 11, color: '#64748b' }}>{l.clientPhone}</div>}
                                                        </td>
                                                        <td style={{ textTransform: 'capitalize', fontSize: 12 }}>{l.plan}</td>
                                                        <td style={{ color: price > 0 ? '#22c55e' : '#64748b', fontWeight: 600 }}>₹{price.toLocaleString('en-IN')}</td>
                                                        <td style={{ color: '#f59e0b', fontWeight: 600 }}>₹{comm.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                                                        <td><span style={{ color: isExpired ? '#64748b' : '#22c55e', fontSize: 12, fontWeight: 600 }}>{isExpired ? 'Expired' : 'Active'}</span></td>
                                                        <td style={{ fontSize: 11, color: '#64748b' }}>{fmtDate(l.issuedAt)}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" style={{ color: '#22c55e', borderColor: 'rgba(34,197,94,.3)' }}
                                onClick={() => { setDetailAffiliate(null); setPayAffiliate(detailAffiliate); setPayAmount(''); setPayNote(''); setPayErr(''); }}>
                                ₹ Pay Now
                            </button>
                            <button className="btn btn-ghost" onClick={() => setDetailAffiliate(null)}>Close</button>
                        </div>
                    </div>
                </div>
            );
        })()}
    </>
    );
}
