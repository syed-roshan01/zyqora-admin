'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { setToken } from '@/lib/apiFetch';
import Icon from '@/components/Icons';

export default function LoginPage() {
    const router = useRouter();
    const [form, setForm] = useState({ username: '', password: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPw, setShowPw] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            const data = await res.json();
            if (!res.ok) { setError(data.error || 'Login failed'); return; }
            setToken(data.token);
            localStorage.setItem('zyqora_admin_user', JSON.stringify({ username: data.username, role: data.role, name: data.name || null }));
            if (data.role === 'affiliate') {
                router.replace('/affiliate-dashboard');
            } else if (data.role === 'whitelabel') {
                router.replace('/licenses');
            } else {
                router.replace('/dashboard');
            }
        } catch {
            setError('Connection failed. Check your network.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-wrap">
            <div className="login-card">
                <div className="login-brand">
                    <div className="login-mark">Z</div>
                    <div>
                        <div className="login-name">Zyqora</div>
                        <div className="login-sub">Admin Panel</div>
                    </div>
                </div>

                <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
                    <div className="form-group">
                        <label className="form-label" htmlFor="login-username">Username</label>
                        <input
                            id="login-username"
                            className="form-input"
                            value={form.username}
                            onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                            placeholder="Enter username"
                            autoFocus required
                            autoComplete="username"
                        />
                    </div>
                    <div className="form-group" style={{ position: 'relative' }}>
                        <label className="form-label" htmlFor="login-password">Password</label>
                        <input
                            id="login-password"
                            className="form-input"
                            type={showPw ? 'text' : 'password'}
                            value={form.password}
                            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                            placeholder="Enter password"
                            required
                            autoComplete="current-password"
                            style={{ paddingRight: 40 }}
                        />
                        <button
                            type="button"
                            className="login-eye"
                            onClick={() => setShowPw(s => !s)}
                            aria-label={showPw ? 'Hide password' : 'Show password'}
                        >
                            <Icon name={showPw ? 'eyeOff' : 'eye'} size={16} />
                        </button>
                    </div>

                    {error && <div className="form-error">{error}</div>}

                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={loading}
                        style={{ marginTop: 4, padding: '11px', fontSize: 14 }}
                    >
                        {loading ? 'Signing in…' : 'Sign In'}
                    </button>
                </form>

                <div className="login-hint">Manage licenses, resellers &amp; business finances</div>
            </div>
        </div>
    );
}
