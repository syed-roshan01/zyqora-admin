// In-memory @vercel/kv stand-in that counts commands (used to prove idle/forged traffic costs no KV usage).
const store = new Map(); const sets = new Map(); const lists = new Map();
export const stats = { commands: 0 };
const c = (n = 1) => { stats.commands += n; };
const clone = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
export const kv = {
    async get(k) { c(); return store.has(k) ? clone(store.get(k)) : null; },
    async set(k, v) { c(); store.set(k, clone(v)); return 'OK'; },
    async del(...ks) { c(); let n = 0; for (const k of ks.flat()) { n += +store.delete(k) + +lists.delete(k) + +sets.delete(k); } return n; },
    async mget(...ks) { c(); return ks.flat().map((k) => (store.has(k) ? clone(store.get(k)) : null)); },
    async sadd(k, ...m) { c(); const s = sets.get(k) || new Set(); m.forEach((x) => s.add(x)); sets.set(k, s); return m.length; },
    async srem(k, ...m) { c(); const s = sets.get(k); if (s) m.forEach((x) => s.delete(x)); return 1; },
    async smembers(k) { c(); return [...(sets.get(k) || [])]; },
    async incr(k) { c(); const n = (store.get(k) || 0) + 1; store.set(k, n); return n; },
    async expire() { c(); return 1; },
    async exists(k) { c(); return store.has(k) || lists.has(k) ? 1 : 0; },
    async rpush(k, ...v) { c(); const l = lists.get(k) || []; v.forEach((x) => l.push(clone(x))); lists.set(k, l); return l.length; },
    async lpush(k, ...v) { c(); const l = lists.get(k) || []; v.forEach((x) => l.unshift(clone(x))); lists.set(k, l); return l.length; },
    async ltrim(k, s, e) { c(); const l = lists.get(k) || []; const end = e < 0 ? l.length + e + 1 : e + 1; lists.set(k, l.slice(s < 0 ? l.length + s : s, end)); return 'OK'; },
    async lrange(k, s, e) { c(); const l = lists.get(k) || []; return clone(l.slice(s, (e < 0 ? l.length + e + 1 : e + 1))); },
    async llen(k) { c(); return (lists.get(k) || []).length; },
    pipeline() { const ops = []; const p = new Proxy({}, { get: (_, name) => (name === 'exec' ? async () => { const out = []; for (const [n, a] of ops) out.push(await kv[n](...a)); return out; } : (...a) => { ops.push([name, a]); return p; }) }); return p; },
};
export const _reset = () => { store.clear(); sets.clear(); lists.clear(); stats.commands = 0; };
