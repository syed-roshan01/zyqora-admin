import { NextResponse } from 'next/server';
import { getLicense, saveLicense } from '@/lib/kv';
import { validateKey, validateCloudKey } from '@/lib/license';

// PUBLIC endpoint – called by the Zyqora desktop app on startup / activation
export async function POST(req) {
    try {
        const { key, machineId, mode } = await req.json();

        if (!key)
            return NextResponse.json({ valid: false, error: 'key required' });

        const cleanKey = key.trim().toUpperCase();
        const cleanMid = machineId?.trim().toUpperCase() || '';

        // 1. DB existence + revocation check first
        const license = await getLicense(cleanKey);
        if (!license)
            return NextResponse.json({ valid: false, error: 'Key not registered' });
        if (license.revoked)
            return NextResponse.json({ valid: false, error: 'Key has been revoked' });

        // 1b. Reviewer/test access — an explicitly flagged license record (set only via
        //     the admin panel, never through normal license generation) that skips
        //     platform-mode and machine-ID binding entirely, so it works on any device.
        //     Exists solely to satisfy Play Store's "Sign in details" requirement, where
        //     reviewers test on a device whose ID can't be known in advance and can't be
        //     contacted mid-review. Scoped to this one flagged record only — every other
        //     license, of any type, is completely unaffected and still goes through the
        //     normal binding checks below. Revoke or let it expire (via the license's own
        //     expiryTs, same as any other key) to shut it off — no app update required.
        if (license.reviewAccess === true) {
            const now = Math.floor(Date.now() / 1000);
            if (!license.isLifetime && license.expiryTs && license.expiryTs < now) {
                return NextResponse.json({ valid: false, error: 'Key expired' });
            }
            if (!license.activated) {
                await saveLicense({ ...license, activated: true, activatedAt: now });
            }
            const secondsLeft = license.isLifetime ? null : Math.max(0, license.expiryTs - now);
            const daysLeft    = license.isLifetime ? 9999 : Math.floor((secondsLeft ?? 0) / 86400);
            return NextResponse.json({
                valid:       true,
                plan:        license.plan,
                deviceLimit: license.deviceLimit ?? 1,
                isLifetime:  license.isLifetime,
                daysLeft,
                secondsLeft,
                expiry:      license.isLifetime ? null : new Date(license.expiryTs * 1000).toISOString(),
                features:    license.features || null,
            });
        }

        // 2. Each license type is bound to the platform it was actually issued
        //    for — the desktop app never sends a `mode` field, the cloud build
        //    always sends 'cloud', and the Android app always sends 'app' (see
        //    the main app's server/routes/_license.js VALIDATION_MODE). Requiring
        //    an exact match stops one purchased key from being reused across
        //    platforms. Cloud keys use the internal CLOUD marker and never need
        //    a real machine ID; desktop/app keys are bound to one device's ID.
        if (license.licenseMode === 'cloud' && mode !== 'cloud')
            return NextResponse.json({ valid: false, error: 'Cloud license requires cloud mode' });
        if (license.licenseMode === 'app' && mode !== 'app')
            return NextResponse.json({ valid: false, error: 'App license can only be used in the Zyqora mobile app' });
        if (license.licenseMode === 'desktop' && mode)
            return NextResponse.json({ valid: false, error: 'Desktop license cannot be used on this platform' });
        if (license.licenseMode !== 'cloud' && !cleanMid)
            return NextResponse.json({ valid: false, error: `${license.licenseMode === 'app' ? 'App' : 'Desktop'} license requires machineId` });
        const isCloud = license.licenseMode === 'cloud';
        const primaryCrypto = isCloud ? validateCloudKey(cleanKey) : validateKey(cleanKey, cleanMid);
        let crypto = primaryCrypto;

        let usedExceptionFallback = false;
        if ((!crypto || !crypto.valid) && license.validationException === true) {
            // Exception mode: validate against stored machine signature and allow re-bind to current machine.
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

        // Exception mode re-binds to latest validated machine.
        if (usedExceptionFallback && license.exceptionBoundMachineId !== cleanMid) {
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
