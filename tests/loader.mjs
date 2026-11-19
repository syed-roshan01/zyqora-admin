import { pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
const root = path.resolve(import.meta.dirname, '..');
export async function resolve(spec, ctx, next) {
    if (spec === '@vercel/kv') return { url: pathToFileURL(path.join(root, 'tests/kv-mock.mjs')).href, shortCircuit: true };
    if (spec.startsWith('@/')) {
        const base = path.join(root, spec.slice(2));
        for (const ext of ['', '.js', '.jsx', '/index.js']) { const f = base + ext; if (fs.existsSync(f) && fs.statSync(f).isFile()) return { url: pathToFileURL(f).href, shortCircuit: true }; }
    }
    if (spec === 'next/server') return next('next/server.js', ctx);
    return next(spec, ctx);
}
