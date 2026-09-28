'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import { apiFetch } from '@/lib/apiFetch';
import Icon from '@/components/Icons';
import { CardsSkeleton, TableSkeleton } from '@/components/Skeleton';
import { useToast } from '@/components/Toast';

function fmtDate(ts) {
    if (!ts) return '—';
    return new Date(ts * 1000).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getDaysLeft(lic) {
    if (lic.isLifetime) return null;
    if (!lic.expiryTs) return null; // missing expiry — treat as unknown, not NaN
    const secs = lic.expiryTs - Math.floor(Date.now() / 1000);
    return Math.floor(secs / 86400);
}

/* ── count-up animation ─────────────────────────────────────────────────── */

function useCountUp(target, duration = 900) {
    const [val, setVal] = useState(0);
    useEffect(() => {
        if (!target || target <= 0) { setVal(0); return; }
        let raf;
        const t0 = performance.now();
        const tick = (t) => {
            const p = Math.min(1, (t - t0) / duration);
            const eased = 1 - Math.pow(1 - p, 3);
            setVal(Math.round(target * eased));
            if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [target, duration]);
    return val;
}

function CountValue({ n, prefix = '' }) {
    const v = useCountUp(n);
    return <>{prefix}{v.toLocaleString('en-IN')}</>;
}

/* ── week-over-week trend pill ──────────────────────────────────────────── */

function Trend({ curr, prev }) {
    if (!prev) return curr > 0
        ? <span className="db-trend up">new</span>
        : <span className="db-trend flat">—</span>;
    const pct = Math.round(((curr - prev) / prev) * 100);
    if (pct === 0) return <span className="db-trend flat">flat</span>;
    return pct > 0
        ? <span className="db-trend up">▲ {pct}%</span>
        : <span className="db-trend down">▼ {Math.abs(pct)}%</span>;
}

/* ── mini sparkline (hero cards) ────────────────────────────────────────── */

function Sparkline({ data, color = '#a78bfa', id }) {
    if (!data || data.length < 2) return null;
    const W = 120, H = 30;
    const max = Math.max(1, ...data);
    const step = W / (data.length - 1);
    const pts = data.map((v, i) => `${(i * step).toFixed(1)},${(H - 3 - (v / max) * (H - 7)).toFixed(1)}`);
    return (
        <svg className="sparkline" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
            <defs>
                <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity=".28" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>
            <polygon className="spark-fill" points={`0,${H} ${pts.join(' ')} ${W},${H}`} fill={`url(#${id})`} />
            <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="1.6"
                strokeLinecap="round" strokeLinejoin="round" opacity=".85" />
        </svg>
    );
}

/* ── revenue trend area chart ───────────────────────────────────────────── */

function TrendChart({ days }) {
    const W = 640, H = 215, PX = 6, PT = 14, PB = 26;
    const max = Math.max(1, ...days.map(d => d.revenue));
    const step = (W - PX * 2) / (days.length - 1);
    const y = (v) => PT + (1 - v / max) * (H - PT - PB);
    const pts = days.map((d, i) => ({ x: PX + i * step, y: y(d.revenue), ...d }));
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const area = `${line} L${(W - PX).toFixed(1)},${H - PB} L${PX},${H - PB} Z`;
    const fmtK = (v) => v >= 100000 ? `₹${(v / 100000).toFixed(1)}L` : v >= 1000 ? `₹${(v / 1000).toFixed(1)}k` : `₹${v}`;
    const fmtDay = (ts) => new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    const uid = 'trendgrad';

    return (
        <svg className="chart-svg" viewBox={`0 0 ${W} ${H}`}>
            <defs>
                <linearGradient id={uid} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7c3aed" stopOpacity=".38" />
                    <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
                </linearGradient>
            </defs>
            {/* gridlines */}
            {[0, .5, 1].map(f => (
                <g key={f}>
                    <line className="chart-grid" x1={PX} x2={W - PX} y1={y(max * f)} y2={y(max * f)} />
                    <text className="chart-lab" x={PX + 2} y={y(max * f) - 4}>{fmtK(Math.round(max * f))}</text>
                </g>
            ))}
            {/* area + line */}
            <path className="chart-area" d={area} fill={`url(#${uid})`} />
            <path className="chart-line" d={line} pathLength="1" />
            {/* x labels — every other day */}
            {pts.map((p, i) => (i % 2 === 0 || i === pts.length - 1) && (
                <text key={i} className="chart-lab" x={p.x} y={H - 8} textAnchor={i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle'}>
                    {fmtDay(p.start.getTime())}
                </text>
            ))}
            {/* hover dots */}
            {pts.map((p, i) => (
                <circle key={i} className={i === pts.length - 1 ? 'chart-dot chart-dot-last' : 'chart-dot'} cx={p.x} cy={p.y} r={i === pts.length - 1 ? 4 : 3}>
                    <title>{`${fmtDay(p.start.getTime())} — ${fmtK(p.revenue)} · ${p.count} license${p.count !== 1 ? 's' : ''}`}</title>
                </circle>
            ))}
        </svg>
    );
}

/* ── license mix donut ──────────────────────────────────────────────────── */

function Donut({ segments, total, centerLabel }) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        const t = setTimeout(() => setMounted(true), 250);
        return () => clearTimeout(t);
    }, []);
    const R = 52, C = 2 * Math.PI * R;
    let acc = 0;
    return (
        <div className="donut-flex">
            <svg className="donut-svg" viewBox="0 0 140 140">
                <g transform="rotate(-90 70 70)">
                    <circle cx="70" cy="70" r={R} fill="none" stroke="rgba(255,255,255,.05)" strokeWidth="13" />
                    {segments.map(s => {
                        const frac = total ? s.value / total : 0;
                        const dash = mounted ? `${Math.max(frac * C - 2, 0)} ${C}` : `0 ${C}`;
                        const off = -acc * C;
                        acc += frac;
                        return (
                            <circle key={s.label} cx="70" cy="70" r={R} fill="none" stroke={s.color}
                                strokeWidth="13" strokeDasharray={dash} strokeDashoffset={off}
                                style={{ transition: 'stroke-dasharray 1s cubic-bezier(.2,.8,.3,1)' }}>
                                <title>{`${s.label}: ${s.value}`}</title>
                            </circle>
                        );
                    })}
                </g>
                <text x="70" y="68" textAnchor="middle" className="donut-num">{total}</text>
                <text x="70" y="84" textAnchor="middle" className="donut-cap">{centerLabel}</text>
            </svg>
            <div className="donut-legend">
                {segments.map(s => (
                    <div key={s.label} className="donut-leg">
                        <span className="donut-leg-dot" style={{ background: s.color }} />
                        {s.label}
                        <small>{total ? Math.round((s.value / total) * 100) : 0}%</small>
                        <b>{s.value}</b>
                    </div>
                ))}
            </div>
        </div>
    );
}

/* ── page ───────────────────────────────────────────────────────────────── */

const PLAN_COLORS = {
    monthly: 'linear-gradient(90deg, rgba(74,158,255,.45), #4a9eff)',
    '3months': 'linear-gradient(90deg, rgba(96,165,250,.45), #60a5fa)',
    '6months': 'linear-gradient(90deg, rgba(45,212,191,.4), #2dd4bf)',
    yearly: 'linear-gradient(90deg, rgba(34,197,94,.4), #22c55e)',
    lifetime: 'linear-gradient(90deg, rgba(124,58,237,.45), #a78bfa)',
    trial: 'linear-gradient(90deg, rgba(245,158,11,.4), #f59e0b)',
    trial1day: 'linear-gradient(90deg, rgba(245,158,11,.4), #f59e0b)',
    custom: 'linear-gradient(90deg, rgba(148,163,184,.4), #94a3b8)',
};

const MODE_META = {
    desktop: { label: 'Desktop', background: 'rgba(139,146,176,.15)', color: '#8b93b0' },
    cloud:   { label: 'Cloud',   background: 'rgba(37,211,102,.15)',  color: '#25D366' },
    app:     { label: 'App',     background: 'rgba(74,158,255,.15)',  color: '#4a9eff' },
};

export default function DashboardPage() {
    const router = useRouter();
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
    const [demoEnabled, setDemoEnabled] = useState(true);
    const [demoBusy, setDemoBusy] = useState(false);
    const [demoMessage, setDemoMessage] = useState('');
    const toast = useToast();

    useEffect(() => {
        const cached = localStorage.getItem('zyqora_admin_user');
        if (cached) try {
            const u = JSON.parse(cached);
            setUser(u);
            // Whitelabel resellers only have the Licenses module
            if (u?.role === 'whitelabel') { router.replace('/licenses'); return; }
        } catch {}

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
            const demoRes = await apiFetch('/api/settings/demo');
            if (demoRes?.ok) setDemoEnabled(demoRes.data?.enabled !== false);
            setLoading(false);
        };
        loadData();
    }, []);

    async function toggleDemo() {
        setDemoBusy(true);
        setDemoMessage('');
        const next = !demoEnabled;
        const res = await apiFetch('/api/settings/demo', { method: 'POST', body: { enabled: next } });
        if (res?.ok) {
            setDemoEnabled(next);
            setDemoMessage(next ? 'Demo is enabled' : 'Demo is disabled');
            toast.success(next ? 'Public demo enabled' : 'Public demo disabled');
        } else {
            setDemoMessage(res?.data?.error || 'Could not update demo status');
            toast.error(res?.data?.error || 'Could not update demo status');
        }
        setDemoBusy(false);
    }

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

    // Week-over-week momentum
    const wkStart = now - 7 * 86400, prevWkStart = now - 14 * 86400;
    const weekIssued = licenses.filter(l => (l.issuedAt || 0) >= wkStart).length;
    const prevWeekIssued = licenses.filter(l => (l.issuedAt || 0) >= prevWkStart && (l.issuedAt || 0) < wkStart).length;
    const weekRevenue = sales.filter(s => !s.revoked && (s.issuedAt || 0) >= wkStart).reduce((t, s) => t + (Number(s.price) || 0), 0);
    const prevWeekRevenue = sales.filter(s => !s.revoked && (s.issuedAt || 0) >= prevWkStart && (s.issuedAt || 0) < wkStart).reduce((t, s) => t + (Number(s.price) || 0), 0);

    // 14-day daily series for the trend chart + sparklines
    const daySeries = useMemo(() => {
        const days = [];
        const d0 = new Date(); d0.setHours(0, 0, 0, 0);
        for (let i = 13; i >= 0; i--) {
            const start = new Date(d0.getTime() - i * 86400000);
            days.push({ start, key: start.toDateString(), count: 0, revenue: 0 });
        }
        const byKey = Object.fromEntries(days.map(d => [d.key, d]));
        for (const l of licenses) {
            if (!l.issuedAt) continue;
            const k = new Date(l.issuedAt * 1000).toDateString();
            if (byKey[k]) byKey[k].count += 1;
        }
        for (const s of sales) {
            if (!s.issuedAt || s.revoked) continue;
            const k = new Date(s.issuedAt * 1000).toDateString();
            if (byKey[k]) byKey[k].revenue += Number(s.price) || 0;
        }
        return days;
    }, [licenses, sales]);

    // Active license mix by platform
    const mix = licenses.filter(l => !l.revoked).reduce((acc, l) => {
        const m = l.licenseMode || 'desktop';
        acc[m] = (acc[m] || 0) + 1;
        return acc;
    }, {});
    const mixSegments = [
        { label: 'Desktop', value: mix.desktop || 0, color: '#8b93b0' },
        { label: 'Cloud',   value: mix.cloud   || 0, color: '#25D366' },
        { label: 'App',     value: mix.app     || 0, color: '#4a9eff' },
    ].filter(s => s.value > 0);
    const mixTotal = mixSegments.reduce((t, s) => t + s.value, 0);

    // Licenses expiring within 7 days — the actionable list
    const expiringSoon = licenses
        .filter(l => !l.revoked && !l.isLifetime && l.expiryTs > now && (l.expiryTs - now) <= 7 * 86400)
        .map(l => ({ ...l, daysLeft: Math.floor((l.expiryTs - now) / 86400) }))
        .sort((a, b) => a.daysLeft - b.daysLeft)
        .slice(0, 6);

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
    const moneyLeft = user?.role === 'super' ? actualCash : globalStats.moneyLeft;

    const planCount = licenses.reduce((acc, l) => {
        if (!l.revoked) acc[l.plan] = (acc[l.plan] || 0) + 1;
        return acc;
    }, {});
    const planMax = Math.max(1, ...Object.values(planCount));
    const spendMax = topSpenders[0]?.total || 1;

    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const displayName = user?.name || user?.username || 'there';

    return (
        <AppLayout>
            <div className="page">
                <div className="page-header">
                    <div>
                        <div className="page-title db-greet">{greeting}, {displayName} 👋</div>
                        <div className="page-subtitle">
                            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                            {' '}· Here&apos;s what&apos;s happening with your business
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <button className="btn btn-primary" onClick={() => router.push('/licenses')}>
                            <Icon name="key" size={14} style={{ marginRight: 6 }} />Generate License
                        </button>
                        <button className="btn btn-ghost" onClick={() => router.push('/sales')}>View Sales</button>
                    </div>
                </div>

                <div className="page-body">
                    {loading ? (
                        <>
                            <CardsSkeleton cards={8} />
                            <TableSkeleton rows={5} />
                        </>
                    ) : (
                        <>
                            {/* ── hero KPIs ── */}
                            <div className="db-hero db-in">
                                <div className="db-kpi">
                                    <div className="db-kpi-head">
                                        <div className="db-kpi-icon" data-tone="green"><Icon name="trending" size={17} /></div>
                                        <Trend curr={weekRevenue} prev={prevWeekRevenue} />
                                    </div>
                                    <div className="db-kpi-label">TOTAL REVENUE</div>
                                    <div className="db-kpi-value" style={{ color: 'var(--green)' }}>
                                        <CountValue n={totalRevenue} prefix="₹" />
                                    </div>
                                    <div className="db-kpi-sub">₹{weekRevenue.toLocaleString('en-IN')} this week</div>
                                    <Sparkline id="spark-rev" data={daySeries.map(d => d.revenue)} color="#22c55e" />
                                </div>

                                <div className="db-kpi">
                                    <div className="db-kpi-head">
                                        <div className="db-kpi-icon"><Icon name="rupee" size={17} /></div>
                                    </div>
                                    <div className="db-kpi-label">MONEY LEFT</div>
                                    <div className="db-kpi-value" style={{ color: moneyLeft >= 0 ? 'var(--accent-light)' : 'var(--red)' }}>
                                        <CountValue n={moneyLeft} prefix="₹" />
                                    </div>
                                    <div className="db-kpi-sub">
                                        {user?.role === 'super' ? 'After expenses, withdrawals & payouts' : 'Business net after expenses & withdrawals'}
                                    </div>
                                    <Sparkline id="spark-cash" data={daySeries.map(d => d.revenue)} color="#a78bfa" />
                                </div>

                                <div className="db-kpi">
                                    <div className="db-kpi-head">
                                        <div className="db-kpi-icon" data-tone="blue"><Icon name="key" size={17} /></div>
                                        <Trend curr={weekIssued} prev={prevWeekIssued} />
                                    </div>
                                    <div className="db-kpi-label">ACTIVE LICENSES</div>
                                    <div className="db-kpi-value" style={{ color: 'var(--blue)' }}>
                                        <CountValue n={active} />
                                    </div>
                                    <div className="db-kpi-sub">{total} issued all-time</div>
                                    <Sparkline id="spark-lic" data={daySeries.map(d => d.count)} color="#4a9eff" />
                                </div>

                                <div className="db-kpi">
                                    <div className="db-kpi-head">
                                        <div className="db-kpi-icon" data-tone="amber"><Icon name="zap" size={17} /></div>
                                        <Trend curr={weekIssued} prev={prevWeekIssued} />
                                    </div>
                                    <div className="db-kpi-label">ISSUED THIS WEEK</div>
                                    <div className="db-kpi-value" style={{ color: 'var(--amber)' }}>
                                        <CountValue n={weekIssued} />
                                    </div>
                                    <div className="db-kpi-sub">{issuedToday} today · {prevWeekIssued} last week</div>
                                    <Sparkline id="spark-week" data={daySeries.map(d => d.count)} color="#f59e0b" />
                                </div>
                            </div>

                            {/* ── charts ── */}
                            <div className="db-charts db-in" style={{ animationDelay: '.08s' }}>
                                <div className="panel">
                                    <div className="chart-head">
                                        <div>
                                            <div className="chart-title">Revenue — last 14 days</div>
                                            <div className="chart-sub">Hover the points for daily detail</div>
                                        </div>
                                        <span className="db-trend up" style={{ background: 'var(--accent-soft)', color: 'var(--accent-light)' }}>
                                            ₹{weekRevenue.toLocaleString('en-IN')} / wk
                                        </span>
                                    </div>
                                    <TrendChart days={daySeries} />
                                </div>
                                <div className="panel">
                                    <div className="chart-head">
                                        <div>
                                            <div className="chart-title">License mix</div>
                                            <div className="chart-sub">Active by platform</div>
                                        </div>
                                    </div>
                                    {mixTotal > 0
                                        ? <Donut segments={mixSegments} total={mixTotal} centerLabel="Active" />
                                        : <div className="empty">No active licenses yet</div>}
                                </div>
                            </div>

                            {/* ── secondary stats ── */}
                            <div className="db-strip db-in" style={{ animationDelay: '.14s' }}>
                                <div className="db-pill">
                                    <div className="db-pill-icon" data-tone="teal"><Icon name="check" size={14} /></div>
                                    <div><div className="db-pill-num">{total}</div><div className="db-pill-lab">Total Licenses</div></div>
                                </div>
                                <div className="db-pill">
                                    <div className="db-pill-icon" data-tone="red"><Icon name="shield" size={14} /></div>
                                    <div><div className="db-pill-num">{revoked}</div><div className="db-pill-lab">Revoked</div></div>
                                </div>
                                <div className="db-pill">
                                    <div className="db-pill-icon"><Icon name="clock" size={14} /></div>
                                    <div><div className="db-pill-num">{expired}</div><div className="db-pill-lab">Expired</div></div>
                                </div>
                                <div className="db-pill">
                                    <div className="db-pill-icon" data-tone="amber"><Icon name="zap" size={14} /></div>
                                    <div><div className="db-pill-num">{issuedToday}</div><div className="db-pill-lab">Issued Today</div></div>
                                </div>
                                <div className="db-pill">
                                    <div className="db-pill-icon" data-tone="red"><Icon name="wallet" size={14} /></div>
                                    <div><div className="db-pill-num">₹{totalExpenses.toLocaleString('en-IN')}</div><div className="db-pill-lab">Total Expenses</div></div>
                                </div>
                                {user?.role === 'super' && (
                                    <div className="db-pill">
                                        <div className="db-pill-icon" data-tone="blue"><Icon name="users" size={14} /></div>
                                        <div><div className="db-pill-num">{admins.length}</div><div className="db-pill-lab">Admins · {admins.filter(a => a.active).length} active</div></div>
                                    </div>
                                )}
                                {user?.role === 'super' && (
                                    <div className="db-pill">
                                        <div className="db-pill-icon" data-tone="amber"><Icon name="share" size={14} /></div>
                                        <div><div className="db-pill-num">₹{affiliateStillOwed.toLocaleString('en-IN')}</div><div className="db-pill-lab">Affiliate Owed</div></div>
                                    </div>
                                )}
                                {user?.role === 'super' && (
                                    <div className="db-pill">
                                        <div className="db-pill-icon" data-tone="green"><Icon name="trending" size={14} /></div>
                                        <div><div className="db-pill-num" style={{ color: netAfterAll >= 0 ? 'var(--green)' : 'var(--red)' }}>₹{netAfterAll.toLocaleString('en-IN')}</div><div className="db-pill-lab">Net After Affiliates</div></div>
                                    </div>
                                )}
                            </div>

                            {/* ── expiring soon + plan breakdown ── */}
                            <div className="db-split db-in" style={{ animationDelay: '.2s' }}>
                                <div className="panel">
                                    <div className="chart-head">
                                        <div>
                                            <div className="chart-title">⏳ Expiring soon</div>
                                            <div className="chart-sub">Active licenses expiring within 7 days</div>
                                        </div>
                                    </div>
                                    {expiringSoon.length === 0 ? (
                                        <div className="empty" style={{ padding: '26px 12px' }}>
                                            <span style={{ color: 'var(--green)' }}>✓</span> No licenses expiring in the next 7 days
                                        </div>
                                    ) : expiringSoon.map(l => (
                                        <div className="db-exp-row" key={l.key}>
                                            <span className={`days-chip ${l.daysLeft <= 2 ? 'urgent' : 'soon'}`}>
                                                {l.daysLeft === 0 ? 'Today' : `${l.daysLeft}d`}
                                            </span>
                                            <span className="db-exp-name">{l.clientName}</span>
                                            <span className={`badge badge-plan-${l.plan}`} style={{ textTransform: 'capitalize' }}>{l.plan}</span>
                                            <span className="db-exp-meta">{fmtDate(l.expiryTs)}</span>
                                        </div>
                                    ))}
                                </div>

                                <div className="panel">
                                    <div className="chart-head">
                                        <div>
                                            <div className="chart-title">Active by plan</div>
                                            <div className="chart-sub">{Object.values(planCount).reduce((a, b) => a + b, 0)} active licenses</div>
                                        </div>
                                    </div>
                                    {Object.entries(planCount)
                                        .sort((a, b) => b[1] - a[1])
                                        .map(([plan, count], i) => (
                                            <div className="meter-row" key={plan}>
                                                <span className="meter-name">{plan}</span>
                                                <div className="meter-track">
                                                    <div className="meter-fill" style={{
                                                        width: `${(count / planMax) * 100}%`,
                                                        background: PLAN_COLORS[plan] || PLAN_COLORS.custom,
                                                        animationDelay: `${i * 0.07}s`,
                                                    }} />
                                                </div>
                                                <span className="meter-val">{count} <small>{Math.round((count / planMax) * 100)}%</small></span>
                                            </div>
                                        ))}
                                </div>
                            </div>

                            {/* ── demo toggle + top spenders (super) ── */}
                            {user?.role === 'super' && (
                                <div className="db-split db-in" style={{ animationDelay: '.26s' }}>
                                    <div className="panel">
                                        <div className="chart-head">
                                            <div>
                                                <div className="chart-title">Top expense users</div>
                                                <div className="chart-sub">Largest spenders across all expenses</div>
                                            </div>
                                        </div>
                                        {topSpenders.length === 0 ? (
                                            <div className="empty" style={{ padding: '26px 12px' }}>No expenses recorded yet</div>
                                        ) : topSpenders.map((s, i) => (
                                            <div className="meter-row" key={s.id}>
                                                <span className="meter-name">#{i + 1} {s.name}</span>
                                                <div className="meter-track">
                                                    <div className="meter-fill" style={{
                                                        width: `${(s.total / spendMax) * 100}%`,
                                                        background: 'linear-gradient(90deg, rgba(239,68,68,.4), #ef4444)',
                                                        animationDelay: `${i * 0.07}s`,
                                                    }} />
                                                </div>
                                                <span className="meter-val">₹{s.total.toLocaleString('en-IN')} <small>×{s.count}</small></span>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                        <div className="chart-head">
                                            <div>
                                                <div className="chart-title">Public demo site</div>
                                                <div className="chart-sub">
                                                    {demoEnabled ? 'demo.zyqora.in is open to visitors' : 'Visitors are redirected to zyqora.in'}
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
                                            <div style={{
                                                fontSize: 12, color: demoEnabled ? 'var(--green)' : 'var(--text-ghost)',
                                                background: demoEnabled ? 'var(--green-soft)' : 'rgba(255,255,255,.04)',
                                                border: `1px solid ${demoEnabled ? 'rgba(34,197,94,.3)' : 'var(--border)'}`,
                                                padding: '6px 12px', borderRadius: 999, fontWeight: 700,
                                            }}>
                                                {demoEnabled ? '● LIVE' : '○ OFF'}
                                            </div>
                                            <button className={`btn ${demoEnabled ? 'btn-ghost' : 'btn-primary'}`} onClick={toggleDemo} disabled={demoBusy}>
                                                {demoBusy ? 'Updating…' : demoEnabled ? 'Disable Demo' : 'Enable Demo'}
                                            </button>
                                        </div>
                                        {demoMessage && <div style={{ color: 'var(--green)', fontSize: 12, marginTop: 10 }}>{demoMessage}</div>}
                                    </div>
                                </div>
                            )}

                            {/* ── recent licenses ── */}
                            <div className="db-in" style={{ animationDelay: '.32s' }}>
                                <div className="chart-head" style={{ marginBottom: 10 }}>
                                    <div>
                                        <div className="chart-title">Recent licenses</div>
                                        <div className="chart-sub">Latest 8 issued</div>
                                    </div>
                                    <button className="btn btn-ghost btn-sm" onClick={() => router.push('/licenses')}>View all →</button>
                                </div>
                                <div className="table-wrap">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Client</th>
                                                <th>Key</th>
                                                <th>Type</th>
                                                <th>Plan</th>
                                                <th>Issued By</th>
                                                <th>Issued At</th>
                                                <th>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {recent.length === 0 ? (
                                                <tr><td colSpan={7} className="empty">No licenses yet</td></tr>
                                            ) : recent.map(l => {
                                                const days = getDaysLeft(l);
                                                const isExpired = !l.isLifetime && days !== null && days < 0;
                                                const mode = MODE_META[l.licenseMode] || MODE_META.desktop;
                                                return (
                                                    <tr key={l.key}>
                                                        <td><span className="bold">{l.clientName}</span></td>
                                                        <td><span className="mono">{l.key.slice(0, 20)}…</span></td>
                                                        <td>
                                                            <span className="badge" style={{ background: mode.background, color: mode.color }}>
                                                                {mode.label}
                                                            </span>
                                                        </td>
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
                            </div>
                        </>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}
