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
    const rows = await Promise.all(ids.map(id => kv.get(`expense:${id}`)));
    return rows.filter(Boolean);
}

export async function listAdminExpenses(adminId) {
    const ids = await kv.smembers(`expenses:admin:${adminId}`);
    if (!ids || !ids.length) return [];
    const rows = await Promise.all(ids.map(id => kv.get(`expense:${id}`)));
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
    const rows = await Promise.all(ids.map(id => kv.get(`affiliate:${id}`)));
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
    const rows = await Promise.all(ids.map(id => kv.get(`payment:${id}`)));
    return rows.filter(Boolean).sort((a, b) => (b.paidAt || 0) - (a.paidAt || 0));
}

export async function listAllPayments() {
    const ids = await kv.smembers('payments');
    if (!ids || !ids.length) return [];
    const rows = await Promise.all(ids.map(id => kv.get(`payment:${id}`)));
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
    const rows = await Promise.all(ids.map(id => kv.get(`withdrawal:${id}`)));
    return rows.filter(Boolean).sort((a, b) => (b.withdrawnAt || 0) - (a.withdrawnAt || 0));
}

export async function listAdminWithdrawals(adminId) {
    const ids = await kv.smembers(`withdrawals:admin:${adminId}`);
    if (!ids || !ids.length) return [];
    const rows = await Promise.all(ids.map(id => kv.get(`withdrawal:${id}`)));
    return rows.filter(Boolean).sort((a, b) => (b.withdrawnAt || 0) - (a.withdrawnAt || 0));
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export async function getStats() {
    const [allKeys, adminCount] = await Promise.all([
        kv.smembers('licenses'),
        kv.scard('admins'),
    ]);
    return { totalLicenses: (allKeys || []).length, totalAdmins: adminCount || 0 };
}
