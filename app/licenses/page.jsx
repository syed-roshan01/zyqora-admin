'use client';
import { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { apiFetch } from '@/lib/apiFetch';

const PLANS = [
    { value: 'trial',    label: 'Trial (3 days)'      },
    { value: 'weekly',   label: 'Weekly (7 days)'     },
    { value: 'monthly',  label: 'Monthly (30 days)'   },
    { value: '3months',  label: '3 Months (90 days)'  },
    { value: '6months',  label: '6 Months (180 days)' },
    { value: 'yearly',   label: 'Yearly (365 days)'   },
    { value: 'lifetime', label: 'Lifetime'            },
    { value: 'custom',   label: 'Custom days'         },
];

const DEFAULT_FORM = {
    clientName: '', clientPhone: '', clientEmail: '',
    machineId: '', plan: 'monthly', deviceLimit: '1',
    customDays: '', notes: '',
};

function fmtDate(ts) {
    if (!ts) return '—';
    return new Date(ts * 1000).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getDaysLeft(l) {
    if (l.isLifetime) return null;
    return Math.floor((l.expiryTs - Math.floor(Date.now() / 1000)) / 86400);
}

export default function LicensesPage() {
    const [licenses, setLicenses] = useState([]);
    const [loading,  setLoading]  = useState(true);
    const [search,   setSearch]   = useState('');
    const [showGen,  setShowGen]  = useState(false);
    const [form,     setForm]     = useState(DEFAULT_FORM);
    const [genBusy,  setGenBusy]  = useState(false);
    const [genErr,   setGenErr]   = useState('');
    const [genKey,   setGenKey]   = useState('');
    const [showRev,  setShowRev]  = useState(null); // key to revoke
    const [revReason,setRevReason]= useState('');
    const [revBusy,  setRevBusy]  = useState(false);
    const [copied,   setCopied]   = useState('');

    const load = async () => {
        setLoading(true);
        const r = await apiFetch('/api/licenses/list');
        if (r?.ok) setLicenses(r.data);
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const filtered = licenses.filter(l => {
        const q = search.toLowerCase();
        return !q || l.clientName?.toLowerCase().includes(q) ||
               l.key.toLowerCase().includes(q) ||
               l.clientPhone?.toLowerCase().includes(q) ||
               l.machineId?.toLowerCase().includes(q);
    });

    const copyKey = (key) => {
        navigator.clipboard.writeText(key);
        setCopied(key);
        setTimeout(() => setCopied(''), 1800);
    };

    const generate = async (e) => {
        e.preventDefault();
        setGenBusy(true);
        setGenErr('');
        const r = await apiFetch('/api/licenses/generate', { method: 'POST', body: form });
        if (!r) return;
        if (!r.ok) { setGenErr(r.data.error || 'Failed'); setGenBusy(false); return; }
        setGenKey(r.data.key);
        setGenBusy(false);
        load();
    };

    const revoke = async () => {
        setRevBusy(true);
        const r = await apiFetch('/api/licenses/revoke', { method: 'POST', body: { key: showRev, reason: revReason } });
        if (r?.ok) { setShowRev(null); setRevReason(''); load(); }
        setRevBusy(false);
    };

    const now = Math.floor(Date.now() / 1000);

    return (
        <AppLayout>
            <div className="page">
                <div className="page-header">
                    <div>
                        <div className="page-title">Licenses</div>
                        <div className="page-subtitle">{licenses.length} total issued</div>
                    </div>
                    <button className="btn btn-primary" onClick={() => { setShowGen(true); setGenKey(''); setForm(DEFAULT_FORM); }}>
                        + Generate Key
                    </button>
                </div>

                <div className="page-body">
                    {/* Search */}
                    <div className="search-bar" style={{ marginBottom: 16 }}>
                        <input
                            className="form-input search-input"
                            placeholder="Search by client, key, phone or machine ID…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                        {search && (
                            <button className="btn btn-ghost btn-sm" onClick={() => setSearch('')}>Clear</button>
                        )}
                    </div>

                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>Client</th>
                                    <th>Key</th>
                                    <th>Plan</th>
                                    <th>Devices</th>
                                    <th>Expiry / Days Left</th>
                                    <th>Machine ID</th>
                                    <th>Issued By</th>
                                    <th>Issued At</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={10} className="empty">Loading…</td></tr>
                                ) : filtered.length === 0 ? (
                                    <tr><td colSpan={10} className="empty">No licenses found</td></tr>
                                ) : filtered.map(l => {
                                    const days = getDaysLeft(l);
                                    const isExpired = !l.isLifetime && days !== null && days < 0;
                                    return (
                                        <tr key={l.key}>
                                            <td>
                                                <div className="bold">{l.clientName}</div>
                                                {l.clientPhone && <div className="dim">{l.clientPhone}</div>}
                                            </td>
                                            <td>
                                                <span
                                                    className="mono copy-key"
                                                    title="Click to copy"
                                                    onClick={() => copyKey(l.key)}
                                                >
                                                    {copied === l.key ? '✓ Copied!' : l.key.slice(0, 23) + '…'}
                                                </span>
                                            </td>
                                            <td><span className={`badge badge-plan-${l.plan}`}>{l.plan}</span></td>
                                            <td style={{ textAlign: 'center' }}>{l.deviceLimit}</td>
                                            <td>
                                                {l.isLifetime ? (
                                                    <span style={{ color: '#a78bfa', fontWeight: 600 }}>Lifetime</span>
                                                ) : (
                                                    <>
                                                        <div>{fmtDate(l.expiryTs)}</div>
                                                        <div className="dim" style={{ color: days !== null && days < 7 && days >= 0 ? '#f59e0b' : '' }}>
                                                            {days !== null && days >= 0 ? `${days}d left` : days !== null ? 'Expired' : ''}
                                                        </div>
                                                    </>
                                                )}
                                            </td>
                                            <td><span className="mono" style={{ fontSize: 11 }}>{l.machineId?.slice(0, 16)}…</span></td>
                                            <td>{l.issuedByName}</td>
                                            <td>{fmtDate(l.issuedAt)}</td>
                                            <td>
                                                {l.revoked   && <span className="badge badge-revoked">Revoked</span>}
                                                {!l.revoked && isExpired && <span className="badge badge-expired">Expired</span>}
                                                {!l.revoked && !isExpired && <span className="badge badge-active">Active</span>}
                                            </td>
                                            <td>
                                                {!l.revoked && (
                                                    <button
                                                        className="btn btn-danger btn-sm"
                                                        onClick={() => { setShowRev(l.key); setRevReason(''); }}
                                                    >
                                                        Revoke
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* ── Generate Modal ─────────────────────────────────────────── */}
            {showGen && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && !genKey && setShowGen(false)}>
                    <div className="modal">
                        <div className="modal-header">
                            <span className="modal-title">{genKey ? '✓ Key Generated' : 'Generate License Key'}</span>
                            <button className="modal-close" onClick={() => setShowGen(false)}>×</button>
                        </div>

                        {genKey ? (
                            <div className="modal-body">
                                <div style={{ background: '#161c2d', border: '1px solid #7c3aed', borderRadius: 10, padding: '16px 18px' }}>
                                    <div style={{ fontSize: 11, color: '#4a5980', marginBottom: 6, fontWeight: 600 }}>LICENSE KEY</div>
                                    <div style={{ fontFamily: 'Courier New, monospace', fontSize: 15, color: '#a78bfa', letterSpacing: '.5px', wordBreak: 'break-all' }}>{genKey}</div>
                                </div>
                                <button
                                    className="btn btn-primary"
                                    style={{ width: '100%' }}
                                    onClick={() => { navigator.clipboard.writeText(genKey); }}
                                >
                                    Copy Key
                                </button>
                                <button
                                    className="btn btn-ghost"
                                    style={{ width: '100%' }}
                                    onClick={() => { setGenKey(''); setForm(DEFAULT_FORM); }}
                                >
                                    Generate Another
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={generate}>
                                <div className="modal-body">
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label className="form-label">Client Name *</label>
                                            <input className="form-input" required value={form.clientName}
                                                onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))} placeholder="e.g. John Doe" />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">WhatsApp / Phone</label>
                                            <input className="form-input" value={form.clientPhone}
                                                onChange={e => setForm(f => ({ ...f, clientPhone: e.target.value }))} placeholder="+91 9876543210" />
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Email</label>
                                        <input className="form-input" type="email" value={form.clientEmail}
                                            onChange={e => setForm(f => ({ ...f, clientEmail: e.target.value }))} placeholder="client@email.com" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Machine ID *</label>
                                        <input className="form-input" required value={form.machineId}
                                            onChange={e => setForm(f => ({ ...f, machineId: e.target.value }))}
                                            placeholder="Paste from Zyqora app License screen"
                                            style={{ fontFamily: 'Courier New, monospace', fontSize: 12 }} />
                                        <span style={{ fontSize: 11, color: '#3a4560' }}>Found in the Zyqora desktop app → License screen → bottom</span>
                                    </div>
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label className="form-label">Plan *</label>
                                            <select className="form-select" value={form.plan}
                                                onChange={e => setForm(f => ({ ...f, plan: e.target.value }))}>
                                                {PLANS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Device Limit *</label>
                                            <input className="form-input" type="number" min={1} max={255} required value={form.deviceLimit}
                                                onChange={e => setForm(f => ({ ...f, deviceLimit: e.target.value }))} />
                                        </div>
                                    </div>
                                    {form.plan === 'custom' && (
                                        <div className="form-group">
                                            <label className="form-label">Custom Days *</label>
                                            <input className="form-input" type="number" min={1} required={form.plan === 'custom'} value={form.customDays}
                                                onChange={e => setForm(f => ({ ...f, customDays: e.target.value }))} placeholder="e.g. 45" />
                                        </div>
                                    )}
                                    <div className="form-group">
                                        <label className="form-label">Notes</label>
                                        <textarea className="form-textarea" value={form.notes}
                                            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                                            placeholder="Internal note (not shown to client)" />
                                    </div>
                                    {genErr && <div className="form-error">{genErr}</div>}
                                </div>
                                <div className="modal-footer">
                                    <button type="button" className="btn btn-ghost" onClick={() => setShowGen(false)}>Cancel</button>
                                    <button type="submit" className="btn btn-primary" disabled={genBusy}>
                                        {genBusy ? 'Generating…' : 'Generate Key'}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {/* ── Revoke Modal ───────────────────────────────────────────── */}
            {showRev && (
                <div className="modal-overlay">
                    <div className="modal" style={{ maxWidth: 420 }}>
                        <div className="modal-header">
                            <span className="modal-title">Revoke License</span>
                            <button className="modal-close" onClick={() => setShowRev(null)}>×</button>
                        </div>
                        <div className="modal-body">
                            <div style={{ color: '#94a3b8', fontSize: 13 }}>
                                This will immediately invalidate the key. The client's app will show as unlicensed on next startup.
                            </div>
                            <div style={{ fontFamily: 'Courier New, monospace', fontSize: 12, color: '#ef4444', background: 'rgba(239,68,68,.08)', borderRadius: 7, padding: '8px 12px', wordBreak: 'break-all' }}>
                                {showRev}
                            </div>
                            <div className="form-group">
                                <label className="form-label">Reason (optional)</label>
                                <input className="form-input" value={revReason}
                                    onChange={e => setRevReason(e.target.value)}
                                    placeholder="e.g. Refund requested" autoFocus />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setShowRev(null)}>Cancel</button>
                            <button className="btn btn-danger" onClick={revoke} disabled={revBusy}>
                                {revBusy ? 'Revoking…' : 'Confirm Revoke'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
