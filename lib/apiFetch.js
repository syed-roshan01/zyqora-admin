// Client-side API helper — runs only in browser

export function getToken() {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('zyqora_admin_token');
}

export function setToken(token) {
    localStorage.setItem('zyqora_admin_token', token);
}

export function clearToken() {
    localStorage.removeItem('zyqora_admin_token');
    localStorage.removeItem('zyqora_admin_user');
}

export async function apiFetch(path, opts = {}) {
    const token = getToken();
    let res;
    try {
        res = await fetch(path, {
            ...opts,
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...(opts.headers || {}),
            },
            body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        });
    } catch {
        // Network failure (offline, DNS, server unreachable): return a failed
        // result instead of throwing, so pages fall back to their empty/error
        // states instead of hanging on "Loading…" forever.
        return { ok: false, status: 0, data: { error: 'Network error — check your connection' } };
    }
    if (res.status === 401) {
        clearToken();
        window.location.href = '/login';
        return null;
    }
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
}
