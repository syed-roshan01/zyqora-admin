import crypto from 'crypto';

const LICENSE_SECRET = process.env.LICENSE_SECRET || 'Zyq$7mKp9xLv2WnBd5tYs6hJfQe1cR8uAoVz3TGw';

// Key format: ZYQ-{expiryHex8}-{deviceHex2+hmac6}-{hmac8}-{hmac8}
const CLOUD_MACHINE_MARKER = 'CLOUD';

export function generateKey({ machineId, expiryTs, deviceLimit, licenseMode = 'desktop' }) {
    const expiryHex = expiryTs.toString(16).toUpperCase().padStart(8, '0');
    const dl = Math.min(255, Math.max(1, Math.floor(deviceLimit)));
    const deviceHex = dl.toString(16).toUpperCase().padStart(2, '0');
    const identity = licenseMode === 'cloud' ? CLOUD_MACHINE_MARKER : machineId;
    const payload = `${identity.toUpperCase()}|${expiryHex}|${deviceHex}`;
    const hmac = crypto
        .createHmac('sha256', LICENSE_SECRET)
        .update(payload)
        .digest('hex')
        .toUpperCase();
    // p2 = deviceHex(2) + hmac[0..5](6)  = 8 chars
    // p3 = hmac[6..13]                   = 8 chars
    // p4 = hmac[14..21]                  = 8 chars
    const p2 = deviceHex + hmac.slice(0, 6);
    const p3 = hmac.slice(6, 14);
    const p4 = hmac.slice(14, 22);
    return `ZYQ-${expiryHex}-${p2}-${p3}-${p4}`;
}

export function validateKey(key, machineId) {
    if (!key || typeof key !== 'string') return null;
    const clean = key.trim().toUpperCase().replace(/\s/g, '');
    const parts = clean.split('-');
    if (parts.length !== 5 || parts[0] !== 'ZYQ') return null;
    const [, p1, p2, p3, p4] = parts;
    if (p1.length !== 8 || p2.length !== 8 || p3.length !== 8 || p4.length !== 8) return null;
    const expiryHex = p1;
    const deviceHex = p2.slice(0, 2);
    const hmacGiven = (p2.slice(2) + p3 + p4).toUpperCase();
    const payload = `${machineId.toUpperCase()}|${expiryHex}|${deviceHex}`;
    const expected = crypto
        .createHmac('sha256', LICENSE_SECRET)
        .update(payload)
        .digest('hex')
        .toUpperCase();
    if (expected.slice(0, 22) !== hmacGiven) return null;
    const expiryTs = parseInt(expiryHex, 16);
    const deviceLimit = parseInt(deviceHex, 16);
    const isLifetime = expiryTs === 0xFFFFFFFF;
    const valid = isLifetime || expiryTs > Math.floor(Date.now() / 1000);
    return { expiryTs, deviceLimit, valid, isLifetime };
}

export function validateCloudKey(key) {
    return validateKey(key, CLOUD_MACHINE_MARKER);
}

// Compute expiry unix timestamp from plan name
export function planToExpiry(plan, customDays = 0) {
    if (plan === 'lifetime') return 0xFFFFFFFF;
    const days = {
        trial1day: 1,
        trial:    3,
        weekly:   7,
        monthly:  30,
        '3months': 90,
        '6months': 180,
        yearly:   365,
        custom:   Math.max(1, parseInt(customDays) || 1),
    }[plan] ?? 30;
    return Math.floor(Date.now() / 1000) + days * 86400;
}

export const PLAN_OPTIONS = [
    { value: 'trial1day', label: 'Trial (1 day)'         },
    { value: 'trial',    label: 'Trial (3 days)'         },
    { value: 'weekly',   label: 'Weekly (7 days)'        },
    { value: 'monthly',  label: 'Monthly (30 days)'      },
    { value: '3months',  label: '3 Months (90 days)'     },
    { value: '6months',  label: '6 Months (180 days)'    },
    { value: 'yearly',   label: 'Yearly (365 days)'      },
    { value: 'lifetime', label: 'Lifetime'               },
    { value: 'custom',   label: 'Custom (specify days)'  },
];

// Single source of truth for valid license types, shared by the generate
// form, the generate API's whitelist check, and the validate API's
// type/mode matching — added here once instead of duplicating the literal
// array across files.
export const LICENSE_MODES = ['desktop', 'cloud', 'app'];

// Key durations a whitelabel reseller may be granted by the super admin.
// The reseller can only issue licenses for durations in their allow-list —
// trials, weekly and lifetime are never available to resellers.
export const WL_PLAN_OPTIONS = [
    { value: 'monthly', label: '1 Month',  days: 30  },
    { value: '3months', label: '3 Months', days: 90  },
    { value: '6months', label: '6 Months', days: 180 },
    { value: 'yearly',  label: '1 Year',   days: 365 },
    { value: 'custom',  label: 'Custom Days', days: null },
];
export const WL_PLANS = WL_PLAN_OPTIONS.map(o => o.value);

// Resolve a whitelabel record's effective allow-list: records created before
// this field existed (or with an unusable value) fall back to "all durations"
// so existing resellers keep working until the super admin restricts them.
export function resolveWlPlans(whitelabel) {
    const list = Array.isArray(whitelabel?.allowedPlans) ? whitelabel.allowedPlans.filter(p => WL_PLANS.includes(p)) : [];
    return list.length ? list : [...WL_PLANS];
}

// Resolve a whitelabel record's effective per-key device cap. Missing field
// (pre-existing records) means unrestricted (255 = key format maximum).
export function resolveWlMaxDevices(whitelabel) {
    const n = Math.floor(Number(whitelabel?.maxDevices));
    return Number.isFinite(n) && n >= 1 && n <= 255 ? n : 255;
}

export const PLAN_COLORS = {
    trial1day:'#f59e0b',
    trial:    '#f59e0b',
    weekly:   '#3b82f6',
    monthly:  '#4a9eff',
    '3months':'#06b6d4',
    '6months':'#8b5cf6',
    yearly:   '#25D366',
    lifetime: '#7c3aed',
    custom:   '#94a3b8',
};
