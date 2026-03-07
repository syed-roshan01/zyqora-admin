import { NextResponse } from 'next/server';
import { getLicense, saveLicense } from '@/lib/kv';
import { validateKey } from '@/lib/license';

// PUBLIC endpoint – called by the Zyqora desktop app on startup / activation
export async function POST(req) {
    try {
        const { key, machineId } = await req.json();

        if (!key || !machineId)
            return NextResponse.json({ valid: false, error: 'key and machineId required' });

        const cleanKey = key.trim().toUpperCase();
        const cleanMid = machineId.trim().toUpperCase();

        // 1. Cryptographic HMAC check (same logic as desktop server.js)
        const crypto = validateKey(cleanKey, cleanMid);
        if (!crypto)
            return NextResponse.json({ valid: false, error: 'Invalid key signature' });
        if (!crypto.valid)
            return NextResponse.json({ valid: false, error: 'Key expired' });

        // 2. DB existence + revocation check
        const license = await getLicense(cleanKey);
        if (!license)
            return NextResponse.json({ valid: false, error: 'Key not registered' });
        if (license.revoked)
            return NextResponse.json({ valid: false, error: 'Key has been revoked' });

        // 3. Record first activation
        const now = Math.floor(Date.now() / 1000);
        if (!license.activated) {
            await saveLicense({ ...license, activated: true, activatedAt: now });
        }

        // 4. Compute time fields
        const secondsLeft = crypto.isLifetime ? null : Math.max(0, crypto.expiryTs - now);
        const daysLeft    = crypto.isLifetime ? 9999  : Math.floor((secondsLeft ?? 0) / 86400);

        return NextResponse.json({
            valid:       true,
            plan:        license.plan,
            deviceLimit: crypto.deviceLimit,
            isLifetime:  crypto.isLifetime,
            daysLeft,
            secondsLeft,
            expiry:      crypto.isLifetime ? null : new Date(crypto.expiryTs * 1000).toISOString(),
        });

    } catch (err) {
        console.error('Validate error:', err);
        return NextResponse.json({ valid: false, error: 'Server error' });
    }
}
