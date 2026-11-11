import { kv } from '@vercel/kv';
import crypto from 'crypto';
import { saveLicense, getLicense, mgetMany } from '@/lib/kv';
import { saveLog } from '@/lib/logs';
import { generateKey, planToExpiry } from '@/lib/license';
import { PLANS } from '@/lib/plans';

const ORDER_TTL = 60 * 60 * 24 * 120;            // pending orders live 120 days
const SELLABLE_MODES = ['desktop', 'app'];       // cloud keys are still issued manually
const ORDERS_Z = 'orders:z';                     // sorted set of orderIds by createdAt

export const MACHINE_ID_RE = /^[A-F0-9]{16}$/;

export function newOrderId() {
    return 'ZQ' + crypto.randomBytes(12).toString('hex').toUpperCase();
}
export function isSellableMode(mode) {
    return SELLABLE_MODES.includes(mode);
}
export async function saveOrder(order) {
    await kv.set(`order:${order.orderId}`, order, { ex: ORDER_TTL });
}
export async function getOrder(orderId) {
    if (!orderId || !/^ZQ[A-F0-9]{24}$/.test(orderId)) return null;
    return kv.get(`order:${orderId}`);
}
// Index so the admin Orders screen can list newest-first.
export async function indexOrder(order) {
    try { await kv.zadd(ORDERS_Z, { score: order.createdAt || Math.floor(Date.now() / 1000), member: order.orderId }); } catch { /* best effort */ }
}
export async function listOrders(limit = 300) {
    let ids = [];
    try { ids = await kv.zrange(ORDERS_Z, 0, limit - 1, { rev: true }); } catch { ids = []; }
    if (!ids || !ids.length) return [];
    const rows = await mgetMany(ids.map(id => `order:${id}`));
    return (rows || []).filter(Boolean);
}

// Issues and stores a license for an approved order, so the record looks exactly
// like one made in the admin panel (plus source/order fields). Idempotent per order:
// if the order already has a licenseKey, that key is returned unchanged.
export async function issueLicenseForOrder(order, actor = {}) {
    if (order.licenseKey) {
        const existing = await getLicense(order.licenseKey);
        if (existing) return existing;
    }
    const plan = PLANS[order.planId];
    if (!plan) throw new Error('Unknown plan on order');

    const machineId = String(order.machineId).toUpperCase();
    const licenseMode = order.mode === 'app' ? 'app' : 'desktop';
    let expiryTs = planToExpiry(plan.durationPlan);
    let key = generateKey({ machineId, expiryTs, deviceLimit: plan.deviceLimit, licenseMode });
    for (let tries = 0; tries < 5 && await getLicense(key); tries++) {
        expiryTs += 1;
        key = generateKey({ machineId, expiryTs, deviceLimit: plan.deviceLimit, licenseMode });
    }
    const now = Math.floor(Date.now() / 1000);
    const license = {
        key,
        plan: plan.durationPlan,
        planTier: plan.id,
        deviceLimit: plan.deviceLimit,
        expiryTs,
        isLifetime: false,
        price: plan.price,
        discountedPrice: order.amount || plan.price,
        discountAmount: Math.max(0, plan.price - (order.amount || plan.price)),
        licenseMode,
        machineId,
        clientName: order.customer?.name || 'UPI customer',
        clientPhone: order.customer?.phone || '',
        clientEmail: order.customer?.email || '',
        businessCategory: '',
        website: 'No website',
        notes: `UPI checkout (${plan.name}) · ref ${order.utr || '—'}`,
        features: plan.features,
        affiliateId: null,
        affiliateName: null,
        affiliateCommissionAmount: null,
        reviewAccess: false,
        source: 'upi',
        orderId: order.orderId,
        paymentRef: order.utr || '',
        issuedBy: actor.sub || 'system',
        issuedByName: actor.username || 'UPI checkout',
        issuedAt: now,
        activated: false,
        activatedAt: null,
        revoked: false,
        revokedBy: null,
        revokedByName: null,
        revokedAt: null,
        revokedReason: null,
    };
    await saveLicense(license);
    await saveLog({
        id: crypto.randomUUID(),
        action: 'LICENSE_GENERATED',
        actorId: actor.sub || 'system',
        actorName: license.issuedByName,
        actorRole: actor.role || 'system',
        ts: now,
        flag: null,
        meta: {
            key, clientName: license.clientName, clientPhone: license.clientPhone,
            plan: plan.durationPlan, tier: plan.id, price: plan.price, discountedPrice: license.discountedPrice,
            deviceLimit: plan.deviceLimit, issuedByName: license.issuedByName, source: 'upi', orderId: order.orderId,
        },
    });
    return license;
}
