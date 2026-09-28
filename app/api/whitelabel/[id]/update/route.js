import { NextResponse } from 'next/server';
import { requireSuper } from '@/lib/auth';
import { getWhitelabel, saveWhitelabel } from '@/lib/kv';
import { LICENSE_MODES, WL_PLANS } from '@/lib/license';

const MAX_LIMIT = 999999;
const MAX_DEVICES = 255;

// Super admin updates a whitelabel client's profile, allowed license types,
// allowed key durations, device cap and/or license limit. Changes are saved
// to KV immediately and take effect for the client in real time (their panel
// enforces the live record).
export async function POST(req, { params }) {
    const { error, status, session } = await requireSuper(req);
    if (error) return NextResponse.json({ error }, { status });

    const whitelabel = await getWhitelabel(params.id);
    if (!whitelabel) return NextResponse.json({ error: 'Whitelabel client not found' }, { status: 404 });

    const body = await req.json().catch(() => ({}));

    let allowedModes = whitelabel.allowedModes;
    if (body.allowedModes !== undefined) {
        if (!Array.isArray(body.allowedModes))
            return NextResponse.json({ error: 'allowedModes must be an array' }, { status: 400 });
        allowedModes = [...new Set(body.allowedModes.filter(m => LICENSE_MODES.includes(m)))];
        if (!allowedModes.length)
            return NextResponse.json({ error: 'Select at least one license type' }, { status: 400 });
    }

    let allowedPlans = whitelabel.allowedPlans;
    if (body.allowedPlans !== undefined) {
        if (!Array.isArray(body.allowedPlans))
            return NextResponse.json({ error: 'allowedPlans must be an array' }, { status: 400 });
        allowedPlans = [...new Set(body.allowedPlans.filter(p => WL_PLANS.includes(p)))];
        if (!allowedPlans.length)
            return NextResponse.json({ error: 'Select at least one key duration' }, { status: 400 });
    }

    let licenseLimit = whitelabel.licenseLimit;
    if (body.licenseLimit !== undefined) {
        licenseLimit = Math.floor(Number(body.licenseLimit));
        if (!Number.isFinite(licenseLimit) || licenseLimit < 1 || licenseLimit > MAX_LIMIT)
            return NextResponse.json({ error: `License limit must be between 1 and ${MAX_LIMIT}` }, { status: 400 });
    }

    let maxDevices = whitelabel.maxDevices;
    if (body.maxDevices !== undefined) {
        if (body.maxDevices === null || body.maxDevices === '')
            maxDevices = MAX_DEVICES;
        else {
            maxDevices = Math.floor(Number(body.maxDevices));
            if (!Number.isFinite(maxDevices) || maxDevices < 1 || maxDevices > MAX_DEVICES)
                return NextResponse.json({ error: `Max devices must be between 1 and ${MAX_DEVICES}` }, { status: 400 });
        }
    }

    // Partnership term — setting it (re)starts the clock from save time;
    // sending null clears it back to no expiry.
    let partnershipStartTs = whitelabel.partnershipStartTs ?? null;
    let partnershipMonths = whitelabel.partnershipMonths ?? null;
    let partnershipEndTs = whitelabel.partnershipEndTs ?? null;
    if (body.partnershipMonths !== undefined) {
        if (body.partnershipMonths === null || body.partnershipMonths === '') {
            partnershipStartTs = null;
            partnershipMonths = null;
            partnershipEndTs = null;
        } else {
            partnershipMonths = Math.floor(Number(body.partnershipMonths));
            if (!Number.isFinite(partnershipMonths) || partnershipMonths < 1 || partnershipMonths > 120)
                return NextResponse.json({ error: 'Partnership duration must be between 1 and 120 months' }, { status: 400 });
            const nowTs = Math.floor(Date.now() / 1000);
            partnershipStartTs = nowTs;
            partnershipEndTs = nowTs + Math.round(partnershipMonths * 30.4375) * 86400;
        }
    }

    const updated = {
        ...whitelabel,
        ...(body.name             !== undefined ? { name:             body.name.trim()             } : {}),
        ...(body.phone            !== undefined ? { phone:            body.phone.trim()            } : {}),
        ...(body.email            !== undefined ? { email:            body.email.trim()            } : {}),
        ...(body.businessName     !== undefined ? { businessName:     body.businessName.trim()     } : {}),
        ...(body.businessCategory !== undefined ? { businessCategory: body.businessCategory.trim() } : {}),
        ...(body.website          !== undefined ? { website:          body.website.trim()          } : {}),
        ...(body.notes            !== undefined ? { notes:            body.notes.trim()            } : {}),
        allowedModes,
        allowedPlans,
        maxDevices,
        licenseLimit,
        partnershipStartTs,
        partnershipMonths,
        partnershipEndTs,
        updatedAt: Math.floor(Date.now() / 1000),
        updatedBy: session.sub,
        updatedByName: session.username,
    };

    await saveWhitelabel(updated);

    const { passwordHash, ...safe } = updated;
    return NextResponse.json({ success: true, whitelabel: safe });
}
