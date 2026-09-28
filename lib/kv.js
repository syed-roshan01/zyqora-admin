import { kv } from '@vercel/kv';

// ── Batched reads ─────────────────────────────────────────────────────────────
// Each kv.get() is a separate HTTPS round-trip. Reading a list of records one
// key at a time is O(N) requests — with hundreds of licenses that meant 1-2s+
// per page load and ballooning KV request usage. kv.mget batches many keys
// into one request; we chunk to keep request bodies bounded as data grows.

const MGET_CHUNK = 500;

export async function mgetMany(keys) {
    if (!keys || !keys.length) return [];
    const out = [];
    for (let i = 0; i < keys.length; i += MGET_CHUNK) {
        const chunk = keys.slice(i, i + MGET_CHUNK);
        const values = await kv.mget(...chunk);
        out.push(...(values || []));
    }
    return out;
}

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
    const rows = await mgetMany(ids.map(id => `admin:${id}`));
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
    const rows = await mgetMany(keys.map(k => `license:${k}`));
    return rows.filter(Boolean);
}

export async function listAdminLicenses(adminId) {
    const keys = await kv.smembers(`licenses:admin:${adminId}`);
    if (!keys || !keys.length) return [];
    const rows = await mgetMany(keys.map(k => `license:${k}`));
    return rows.filter(Boolean);
}

export async function getDemoSettings() {
    return (await kv.get('settings:demo')) || { enabled: true };
}

export async function saveDemoSettings(settings) {
    await kv.set('settings:demo', settings);
    return settings;
}

export async function deleteLicense(license) {
    const k = license.key.toUpperCase();
    await Promise.all([
        kv.del(`license:${k}`),
        kv.srem('licenses', k),
        kv.srem(`licenses:admin:${license.issuedBy}`, k),
    ]);
}

// ── Expenses ─────────────────────────────────────────────────────────────────

export async function getExpense(id) {
    return kv.get(`expense:${id}`);
}

export async function saveExpense(expense) {
    await kv.set(`expense:${expense.id}`, expense);
    await kv.sadd('expenses', expense.id);
    await kv.sadd(`expenses:admin:${expense.spentBy}`, expense.id);
}

export async function listAllExpenses() {
    const ids = await kv.smembers('expenses');
    if (!ids || !ids.length) return [];
    const rows = await mgetMany(ids.map(id => `expense:${id}`));
    return rows.filter(Boolean);
}

export async function listAdminExpenses(adminId) {
    const ids = await kv.smembers(`expenses:admin:${adminId}`);
    if (!ids || !ids.length) return [];
    const rows = await mgetMany(ids.map(id => `expense:${id}`));
    return rows.filter(Boolean);
}

// ── Affiliates ────────────────────────────────────────────────────────────────

export async function getAffiliate(id) {
    return kv.get(`affiliate:${id}`);
}

export async function getAffiliateByUsername(username) {
    const id = await kv.get(`affiliate:u:${username.toLowerCase()}`);
    if (!id) return null;
    return kv.get(`affiliate:${id}`);
}

export async function saveAffiliate(affiliate) {
    await kv.set(`affiliate:${affiliate.id}`, affiliate);
    await kv.set(`affiliate:u:${affiliate.username.toLowerCase()}`, affiliate.id);
    await kv.sadd('affiliates', affiliate.id);
}

export async function listAffiliates() {
    const ids = await kv.smembers('affiliates');
    if (!ids || !ids.length) return [];
    const rows = await mgetMany(ids.map(id => `affiliate:${id}`));
    return rows.filter(Boolean);
}

export async function deleteAffiliate(affiliate) {
    await kv.del(`affiliate:${affiliate.id}`);
    await kv.del(`affiliate:u:${affiliate.username.toLowerCase()}`);
    await kv.srem('affiliates', affiliate.id);
}

// ── Affiliate Payments (payouts) ──────────────────────────────────────────────

export async function getPayment(id) {
    return kv.get(`payment:${id}`);
}

export async function savePayment(payment) {
    await kv.set(`payment:${payment.id}`, payment);
    await kv.sadd('payments', payment.id);
    await kv.sadd(`payments:affiliate:${payment.affiliateId}`, payment.id);
}

export async function listAffiliatePayments(affiliateId) {
    const ids = await kv.smembers(`payments:affiliate:${affiliateId}`);
    if (!ids || !ids.length) return [];
    const rows = await mgetMany(ids.map(id => `payment:${id}`));
    return rows.filter(Boolean).sort((a, b) => (b.paidAt || 0) - (a.paidAt || 0));
}

