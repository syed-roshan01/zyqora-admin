'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getToken } from '@/lib/apiFetch';

export default function RootPage() {
    const router = useRouter();
    useEffect(() => {
        if (!getToken()) { router.replace('/login'); return; }
        try {
            const raw = localStorage.getItem('zyqora_admin_user');
            const u = raw ? JSON.parse(raw) : null;
            router.replace(u?.role === 'affiliate' ? '/affiliate-dashboard' : '/dashboard');
        } catch {
            router.replace('/dashboard');
        }
    }, []);
    return null;
}
