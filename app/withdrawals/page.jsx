'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import { apiFetch } from '@/lib/apiFetch';

function fmtMoney(n) {
    return '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function fmtDate(ts) {
    if (!ts) return '—';
    return new Date(ts * 1000).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function toDateInput(ts) {
    const d = ts ? new Date(ts * 1000) : new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fromDateInput(v) {
    if (!v) return Math.floor(Date.now() / 1000);
    return Math.floor(new Date(`${v}T00:00:00`).getTime() / 1000);
}

const EMPTY_FORM = { adminId: '', amount: '', note: '', date: toDateInput() };

export default function WithdrawalsPage() {
    const router = useRouter();

    const [admins,      setAdmins]      = useState([]);
    const [withdrawals, setWithdrawals] = useState([]);
    const [sales,       setSales]       = useState([]);
    const [expenses,    setExpenses]    = useState([]);
    const [affiliates,  setAffiliates]  = useState([]);
    const [loading,     setLoading]     = useState(true);
    const [globalStats, setGlobalStats] = useState({ totalRevenueBasis: 0, allWithdrawn: 0, moneyLeft: 0 });

    // Add withdrawal modal
    const [showAdd, setShowAdd]   = useState(false);
    const [form,    setForm]      = useState(EMPTY_FORM);
    const [busy,    setBusy]      = useState(false);
    const [err,     setErr]       = useState('');

    // Admin filter
    const [adminFilter, setAdminFilter] = useState('all');

    // Edit withdrawal modal
    const [editTarget,  setEditTarget]  = useState(null); // withdrawal object
    const [editForm,    setEditForm]    = useState({ amount: '', note: '', date: '' });
    const [editBusy,    setEditBusy]    = useState(false);
    const [editErr,     setEditErr]     = useState('');

    // Set share % modal
    const [shareModal,    setShareModal]    = useState(null); // { id, username, sharePercent }
    const [shareVal,      setShareVal]      = useState('');
    const [shareBusy,     setShareBusy]     = useState(false);
    const [shareErr,      setShareErr]      = useState('');

    const [user, setUser] = useState(null);

    useEffect(() => {
        const cached = localStorage.getItem('zyqora_admin_user');
        if (cached) {
            try {
                const u = JSON.parse(cached);
                if (u.role === 'affiliate') { router.replace('/affiliate-dashboard'); return; }
                setUser(u);
            } catch {}
        }
        load();
    }, []);

    const isSuper = user?.role === 'super';

    const load = async () => {
        setLoading(true);
        const promises = [apiFetch('/api/withdrawals'), apiFetch('/api/sales'), apiFetch('/api/expenses'), apiFetch('/api/affiliates/list'), apiFetch('/api/stats')];
        const isS = (() => {
            try { return JSON.parse(localStorage.getItem('zyqora_admin_user'))?.role === 'super'; } catch { return false; }        })();
        if (isS) promises.push(apiFetch('/api/admins/list'));
        const [wRes, sRes, eRes, affRes, statsRes, aRes] = await Promise.all(promises);
        if (wRes?.ok)     setWithdrawals(wRes.data);
        if (sRes?.ok)     setSales(sRes.data);
        if (eRes?.ok)     setExpenses(eRes.data);
        if (affRes?.ok)   setAffiliates(affRes.data);
        if (statsRes?.ok) setGlobalStats(statsRes.data);
        if (aRes?.ok)     setAdmins(aRes.data);
        setLoading(false);
    };

    // Net After Affiliates = totalRevenue - totalExpenses - affiliateCommissions
    const totalRevenue = useMemo(() => {
        return sales.reduce((sum, s) => (!s.revoked && s.price > 0 ? sum + Number(s.price) : sum), 0);
    }, [sales]);

    const totalRevenueBasis = useMemo(() => {
        const totalExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
        const affCommPctMap = Object.fromEntries(affiliates.map(a => [a.id, a.commission || 0]));
        const affilCommission = sales
            .filter(s => !s.revoked && s.affiliateId)
            .reduce((sum, s) => {
                const stored = parseFloat(s.affiliateCommissionAmount);
                if (stored > 0) return sum + stored;
                const revenue = parseFloat(s.discountedPrice ?? s.price) || 0;
                const pct = affCommPctMap[s.affiliateId] || 0;
                return sum + (revenue * pct / 100);
            }, 0);
        return totalRevenue - totalExpenses - affilCommission;
    }, [sales, expenses, affiliates, totalRevenue]);

    // Per-admin total withdrawn
    const withdrawnByAdmin = useMemo(() => {
        const map = {};
        withdrawals.forEach(w => {
            map[w.adminId] = (map[w.adminId] || 0) + Number(w.amount);
        });
        return map;
    }, [withdrawals]);

    // Filtered withdrawal history
    const filtered = useMemo(() => {
        if (adminFilter === 'all') return withdrawals;
        return withdrawals.filter(w => w.adminId === adminFilter);
    }, [withdrawals, adminFilter]);

    const totalWithdrawn = filtered.reduce((s, w) => s + Number(w.amount), 0);
    const allWithdrawn   = withdrawals.reduce((s, w) => s + Number(w.amount), 0);
    const moneyLeft      = totalRevenueBasis - allWithdrawn;

    const openAdd = () => {
        setForm(EMPTY_FORM);
        setErr('');
        setShowAdd(true);
    };

    const closeAdd = () => { setShowAdd(false); setErr(''); };

    const addWithdrawal = async (e) => {
        e.preventDefault();
        setBusy(true);
        setErr('');
        const admin = admins.find(a => a.id === form.adminId);
        const r = await apiFetch('/api/withdrawals', {
            method: 'POST',
            body: {
                adminId:       form.adminId,
                adminUsername: admin?.username || '',
                amount:        form.amount,
                note:          form.note,
                withdrawnAt:   fromDateInput(form.date),
            },
        });
        if (!r?.ok) { setErr(r?.data?.error || 'Failed'); setBusy(false); return; }
        setBusy(false);
        closeAdd();
        load();
    };

    const openEdit = (w) => {
        setEditTarget(w);
        setEditForm({ amount: String(w.amount), note: w.note || '', date: toDateInput(w.withdrawnAt) });
        setEditErr('');
    };

    const closeEdit = () => { setEditTarget(null); setEditErr(''); };

    const saveEdit = async (e) => {
        e.preventDefault();
        setEditBusy(true);
        setEditErr('');
        const r = await apiFetch(`/api/withdrawals/${editTarget.id}`, {
            method: 'PUT',
            body: {
                amount:      editForm.amount,
                note:        editForm.note,
                withdrawnAt: fromDateInput(editForm.date),
            },
        });
        if (!r?.ok) { setEditErr(r?.data?.error || 'Failed'); setEditBusy(false); return; }
        setEditBusy(false);
        closeEdit();
        load();
    };

    const openShare = (admin) => {
        setShareModal(admin);
        setShareVal(admin.sharePercent != null ? String(admin.sharePercent) : '');
        setShareErr('');
    };

    const closeShare = () => { setShareModal(null); setShareErr(''); };

    const saveShare = async (e) => {
        e.preventDefault();
        setShareBusy(true);
        setShareErr('');
        const r = await apiFetch(`/api/admins/${shareModal.id}/update-share`, {
            method: 'POST',
            body: { sharePercent: shareVal },
        });
        if (!r?.ok) { setShareErr(r?.data?.error || 'Failed'); setShareBusy(false); return; }
        setShareBusy(false);
        closeShare();
        load();
    };

    return (
        <>
        <AppLayout>
            <div className="page">
                <div className="page-header">
                    <div>
                        <div className="page-title">Money Withdrawn</div>
                        <div className="page-subtitle">Track withdrawals per admin and their profit share</div>
                    </div>
                    {isSuper && <button className="btn btn-primary" onClick={openAdd}>+ Add Withdrawal</button>}
                </div>

                <div className="page-body">

                    {/* Admin own summary card (non-super) */}
                    {!isSuper && !loading && (() => {
                        // Use global revenue basis — sharePercent applies to the whole business pool
                        const revenue   = globalStats.totalRevenueBasis;
                        const pct       = user?.sharePercent != null ? Number(user.sharePercent) : 0;
                        const earned    = revenue * pct / 100;
                        const withdrawn = withdrawnByAdmin[user?.id] || 0;
                        const balance   = earned - withdrawn;
                        const bizMoneyLeft = globalStats.moneyLeft;
                        return (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
                                <div className="stat-card"><div className="stat-label">Net Revenue Basis</div><div className="stat-value stat-blue">{fmtMoney(revenue)}</div></div>
                                <div className="stat-card"><div className="stat-label">Share Earned ({pct}%)</div><div className="stat-value stat-green">{fmtMoney(earned)}</div></div>
                                <div className="stat-card"><div className="stat-label">Withdrawn</div><div className="stat-value" style={{color:'#ef4444'}}>{fmtMoney(withdrawn)}</div></div>
                                <div className="stat-card"><div className="stat-label">Balance Owed</div><div className="stat-value" style={{color: balance>=0?'#a78bfa':'#ef4444'}}>{fmtMoney(balance)}</div></div>
                                <div className="stat-card"><div className="stat-label">Money Left (Business)</div><div className="stat-value" style={{color: bizMoneyLeft>=0?'#22c55e':'#ef4444'}}>{fmtMoney(bizMoneyLeft)}</div><div className="stat-sub">Net minus all withdrawals</div></div>
                            </div>
                        );
                    })()}

                    {/* Admin summary cards (super) */}
                    {isSuper && !loading && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
                            <div className="stat-card">
                                <div className="stat-label">Net Revenue Basis</div>
                                <div className="stat-value stat-blue">{fmtMoney(totalRevenueBasis)}</div>
                                <div className="stat-sub">After expenses &amp; affiliate commissions</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-label">Total Withdrawn</div>
                                <div className="stat-value" style={{ color: '#ef4444' }}>{fmtMoney(allWithdrawn)}</div>
                                <div className="stat-sub">Across all admins</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-label">Money Left</div>
                                <div className="stat-value" style={{ color: moneyLeft >= 0 ? '#22c55e' : '#ef4444' }}>{fmtMoney(moneyLeft)}</div>
                                <div className="stat-sub">Net minus all withdrawals</div>
                            </div>
                        </div>
                    )}

                    {isSuper && !loading && admins.length > 0 && (
                        <div style={{ marginBottom: 24 }}>
                            <div style={{ fontWeight: 700, color: '#e2e8f0', fontSize: 13, marginBottom: 10 }}>Admin Overview</div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
                                {admins.map(a => {
                                    const revenue   = totalRevenueBasis;
                                    const pct       = a.sharePercent != null ? Number(a.sharePercent) : 0;
                                    const earned    = revenue * pct / 100;
                                    const withdrawn = withdrawnByAdmin[a.id] || 0;
                                    const balance   = earned - withdrawn;
                                    // latest withdrawal with an amountLeft set
                                    const latestLeft = null; // removed: balance is always live-computed
                                    return (
                                        <div key={a.id} className="card" style={{ padding: '16px 18px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                                <div>
                                                    <div style={{ fontWeight: 700, color: '#e2e8f0', fontSize: 14 }}>{a.username}</div>
                                                    <div style={{ fontSize: 11, color: '#3a4560', marginTop: 2 }}>
                                                        <span className={`badge badge-${a.role}`}>{a.role}</span>
                                                    </div>
                                                </div>
                                                <button
                                                    className="btn btn-ghost btn-sm"
                                                    onClick={() => openShare(a)}
                                                    title="Set Share %"
                                                >
                                                    {pct}% share
                                                </button>
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                                <div style={{ background: '#0d1120', borderRadius: 6, padding: '8px 10px' }}>
                                                    <div style={{ fontSize: 10, color: '#3a4560', marginBottom: 2 }}>Revenue</div>
                                                    <div style={{ fontWeight: 700, color: '#4a9eff', fontSize: 13 }}>{fmtMoney(revenue)}</div>
                                                </div>
                                                <div style={{ background: '#0d1120', borderRadius: 6, padding: '8px 10px' }}>
                                                    <div style={{ fontSize: 10, color: '#3a4560', marginBottom: 2 }}>Share Earned</div>
                                                    <div style={{ fontWeight: 700, color: '#22c55e', fontSize: 13 }}>{fmtMoney(earned)}</div>
                                                </div>
                                                <div style={{ background: '#0d1120', borderRadius: 6, padding: '8px 10px' }}>
                                                    <div style={{ fontSize: 10, color: '#3a4560', marginBottom: 2 }}>Withdrawn</div>
                                                    <div style={{ fontWeight: 700, color: '#ef4444', fontSize: 13 }}>{fmtMoney(withdrawn)}</div>
                                                </div>
                                                <div style={{ background: '#0d1120', borderRadius: 6, padding: '8px 10px' }}>
                                                    <div style={{ fontSize: 10, color: '#3a4560', marginBottom: 2 }}>Balance Owed</div>
                                                    <div style={{ fontWeight: 700, color: balance >= 0 ? '#a78bfa' : '#ef4444', fontSize: 13 }}>{fmtMoney(balance)}</div>
                                                </div>
                                            </div>
                                            {latestLeft && null}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Transaction history */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ fontWeight: 700, color: '#e2e8f0', fontSize: 13 }}>Transaction History</div>
                            {filtered.length > 0 && (
                                <div style={{ fontSize: 12, color: '#ef4444', fontWeight: 600 }}>
                                    Total: {fmtMoney(totalWithdrawn)}
                                </div>
                            )}
                        </div>
                        {isSuper && (
                            <select
                                className="form-select"
                                style={{ width: 'auto', maxWidth: 220 }}
                                value={adminFilter}
                                onChange={e => setAdminFilter(e.target.value)}
                            >
                                <option value="all">All Admins</option>
                                {admins.map(a => (
                                    <option key={a.id} value={a.id}>{a.username}</option>
                                ))}
                            </select>
                        )}
                    </div>

                    {loading ? (
                        <div className="empty">Loading…</div>
                    ) : filtered.length === 0 ? (
                        <div className="empty">No withdrawals recorded yet.</div>
                    ) : (
                        <div className="table-wrap">
                            <table>
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Admin</th>
                                        <th>Amount</th>
                                        <th>Date</th>
                                        <th>Note</th>
                                        <th>Recorded By</th>
                                        {isSuper && <th></th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map((w, i) => (
                                        <tr key={w.id}>
                                            <td style={{ color: '#3a4560', fontSize: 12 }}>{i + 1}</td>
                                            <td style={{ fontWeight: 600, color: '#e2e8f0' }}>{w.adminUsername || w.adminId}</td>
                                            <td style={{ color: '#ef4444', fontWeight: 700 }}>{fmtMoney(w.amount)}</td>
                                            <td>{fmtDate(w.withdrawnAt)}</td>
                                            <td style={{ color: '#94a3b8' }}>{w.note || '—'}</td>
                                            <td style={{ color: '#3a4560', fontSize: 12 }}>{w.recordedByName}</td>
                                            {isSuper && (
                                                <td>
                                                    <button
                                                        className="btn btn-ghost btn-sm"
                                                        onClick={() => openEdit(w)}
                                                        title="Edit"
                                                    >✏️</button>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </AppLayout>

        {/* Add Withdrawal Modal */}
        {showAdd && (
            <div className="modal-overlay" onClick={closeAdd}>
                <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
                    <div className="modal-header">
                        <div style={{ fontWeight: 700, fontSize: 16 }}>Record Withdrawal</div>
                        <button className="btn btn-ghost btn-sm" onClick={closeAdd}>✕</button>
                    </div>
                    <form onSubmit={addWithdrawal}>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">Admin *</label>
                                <select
                                    className="form-select"
                                    value={form.adminId}
                                    onChange={e => setForm(f => ({ ...f, adminId: e.target.value }))}
                                    required
                                >
                                    <option value="">Select admin…</option>
                                    {admins.map(a => (
                                        <option key={a.id} value={a.id}>{a.username}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-row" style={{ marginTop: 12 }}>
                                <div className="form-group">
                                    <label className="form-label">Amount (₹) *</label>
                                    <input
                                        className="form-input"
                                        type="number"
                                        min="0.01"
                                        step="0.01"
                                        placeholder="e.g. 5000"
                                        value={form.amount}
                                        onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Date *</label>
                                    <input
                                        className="form-input"
                                        type="date"
                                        value={form.date}
                                        onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="form-group" style={{ marginTop: 12 }}>
                                <label className="form-label">Note</label>
                                <input
                                    className="form-input"
                                    placeholder="Optional reason or reference"
                                    value={form.note}
                                    onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                                    maxLength={300}
                                />
                            </div>
                            {form.adminId && (() => {
                                const a        = admins.find(x => x.id === form.adminId);
                                const revenue  = totalRevenueBasis;
                                const pct      = a?.sharePercent != null ? Number(a.sharePercent) : 0;
                                const earned   = revenue * pct / 100;
                                const already  = withdrawnByAdmin[form.adminId] || 0;
                                const balance  = earned - already;
                                const thisAmt  = parseFloat(form.amount) || 0;
                                const afterWd  = balance - thisAmt;
                                return (
                                    <>
                                    <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                                        <div style={{ flex: 1, background: '#0d1120', borderRadius: 6, padding: '8px 10px', textAlign: 'center' }}>
                                            <div style={{ fontSize: 10, color: '#3a4560' }}>Share Earned</div>
                                            <div style={{ fontWeight: 700, color: '#22c55e', fontSize: 13 }}>{fmtMoney(earned)}</div>
                                        </div>
                                        <div style={{ flex: 1, background: '#0d1120', borderRadius: 6, padding: '8px 10px', textAlign: 'center' }}>
                                            <div style={{ fontSize: 10, color: '#3a4560' }}>Already Withdrawn</div>
                                            <div style={{ fontWeight: 700, color: '#ef4444', fontSize: 13 }}>{fmtMoney(already)}</div>
                                        </div>
                                        <div style={{ flex: 1, background: '#0d1120', borderRadius: 6, padding: '8px 10px', textAlign: 'center' }}>
                                            <div style={{ fontSize: 10, color: '#3a4560' }}>Balance Owed</div>
                                            <div style={{ fontWeight: 700, color: balance >= 0 ? '#a78bfa' : '#ef4444', fontSize: 13 }}>{fmtMoney(balance)}</div>
                                        </div>
                                    </div>
                                    {thisAmt > 0 && (
                                        <div style={{ marginTop: 8, background: afterWd >= 0 ? '#0d1a10' : '#1a0d0d', border: `1px solid ${afterWd >= 0 ? '#166534' : '#7f1d1d'}`, borderRadius: 6, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <span style={{ fontSize: 12, color: '#94a3b8' }}>Amount left after this withdrawal</span>
                                            <span style={{ fontWeight: 800, fontSize: 15, color: afterWd >= 0 ? '#22c55e' : '#ef4444' }}>{fmtMoney(afterWd)}</span>
                                        </div>
                                    )}
                                    </>
                                );
                            })()}
                            {err && <div className="form-error" style={{ marginTop: 12 }}>{err}</div>}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" type="button" onClick={closeAdd}>Cancel</button>
                            <button className="btn btn-primary" type="submit" disabled={busy}>
                                {busy ? 'Saving…' : 'Record Withdrawal'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )}

        {/* Edit Withdrawal Modal */}
        {editTarget && (
            <div className="modal-overlay" onClick={closeEdit}>
                <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
                    <div className="modal-header">
                        <div style={{ fontWeight: 700, fontSize: 16 }}>Edit Withdrawal — {editTarget.adminUsername}</div>
                        <button className="btn btn-ghost btn-sm" onClick={closeEdit}>✕</button>
                    </div>
                    <form onSubmit={saveEdit}>
                        <div className="modal-body">
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Amount (₹) *</label>
                                    <input
                                        className="form-input"
                                        type="number"
                                        min="0.01"
                                        step="0.01"
                                        value={editForm.amount}
                                        onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))}
                                        required
                                        autoFocus
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Date *</label>
                                    <input
                                        className="form-input"
                                        type="date"
                                        value={editForm.date}
                                        onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="form-group" style={{ marginTop: 12 }}>
                                <label className="form-label">Note</label>
                                <input
                                    className="form-input"
                                    placeholder="Optional reason or reference"
                                    value={editForm.note}
                                    onChange={e => setEditForm(f => ({ ...f, note: e.target.value }))}
                                    maxLength={300}
                                />
                            </div>
                            {editErr && <div className="form-error" style={{ marginTop: 10 }}>{editErr}</div>}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" type="button" onClick={closeEdit}>Cancel</button>
                            <button className="btn btn-primary" type="submit" disabled={editBusy}>
                                {editBusy ? 'Saving…' : 'Save Changes'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )}

        {/* Set Share % Modal */}
        {shareModal && (
            <div className="modal-overlay" onClick={closeShare}>
                <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 360 }}>
                    <div className="modal-header">
                        <div style={{ fontWeight: 700, fontSize: 16 }}>Set Share % — {shareModal.username}</div>
                        <button className="btn btn-ghost btn-sm" onClick={closeShare}>✕</button>
                    </div>
                    <form onSubmit={saveShare}>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">Profit Share Percentage</label>
                                <input
                                    className="form-input"
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.01"
                                    placeholder="e.g. 30"
                                    value={shareVal}
                                    onChange={e => setShareVal(e.target.value)}
                                    required
                                    autoFocus
                                />
                                <div style={{ fontSize: 11, color: '#3a4560', marginTop: 6 }}>
                                    This defines what % of their generated revenue they are entitled to.
                                </div>
                            </div>
                            {shareErr && <div className="form-error" style={{ marginTop: 10 }}>{shareErr}</div>}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" type="button" onClick={closeShare}>Cancel</button>
                            <button className="btn btn-primary" type="submit" disabled={shareBusy}>
                                {shareBusy ? 'Saving…' : 'Save'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )}
        </>
    );
}
