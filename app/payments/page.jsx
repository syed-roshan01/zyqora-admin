'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import { apiFetch } from '@/lib/apiFetch';

function fmtDateTime(ts) {
    if (!ts) return '—';
    return new Date(ts * 1000).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function toDateInput(ts) {
    const d = ts ? new Date(ts * 1000) : new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fromDateInput(v) {
    if (!v) return Math.floor(Date.now() / 1000);
    return Math.floor(new Date(`${v}T00:00:00`).getTime() / 1000);
}

function fmtMoney(v) {
    const n = Math.max(0, parseFloat(v) || 0);
    return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export default function PaymentsPage() {
    const router = useRouter();
    const [user, setUser] = useState(null);
    const [payments, setPayments] = useState([]);
    const [affiliates, setAffiliates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterAff, setFilterAff] = useState('all');
    const [search, setSearch] = useState('');

    // Edit payment modal
    const [editTarget, setEditTarget] = useState(null);
    const [editForm,   setEditForm]   = useState({ amount: '', note: '', date: '' });
    const [editBusy,   setEditBusy]   = useState(false);
    const [editErr,    setEditErr]    = useState('');

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
        const [payRes, affRes] = await Promise.all([
            apiFetch('/api/affiliates/payments/list'),
            apiFetch('/api/affiliates/list'),
        ]);
        setPayments(payRes?.ok ? (payRes.data?.payments || []) : []);
        setAffiliates(affRes?.ok ? (affRes.data || []) : []);
        setLoading(false);
    };

    const filtered = payments.filter(p => {
        if (filterAff !== 'all' && p.affiliateId !== filterAff) return false;
        if (search.trim()) {
            const q = search.toLowerCase();
            return (
                p.affiliateName?.toLowerCase().includes(q) ||
                p.paidByName?.toLowerCase().includes(q) ||
                p.note?.toLowerCase().includes(q)
            );
        }
        return true;
    });

    // Summary: per-affiliate totals
    const summaryMap = {};
    for (const p of payments) {
        if (!summaryMap[p.affiliateId]) summaryMap[p.affiliateId] = { name: p.affiliateName, total: 0, count: 0 };
        summaryMap[p.affiliateId].total += parseFloat(p.amount) || 0;
        summaryMap[p.affiliateId].count++;
    }
    const grandTotal = payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);

    const openEdit = (p) => {
        setEditTarget(p);
        setEditForm({ amount: String(p.amount), note: p.note || '', date: toDateInput(p.paidAt) });
        setEditErr('');
    };

    const closeEdit = () => { setEditTarget(null); setEditErr(''); };

    const saveEdit = async (e) => {
        e.preventDefault();
        setEditBusy(true);
        setEditErr('');
        const r = await apiFetch(`/api/affiliates/payments/${editTarget.id}`, {
            method: 'PUT',
            body: {
                amount: editForm.amount,
                note:   editForm.note,
                paidAt: fromDateInput(editForm.date),
            },
        });
        if (!r?.ok) { setEditErr(r?.data?.error || 'Failed'); setEditBusy(false); return; }
        setEditBusy(false);
        closeEdit();
        load();
    };

    return (
        <>
        <AppLayout>
            <div className="page">
                <div className="page-header">
                    <div>
                        <div className="page-title">Affiliate Payments</div>
                        <div className="page-subtitle">Monitor all commission payouts made to affiliates</div>
                    </div>
                </div>

                <div className="page-body">
                    {/* Summary cards */}
                    {!loading && payments.length > 0 && (
                        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 22 }}>
                            <div style={{ background: '#0f1420', border: '1px solid #1e2640', borderRadius: 10, padding: '12px 20px', minWidth: 160 }}>
                                <div style={{ fontSize: 11, color: '#4a5980', marginBottom: 4 }}>Total Paid Out</div>
                                <div style={{ fontSize: 22, fontWeight: 800, color: '#22c55e' }}>{fmtMoney(grandTotal)}</div>
                                <div style={{ fontSize: 11, color: '#3a4560', marginTop: 2 }}>{payments.length} transaction{payments.length !== 1 ? 's' : ''}</div>
                            </div>
                            {Object.entries(summaryMap).map(([id, s]) => (
                                <div key={id} style={{ background: '#0f1420', border: '1px solid #1e2640', borderRadius: 10, padding: '12px 20px', minWidth: 160 }}>
                                    <div style={{ fontSize: 11, color: '#4a5980', marginBottom: 4 }}>{s.name}</div>
                                    <div style={{ fontSize: 20, fontWeight: 800, color: '#f59e0b' }}>{fmtMoney(s.total)}</div>
                                    <div style={{ fontSize: 11, color: '#3a4560', marginTop: 2 }}>{s.count} payment{s.count !== 1 ? 's' : ''}</div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Filters */}
                    <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                        <input
                            className="form-input"
                            style={{ maxWidth: 240 }}
                            placeholder="Search affiliate, paid by, note…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                        <select className="form-input" style={{ maxWidth: 200 }}
                            value={filterAff} onChange={e => setFilterAff(e.target.value)}>
                            <option value="all">All Affiliates</option>
                            {affiliates.map(a => (
                                <option key={a.id} value={a.id}>{a.name}</option>
                            ))}
                        </select>
                        {(filterAff !== 'all' || search.trim()) && (
                            <button className="btn btn-ghost btn-sm" onClick={() => { setFilterAff('all'); setSearch(''); }}>Clear</button>
                        )}
                    </div>

                    {loading ? (
                        <div className="empty">Loading…</div>
                    ) : filtered.length === 0 ? (
                        <div className="empty">No payment records found.</div>
                    ) : (
                        <div className="table-wrap">
                            <table>
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Affiliate</th>
                                        <th>Amount</th>
                                        <th>Note</th>
                                        <th>Paid By</th>
                                        <th>Date &amp; Time</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map((p, i) => (
                                        <tr key={p.id}>
                                            <td style={{ color: '#3a4560', fontSize: 12 }}>{i + 1}</td>
                                            <td style={{ fontWeight: 700 }}>{p.affiliateName}</td>
                                            <td style={{ fontWeight: 800, color: '#22c55e', fontSize: 15 }}>{fmtMoney(p.amount)}</td>
                                            <td style={{ color: '#94a3b8', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {p.note || '—'}
                                            </td>
                                            <td style={{ fontSize: 12, color: '#64748b' }}>{p.paidByName || p.paidBy}</td>
                                            <td style={{ fontSize: 12, color: '#64748b' }}>{fmtDateTime(p.paidAt)}</td>
                                            <td>
                                                <button
                                                    className="btn btn-ghost btn-sm"
                                                    onClick={() => openEdit(p)}
                                                    title="Edit"
                                                >✏️</button>
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

        {/* Edit Payment Modal */}
        {editTarget && (
            <div className="modal-overlay" onClick={closeEdit}>
                <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
                    <div className="modal-header">
                        <div style={{ fontWeight: 700, fontSize: 16 }}>Edit Payment — {editTarget.affiliateName}</div>
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
                                    placeholder="Optional note"
                                    value={editForm.note}
                                    onChange={e => setEditForm(f => ({ ...f, note: e.target.value }))}
                                    maxLength={200}
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
        </>
    );
}
