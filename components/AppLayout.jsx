'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { getToken, clearToken, apiFetch } from '@/lib/apiFetch';

const ALL_NAV = [
    { href: '/dashboard', icon: '◈',  label: 'Dashboard' },
    { href: '/licenses',  icon: '⚿',  label: 'Licenses'  },
    { href: '/sales',     icon: '₹',  label: 'Sales'     },
    { href: '/admins',    icon: '⊛',  label: 'Admins',    superOnly: true },
];

export default function AppLayout({ children }) {
    const router   = useRouter();
    const pathname = usePathname();
    const [user, setUser]   = useState(null);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        if (!getToken()) { router.replace('/login'); return; }
        const cached = localStorage.getItem('zyqora_admin_user');
        if (cached) try { setUser(JSON.parse(cached)); } catch {}

        apiFetch('/api/auth/me').then(r => {
            if (!r) return; // auto-redirected on 401
            if (r.ok) {
                setUser(r.data);
                localStorage.setItem('zyqora_admin_user', JSON.stringify(r.data));
            }
            setReady(true);
        });
    }, []);

    const logout = () => {
        clearToken(); // also removes zyqora_admin_user
        router.replace('/login');
    };

    if (!ready && !user) {
        return (
            <div style={{ minHeight: '100vh', background: '#0a0d14', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3a4560', fontSize: 13 }}>
                Loading…
            </div>
        );
    }

    const nav = ALL_NAV.filter(n => !n.superOnly || user?.role === 'super');

    return (
        <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#0a0d14' }}>
            {/* Sidebar */}
            <aside className="sidebar">
                <div className="sidebar-logo">
                    <div className="sidebar-logo-name">Zyqora</div>
                    <div className="sidebar-logo-sub">License Management</div>
                </div>

                <nav className="sidebar-nav">
                    {nav.map(n => (
                        <Link
                            key={n.href}
                            href={n.href}
                            className={`nav-item${pathname.startsWith(n.href) ? ' active' : ''}`}
                        >
                            <span className="nav-icon" style={{ fontSize: 15 }}>{n.icon}</span>
                            <span>{n.label}</span>
                        </Link>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <div className="sidebar-user-name">{user?.username}</div>
                    <div
                        className="sidebar-user-role"
                        style={{ color: user?.role === 'super' ? '#a78bfa' : '#4a9eff' }}
                    >
                        {user?.role}
                    </div>
                    <button className="btn btn-danger btn-sm" onClick={logout} style={{ width: '100%' }}>
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Main content */}
            <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {children}
            </main>
        </div>
    );
}
