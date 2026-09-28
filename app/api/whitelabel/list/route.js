import { NextResponse } from 'next/server';
import { requireSuper } from '@/lib/auth';
import { listWhitelabels, countIssuedLicenses } from '@/lib/kv';

export async function GET(req) {
    const { error, status } = await requireSuper(req);
    if (error) return NextResponse.json({ error }, { status });

    const clients = await listWhitelabels();

    const result = await Promise.all(clients.map(async (c) => {
        const used = await countIssuedLicenses(c.id);
        const { passwordHash, ...safe } = c;
        return { ...safe, usedLicenses: used, remainingLicenses: Math.max(0, (c.licenseLimit || 0) - used) };
    }));

    // Newest first
    result.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return NextResponse.json(result);
}
