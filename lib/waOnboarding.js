import { kv } from '@vercel/kv';
import crypto from 'crypto';
import { getLicense, getAdmin, mgetMany } from '@/lib/kv';
import { validateKey, validateCloudKey } from '@/lib/license';

// ── Statuses (admin-configurable wording; keys are fixed so history stays meaningful) ─────────────────────────
export const DEFAULT_STATUSES = [
    { key: 'request_submitted', label: 'Request Submitted', description: 'We received your request.', nextStep: 'A team member will review your details.', customerAction: null, path: true },
    { key: 'under_review', label: 'Under Review', description: 'Our team is reviewing your request.', nextStep: 'We may contact you if anything is missing.', customerAction: null, path: true },
    { key: 'awaiting_customer_info', label: 'Awaiting Customer Information', description: 'We need a few details from you to continue.', nextStep: 'Reply to the question shown below.', customerAction: 'Please provide the requested information.', path: false },
    { key: 'meta_business_setup', label: 'Meta Business Setup', description: 'We are helping set up or review your Meta Business Portfolio.', nextStep: 'Follow the steps our team shares with you.', customerAction: null, path: true },
    { key: 'business_verification_pending', label: 'Business Verification Pending', description: 'Meta business verification still has to be completed.', nextStep: 'Provide the business documents our team asks for.', customerAction: 'Prepare your business documents.', path: true },
    { key: 'business_verification_submitted', label: 'Business Verification Submitted', description: 'Verification was submitted to Meta. Meta decides the outcome and its timing.', nextStep: 'We will update this page when Meta responds.', customerAction: null, path: true },
    { key: 'business_verification_approved', label: 'Business Verification Approved', description: 'Meta approved your business verification.', nextStep: 'We will register your WhatsApp number.', customerAction: null, path: true },
    { key: 'number_registration', label: 'WhatsApp Number Registration', description: 'Your WhatsApp Business number is being registered.', nextStep: 'You may be asked to confirm the number.', customerAction: null, path: true },
    { key: 'api_configuration', label: 'API Configuration', description: 'The Cloud API connection is being configured.', nextStep: 'We will share the connection details with you.', customerAction: null, path: true },
    { key: 'webhook_configuration', label: 'Webhook Configuration', description: 'Webhooks are being configured so you receive delivery updates and replies.', nextStep: 'Almost there — testing comes next.', customerAction: null, path: true },
    { key: 'testing', label: 'Testing', description: 'We are testing sending and receiving.', nextStep: 'We will confirm when it is ready.', customerAction: null, path: true },
    { key: 'connected', label: 'Connected', description: 'Your official WhatsApp number is connected to Zyqora.', nextStep: 'Open WhatsApp → Official API to start.', customerAction: null, path: true, terminal: true },
    { key: 'rejected_needs_attention', label: 'Rejected / Needs Attention', description: 'Something needs attention before we can continue.', nextStep: 'Our team will explain what to fix.', customerAction: 'Please check the note from our team.', path: false },
    { key: 'cancelled', label: 'Cancelled', description: 'This request was cancelled.', nextStep: 'You can submit a new request any time.', customerAction: null, path: false, terminal: true },
];
const STATUS_KEYS = DEFAULT_STATUSES.map((s) => s.key);
const CFG = 'waob:config';

export async function getConfig() {
    const over = ((await kv.get(CFG)) || {}).statuses || {};
    return DEFAULT_STATUSES.map((s) => ({ ...s, label: over[s.key]?.label || s.label, description: over[s.key]?.description ?? s.description, nextStep: over[s.key]?.nextStep ?? s.nextStep, customerAction: over[s.key]?.customerAction !== undefined ? over[s.key].customerAction : s.customerAction }));
}
export async function saveConfig(statuses) {
    const clean = {};
    for (const k of STATUS_KEYS) { const v = statuses && statuses[k]; if (!v) continue;
        clean[k] = { label: String(v.label || '').slice(0, 60) || undefined, description: String(v.description ?? '').slice(0, 300), nextStep: String(v.nextStep ?? '').slice(0, 200), customerAction: v.customerAction ? String(v.customerAction).slice(0, 200) : null }; }
    await kv.set(CFG, { statuses: clean, updatedAt: Date.now() }); return getConfig();
}

