'use client';
import { useEffect, useState, useMemo } from 'react';
import AppLayout from '@/components/AppLayout';
import { apiFetch } from '@/lib/apiFetch';

const PERIODS = [
    { key: 'today',  label: 'Today'      },
    { key: 'week',   label: 'This Week'  },
    { key: 'month',  label: 'This Month' },
    { key: 'all',    label: 'All Time'   },
];

function fmt(n) {
    return '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function fmtDate(ts) {
    if (!ts) return '—';
    return new Date(ts * 1000).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function periodStart(key) {
    const now = new Date();
    if (key === 'today') {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return Math.floor(d.getTime() / 1000);
    }
    if (key === 'week') {
        const d = new Date(now);
        d.setDate(d.getDate() - d.getDay());
        d.setHours(0, 0, 0, 0);
        return Math.floor(d.getTime() / 1000);
    }
    if (key === 'month') {
        const d = new Date(now.getFullYear(), now.getMonth(), 1);
        return Math.floor(d.getTime() / 1000);
    }
    return 0; // all time
}

export default function SalesPage() {
    const [user,    setUser]    = useState(null);
    const [sales,   setSales]   = useState([]);
    const [loading, setLoading] = useState(true);
    const [period,  setPeriod]  = useState('month');
    const [adminFilter, setAdminFilter] = useState('all');

    useEffect(() => {
        try { const u = localStorage.getItem('zyqora_admin_user'); if (u) setUser(JSON.parse(u)); } catch {}
        apiFetch('/api/sales').then(r => {
            if (r?.ok) setSales(r.data);
            setLoading(false);
        });
    }, []);

    const isSuper = user?.role === 'super';

    // Unique admins for super filter
    const adminList = useMemo(() => {
        const map = {};
        sales.forEach(s => { if (s.issuedBy) map[s.issuedBy] = s.issuedByName; });
        return Object.entries(map).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
    }, [sales]);

    const start = periodStart(period);

    // Filtered by period + admin
    const filtered = useMemo(() => sales.filter(s => {
        if ((s.issuedAt || 0) < start) return false;
        if (isSuper && adminFilter !== 'all' && s.issuedBy !== adminFilter) return false;
        return true;
    }), [sales, start, adminFilter, isSuper]);

    const totalRevenue = filtered.reduce((a, s) => a + (s.price || 0), 0);
    const totalCount   = filtered.length;

    // Per-admin breakdown (super only)
    const adminBreakdown = useMemo(() => {
        if (!isSuper) return [];
        const map = {};
        filtered.forEach(s => {
            if (!map[s.issuedBy]) map[s.issuedBy] = { id: s.issuedBy, name: s.issuedByName, revenue: 0, count: 0 };
            map[s.issuedBy].revenue += s.price || 0;
            map[s.issuedBy].count  += 1;
        });
        return Object.values(map).sort((a, b) => b.revenue - a.revenue);
    }, [filtered, isSuper]);

    // Summary stats for all 4 periods (quick overview row)
    const periodStats = useMemo(() => PERIODS.map(p => {
        const s = periodStart(p.key);
        const rows = sales.filter(x => (x.issuedAt || 0) >= s);
        return { label: p.label, revenue: rows.reduce((a, x) => a + (x.price || 0), 0), count: rows.length };
    }), [sales]);

    return (
        <AppLayout>
            <div className="page">
                <div className="page-header">
                    <div>
                        <div className="page-title">Sales</div>
                        <div className="page-subtitle">Revenue from license sales</div>
                    </div>
                </div>

                <div className="page-body">
                    {loading ? (
                        <div className="empty">Loading…</div>
                    ) : (
                        <>
                            {/* Summary stat cards */}
                            <div className="stats-grid" style={{ marginBottom: 24 }}>
                                {periodStats.map((ps, i) => (
                                    <div
                                        key={ps.label}
                                        className="stat-card"
                                        style={{
                                            cursor: 'pointer',
                                            borderColor: period === PERIODS[i].key ? '#7c3aed' : '#1e2640',
                                            background:  period === PERIODS[i].key ? 'rgba(124,58,237,.08)' : '#0f1320',
                                        }}
                                        onClick={() => setPeriod(PERIODS[i].key)}
                                    >
                                        <div className="stat-label">{ps.label}</div>
                                        <div className="stat-value" style={{ fontSize: 24, color: period === PERIODS[i].key ? '#a78bfa' : '#e2e8f0' }}>
                                            {fmt(ps.revenue)}
                                        </div>
                                        <div className="stat-sub">{ps.count} sale{ps.count !== 1 ? 's' : ''}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Filters row */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                                <div style={{ display: 'flex', gap: 6 }}>
                                    {PERIODS.map(p => (
                                        <button
                                            key={p.key}
                                            className={`btn btn-sm ${period === p.key ? 'btn-primary' : 'btn-ghost'}`}
                                            onClick={() => setPeriod(p.key)}
                                        >
                                            {p.label}
                                        </button>
                                    ))}
                                </div>
                                {isSuper && adminList.length > 1 && (
                                    <select
                                        className="form-select"
                                        style={{ width: 'auto', maxWidth: 200 }}
                                        value={adminFilter}
                                        onChange={e => setAdminFilter(e.target.value)}
                                    >
                                        <option value="all">All Admins</option>
                                        {adminList.map(a => (
                                            <option key={a.id} value={a.id}>{a.name}</option>
                                        ))}
                                    </select>
                                )}
                                <span style={{ marginLeft: 'auto', color: '#4a5980', fontSize: 13 }}>
                                    {totalCount} sale{totalCount !== 1 ? 's' : ''} &nbsp;·&nbsp;
                                    <span style={{ color: '#22c55e', fontWeight: 700 }}>{fmt(totalRevenue)}</span>
                                </span>
                            </div>

                            {/* Per-admin breakdown (super only) */}
                            {isSuper && adminBreakdown.length > 1 && adminFilter === 'all' && (
                                <div className="card" style={{ marginBottom: 20 }}>
                                    <div style={{ fontWeight: 700, color: '#e2e8f0', marginBottom: 12, fontSize: 13 }}>
                                        Admin Breakdown
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                                        {adminBreakdown.map(a => (
                                            <div
                                                key={a.id}
                                                style={{
                                                    background: '#161c2d', border: '1px solid #252d42',
                                                    borderRadius: 10, padding: '12px 18px', minWidth: 160,
                                                    cursor: 'pointer',
                                                }}
                                                onClick={() => setAdminFilter(a.id)}
                                            >
                                                <div style={{ fontSize: 12, color: '#4a5980', marginBottom: 4, fontWeight: 600 }}>
                                                    {a.name}
                                                </div>
                                                <div style={{ fontSize: 20, fontWeight: 800, color: '#a78bfa' }}>
                                                    {fmt(a.revenue)}
                                                </div>
                                                <div style={{ fontSize: 11, color: '#4a5980', marginTop: 2 }}>
                                                    {a.count} sale{a.count !== 1 ? 's' : ''}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Sales table */}
                            {filtered.length === 0 ? (
                                <div className="empty">No sales recorded for this period.</div>
                            ) : (
                                <div className="table-wrap">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>#</th>
                                                <th>Client</th>
                                                <th>Plan</th>
                                                <th>Price</th>
                                                {isSuper && <th>Admin</th>}
                                                <th>Date</th>
                                                <th>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filtered.map((s, i) => (
                                                <tr key={s.key}>
                                                    <td style={{ color: '#3a4560', fontSize: 12 }}>{i + 1}</td>
                                                    <td>
                                                        <div className="bold">{s.clientName}</div>
                                                        {s.clientPhone && <div className="dim">{s.clientPhone}</div>}
                                                    </td>
                                                    <td>
                                                        <span className={`badge badge-plan-${s.plan}`}>{s.plan}</span>
                                                    </td>
                                                    <td>
                                                        <span style={{ fontWeight: 700, color: '#22c55e', fontSize: 14 }}>
                                                            {fmt(s.price)}
                                                        </span>
                                                    </td>
                                                    {isSuper && (
                                                        <td style={{ color: '#94a3b8' }}>{s.issuedByName}</td>
                                                    )}
                                                    <td>{fmtDate(s.issuedAt)}</td>
                                                    <td>
                                                        {s.revoked
                                                            ? <span className="badge badge-revoked">Revoked</span>
                                                            : <span className="badge badge-active">Active</span>
                                                        }
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}
