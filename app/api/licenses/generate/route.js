import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { saveLicense, getAffiliate, getLicense, getWhitelabel, countIssuedLicenses } from '@/lib/kv';
import { saveLog } from '@/lib/logs';
import { generateKey, planToExpiry, LICENSE_MODES, resolveWlPlans, resolveWlMaxDevices } from '@/lib/license';

export async function POST(req) {
    const { error, status, session } = await requireAuth(req);
    if (error) return NextResponse.json({ error }, { status });

    const { clientName, clientPhone, clientEmail, machineId, licenseMode = 'desktop',
            plan, deviceLimit, customDays, notes, price, discountedPrice, features,
            businessCategory, website, affiliateId, affiliateName, reviewAccess } = await req.json();

    const DEFAULT_FEATURES = { mobile: true, trustBuilder: true, autoReply: true, chatbot: true, liveChat: true, groupGrabber: true, aiAutomation: true, forms: true };

    // Cloud licenses use a fixed internal identity marker instead of a real
    // device — every other mode (desktop, app) is bound to one specific
    // device's ID and requires it up front.
    if (!LICENSE_MODES.includes(licenseMode) || (licenseMode !== 'cloud' && !machineId?.trim()) || !plan || !clientName?.trim())
        return NextResponse.json({ error: 'clientName, license mode and plan are required' }, { status: 400 });

    // Whitelabel resellers: enforce the live allow-list of license types,
    // the allowed key durations, the per-key device cap and the issue quota
    // against their current record, so super-admin changes apply immediately.
    // No affiliate attribution or reviewer keys either.
    let whitelabel = null;
    if (session.role === 'whitelabel') {
        whitelabel = await getWhitelabel(session.sub);
        if (!whitelabel || !whitelabel.active)
            return NextResponse.json({ error: 'Whitelabel account is inactive' }, { status: 403 });
        if (whitelabel.partnershipEndTs && whitelabel.partnershipEndTs <= Math.floor(Date.now() / 1000))
            return NextResponse.json({ error: 'Your whitelabel partnership has expired. Contact the administrator to renew.' }, { status: 403 });
        const allowed = Array.isArray(whitelabel.allowedModes) ? whitelabel.allowedModes : [];
        if (!allowed.includes(licenseMode))
            return NextResponse.json({ error: `License type "${licenseMode}" is not allowed for this account` }, { status: 403 });
        const allowedPlans = resolveWlPlans(whitelabel);
        if (!allowedPlans.includes(plan))
            return NextResponse.json({ error: `Key duration "${plan}" is not allowed for this account` }, { status: 403 });
        if (affiliateId)
            return NextResponse.json({ error: 'Affiliate attribution is not available for whitelabel accounts' }, { status: 403 });
        const used = await countIssuedLicenses(session.sub);
        if (used >= (whitelabel.licenseLimit || 0))
            return NextResponse.json({ error: `License limit reached (${used}/${whitelabel.licenseLimit || 0}). Contact the administrator to raise your limit.` }, { status: 403 });
    }

    const dl       = Math.max(1, Math.min(255, parseInt(deviceLimit) || 1));
    if (whitelabel) {
        const maxDevices = resolveWlMaxDevices(whitelabel);
        if (dl > maxDevices)
            return NextResponse.json({ error: `Device limit ${dl} exceeds your maximum of ${maxDevices} per key` }, { status: 403 });
    }
    const isLifetime = plan === 'lifetime';
    let expiryTs = planToExpiry(plan, customDays);
    let key = generateKey({ machineId: machineId?.trim().toUpperCase() || 'CLOUD', expiryTs, deviceLimit: dl, licenseMode });
    // Same-second collision guard: two identical-spec cloud keys share the
    // same HMAC inputs and would silently overwrite each other. Nudge expiry
    // by 1 second (invisible to clients) until the key is unused. Lifetime
    // keys keep their fixed 0xFFFFFFFF expiry — identical lifetime re-issues
    // stay idempotent instead.
    if (!isLifetime) {
        for (let tries = 0; tries < 5 && await getLicense(key); tries++) {
            expiryTs += 1;
            key = generateKey({ machineId: machineId?.trim().toUpperCase() || 'CLOUD', expiryTs, deviceLimit: dl, licenseMode });
        }
    }
    const priceNum = Math.max(0, parseFloat(price) || 0);
    const discountedNumRaw = discountedPrice === '' || discountedPrice === undefined || discountedPrice === null
        ? priceNum
        : Math.max(0, parseFloat(discountedPrice) || 0);
    const discountedNum = Math.min(priceNum, discountedNumRaw);
    const discountAmount = Math.max(0, priceNum - discountedNum);

    const license = {
        key,
        plan,
        deviceLimit: dl,
        expiryTs,
        isLifetime,
        price:        priceNum,
        discountedPrice: discountedNum,
        discountAmount,
        licenseMode,
        machineId:    licenseMode === 'cloud' ? null : machineId.trim().toUpperCase(),
        clientName:   clientName.trim(),
        clientPhone:      (clientPhone || '').trim(),
        clientEmail:      (clientEmail || '').trim(),
        businessCategory: (businessCategory || '').trim(),
        website:          (website || '').trim() || 'No website',
        notes:            (notes || '').trim(),
        features:     features || DEFAULT_FEATURES,
        affiliateId:  affiliateId || null,
        affiliateName: affiliateName || null,
        affiliateCommissionAmount: null, // filled below
        // Store-review / test access only — see validate/route.js. Only ever set true
        // when explicitly checked in the generate form; absent/false for every normal
        // customer license, which changes nothing about their validation. Restricted to
        // super admins server-side too — the UI already hides the checkbox from regular
        // admins, but that alone wouldn't stop someone calling this API directly.
        reviewAccess: reviewAccess === true && session.role === 'super',
        // Whitelabel marker — lets sales/stats exclude reseller-issued licenses
        // from direct revenue while the licenses page still shows them.
        whitelabelIssued: whitelabel ? true : undefined,
        whitelabelName:   whitelabel ? (whitelabel.name || whitelabel.username) : null,
        issuedBy:     session.sub,
        issuedByName: whitelabel ? (whitelabel.name || session.username) : session.username,
        issuedAt:     Math.floor(Date.now() / 1000),
        activated:    false,
        activatedAt:  null,
        revoked:      false,
        revokedBy:    null,
        revokedByName:null,
        revokedAt:    null,
        revokedReason:null,
    };

    if (affiliateId) {
        const aff = await getAffiliate(affiliateId);
        if (aff) {
            const revenue = discountedNum > 0 ? discountedNum : priceNum;
            license.affiliateCommissionAmount = parseFloat(((revenue * aff.commission) / 100).toFixed(2));
        }
    }

    await saveLicense(license);

    await saveLog({
        id: crypto.randomUUID(),
        action: 'LICENSE_GENERATED',
        actorId: session.sub,
        actorName: session.username,
        actorRole: session.role,
        ts: license.issuedAt,
        flag: null,
        meta: {
            key,
            clientName: license.clientName,
            clientPhone: license.clientPhone || '',
            plan: license.plan,
            price: license.price,
            discountedPrice: license.discountedPrice,
            deviceLimit: license.deviceLimit,
            issuedByName: license.issuedByName,
            affiliateId: license.affiliateId || null,
            affiliateName: license.affiliateName || null,
        },
    });

    return NextResponse.json({ success: true, key, license });
}
