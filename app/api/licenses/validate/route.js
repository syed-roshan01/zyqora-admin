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

        // 1. DB existence + revocation check first
        const license = await getLicense(cleanKey);
        if (!license)
            return NextResponse.json({ valid: false, error: 'Key not registered' });
        if (license.revoked)
            return NextResponse.json({ valid: false, error: 'Key has been revoked' });

        // 2. Validate using client machineId by default.
        //    If this specific license has super-admin exception enabled,
        //    allow fallback to the machineId stored at generation time.
        const primaryCrypto = validateKey(cleanKey, cleanMid);
        let crypto = primaryCrypto;

        let usedExceptionFallback = false;
        if ((!crypto || !crypto.valid) && license.validationException === true) {
            // If an exception license is already bound, only that machine can use the exception path.
            if (license.exceptionBoundMachineId && license.exceptionBoundMachineId !== cleanMid) {
                return NextResponse.json({ valid: false, error: 'Machine not allowed for exception license' });
            }
            const storedMid = (license.machineId || '').trim().toUpperCase();
            const fallbackCrypto = validateKey(cleanKey, storedMid);
            if (fallbackCrypto?.valid) {
                crypto = fallbackCrypto;
                usedExceptionFallback = true;
            }
        }

        if (!crypto)
            return NextResponse.json({ valid: false, error: 'Invalid key signature' });
        if (!crypto.valid)
            return NextResponse.json({ valid: false, error: 'Key expired' });

        // 3. Record first activation
        const now = Math.floor(Date.now() / 1000);
        let updatedLicense = license;
        if (!license.activated) {
            updatedLicense = { ...updatedLicense, activated: true, activatedAt: now };
        }

        // One-time bind for exception licenses: after first successful fallback,
        // lock exception usage to that machine ID for future validations.
        if (usedExceptionFallback && !license.exceptionBoundMachineId) {
            updatedLicense = { ...updatedLicense, exceptionBoundMachineId: cleanMid };
        }

        if (updatedLicense !== license) {
            await saveLicense(updatedLicense);
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
            features:    license.features || null,
        });

    } catch (err) {
        console.error('Validate error:', err);
        return NextResponse.json({ valid: false, error: 'Server error' });
    }
}
