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

const FEATURE_OPTIONS = [
    { key: 'mobile',       label: 'Open on Mobile',  sub: 'Cloudflare tunnel' },
    { key: 'trustBuilder', label: 'Trust Builder',   sub: 'Account warming'   },
    { key: 'autoReply',    label: 'Auto Reply',      sub: 'Auto responses'    },
    { key: 'chatbot',      label: 'Chatbot Flows',   sub: 'Flow builder'      },
    { key: 'liveChat',     label: 'Live Chat',       sub: 'Real-time chat'    },
    { key: 'groupGrabber', label: 'Group Grabber',   sub: 'Extract groups'    },
];

const DEFAULT_FEATURES = { mobile: true, trustBuilder: true, autoReply: true, chatbot: true, liveChat: true, groupGrabber: true };

const DEFAULT_FORM = {
    clientName: '', clientPhone: '', clientEmail: '',
    machineId: '', plan: 'monthly', deviceLimit: '1',
    customDays: '', notes: '', price: '',
    features: { ...DEFAULT_FEATURES },
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
    const [user,     setUser]     = useState(null);
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
    const [showDel,  setShowDel]  = useState(null); // { key, clientName }
    const [delBusy,  setDelBusy]  = useState(false);
    const [showDetail,setShowDetail]= useState(null);   // license object
    const [showEdit,  setShowEdit]  = useState(null);   // license object
    const [editForm,  setEditForm]  = useState({ price: '', notes: '' });
    const [editBusy,  setEditBusy]  = useState(false);
    const [editErr,   setEditErr]   = useState('');

    const load = async () => {
        setLoading(true);
        const r = await apiFetch('/api/licenses/list');
        if (r?.ok) setLicenses(r.data);
        setLoading(false);
    };

    useEffect(() => {
        try { const u = localStorage.getItem('zyqora_admin_user'); if (u) setUser(JSON.parse(u)); } catch {}
        load();
    }, []);

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

    const deleteLic = async () => {
        setDelBusy(true);
        const r = await apiFetch('/api/licenses/delete', { method: 'POST', body: { key: showDel.key } });
        if (r?.ok) { setShowDel(null); load(); }
        setDelBusy(false);
    };

    const updateLicense = async (e) => {
        e.preventDefault();
        setEditBusy(true);
        setEditErr('');
        const r = await apiFetch('/api/licenses/update', { method: 'POST', body: { key: showEdit.key, price: editForm.price, notes: editForm.notes } });
        if (!r?.ok) { setEditErr(r?.data?.error || 'Failed to update'); setEditBusy(false); return; }
        setShowEdit(null);
        setEditBusy(false);
        load();
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
                                                <div className="bold" style={{ cursor: 'pointer', color: '#a78bfa', textDecoration: 'underline', textDecorationStyle: 'dotted' }} onClick={() => setShowDetail(l)}>{l.clientName}</div>
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
                                                <div style={{ display: 'flex', gap: 6 }}>
                                                    <button
                                                        className="btn btn-ghost btn-sm"
                                                        onClick={() => { setShowEdit(l); setEditForm({ price: l.price ?? '', notes: l.notes || '' }); setEditErr(''); }}
                                                        title="Edit price & notes"
                                                    >✎</button>
                                                    {!l.revoked && (
                                                        <button
                                                            className="btn btn-danger btn-sm"
                                                            onClick={() => { setShowRev(l.key); setRevReason(''); }}
                                                        >
                                                            Revoke
                                                        </button>
                                                    )}
                                                    {user?.role === 'super' && (
                                                        <button
                                                            className="btn btn-ghost btn-sm"
                                                            style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,.3)' }}
                                                            onClick={() => setShowDel({ key: l.key, clientName: l.clientName })}
                                                        >
                                                            Delete
                                                        </button>
                                                    )}
                                                </div>
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
                                    onClick={() => { navigator.clipboard.writeText(genKey); setCopied('__genkey__'); setTimeout(() => setCopied(''), 2000); }}
                                >
                                    {copied === '__genkey__' ? '✓ Key Copied!' : 'Copy Key'}
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
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label className="form-label">Price (₹)</label>
                                            <input className="form-input" type="number" min="0" step="0.01" value={form.price}
                                                onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                                                placeholder="e.g. 999" />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Notes</label>
                                            <textarea className="form-textarea" value={form.notes}
                                                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                                                placeholder="Internal note" style={{ minHeight: 42 }} />
                                        </div>
                                    </div>
                                    {/* Feature Flags */}
                                    <div className="form-group">
                                        <label className="form-label" style={{ marginBottom: 8 }}>Features Included</label>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                                            {FEATURE_OPTIONS.map(({ key, label, sub }) => (
                                                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '8px 10px', borderRadius: 8, border: '1px solid', borderColor: form.features[key] ? '#7c3aed' : '#252d42', background: form.features[key] ? 'rgba(124,58,237,.1)' : 'transparent', transition: 'all .15s', userSelect: 'none' }}>
                                                    <input type="checkbox" checked={form.features[key] ?? true}
                                                        onChange={e => setForm(f => ({ ...f, features: { ...f.features, [key]: e.target.checked } }))}
                                                        style={{ accentColor: '#7c3aed', width: 14, height: 14, flexShrink: 0 }} />
                                                    <span style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                                        <span style={{ fontSize: 12.5, fontWeight: 600, color: form.features[key] ? '#e2e8f0' : '#4a5980' }}>{label}</span>
                                                        <span style={{ fontSize: 10.5, color: '#3a4560' }}>{sub}</span>
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                        <button type="button" onClick={() => setForm(f => ({ ...f, features: { ...DEFAULT_FEATURES } }))}
                                            style={{ marginTop: 6, background: 'none', border: 'none', color: '#4a5980', fontSize: 11, cursor: 'pointer', textAlign: 'left', padding: 0 }}>
                                            ↺ Select all
                                        </button>
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

            {/* ── Delete Modal ───────────────────────────────────────────── */}
            {showDel && (
                <div className="modal-overlay">
                    <div className="modal" style={{ maxWidth: 420 }}>
                        <div className="modal-header">
                            <span className="modal-title">Delete License</span>
                            <button className="modal-close" onClick={() => setShowDel(null)} disabled={delBusy}>×</button>
                        </div>
                        <div className="modal-body">
                            <p style={{ color: '#94a3b8', fontSize: 13 }}>
                                Permanently delete license for <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{showDel.clientName}</span>?<br />
                                <span style={{ fontSize: 12, color: '#ef4444' }}>This removes the record entirely and cannot be undone.</span>
                            </p>
                            <div style={{ fontFamily: 'Courier New, monospace', fontSize: 11, color: '#64748b', background: 'rgba(255,255,255,.03)', borderRadius: 7, padding: '8px 12px', wordBreak: 'break-all' }}>
                                {showDel.key}
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setShowDel(null)} disabled={delBusy}>Cancel</button>
                            <button className="btn btn-danger" onClick={deleteLic} disabled={delBusy}>
                                {delBusy ? 'Deleting…' : 'Delete Permanently'}
                            </button>
                        </div>
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
            {/* ── Detail Modal ──────────────────────────────────────────── */}
            {showDetail && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowDetail(null)}>
                    <div className="modal" style={{ maxWidth: 580 }}>
                        <div className="modal-header">
                            <span className="modal-title">📋 License Details</span>
                            <button className="modal-close" onClick={() => setShowDetail(null)}>×</button>
                        </div>
                        <div className="modal-body">
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 24px' }}>
                                <div>
                                    <div style={{ fontSize: 10, color: '#4a5980', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Client Name</div>
                                    <div style={{ fontSize: 13, color: '#e2e8f0' }}>{showDetail.clientName}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 10, color: '#4a5980', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Phone</div>
                                    <div style={{ fontSize: 13, color: '#e2e8f0' }}>{showDetail.clientPhone || '—'}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 10, color: '#4a5980', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Email</div>
                                    <div style={{ fontSize: 13, color: '#e2e8f0' }}>{showDetail.clientEmail || '—'}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 10, color: '#4a5980', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Plan</div>
                                    <div><span className={`badge badge-plan-${showDetail.plan}`}>{showDetail.plan}</span></div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 10, color: '#4a5980', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Expiry</div>
                                    <div style={{ fontSize: 13, color: showDetail.isLifetime ? '#a78bfa' : '#e2e8f0' }}>{showDetail.isLifetime ? 'Lifetime ∞' : fmtDate(showDetail.expiryTs)}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 10, color: '#4a5980', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Days Left</div>
                                    <div style={{ fontSize: 13, color: '#e2e8f0' }}>{showDetail.isLifetime ? '∞' : (() => { const d = getDaysLeft(showDetail); return d !== null && d >= 0 ? `${d}d` : 'Expired'; })()}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 10, color: '#4a5980', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Device Limit</div>
                                    <div style={{ fontSize: 13, color: '#e2e8f0' }}>{showDetail.deviceLimit}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 10, color: '#4a5980', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Price</div>
                                    <div style={{ fontSize: 13, color: '#e2e8f0' }}>₹{showDetail.price || 0}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 10, color: '#4a5980', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Issued By</div>
                                    <div style={{ fontSize: 13, color: '#e2e8f0' }}>{showDetail.issuedByName}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 10, color: '#4a5980', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Issued At</div>
                                    <div style={{ fontSize: 13, color: '#e2e8f0' }}>{fmtDate(showDetail.issuedAt)}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 10, color: '#4a5980', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Activated</div>
                                    <div style={{ fontSize: 13, color: '#e2e8f0' }}>{showDetail.activated ? fmtDate(showDetail.activatedAt) : <span style={{ color: '#64748b' }}>Not yet</span>}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 10, color: '#4a5980', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Status</div>
                                    <div>{showDetail.revoked ? <span className="badge badge-revoked">Revoked</span> : (() => { const d = getDaysLeft(showDetail); return (!showDetail.isLifetime && d !== null && d < 0) ? <span className="badge badge-expired">Expired</span> : <span className="badge badge-active">Active</span>; })()}</div>
                                </div>
                                <div style={{ gridColumn: 'span 2' }}>
                                    <div style={{ fontSize: 10, color: '#4a5980', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Machine ID</div>
                                    <div style={{ fontFamily: 'Courier New, monospace', fontSize: 11, color: '#94a3b8', wordBreak: 'break-all', background: 'rgba(255,255,255,.03)', borderRadius: 6, padding: '6px 10px' }}>{showDetail.machineId}</div>
                                </div>
                                <div style={{ gridColumn: 'span 2' }}>
                                    <div style={{ fontSize: 10, color: '#4a5980', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>License Key</div>
                                    <div style={{ fontFamily: 'Courier New, monospace', fontSize: 10, color: '#a78bfa', wordBreak: 'break-all', background: 'rgba(124,58,237,.07)', borderRadius: 6, padding: '6px 10px' }}>{showDetail.key}</div>
                                </div>
                                {showDetail.notes && (
                                    <div style={{ gridColumn: 'span 2' }}>
                                        <div style={{ fontSize: 10, color: '#4a5980', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Notes</div>
                                        <div style={{ fontSize: 12, color: '#94a3b8' }}>{showDetail.notes}</div>
                                    </div>
                                )}
                                {showDetail.revoked && (
                                    <div style={{ gridColumn: 'span 2' }}>
                                        <div style={{ fontSize: 10, color: '#ef4444', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Revoke Reason</div>
                                        <div style={{ fontSize: 12, color: '#f87171' }}>{showDetail.revokedReason || '—'} <span style={{ color: '#64748b' }}>(by {showDetail.revokedByName})</span></div>
                                    </div>
                                )}
                            </div>

                            {/* Features */}
                            <div style={{ marginTop: 16 }}>
                                <div style={{ fontSize: 10, color: '#4a5980', fontWeight: 600, textTransform: 'uppercase', marginBottom: 8 }}>Features Opted</div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                                    {FEATURE_OPTIONS.map(({ key, label, sub }) => {
                                        const enabled = showDetail.features ? showDetail.features[key] !== false : true;
                                        return (
                                            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 10px', borderRadius: 8, background: enabled ? 'rgba(34,197,94,.08)' : 'rgba(239,68,68,.07)', border: `1px solid ${enabled ? 'rgba(34,197,94,.25)' : 'rgba(239,68,68,.2)'}` }}>
                                                <span style={{ fontSize: 13, color: enabled ? '#22c55e' : '#ef4444', flexShrink: 0 }}>{enabled ? '✓' : '✗'}</span>
                                                <span style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                                    <span style={{ fontSize: 11.5, fontWeight: 600, color: enabled ? '#e2e8f0' : '#64748b' }}>{label}</span>
                                                    <span style={{ fontSize: 10, color: '#3a4560' }}>{sub}</span>
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setShowDetail(null)}>Close</button>
                            <button className="btn btn-primary" onClick={() => { setShowEdit(showDetail); setEditForm({ price: showDetail.price ?? '', notes: showDetail.notes || '' }); setEditErr(''); setShowDetail(null); }}>✎ Edit Price &amp; Notes</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Edit Modal ────────────────────────────────────────────── */}
            {showEdit && (
                <div className="modal-overlay">
                    <div className="modal" style={{ maxWidth: 420 }}>
                        <div className="modal-header">
                            <span className="modal-title">✎ Edit License</span>
                            <button className="modal-close" onClick={() => setShowEdit(null)} disabled={editBusy}>×</button>
                        </div>
                        <form onSubmit={updateLicense}>
                            <div className="modal-body">
                                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
                                    Editing: <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{showEdit.clientName}</span>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Price (₹)</label>
                                    <input className="form-input" type="number" min="0" step="0.01" value={editForm.price}
                                        onChange={e => setEditForm(f => ({ ...f, price: e.target.value }))}
                                        placeholder="e.g. 999" autoFocus />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Notes</label>
                                    <textarea className="form-textarea" value={editForm.notes}
                                        onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                                        placeholder="Internal notes" style={{ minHeight: 80 }} />
                                </div>
                                {editErr && <div className="form-error">{editErr}</div>}
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowEdit(null)} disabled={editBusy}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={editBusy}>
                                    {editBusy ? 'Saving…' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
