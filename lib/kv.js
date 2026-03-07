import { kv } from '@vercel/kv';

// ── Admins ────────────────────────────────────────────────────────────────────

export async function getAdmin(id) {
    return kv.get(`admin:${id}`);
}

export async function getAdminByUsername(username) {
    const id = await kv.get(`admin:u:${username.toLowerCase()}`);
    if (!id) return null;
    return kv.get(`admin:${id}`);
}

export async function saveAdmin(admin) {
    await kv.set(`admin:${admin.id}`, admin);
    await kv.set(`admin:u:${admin.username.toLowerCase()}`, admin.id);
    await kv.sadd('admins', admin.id);
}

export async function listAdmins() {
    const ids = await kv.smembers('admins');
    if (!ids || !ids.length) return [];
    const rows = await Promise.all(ids.map(id => kv.get(`admin:${id}`)));
    return rows.filter(Boolean);
}

export async function getAdminLicenseKeys(adminId) {
    const keys = await kv.smembers(`licenses:admin:${adminId}`);
    return keys || [];
}

// ── Licenses ──────────────────────────────────────────────────────────────────

export async function getLicense(key) {
    return kv.get(`license:${key.toUpperCase()}`);
}

export async function saveLicense(license) {
    const k = license.key.toUpperCase();
    await kv.set(`license:${k}`, license);
    await kv.sadd('licenses', k);
    await kv.sadd(`licenses:admin:${license.issuedBy}`, k);
}

export async function listAllLicenses() {
    const keys = await kv.smembers('licenses');
    if (!keys || !keys.length) return [];
    const rows = await Promise.all(keys.map(k => kv.get(`license:${k}`)));
    return rows.filter(Boolean);
}

export async function listAdminLicenses(adminId) {
    const keys = await kv.smembers(`licenses:admin:${adminId}`);
    if (!keys || !keys.length) return [];
    const rows = await Promise.all(keys.map(k => kv.get(`license:${k}`)));
    return rows.filter(Boolean);
}

export async function deleteLicense(license) {
    const k = license.key.toUpperCase();
    await Promise.all([
        kv.del(`license:${k}`),
        kv.srem('licenses', k),
        kv.srem(`licenses:admin:${license.issuedBy}`, k),
    ]);
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export async function getStats() {
    const [allKeys, adminCount] = await Promise.all([
        kv.smembers('licenses'),
        kv.scard('admins'),
    ]);
    return { totalLicenses: (allKeys || []).length, totalAdmins: adminCount || 0 };
}
