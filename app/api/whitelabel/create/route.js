import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { requireSuper } from '@/lib/auth';
import {
    getAdminByUsername, getAffiliateByUsername, getWhitelabelByUsername, saveWhitelabel,
} from '@/lib/kv';
import { LICENSE_MODES, WL_PLANS } from '@/lib/license';

const MAX_LIMIT = 999999;
const MAX_DEVICES = 255;

export async function POST(req) {
    const { error, status, session } = await requireSuper(req);
    if (error) return NextResponse.json({ error }, { status });

    const body = await req.json().catch(() => ({}));
    const username       = (body?.username || '').trim().toLowerCase();
    const password       = (body?.password || '').trim();
    const name           = (body?.name || '').trim();
    const phone          = (body?.phone || '').trim();
    const email          = (body?.email || '').trim();
    const businessName   = (body?.businessName || '').trim();
    const businessCategory = (body?.businessCategory || '').trim();
    const website        = (body?.website || '').trim();
    const notes          = (body?.notes || '').trim();

    if (!username) return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    if (!name)     return NextResponse.json({ error: 'Display name is required' }, { status: 400 });
    if (!password || password.length < 6)
        return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });

    // Whitelabel users log into the same panel — their username must not
    // collide with any existing admin or affiliate account.
    const [adminDup, affDup, wlDup] = await Promise.all([
        getAdminByUsername(username),
        getAffiliateByUsername(username),
        getWhitelabelByUsername(username),
    ]);
    if (adminDup || affDup || wlDup)
        return NextResponse.json({ error: 'Username already taken' }, { status: 409 });

    // Which license types (desktop / cloud / app) this client may generate
    const allowedModes = Array.isArray(body?.allowedModes)
        ? [...new Set(body.allowedModes.filter(m => LICENSE_MODES.includes(m)))]
        : [];
    if (!allowedModes.length)
        return NextResponse.json({ error: 'Select at least one license type' }, { status: 400 });

    // Which key durations (1/3/6 months, 1 year, custom) this client may issue
    const allowedPlans = Array.isArray(body?.allowedPlans)
        ? [...new Set(body.allowedPlans.filter(p => WL_PLANS.includes(p)))]
        : [...WL_PLANS];
    if (!allowedPlans.length)
        return NextResponse.json({ error: 'Select at least one key duration' }, { status: 400 });

    const licenseLimit = Math.floor(Number(body?.licenseLimit));
    if (!Number.isFinite(licenseLimit) || licenseLimit < 1 || licenseLimit > MAX_LIMIT)
        return NextResponse.json({ error: `License limit must be between 1 and ${MAX_LIMIT}` }, { status: 400 });

    // Maximum devices per key this client may issue
    let maxDevices = MAX_DEVICES;
    if (body?.maxDevices !== undefined && body?.maxDevices !== null && body?.maxDevices !== '') {
        maxDevices = Math.floor(Number(body.maxDevices));
        if (!Number.isFinite(maxDevices) || maxDevices < 1 || maxDevices > MAX_DEVICES)
            return NextResponse.json({ error: `Max devices must be between 1 and ${MAX_DEVICES}` }, { status: 400 });
    }

    // Partnership term — how long this reseller relationship lasts
    // (months; null/absent = no expiry)
    let partnershipMonths = null;
    if (body?.partnershipMonths !== undefined && body?.partnershipMonths !== null && body?.partnershipMonths !== '') {
        partnershipMonths = Math.floor(Number(body.partnershipMonths));
        if (!Number.isFinite(partnershipMonths) || partnershipMonths < 1 || partnershipMonths > 120)
            return NextResponse.json({ error: 'Partnership duration must be between 1 and 120 months' }, { status: 400 });
    }
    const nowTs = Math.floor(Date.now() / 1000);

    const passwordHash = await bcrypt.hash(password, 12);

    const whitelabel = {
        id: randomUUID(),
        username,
        name,
        passwordHash,
        phone,
        email,
        businessName,
        businessCategory,
        website,
        notes,
        allowedModes,
        allowedPlans,
        maxDevices,
        licenseLimit,
        partnershipStartTs: partnershipMonths ? nowTs : null,
        partnershipMonths,
        partnershipEndTs: partnershipMonths ? nowTs + Math.round(partnershipMonths * 30.4375) * 86400 : null,
        active: true,
        createdBy: session.sub,
        createdByName: session.username,
        createdAt: nowTs,
    };

    await saveWhitelabel(whitelabel);

    const { passwordHash: _, ...safe } = whitelabel;
    return NextResponse.json({ success: true, whitelabel: safe }, { status: 201 });
}
