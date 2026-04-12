'use client';
import { useEffect, useState, useMemo } from 'react';
import AppLayout from '@/components/AppLayout';
import { apiFetch } from '@/lib/apiFetch';

function fmtDate(ts) {
    if (!ts) return '—';
    return new Date(ts * 1000).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

function fmtMoney(v) {
    const n = Math.max(0, parseFloat(v) || 0);
    return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

const ACTION_META = {
    LICENSE_GENERATED:  { label: 'License Generated',  color: '#22c55e', icon: '✦' },
    LICENSE_REVOKED:    { label: 'License Revoked',    color: '#f59e0b', icon: '⊘' },
    LICENSE_DELETED:    { label: 'License Deleted',    color: '#ef4444', icon: '✕' },
    LICENSE_CONVERTED:  { label: 'Trial Converted',    color: '#6366f1', icon: '⇄' },
};

export default function LogsPage() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // all | warning | LICENSE_GENERATED | LICENSE_REVOKED | LICENSE_DELETED
    const [search, setSearch] = useState('');
    const [clearStep, setClearStep] = useState(0); // 0=idle 1=first confirm 2=second confirm
    const [clearBusy, setClearBusy] = useState(false);

    useEffect(() => {
        apiFetch('/api/logs').then(r => {
            if (r?.ok) setLogs(r.data || []);
            setLoading(false);
        });
    }, []);

    const clearLogs = async () => {
        setClearBusy(true);
        const r = await apiFetch('/api/logs', { method: 'DELETE' });
        if (r?.ok) {
            setLogs([]);
            setClearStep(0);
        }
        setClearBusy(false);
    };

    const filtered = useMemo(() => {
        let list = logs;
        if (filter === 'warning') list = list.filter(l => l.flag === 'warning');
        else if (filter !== 'all') list = list.filter(l => l.action === filter);
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(l =>
                l.actorName?.toLowerCase().includes(q) ||
                l.meta?.clientName?.toLowerCase().includes(q) ||
                l.meta?.key?.toLowerCase().includes(q) ||
                l.action?.toLowerCase().includes(q)
            );
        }
        return list;
    }, [logs, filter, search]);

    const warnCount = logs.filter(l => l.flag === 'warning').length;
    const genCount  = logs.filter(l => l.action === 'LICENSE_GENERATED').length;
    const revCount  = logs.filter(l => l.action === 'LICENSE_REVOKED').length;
    const delCount  = logs.filter(l => l.action === 'LICENSE_DELETED').length;

    return (
        <AppLayout>
            <div className="page">
                <div className="page-header">
                    <div>
                        <div className="page-title">Activity Logs</div>
                        <div className="page-subtitle">All license operations — last 300 entries</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        {clearStep === 0 && (
                            <button className="btn btn-ghost" style={{ color: '#ef4444', borderColor: '#ef444433' }}
                                onClick={() => setClearStep(1)} disabled={logs.length === 0}>
                                🗑 Clear Logs
                            </button>
                        )}
                        {clearStep === 1 && (
                            <>
                                <span style={{ fontSize: 13, color: '#f59e0b' }}>Are you sure?</span>
                                <button className="btn btn-ghost" style={{ color: '#ef4444', borderColor: '#ef444433' }}
                                    onClick={() => setClearStep(2)}>
                                    Yes, clear all
                                </button>
                                <button className="btn btn-ghost" onClick={() => setClearStep(0)}>Cancel</button>
                            </>
                        )}
                        {clearStep === 2 && (
                            <>
                                <span style={{ fontSize: 13, color: '#ef4444', fontWeight: 600 }}>This cannot be undone!</span>
                                <button className="btn btn-primary" style={{ background: '#ef4444', borderColor: '#ef4444' }}
                                    onClick={clearLogs} disabled={clearBusy}>
                                    {clearBusy ? 'Clearing…' : 'Confirm — Delete All Logs'}
                                </button>
                                <button className="btn btn-ghost" onClick={() => setClearStep(0)} disabled={clearBusy}>Cancel</button>
                            </>
                        )}
                    </div>
                </div>

                <div className="page-body">
                    {/* Stats */}
                    <div className="stats-grid" style={{ marginBottom: 20 }}>
                        <div className="stat-card">
                            <div className="stat-label">Total Logs</div>
                            <div className="stat-value stat-accent">{logs.length}</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-label">Generated</div>
                            <div className="stat-value stat-green">{genCount}</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-label">Revoked</div>
                            <div className="stat-value" style={{ color: '#f59e0b' }}>{revCount}</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-label">Deleted</div>
                            <div className="stat-value stat-red">{delCount}</div>
                        </div>
                        {warnCount > 0 && (
                            <div className="stat-card" style={{ border: '1px solid #ef444466' }}>
                                <div className="stat-label">⚠ With Amount Lost</div>
                                <div className="stat-value stat-red">{warnCount}</div>
                                <div className="stat-sub">Deleted licenses that had a price</div>
                            </div>
                        )}
                    </div>

                    {/* Filters */}
                    <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                        <input
                            className="form-input"
                            style={{ maxWidth: 260 }}
                            placeholder="Search client, key, action…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                        {['all', 'warning', 'LICENSE_GENERATED', 'LICENSE_REVOKED', 'LICENSE_DELETED'].map(f => (
                            <button
                                key={f}
                                className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-ghost'}`}
                                onClick={() => setFilter(f)}
                            >
                                {f === 'all' ? 'All'
                                    : f === 'warning' ? `⚠ Amount Lost (${warnCount})`
                                    : f === 'LICENSE_GENERATED' ? 'Generated'
                                    : f === 'LICENSE_REVOKED' ? 'Revoked'
                                    : 'Deleted'}
                            </button>
                        ))}
                    </div>

                    {loading ? (
                        <div className="empty">Loading logs…</div>
                    ) : filtered.length === 0 ? (
                        <div className="empty">No log entries found.</div>
                    ) : (
                        <div className="table-wrap">
                            <table>
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Time</th>
                                        <th>Action</th>
                                        <th>Done By</th>
                                        <th>Client</th>
                                        <th>Plan</th>
                                        <th>Amount</th>
                                        <th>Key</th>
                                        <th>Note</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map((log, i) => {
                                        const am = ACTION_META[log.action] || { label: log.action, color: '#94a3b8', icon: '•' };
                                        const isWarn = log.flag === 'warning';
                                        const price = Math.max(0, parseFloat(log.meta?.discountedPrice ?? log.meta?.price) || 0);
                                        return (
                                            <tr key={log.id} style={isWarn ? { background: 'rgba(239,68,68,0.07)' } : {}}>
                                                <td style={{ color: '#3a4560', fontSize: 12 }}>{i + 1}</td>
                                                <td style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>{fmtDate(log.ts)}</td>
                                                <td>
                                                    <span style={{
                                                        display: 'inline-flex', alignItems: 'center', gap: 5,
                                                        background: am.color + '22',
                                                        color: am.color,
                                                        borderRadius: 6, padding: '3px 8px', fontSize: 12, fontWeight: 600,
                                                    }}>
                                                        <span>{am.icon}</span>
                                                        <span>{am.label}</span>
                                                    </span>
                                                    {isWarn && (
                                                        <span style={{ marginLeft: 6, fontSize: 11, color: '#ef4444', fontWeight: 700 }}>⚠ Amount Affected</span>
                                                    )}
                                                </td>
                                                <td>
                                                    <span style={{ fontWeight: 600 }}>{log.actorName}</span>
                                                    <span style={{ fontSize: 11, color: '#4a5980', marginLeft: 5 }}>[{log.actorRole}]</span>
                                                </td>
                                                <td>
                                                    <div style={{ fontWeight: 600 }}>{log.meta?.clientName || '—'}</div>
                                                    {log.meta?.clientPhone && (
                                                        <div style={{ fontSize: 11, color: '#64748b' }}>{log.meta.clientPhone}</div>
                                                    )}
                                                </td>
                                                <td>
                                                    <span style={{ textTransform: 'capitalize' }}>{log.meta?.plan || '—'}</span>
                                                </td>
                                                <td style={{ fontWeight: 700, color: price > 0 ? (isWarn ? '#ef4444' : '#22c55e') : '#3a4560' }}>
                                                    {price > 0 ? fmtMoney(price) : '—'}
                                                </td>
                                                <td>
                                                    <span style={{ fontFamily: 'Courier New, monospace', fontSize: 10, color: '#4a5980', wordBreak: 'break-all' }}>
                                                        {log.meta?.key || '—'}
                                                    </span>
                                                </td>
                                                <td style={{ maxWidth: 260, fontSize: 12, color: isWarn ? '#fca5a5' : '#64748b' }}>
                                                    {log.action === 'LICENSE_DELETED' && log.meta?.note
                                                        ? log.meta.note
                                                        : log.action === 'LICENSE_REVOKED' && log.meta?.reason
                                                        ? `Reason: ${log.meta.reason}`
                                                        : '—'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}
