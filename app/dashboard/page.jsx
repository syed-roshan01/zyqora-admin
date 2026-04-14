'use client';
import { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { apiFetch } from '@/lib/apiFetch';

function fmtDate(ts) {
    if (!ts) return '—';
    return new Date(ts * 1000).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getDaysLeft(lic) {
    if (lic.isLifetime) return null;
    const secs = lic.expiryTs - Math.floor(Date.now() / 1000);
    return Math.floor(secs / 86400);
}

export default function DashboardPage() {
    const [licenses, setLicenses] = useState([]);
    const [admins,   setAdmins]   = useState([]);
    const [sales,    setSales]    = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [affiliates, setAffiliates] = useState([]);
    const [withdrawals, setWithdrawals] = useState([]);
    const [affPayments, setAffPayments] = useState([]);
    const [globalStats, setGlobalStats] = useState({ moneyLeft: 0 });
    const [user,     setUser]     = useState(null);
    const [loading,  setLoading]  = useState(true);

    useEffect(() => {
        const cached = localStorage.getItem('zyqora_admin_user');
        if (cached) try { setUser(JSON.parse(cached)); } catch {}

        const loadData = async () => {
            const [lRes, aRes, sRes, eRes, affRes, wRes, apRes, statsRes] = await Promise.all([
                apiFetch('/api/licenses/list'),
                apiFetch('/api/admins/list').catch(() => null),
                apiFetch('/api/sales'),
                apiFetch('/api/expenses'),
                apiFetch('/api/affiliates/list').catch(() => null),
                apiFetch('/api/withdrawals'),
                apiFetch('/api/affiliates/payments/list').catch(() => null),
                apiFetch('/api/stats').catch(() => null),
            ]);
            if (lRes?.ok)     setLicenses(lRes.data);
            if (aRes?.ok)     setAdmins(aRes.data);
            if (sRes?.ok)     setSales(sRes.data);
            if (eRes?.ok)     setExpenses(eRes.data);
            if (affRes?.ok)   setAffiliates(affRes.data || []);
            if (wRes?.ok)     setWithdrawals(wRes.data || []);
            if (apRes?.ok)    setAffPayments(apRes.data?.payments || []);
            if (statsRes?.ok) setGlobalStats(statsRes.data || { moneyLeft: 0 });
            setLoading(false);
        };
        loadData();
    }, []);

    const now = Math.floor(Date.now() / 1000);
    const todayStart = Math.floor(new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime() / 1000);
    const total    = licenses.length;
    const active   = licenses.filter(l => !l.revoked && (l.isLifetime || l.expiryTs > now)).length;
    const revoked  = licenses.filter(l => l.revoked).length;
    const expired  = licenses.filter(l => !l.revoked && !l.isLifetime && l.expiryTs <= now).length;
    const issuedToday = licenses.filter(l => (l.issuedAt || 0) >= todayStart).length;
    const totalRevenue = sales.filter(s => !s.revoked).reduce((sum, s) => sum + (Number(s.price) || 0), 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const netMoney = totalRevenue - totalExpenses;
    const recent   = [...licenses].slice(0, 8);
    const topSpenders = user?.role === 'super'
        ? Object.values(expenses.reduce((acc, e) => {
            if (!acc[e.spentBy]) {
                acc[e.spentBy] = { id: e.spentBy, name: e.spentByName, total: 0, count: 0 };
            }
            acc[e.spentBy].total += Number(e.amount) || 0;
            acc[e.spentBy].count += 1;
            return acc;
        }, {})).sort((a, b) => b.total - a.total).slice(0, 5)
        : [];

    // Affiliate commission — use stored amount if available, else compute from affiliate % dynamically
    const affCommPctMap = Object.fromEntries(affiliates.map(a => [a.id, a.commission || 0]));
    const affilCommissionTotal = sales
        .filter(s => !s.revoked && s.affiliateId)
        .reduce((sum, s) => {
            const stored = parseFloat(s.affiliateCommissionAmount);
            if (stored > 0) return sum + stored;
            const revenue = parseFloat(s.discountedPrice ?? s.price) || 0;
            const pct = affCommPctMap[s.affiliateId] || 0;
            return sum + (revenue * pct / 100);
        }, 0);
    const netAfterAffiliate = netMoney - affilCommissionTotal;

    // Actual cash: deduct withdrawals + affiliate payments already paid out
    const totalWithdrawn    = withdrawals.reduce((sum, w) => sum + (Number(w.amount) || 0), 0);
    const totalAffiliatePaid = affPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    // For non-super admin: don't deduct global affiliate payouts — they only see their own scoped data
    const actualCash = user?.role === 'super'
        ? totalRevenue - totalExpenses - totalWithdrawn - totalAffiliatePaid
        : totalRevenue - totalExpenses - totalWithdrawn;
    // Remaining affiliate obligation (owed − already paid, floor at 0)
    const affiliateStillOwed = Math.max(0, affilCommissionTotal - totalAffiliatePaid);
    const netAfterAll       = actualCash - affiliateStillOwed;

    const planCount = licenses.reduce((acc, l) => {
        if (!l.revoked) acc[l.plan] = (acc[l.plan] || 0) + 1;
        return acc;
    }, {});

    return (
        <AppLayout>
            <div className="page">
                <div className="page-header">
                    <div>
                        <div className="page-title">Dashboard</div>
                        <div className="page-subtitle">Overview of your license business</div>
                    </div>
                </div>

                <div className="page-body">
                    {loading ? (
                        <div className="empty">Loading stats…</div>
                    ) : (
                        <>
                            <div className="stats-grid">
                                <div className="stat-card">
                                    <div className="stat-label">Total Licenses</div>
                                    <div className="stat-value stat-accent">{total}</div>
                                    <div className="stat-sub">All time issued</div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-label">Active</div>
                                    <div className="stat-value stat-green">{active}</div>
                                    <div className="stat-sub">Not expired or revoked</div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-label">Revoked</div>
                                    <div className="stat-value stat-red">{revoked}</div>
                                    <div className="stat-sub">Manually revoked</div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-label">Expired</div>
                                    <div className="stat-value" style={{ color: '#64748b' }}>{expired}</div>
                                    <div className="stat-sub">Past expiry date</div>
                                </div>
                                {user?.role === 'super' && (
                                    <div className="stat-card">
                                        <div className="stat-label">Admins</div>
                                        <div className="stat-value stat-blue">{admins.length}</div>
                                        <div className="stat-sub">{admins.filter(a => a.active).length} active</div>
                                    </div>
                                )}
                                <div className="stat-card">
                                    <div className="stat-label">Issued Today</div>
                                    <div className="stat-value" style={{ color: '#f59e0b' }}>{issuedToday}</div>
                                    <div className="stat-sub">Since midnight</div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-label">Total Revenue</div>
                                    <div className="stat-value stat-green">₹{totalRevenue.toLocaleString('en-IN')}</div>
                                    <div className="stat-sub">From license sales</div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-label">Total Expenses</div>
                                    <div className="stat-value stat-red">₹{totalExpenses.toLocaleString('en-IN')}</div>
                                    <div className="stat-sub">All recorded expenses</div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-label">Money Left</div>
                                    <div className="stat-value" style={{ color: (user?.role === 'super' ? actualCash : globalStats.moneyLeft) >= 0 ? '#22c55e' : '#ef4444' }}>
                                        ₹{(user?.role === 'super' ? actualCash : globalStats.moneyLeft).toLocaleString('en-IN')}
                                    </div>
                                    <div className="stat-sub">
                                        {user?.role === 'super'
                                            ? 'After expenses, withdrawals & affiliate payouts'
                                            : 'Business net after expenses & all withdrawals'}
                                    </div>
                                </div>
                                {user?.role === 'super' && (
                                    <div className="stat-card">
                                        <div className="stat-label">Affiliate Commission</div>
                                        <div className="stat-value" style={{ color: '#f59e0b' }}>
                                            ₹{affiliateStillOwed.toLocaleString('en-IN')}
                                        </div>
                                        <div className="stat-sub">Still owed to affiliates</div>
                                    </div>
                                )}
                                {user?.role === 'super' && (
                                    <div className="stat-card">
                                        <div className="stat-label">Net After Affiliates</div>
                                        <div className="stat-value" style={{ color: netAfterAll >= 0 ? '#22c55e' : '#ef4444' }}>
                                            ₹{netAfterAll.toLocaleString('en-IN')}
                                        </div>
                                        <div className="stat-sub">Cash minus unpaid commissions</div>
                                    </div>
                                )}
                            </div>

                            {user?.role === 'super' && topSpenders.length > 0 && (
                                <div className="card" style={{ marginBottom: 24 }}>
                                    <div style={{ fontWeight: 700, color: '#e2e8f0', marginBottom: 14, fontSize: 14 }}>
                                        Top Expense Users
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                                        {topSpenders.map(s => (
                                            <div key={s.id} style={{ background: '#161c2d', border: '1px solid #252d42', borderRadius: 8, padding: '10px 14px', minWidth: 170 }}>
                                                <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600 }}>{s.name}</div>
                                                <div style={{ color: '#ef4444', fontSize: 20, fontWeight: 800, lineHeight: 1.2 }}>
                                                    ₹{s.total.toLocaleString('en-IN')}
                                                </div>
                                                <div style={{ color: '#4a5980', fontSize: 11 }}>{s.count} expense{s.count !== 1 ? 's' : ''}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Plan breakdown */}
                            {Object.keys(planCount).length > 0 && (
                                <div className="card" style={{ marginBottom: 24 }}>
                                    <div style={{ fontWeight: 700, color: '#e2e8f0', marginBottom: 14, fontSize: 14 }}>Active Licenses by Plan</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                                        {Object.entries(planCount).map(([plan, count]) => (
                                            <div key={plan} style={{ background: '#161c2d', border: '1px solid #252d42', borderRadius: 8, padding: '8px 16px', display: 'flex', gap: 8, alignItems: 'baseline' }}>
                                                <span style={{ fontWeight: 700, fontSize: 20, color: '#e2e8f0' }}>{count}</span>
                                                <span style={{ fontSize: 12, color: '#4a5980', textTransform: 'capitalize' }}>{plan}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Recent licenses */}
                            <div style={{ fontWeight: 700, color: '#e2e8f0', marginBottom: 12, fontSize: 14 }}>
                                Recent Licenses
                            </div>
                            <div className="table-wrap">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Client</th>
                                            <th>Key</th>
                                            <th>Plan</th>
                                            <th>Issued By</th>
                                            <th>Issued At</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {recent.length === 0 ? (
                                            <tr><td colSpan={6} className="empty">No licenses yet</td></tr>
                                        ) : recent.map(l => {
                                            const days = getDaysLeft(l);
                                            const isExpired = !l.isLifetime && days !== null && days < 0;
                                            return (
                                                <tr key={l.key}>
                                                    <td><span className="bold">{l.clientName}</span></td>
                                                    <td><span className="mono">{l.key.slice(0, 20)}…</span></td>
                                                    <td><span className={`badge badge-plan-${l.plan}`}>{l.plan}</span></td>
                                                    <td>{l.issuedByName}</td>
                                                    <td>{fmtDate(l.issuedAt)}</td>
                                                    <td>
                                                        {l.revoked  && <span className="badge badge-revoked">Revoked</span>}
                                                        {!l.revoked && isExpired && <span className="badge badge-expired">Expired</span>}
                                                        {!l.revoked && !isExpired && <span className="badge badge-active">Active</span>}
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
    );
}
