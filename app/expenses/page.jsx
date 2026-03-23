'use client';
import { useEffect, useMemo, useState } from 'react';
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
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function fromDateInput(v) {
    if (!v) return Math.floor(Date.now() / 1000);
    return Math.floor(new Date(`${v}T00:00:00`).getTime() / 1000);
}

const EMPTY_FORM = {
    title: '',
    amount: '',
    category: '',
    location: '',
    notes: '',
    spentDate: toDateInput(),
};

export default function ExpensesPage() {
    const [user, setUser] = useState(null);
    const [users, setUsers] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState(EMPTY_FORM);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const [adminFilter, setAdminFilter] = useState('all');
    const [showAddForm, setShowAddForm] = useState(false);

    const load = async () => {
        setLoading(true);
        const r = await apiFetch('/api/expenses');
        if (r?.ok) setExpenses(r.data);
        setLoading(false);
    };

    useEffect(() => {
        try {
            const raw = localStorage.getItem('zyqora_admin_user');
            if (raw) setUser(JSON.parse(raw));
        } catch {}
        load();
    }, []);

    const isSuper = user?.role === 'super';

    useEffect(() => {
        if (!isSuper) return;
        apiFetch('/api/admins/list').then(r => {
            if (r?.ok) {
                const list = (r.data || []).map(a => ({ id: a.id, name: a.username }));
                setUsers(list.sort((a, b) => a.name.localeCompare(b.name)));
            }
        });
    }, [isSuper]);

    const admins = useMemo(() => {
        if (!isSuper) return [];
        if (users.length) return users;

        const map = {};
        expenses.forEach(e => {
            if (e.spentBy) map[e.spentBy] = e.spentByName;
        });
        return Object.entries(map)
            .map(([id, name]) => ({ id, name }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [expenses, isSuper, users]);

    const filtered = useMemo(() => {
        if (!isSuper || adminFilter === 'all') return expenses;
        return expenses.filter(e => e.spentBy === adminFilter);
    }, [expenses, isSuper, adminFilter]);

    const totalSpent = filtered.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const thisMonthStart = Math.floor(new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() / 1000);
    const monthSpent = filtered
        .filter(e => (e.spentAt || 0) >= thisMonthStart)
        .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    const addExpense = async (e) => {
        e.preventDefault();
        setBusy(true);
        setErr('');

        const body = {
            title: form.title,
            amount: form.amount,
            category: form.category,
            location: form.location,
            notes: form.notes,
            spentAt: fromDateInput(form.spentDate),
        };

        const r = await apiFetch('/api/expenses', { method: 'POST', body });
        if (!r?.ok) {
            setErr(r?.data?.error || 'Failed to save expense');
            setBusy(false);
            return;
        }

        setForm(EMPTY_FORM);
        setBusy(false);
        if (isSuper) setShowAddForm(false);
        load();
    };

    return (
        <AppLayout>
            <div className="page">
                <div className="page-header">
                    <div>
                        <div className="page-title">Expenses</div>
                        <div className="page-subtitle">Track where money was spent and by whom</div>
                    </div>
                    {isSuper && (
                        <button
                            className={`btn ${showAddForm ? 'btn-ghost' : 'btn-primary'}`}
                            onClick={() => {
                                setShowAddForm(v => !v);
                                setErr('');
                            }}
                        >
                            {showAddForm ? 'Close Add Expense' : '+ Add Expense'}
                        </button>
                    )}
                </div>

                <div className="page-body">
                    <div className="stats-grid" style={{ marginBottom: 20 }}>
                        <div className="stat-card">
                            <div className="stat-label">Total Expenses</div>
                            <div className="stat-value" style={{ color: '#ef4444' }}>{fmtMoney(totalSpent)}</div>
                            <div className="stat-sub">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-label">This Month</div>
                            <div className="stat-value" style={{ color: '#f59e0b' }}>{fmtMoney(monthSpent)}</div>
                            <div className="stat-sub">Since month start</div>
                        </div>
                        {isSuper && admins.length > 0 && (
                            <div className="stat-card">
                                <div className="stat-label">Spending Admins</div>
                                <div className="stat-value stat-blue">{admins.length}</div>
                                <div className="stat-sub">Admins with expense entries</div>
                            </div>
                        )}
                    </div>

                    {(!isSuper || showAddForm) && (
                        <div className="card" style={{ marginBottom: 18 }}>
                            <form onSubmit={addExpense}>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Expense Title *</label>
                                    <input
                                        className="form-input"
                                        value={form.title}
                                        onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                                        placeholder="e.g. Facebook ads, Team travel"
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Amount (₹) *</label>
                                    <input
                                        className="form-input"
                                        type="number"
                                        min="0.01"
                                        step="0.01"
                                        value={form.amount}
                                        onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                                        placeholder="e.g. 2500"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-row" style={{ marginTop: 12 }}>
                                <div className="form-group">
                                    <label className="form-label">Category</label>
                                    <input
                                        className="form-input"
                                        value={form.category}
                                        onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                                        placeholder="e.g. Marketing, Ops, Salary"
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Where Used</label>
                                    <input
                                        className="form-input"
                                        value={form.location}
                                        onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                                        placeholder="e.g. Mumbai office, Google Ads"
                                    />
                                </div>
                            </div>

                            <div className="form-row" style={{ marginTop: 12 }}>
                                <div className="form-group">
                                    <label className="form-label">Spent Date</label>
                                    <input
                                        className="form-input"
                                        type="date"
                                        value={form.spentDate}
                                        onChange={e => setForm(f => ({ ...f, spentDate: e.target.value }))}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Notes</label>
                                    <input
                                        className="form-input"
                                        value={form.notes}
                                        onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                                        placeholder="Optional details"
                                    />
                                </div>
                            </div>

                            {err && <div className="form-error" style={{ marginTop: 12 }}>{err}</div>}

                            <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
                                <button className="btn btn-primary" type="submit" disabled={busy}>
                                    {busy ? 'Saving…' : 'Add Expense'}
                                </button>
                            </div>
                            </form>
                        </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 10 }}>
                        <div style={{ fontWeight: 700, color: '#e2e8f0', fontSize: 13 }}>Expense History</div>
                        {isSuper && (
                            <select
                                className="form-select"
                                style={{ width: 'auto', maxWidth: 220 }}
                                value={adminFilter}
                                onChange={e => setAdminFilter(e.target.value)}
                            >
                                <option value="all">All Users</option>
                                {admins.map(a => (
                                    <option key={a.id} value={a.id}>{a.name}</option>
                                ))}
                            </select>
                        )}
                    </div>

                    {loading ? (
                        <div className="empty">Loading expenses…</div>
                    ) : filtered.length === 0 ? (
                        <div className="empty">No expenses recorded yet.</div>
                    ) : (
                        <div className="table-wrap">
                            <table>
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Title</th>
                                        <th>Category</th>
                                        <th>Where Used</th>
                                        <th>Amount</th>
                                        {isSuper && <th>Used By</th>}
                                        <th>Date</th>
                                        <th>Notes</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map((e, i) => (
                                        <tr key={e.id}>
                                            <td style={{ color: '#3a4560', fontSize: 12 }}>{i + 1}</td>
                                            <td><span className="bold">{e.title}</span></td>
                                            <td>{e.category || '—'}</td>
                                            <td>{e.location || '—'}</td>
                                            <td style={{ color: '#ef4444', fontWeight: 700 }}>{fmtMoney(e.amount)}</td>
                                            {isSuper && <td>{e.spentByName}</td>}
                                            <td>{fmtDate(e.spentAt)}</td>
                                            <td>{e.notes || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}
