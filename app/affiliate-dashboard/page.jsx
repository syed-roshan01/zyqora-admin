'use client';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { getToken, clearToken, apiFetch } from '@/lib/apiFetch';

function fmtDate(ts) {
    if (!ts) return '—';
    return new Date(ts * 1000).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDateTime(ts) {
    if (!ts) return '—';
    return new Date(ts * 1000).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtMoney(v) {
    const n = Math.max(0, parseFloat(v) || 0);
    return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

const STATUS_COLORS = {
    active: '#22c55e',
    expired: '#f59e0b',
    revoked: '#ef4444',
};

export default function AffiliateDashboard() {
    const router = useRouter();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState('all'); // all | demo | converted
    const [activeTab, setActiveTab] = useState('clients'); // clients | payments

    useEffect(() => {
        if (!getToken()) { router.replace('/login'); return; }
        try {
            const u = localStorage.getItem('zyqora_admin_user');
            if (u) {
                const parsed = JSON.parse(u);
                // Redirect non-affiliates away
                if (parsed.role !== 'affiliate') {
                    router.replace('/dashboard');
                    return;
                }
            }
        } catch {}

        apiFetch('/api/affiliates/stats').then(r => {
            if (r?.ok) setData(r.data);
            setLoading(false);
        });
    }, []);

    const { affiliate, stats, licenses } = data || {};
    const payments = data?.payments || [];

    const filtered = useMemo(() => {
        let list = (licenses || []).filter(l => !l.revoked);
        if (filterType === 'demo') list = list.filter(l => l.isTrial || l.price === 0);
        if (filterType === 'converted') list = list.filter(l => l.converted);
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(l =>
                l.clientName?.toLowerCase().includes(q) ||
                l.clientPhone?.toLowerCase().includes(q) ||
                l.key?.toLowerCase().includes(q)
            );
        }
        return list;
    }, [licenses, filterType, search]);

    const logout = () => { clearToken(); router.replace('/login'); };

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', background: '#0a0d14', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3a4560', fontSize: 13 }}>
                Loading…
            </div>
        );
    }

    if (!data) {
        return (
            <div style={{ minHeight: '100vh', background: '#0a0d14', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', fontSize: 13 }}>
                Failed to load data.
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', background: '#0a0d14', color: '#e2e8f0' }}>
            {/* Header */}
            <div style={{ background: '#0f1320', borderBottom: '1px solid #1e2640', padding: '0 28px', height: 58, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#7c3aed' }}>Zyqora</div>
                    <div style={{ fontSize: 12, color: '#4a5980' }}>Affiliate Portal</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{affiliate?.name}</div>
                        <div style={{ fontSize: 11, color: '#4a5980' }}>@{affiliate?.username}</div>
                    </div>
                    <button
                        onClick={logout}
                        style={{ background: 'rgba(239,68,68,.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,.3)', borderRadius: 7, padding: '6px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                    >
                        Sign Out
                    </button>
                </div>
            </div>

            <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>
                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 28 }}>
                    <div className="stat-card">
                        <div className="stat-label">Total Clients</div>
                        <div className="stat-value stat-accent">{stats?.totalClients ?? 0}</div>
                        <div className="stat-sub">All referrals</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-label">Demo / Trial</div>
                        <div className="stat-value" style={{ color: '#f59e0b' }}>{stats?.demoClients ?? 0}</div>
                        <div className="stat-sub">Free trial users</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-label">Converted</div>
                        <div className="stat-value stat-green">{stats?.convertedClients ?? 0}</div>
                        <div className="stat-sub">Paid plans</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-label">Total Sales (via you)</div>
                        <div className="stat-value stat-green">{fmtMoney(stats?.totalRevenue ?? 0)}</div>
                        <div className="stat-sub">Sum of converted licenses</div>
                    </div>
                    <div className="stat-card" style={{ border: '1px solid rgba(124,58,237,.4)', background: 'rgba(124,58,237,.06)' }}>
                        <div className="stat-label">Commission Earned ({stats?.commissionPercent ?? 0}%)</div>
                        <div className="stat-value" style={{ color: '#a78bfa', fontSize: 26 }}>
                            {fmtMoney(stats?.commissionAmount ?? 0)}
                        </div>
                        <div className="stat-sub">Based on converted sales</div>
                    </div>
                    <div className="stat-card" style={{ border: '1px solid rgba(34,197,94,.3)', background: 'rgba(34,197,94,.04)' }}>
                        <div className="stat-label">Paid Out</div>
                        <div className="stat-value stat-green" style={{ fontSize: 26 }}>
                            {fmtMoney(stats?.totalPaid ?? 0)}
                        </div>
                        <div className="stat-sub">{payments.length} transaction{payments.length !== 1 ? 's' : ''}</div>
                    </div>
                    <div className="stat-card" style={{ border: '1px solid rgba(239,68,68,.3)', background: 'rgba(239,68,68,.04)' }}>
                        <div className="stat-label">Balance Owed to You</div>
                        <div className="stat-value" style={{ color: (stats?.balance ?? 0) > 0 ? '#ef4444' : '#3a4560', fontSize: 26 }}>
                            {fmtMoney(stats?.balance ?? 0)}
                        </div>
                        <div className="stat-sub">Commission − paid out</div>
                    </div>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 18, borderBottom: '1px solid #1e2640', paddingBottom: 12 }}>
                    {[['clients', `Leads (${stats?.totalClients ?? 0})`], ['payments', `Payment History (${payments.length})`]].map(([tab, label]) => (
                        <button key={tab}
                            className={`btn btn-sm ${activeTab === tab ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => setActiveTab(tab)}>
                            {label}
                        </button>
                    ))}
                </div>

                {activeTab === 'clients' && (
                <>
                {/* Client filters */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
                    <input
                        className="form-input"
                        style={{ maxWidth: 260 }}
                        placeholder="Search client, phone, key…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                    {['all', 'demo', 'converted'].map(f => (
                        <button
                            key={f}
                            className={`btn btn-sm ${filterType === f ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => setFilterType(f)}
                        >
                            {f === 'all' ? `All (${stats?.totalClients ?? 0})`
                                : f === 'demo' ? `Demo (${stats?.demoClients ?? 0})`
                                : `Converted (${stats?.convertedClients ?? 0})`}
                        </button>
                    ))}
                </div>

                {filtered.length === 0 ? (
                    <div className="empty">No records found.</div>
                ) : (
                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Client</th>
                                    <th>Phone</th>
                                    <th>Plan</th>
                                    <th>Amount</th>
                                    <th>Status</th>
                                    <th>Issued</th>
                                    <th>Commission</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((l, i) => {
                                    const comm = l.converted ? l.price * (stats.commissionPercent / 100) : 0;
                                    return (
                                        <tr key={l.key}>
                                            <td style={{ color: '#3a4560', fontSize: 12 }}>{i + 1}</td>
                                            <td style={{ fontWeight: 600 }}>{l.clientName || '—'}</td>
                                            <td style={{ fontSize: 12, color: '#64748b' }}>{l.clientPhone || '—'}</td>
                                            <td>
                                                <span style={{ textTransform: 'capitalize' }}>{l.plan}</span>
                                                {l.isTrial && (
                                                    <span style={{ marginLeft: 5, fontSize: 10, background: 'rgba(245,158,11,.15)', color: '#f59e0b', borderRadius: 4, padding: '2px 5px' }}>DEMO</span>
                                                )}
                                            </td>
                                            <td style={{ fontWeight: 700, color: l.price > 0 ? '#22c55e' : '#3a4560' }}>
                                                {l.price > 0 ? fmtMoney(l.price) : '—'}
                                            </td>
                                            <td>
                                                <span style={{ fontSize: 12, fontWeight: 600, color: STATUS_COLORS[l.status] || '#64748b' }}>
                                                    {l.status?.charAt(0).toUpperCase() + l.status?.slice(1)}
                                                </span>
                                            </td>
                                            <td style={{ fontSize: 12, color: '#64748b' }}>{fmtDate(l.issuedAt)}</td>
                                            <td style={{ fontWeight: 700, color: comm > 0 ? '#a78bfa' : '#3a4560' }}>
                                                {comm > 0 ? fmtMoney(comm) : '—'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
                </>
                )}

                {activeTab === 'payments' && (
                payments.length === 0 ? (
                    <div className="empty">No payments received yet.</div>
                ) : (
                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Amount</th>
                                    <th>Note</th>
                                    <th>Paid By</th>
                                    <th>Date &amp; Time</th>
                                </tr>
                            </thead>
                            <tbody>
                                {payments.map((p, i) => (
                                    <tr key={p.id}>
                                        <td style={{ color: '#3a4560', fontSize: 12 }}>{i + 1}</td>
                                        <td style={{ fontWeight: 800, color: '#22c55e', fontSize: 15 }}>{fmtMoney(p.amount)}</td>
                                        <td style={{ color: '#94a3b8' }}>{p.note || '—'}</td>
                                        <td style={{ fontSize: 12, color: '#64748b' }}>{p.paidByName || p.paidBy}</td>
                                        <td style={{ fontSize: 12, color: '#64748b' }}>{fmtDateTime(p.paidAt)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )
                )}
            </div>
        </div>
    );
}