export async function listAllPayments() {
    const ids = await kv.smembers('payments');
    if (!ids || !ids.length) return [];
    const rows = await mgetMany(ids.map(id => `payment:${id}`));
    return rows.filter(Boolean).sort((a, b) => (b.paidAt || 0) - (a.paidAt || 0));
}

// ── Admin Withdrawals ─────────────────────────────────────────────────────────

export async function getWithdrawal(id) {
    return kv.get(`withdrawal:${id}`);
}

export async function saveWithdrawal(withdrawal) {
    await kv.set(`withdrawal:${withdrawal.id}`, withdrawal);
    await kv.sadd('withdrawals', withdrawal.id);
    await kv.sadd(`withdrawals:admin:${withdrawal.adminId}`, withdrawal.id);
}

export async function listAllWithdrawals() {
    const ids = await kv.smembers('withdrawals');
    if (!ids || !ids.length) return [];
    const rows = await mgetMany(ids.map(id => `withdrawal:${id}`));
    return rows.filter(Boolean).sort((a, b) => (b.withdrawnAt || 0) - (a.withdrawnAt || 0));
}

export async function listAdminWithdrawals(adminId) {
    const ids = await kv.smembers(`withdrawals:admin:${adminId}`);
    if (!ids || !ids.length) return [];
    const rows = await mgetMany(ids.map(id => `withdrawal:${id}`));
    return rows.filter(Boolean).sort((a, b) => (b.withdrawnAt || 0) - (a.withdrawnAt || 0));
}

// ── Whitelabel Clients ────────────────────────────────────────────────────────

export async function getWhitelabel(id) {
    return kv.get(`whitelabel:${id}`);
}

export async function getWhitelabelByUsername(username) {
    const id = await kv.get(`whitelabel:u:${username.toLowerCase()}`);
    if (!id) return null;
    return kv.get(`whitelabel:${id}`);
}

export async function saveWhitelabel(whitelabel) {
    // Guard against corrupted records ever being written: a record without
    // id/username would land at whitelabel:undefined and silently break the
    // client's login, quota and every restriction.
    if (!whitelabel?.id || !whitelabel?.username)
        throw new Error('saveWhitelabel: record is missing id/username — refusing to write');
    await kv.set(`whitelabel:${whitelabel.id}`, whitelabel);
    await kv.set(`whitelabel:u:${whitelabel.username.toLowerCase()}`, whitelabel.id);
    await kv.sadd('whitelabels', whitelabel.id);
}

export async function listWhitelabels() {
    const ids = await kv.smembers('whitelabels');
    if (!ids || !ids.length) return [];
    const rows = await mgetMany(ids.map(id => `whitelabel:${id}`));
    // Guard against corrupted records (missing id/username) ever reaching
    // the UI — a garbage row can't be edited, deleted or displayed safely.
    return rows.filter(r => r && typeof r === 'object' && r.id && r.username);
}

/**
 * Remove a whitelabel client account (record, username index, set entry).
 * Licenses they issued deliberately stay in the records — deleting the
 * reseller must not erase sales history. Defensive against corrupted
 * records so super admins can use delete to clean them up.
 */
export async function deleteWhitelabel(whitelabel) {
    if (whitelabel?.id) {
        await kv.del(`whitelabel:${whitelabel.id}`);
        await kv.srem('whitelabels', whitelabel.id);
    }
    if (whitelabel?.username) {
        await kv.del(`whitelabel:u:${whitelabel.username.toLowerCase()}`);
    }
}

/**
 * Number of licenses an account (admin or whitelabel) has issued, counted
 * against a whitelabel quota. Deleted licenses are already absent from the
 * set; keys auto-revoked by a trial→paid conversion are excluded so a
 * conversion stays net-neutral against the quota.
 */
export async function countIssuedLicenses(adminId) {
    const rows = await listAdminLicenses(adminId);
    return rows.filter(l => !(l.revoked && typeof l.revokedReason === 'string' && l.revokedReason.startsWith('Converted to'))).length;
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export async function getStats() {
    const [allKeys, adminCount] = await Promise.all([
        kv.smembers('licenses'),
        kv.scard('admins'),
    ]);
    return { totalLicenses: (allKeys || []).length, totalAdmins: adminCount || 0 };
}
