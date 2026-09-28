'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { setToken } from '@/lib/apiFetch';
import Icon from '@/components/Icons';

export default function LoginPage() {
    const router = useRouter();
    const [form, setForm] = useState({ username: '', password: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPw, setShowPw] = useState(false);

    // Twinkling background particles — random per visit, CSS-animated.
    const sparks = useMemo(() =>
        Array.from({ length: 18 }, () => ({
            left: Math.random() * 100,
            top: Math.random() * 100,
            size: 2 + Math.random() * 2.5,
            delay: Math.random() * 4.5,
            dur: 3.5 + Math.random() * 3,
        })), []);

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
            {/* Animated backdrop: aurora orbs, grid, twinkling particles */}
            <div className="login-orb login-orb-1" />
            <div className="login-orb login-orb-2" />
            <div className="login-orb login-orb-3" />
            <div className="login-grid" />
            {sparks.map((s, i) => (
                <span
                    key={i}
                    className="login-spark"
                    style={{
                        left: `${s.left}%`,
                        top: `${s.top}%`,
                        width: s.size,
                        height: s.size,
                        animationDelay: `${s.delay}s`,
                        animationDuration: `${s.dur}s`,
                    }}
                />
            ))}

            <div className="login-stage">
                {/* Hero — desktop only */}
                <div className="login-hero">
                    <div className="login-hero-badge">
                        <span className="login-dot" /> Zyqora Admin Portal
                    </div>
                    <h1>Command your <span className="grad">licensing empire</span></h1>
                    <p>
                        Licenses, whitelabel resellers, sales and affiliate payouts —
                        your entire WhatsApp automation business in one dark control room.
                    </p>
                    <ul>
                        <li>
                            <Icon name="shield" size={17} />
                            <span><b>Role-based access</b> — admins, affiliates &amp; whitelabel clients</span>
                        </li>
                        <li>
                            <Icon name="zap" size={17} />
                            <span><b>Real-time controls</b> — quotas &amp; license types update live</span>
                        </li>
                        <li>
                            <Icon name="layers" size={17} />
                            <span><b>Whitelabel reselling</b> — your clients, your rules</span>
                        </li>
                    </ul>
                </div>

                {/* Login card */}
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
                            <div className="input-wrap">
                                <span className="lead-icon"><Icon name="user" size={16} /></span>
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
                        </div>
                        <div className="form-group">
                            <label className="form-label" htmlFor="login-password">Password</label>
                            <div className="input-wrap">
                                <span className="lead-icon"><Icon name="lock" size={16} /></span>
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
                        </div>

                        {error && <div className="form-error">{error}</div>}

                        <button type="submit" className="btn btn-primary login-submit" disabled={loading}>
                            {loading
                                ? <><span className="spinner" /> Signing in…</>
                                : <>Sign In <Icon name="arrowUp" size={15} style={{ transform: 'rotate(90deg)' }} /></>}
                        </button>
                    </form>

                    <div className="login-hint">
                        <Icon name="shield" size={12} />
                        Authorized personnel only · Sessions expire after 8 hours
                    </div>
                </div>
            </div>
        </div>
    );
}
