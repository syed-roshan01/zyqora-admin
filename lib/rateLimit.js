import { kv } from '@vercel/kv';

// Fixed-window counter in KV. Returns true if the request is allowed.
export async function allow(bucket, limit, windowSec) {
    try {
        const k = `rl:${bucket}`;
        const n = await kv.incr(k);
        if (n === 1) await kv.expire(k, windowSec);
        return n <= limit;
    } catch {
        return true; // never block real customers because the limiter itself failed
    }
}

export function clientIp(req) {
    const xf = req.headers.get('x-forwarded-for');
    return (xf ? xf.split(',')[0].trim() : req.headers.get('x-real-ip')) || 'unknown';
}
