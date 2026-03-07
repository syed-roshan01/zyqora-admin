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
    const res = await fetch(path, {
        ...opts,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(opts.headers || {}),
        },
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    if (res.status === 401) {
        clearToken();
        window.location.href = '/login';
        return null;
    }
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
}
