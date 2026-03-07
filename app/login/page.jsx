'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { setToken } from '@/lib/apiFetch';

export default function LoginPage() {
    const router = useRouter();
    const [form, setForm] = useState({ username: '', password: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

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
            localStorage.setItem('zyqora_admin_user', JSON.stringify({ username: data.username, role: data.role }));
            router.replace('/dashboard');
        } catch {
            setError('Connection failed. Check your network.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh', display: 'flex', alignItems: 'center',
            justifyContent: 'center', background: '#0a0d14', padding: 20,
        }}>
            <div style={{
                width: '100%', maxWidth: 400,
                background: '#0f1320', border: '1px solid #252d42',
                borderRadius: 14, padding: '36px 32px',
            }}>
                <div style={{ textAlign: 'center', marginBottom: 30 }}>
                    <div style={{ fontSize: 30, fontWeight: 800, color: '#7c3aed', letterSpacing: -1 }}>Zyqora</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0', marginTop: 4 }}>Admin Panel</div>
                    <div style={{ fontSize: 13, color: '#4a5980', marginTop: 6 }}>Sign in to manage licenses & admins</div>
                </div>

                <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
                    <div className="form-group">
                        <label className="form-label">Username</label>
                        <input
                            className="form-input"
                            value={form.username}
                            onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                            placeholder="Enter username"
                            autoFocus required
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Password</label>
                        <input
                            type="password"
                            className="form-input"
                            value={form.password}
                            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                            placeholder="Enter password"
                            required
                        />
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
            </div>
        </div>
    );
}
