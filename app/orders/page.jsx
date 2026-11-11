'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import { apiFetch } from '@/lib/apiFetch';
import { TableSkeleton } from '@/components/Skeleton';
import { useToast } from '@/components/Toast';

function fmtDateTime(ts) {
    if (!ts) return '—';
    return new Date(ts * 1000).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function fmtMoney(v) {
    const n = Math.max(0, parseFloat(v) || 0);
    return '₹' + n.toLocaleString('en-IN');
}
const STATUS_META = {
    pending:  { label: 'Pending',  bg: 'rgba(245,158,11,.15)', color: '#f59e0b' },
    approved: { label: 'Approved', bg: 'rgba(34,197,94,.15)',  color: '#22c55e' },
    rejected: { label: 'Rejected', bg: 'rgba(239,68,68,.15)',  color: '#ef4444' },
};
const MODE_LABEL = { desktop: 'PC / Desktop', app: 'Android App' };

export default function OrdersPage() {
    const router = useRouter();
    const toast = useToast();
    const [user, setUser] = useState(null);
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState('pending');
    const [search, setSearch] = useState('');
    const [busyId, setBusyId] = useState('');
    const [rejectTarget, setRejectTarget] = useState(null);
    const [rejectReason, setRejectReason] = useState('');

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
        const r = await apiFetch('/api/checkout/list');
        setOrders(r?.ok ? (r.data?.orders || []) : []);
        setLoading(false);
    };

    const counts = orders.reduce((a, o) => { a[o.status] = (a[o.status] || 0) + 1; return a; }, {});

    const filtered = orders.filter(o => {
        if (tab !== 'all' && o.status !== tab) return false;
        if (search.trim()) {
            const q = search.toLowerCase();
            return (
                o.customer?.name?.toLowerCase().includes(q) ||
                o.customer?.phone?.includes(q) ||
                o.customer?.email?.toLowerCase().includes(q) ||
                o.machineId?.toLowerCase().includes(q) ||
                o.utr?.toLowerCase().includes(q) ||
                o.orderId?.toLowerCase().includes(q)
            );
        }
        return true;
    });

    const approve = async (o) => {
        setBusyId(o.orderId);
        const r = await apiFetch('/api/checkout/approve', { method: 'POST', body: { orderId: o.orderId } });
        setBusyId('');
        if (!r?.ok) { toast.error(r?.data?.error || 'Could not approve'); return; }
        toast.success('Approved — key issued & emailed');
        load();
    };

    const doReject = async () => {
        if (!rejectTarget) return;
        setBusyId(rejectTarget.orderId);
        const r = await apiFetch('/api/checkout/reject', { method: 'POST', body: { orderId: rejectTarget.orderId, reason: rejectReason } });
        setBusyId('');
        setRejectTarget(null);
        setRejectReason('');
        if (!r?.ok) { toast.error(r?.data?.error || 'Could not reject'); return; }
        toast.success('Order rejected');
        load();
    };

    const copyKey = async (k) => {
        try { await navigator.clipboard.writeText(k); toast.success('Key copied'); } catch { /* ignore */ }
    };

    const TABS = [
        { id: 'pending',  label: 'Pending'  },
        { id: 'approved', label: 'Approved' },
        { id: 'rejected', label: 'Rejected' },
        { id: 'all',      label: 'All'      },
    ];

    return (
        <AppLayout>
            <div className="page">
                <div className="page-header">
                    <div>
                        <div className="page-title">Orders</div>
                        <div className="page-subtitle">UPI payments from the Buy page — approve to issue the license key</div>
                    </div>
                </div>

                <div className="page-body">
                    <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                        {TABS.map(t => (
                            <button key={t.id}
                                className={`btn btn-sm ${tab === t.id ? '' : 'btn-ghost'}`}
                                onClick={() => setTab(t.id)}>
                                {t.label}{t.id !== 'all' && counts[t.id] ? ` (${counts[t.id]})` : ''}
                            </button>
                        ))}
                        <input className="form-input" style={{ maxWidth: 240, marginLeft: 'auto' }}
                            placeholder="Search name, phone, machine, ref…"
                            value={search} onChange={e => setSearch(e.target.value)} />
                    </div>

                    {loading ? (
                        <TableSkeleton rows={6} />
                    ) : filtered.length === 0 ? (
                        <div className="empty">No orders here.</div>
                    ) : (
                        <div className="table-wrap">
                            <table>
                                <thead>
                                    <tr>
                                        <th>When</th>
                                        <th>Customer</th>
                                        <th>Plan</th>
                                        <th>Machine ID</th>
                                        <th>UPI ref</th>
                                        <th>Type</th>
                                        <th>Status</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map(o => {
                                        const sm = STATUS_META[o.status] || STATUS_META.pending;
                                        return (
                                            <tr key={o.orderId}>
                                                <td style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>{fmtDateTime(o.createdAt)}</td>
                                                <td>
                                                    <div style={{ fontWeight: 700 }}>{o.customer?.name || '—'}</div>
                                                    <div style={{ fontSize: 12, color: '#64748b' }}>{o.customer?.phone}</div>
                                                    <div style={{ fontSize: 12, color: '#64748b' }}>{o.customer?.email}</div>
                                                </td>
                                                <td>
                                                    <div style={{ fontWeight: 700 }}>{o.planName}</div>
                                                    <div style={{ fontSize: 13, color: '#22c55e', fontWeight: 800 }}>{fmtMoney(o.amount)}</div>
                                                </td>
                                                <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{o.machineId}</td>
                                                <td style={{ fontFamily: 'monospace', fontSize: 12, color: '#94a3b8' }}>{o.utr || '—'}</td>
                                                <td style={{ fontSize: 12, color: '#64748b' }}>{MODE_LABEL[o.mode] || o.mode}</td>
                                                <td>
                                                    <span style={{ background: sm.bg, color: sm.color, fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 99 }}>{sm.label}</span>
                                                    {o.status === 'rejected' && o.rejectedReason && (
                                                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 3, maxWidth: 160 }}>{o.rejectedReason}</div>
                                                    )}
                                                </td>
                                                <td>
                                                    {o.status === 'pending' && (
                                                        <div style={{ display: 'flex', gap: 6 }}>
                                                            <button className="btn btn-sm" disabled={busyId === o.orderId} onClick={() => approve(o)}>
                                                                {busyId === o.orderId ? '…' : 'Approve'}
                                                            </button>
                                                            <button className="btn btn-ghost btn-sm" disabled={busyId === o.orderId} onClick={() => { setRejectTarget(o); setRejectReason(''); }}>Reject</button>
                                                        </div>
                                                    )}
                                                    {o.status === 'approved' && o.licenseKey && (
                                                        <button className="btn btn-ghost btn-sm" title={o.licenseKey} onClick={() => copyKey(o.licenseKey)}>Copy key</button>
                                                    )}
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

            {rejectTarget && (
                <div onClick={() => setRejectTarget(null)}
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16 }}>
                    <div onClick={e => e.stopPropagation()}
                        style={{ background: '#111b2e', border: '1px solid #1f2c47', borderRadius: 14, padding: 22, maxWidth: 420, width: '100%' }}>
                        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Reject order</div>
                        <div style={{ fontSize: 13, color: '#8fa3c7', marginBottom: 12 }}>
                            {rejectTarget.customer?.name} · {rejectTarget.planName} · ref {rejectTarget.utr || '—'}
                        </div>
                        <textarea className="form-input" rows={3} placeholder="Reason (optional) — e.g. payment not received"
                            value={rejectReason} onChange={e => setRejectReason(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical' }} />
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => setRejectTarget(null)}>Cancel</button>
                            <button className="btn btn-sm" disabled={busyId === rejectTarget.orderId} onClick={doReject}>Reject order</button>
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
