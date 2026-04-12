import { kv } from '@vercel/kv';

// ── Activity Logs ─────────────────────────────────────────────────────────────
// Stored as a Redis list (logs_list) for ordered retrieval + individual keys.
// Max 1000 most-recent log IDs kept in the list.

const MAX_LOGS = 1000;

export async function saveLog(log) {
    await kv.set(`log:${log.id}`, log);
    await kv.lpush('logs_list', log.id);
    await kv.ltrim('logs_list', 0, MAX_LOGS - 1);
}

export async function listLogs(limit = 300) {
    const ids = await kv.lrange('logs_list', 0, limit - 1);
    if (!ids?.length) return [];
    const rows = await Promise.all(ids.map(id => kv.get(`log:${id}`)));
    return rows.filter(Boolean);
}

export async function clearLogs() {
    const ids = await kv.lrange('logs_list', 0, 999);
    if (ids?.length) {
        await Promise.all(ids.map(id => kv.del(`log:${id}`)));
    }
    await kv.del('logs_list');
}