// ── Customer auth (license key + machine id), same rules as license validation ──────────────────────────────
const MID_RE = /^[A-F0-9]{16}$/;
export async function authCustomerLicense(licenseKey, machineId) {
    const key = String(licenseKey || '').trim().toUpperCase(); const mid = String(machineId || '').trim().toUpperCase();
    if (!/^ZYQ(-[A-F0-9]{8}){4}$/.test(key)) return { ok: false, status: 400, error: 'bad_request' };
    const license = await getLicense(key);
    if (!license || license.revoked) return { ok: false, status: 403, error: 'license_invalid' };
    const cloud = license.licenseMode === 'cloud';
    if (!cloud && !MID_RE.test(mid)) return { ok: false, status: 400, error: 'bad_request' };
    let c = cloud ? validateCloudKey(key) : validateKey(key, mid);
    if ((!c || !c.valid) && license.validationException === true) c = validateKey(key, String(license.machineId || '').toUpperCase());
    if (!c || !c.valid) return { ok: false, status: 403, error: 'license_invalid' };
    return { ok: true, key, machineId: cloud ? 'CLOUD' : mid, license };
}

// ── Form validation. NEVER accepts credentials/OTPs/tokens. ─────────────────────────────────────────────────
const SECRET_PATTERNS = [/EAA[A-Za-z0-9]{20,}/, /\b(password|passcode|passwd|otp|one[- ]time|recovery code|backup code|2fa|verification code|access token|app secret)\b\s*(is|:|=)/i, /\b\d{6}\b.*\b(otp|code)\b/i];
export function scanForSecrets(text) { return SECRET_PATTERNS.some((r) => r.test(String(text || ''))); }
export const SECRET_MSG = 'Please do not share passwords, OTPs, recovery codes or access tokens here. Our team will never ask for them.';
const ENUM = {
    businessType: ['sole_proprietorship', 'partnership', 'private_limited', 'llp', 'public_limited', 'ngo', 'other'],
    metaPortfolio: ['yes', 'no', 'unsure'], numberStatus: ['no_number_yet', 'regular_whatsapp', 'whatsapp_business_app', 'new_number', 'already_on_cloud_api', 'unsure'],
    verificationStatus: ['not_started', 'in_progress', 'verified', 'unsure'], preferredContact: ['whatsapp', 'email', 'phone_call'],
};
const t = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
export function validateForm(f = {}) {
    const e = [];
    const out = { businessLegalName: t(f.businessLegalName, 150), businessDisplayName: t(f.businessDisplayName, 100), website: t(f.website, 200), businessEmail: t(f.businessEmail, 150).toLowerCase(), country: t(f.country, 80),
        contactPhone: t(f.contactPhone, 25), businessCategory: t(f.businessCategory, 100), businessAddress: t(f.businessAddress, 300), businessType: t(f.businessType, 40), whatsappNumber: t(f.whatsappNumber, 25),
        metaPortfolio: t(f.metaPortfolio, 10), existingWabaId: t(f.existingWabaId, 25), numberStatus: t(f.numberStatus, 30), verificationStatus: t(f.verificationStatus, 20), preferredContact: t(f.preferredContact, 20), notes: t(f.notes, 1000), consent: f.consent === true };
    if (!out.businessLegalName) e.push('Business legal name is required.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(out.businessEmail)) e.push('A valid business email is required.');
    if (!out.country) e.push('Country is required.');
    if (!/^\+?[\d\s\-()]{7,20}$/.test(out.contactPhone)) e.push('A valid contact phone number is required.');
    if (!out.businessCategory) e.push('Business category is required.');
    if (out.website) { try { out.website = new URL(/^https?:\/\//i.test(out.website) ? out.website : 'https://' + out.website).toString(); } catch { e.push('Website is not a valid address.'); } }
    if (out.whatsappNumber && !/^\+?[\d\s\-()]{7,20}$/.test(out.whatsappNumber)) e.push('The WhatsApp number to connect is not valid.');
    if (out.existingWabaId && !/^\d{5,25}$/.test(out.existingWabaId)) e.push('The WhatsApp Business Account ID must be digits only.');
    for (const k of Object.keys(ENUM)) if (out[k] && !ENUM[k].includes(out[k])) e.push(`Invalid value for ${k}.`);
    if (!out.consent) e.push('You must agree to the consent statement to continue.');
    for (const k of ['businessLegalName', 'businessDisplayName', 'businessAddress', 'notes', 'businessCategory']) if (scanForSecrets(out[k])) { e.push(SECRET_MSG); break; }
    return { errors: [...new Set(e)], form: out };
}

// ── Storage ─────────────────────────────────────────────────────────────────────────────────────────────────
export const recKey = (id) => `waob:${id}`;
const idxKey = (lic) => `waob:lic:${lic}`;
export async function getRecord(id) { return /^[0-9a-f-]{36}$/.test(String(id)) ? kv.get(recKey(id)) : null; }
export async function getByLicense(key) { const id = await kv.get(idxKey(key)); return id ? kv.get(recKey(id)) : null; }
export async function saveRecord(rec) { rec.updatedAt = Date.now(); await kv.set(recKey(rec.id), rec); await kv.sadd('waob:all', rec.id); await kv.set(idxKey(rec.licenseKey), rec.id); return rec; }
export async function listRecords() { const ids = (await kv.smembers('waob:all')) || []; return (await mgetMany(ids.map(recKey))).filter(Boolean); }

export function newRecord({ licenseKey, machineId, license, form }) {
    const now = Date.now();
    return { id: crypto.randomUUID(), licenseKey, machineId, customer: { name: license.clientName || '', phone: license.clientPhone || '', email: license.clientEmail || '' }, form, status: 'request_submitted', assignedTo: null,
        ids: { wabaId: '', phoneNumberId: '', businessPortfolioId: '', verificationSubmittedAt: null, verificationApprovedAt: null }, notes: [], customerMessages: [], customerAction: null, failedAttempts: [], retries: 0, suspended: false,
        history: [{ at: now, type: 'created', byName: 'customer', to: 'request_submitted' }], createdAt: now, updatedAt: now };
}

/** What a customer may see: NO internal notes, no failed-attempt details, only the agent's display name. */
export function customerView(rec, cfg) {
    const cur = cfg.find((s) => s.key === rec.status) || cfg[0];
    const path = cfg.filter((s) => s.path); const idx = path.findIndex((s) => s.key === rec.status);
    const reached = rec.history.filter((h) => h.type === 'status' || h.type === 'created').map((h) => path.findIndex((s) => s.key === h.to));
    const lastPathIdx = Math.max(-1, ...reached);
    return { id: rec.id, status: rec.status, statusLabel: cur.label, description: cur.description, nextStep: cur.nextStep,
        customerAction: rec.customerAction ? rec.customerAction.message : cur.customerAction, awaitingInfo: rec.status === 'awaiting_customer_info',
        assignedAgent: rec.assignedTo ? rec.assignedTo.name : null, onHold: !!rec.suspended, lastUpdated: rec.updatedAt, createdAt: rec.createdAt,
        steps: path.map((s, i) => ({ key: s.key, label: s.label, state: idx >= 0 ? (i < idx ? 'done' : i === idx ? 'current' : 'todo') : (i <= lastPathIdx ? 'done' : 'todo') })),
        notes: rec.notes.filter((n) => n.visibility === 'customer').map((n) => ({ at: n.at, text: n.text, by: n.byName })),
        timeline: rec.history.filter((h) => h.type === 'status' || h.type === 'created').map((h) => ({ at: h.at, label: (cfg.find((s) => s.key === h.to) || {}).label || h.to })),
        canCancel: !['connected', 'cancelled'].includes(rec.status), form: { businessLegalName: rec.form.businessLegalName, whatsappNumber: rec.form.whatsappNumber } };
}

export async function appendLog(action, session, meta) {
    try { const { saveLog } = await import('@/lib/logs'); await saveLog({ id: crypto.randomUUID(), action, actorId: session?.sub || 'customer', actorName: session?.username || 'customer', actorRole: session?.role || 'customer', ts: Math.floor(Date.now() / 1000), flag: null, meta }); } catch { /* logging must never break a request */ }
}
export { STATUS_KEYS, getAdmin };
