import crypto from 'crypto';

// Webhook relay for the Official WhatsApp Cloud API.
// Design goals (Vercel free tier + KV request budget):
//  * The relay is a dumb mailbox. It stores the RAW body + X-Hub-Signature-256 and never sees an App Secret.
//    The customer's own Zyqora app verifies the signature locally.
//  * Authentication is STATELESS (HMAC), so hostile traffic and idle polls cost no KV reads.
//  * Poll interval is server-controlled (nextPollSec) and backs off when idle.

const secret = () => process.env.WA_RELAY_SECRET || process.env.JWT_SECRET || null;
export const relayEnabled = () => !!secret();
const hmac = (label, data) => crypto.createHmac('sha256', secret()).update(`${label}:${data}`).digest('hex');
const safeEq = (a, b) => { const x = Buffer.from(String(a)); const y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

export const MAX_BODY_BYTES = 256 * 1024;
export const QUEUE_CAP = 200;
export const TTL_SEC = 7 * 86400;
export const PULL_BATCH = 50;

export function newBindingId() {
    const rand = crypto.randomBytes(12).toString('base64url');
    return `${rand}.${hmac('bind', rand).slice(0, 20)}`;
}
export function bindingIdValid(id) {
    if (typeof id !== 'string' || id.length > 80 || !relayEnabled()) return false;
    const [rand, sig] = id.split('.');
    return !!rand && !!sig && /^[A-Za-z0-9_-]{16}$/.test(rand) && safeEq(sig, hmac('bind', rand).slice(0, 20));
}
export const pullSecretFor = (id) => hmac('pull', id);
export const verifyTokenFor = (id) => hmac('verify', id).slice(0, 32);
export const pullSecretValid = (id, s) => bindingIdValid(id) && typeof s === 'string' && safeEq(s, pullSecretFor(id));
export const queueKey = (id) => `walr:q:${id}`;

/** Server-controlled poll interval: fast while events flow or the app just sent, slow when idle. Never below 15s. */
export function nextPollSec({ gotEvents, streak = 0, active = false }) {
    if (gotEvents) return 15;
    const s = Math.max(0, Math.min(1000, Number(streak) || 0));
    let sec = s < 3 ? 30 : s < 10 ? 60 : s < 30 ? 180 : 600;
    if (active) sec = Math.min(sec, 30);
    return Math.max(15, sec);
}

export function publicBase(req) {
    return (process.env.PUBLIC_BASE_URL || new URL(req.url).origin).replace(/\/$/, '');
}
