import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getLicense, saveLicense, getAffiliate } from '@/lib/kv';
import { saveLog } from '@/lib/logs';
import { generateKey, planToExpiry } from '@/lib/license';

export async function POST(req) {
    const { error, status, session } = await requireAuth(req);
    if (error) return NextResponse.json({ error }, { status });

    const body = await req.json();
    const { oldKey, plan, deviceLimit, customDays, price, discountedPrice, notes, features } = body;

    if (!oldKey) return NextResponse.json({ error: 'oldKey required' }, { status: 400 });
    if (!plan)   return NextResponse.json({ error: 'plan required' }, { status: 400 });

    const oldLicense = await getLicense(oldKey);
    if (!oldLicense) return NextResponse.json({ error: 'Original license not found' }, { status: 404 });

    // Admins can only convert their own licenses
    if (session.role !== 'super' && oldLicense.issuedBy !== session.sub)
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // Must not already be a converted (non-trial paid) license
    const isTrial = oldLicense.plan === 'trial' || oldLicense.plan === 'trial1day';
    const wasFreePlan = !isTrial && (parseFloat(oldLicense.price) || 0) === 0;
    if (!isTrial && !wasFreePlan && !oldLicense.revoked) {
        return NextResponse.json({ error: 'Only trial or free licenses can be converted' }, { status: 400 });
    }

    const DEFAULT_FEATURES = { mobile: true, trustBuilder: true, autoReply: true, chatbot: true, liveChat: true, groupGrabber: true, aiAutomation: true };

    const dl          = Math.max(1, Math.min(255, parseInt(deviceLimit) || 1));
    const expiryTs    = planToExpiry(plan, customDays);
    const isLifetime  = plan === 'lifetime';
    const newKey      = generateKey({ machineId: oldLicense.machineId, expiryTs, deviceLimit: dl });

    const priceNum        = Math.max(0, parseFloat(price) || 0);
    const discountedRaw   = (discountedPrice === '' || discountedPrice == null)
        ? priceNum
        : Math.max(0, parseFloat(discountedPrice) || 0);
    const discountedNum   = Math.min(priceNum, discountedRaw);
    const discountAmount  = Math.max(0, priceNum - discountedNum);

    const nowTs = Math.floor(Date.now() / 1000);

    // 1. Revoke old trial license
    await saveLicense({
        ...oldLicense,
        revoked:       true,
        revokedBy:     session.sub,
        revokedByName: session.username,
        revokedAt:     nowTs,
        revokedReason: `Converted to ${plan} plan (key: ${newKey})`,
    });

    await saveLog({
        id: crypto.randomUUID(),
        action: 'LICENSE_REVOKED',
        actorId: session.sub,
        actorName: session.username,
        actorRole: session.role,
        ts: nowTs,
        flag: null,
        meta: {
            key: oldLicense.key,
            clientName: oldLicense.clientName || '',
            clientPhone: oldLicense.clientPhone || '',
            plan: oldLicense.plan || '',
            price: 0,
            issuedByName: oldLicense.issuedByName || '',
            reason: `Converted to ${plan} plan`,
        },
    });

    // 2. Create new paid license, inheriting all client data from old
    const newLicense = {
        key:              newKey,
        plan,
        deviceLimit:      dl,
        expiryTs,
        isLifetime,
        price:            priceNum,
        discountedPrice:  discountedNum,
        discountAmount,
        machineId:        oldLicense.machineId,
        clientName:       oldLicense.clientName,
        clientPhone:      oldLicense.clientPhone,
        clientEmail:      oldLicense.clientEmail,
        businessCategory: oldLicense.businessCategory,
        website:          oldLicense.website,
        notes:            (notes || oldLicense.notes || '').trim(),
        features:         features || oldLicense.features || DEFAULT_FEATURES,
        affiliateId:      oldLicense.affiliateId || null,
        affiliateName:    oldLicense.affiliateName || null,
        issuedBy:         session.sub,
        issuedByName:     session.username,
        issuedAt:         nowTs,
        activated:        false,
        activatedAt:      null,
        revoked:          false,
        revokedBy:        null,
        revokedByName:    null,
        revokedAt:        null,
        revokedReason:    null,
        convertedFromKey: oldKey,
        affiliateCommissionAmount: null, // filled below
    };

    if (newLicense.affiliateId) {
        const aff = await getAffiliate(newLicense.affiliateId);
        if (aff) {
            const revenue = discountedNum > 0 ? discountedNum : priceNum;
            newLicense.affiliateCommissionAmount = parseFloat(((revenue * aff.commission) / 100).toFixed(2));
        }
    }

    await saveLicense(newLicense);

    await saveLog({
        id: crypto.randomUUID(),
        action: 'LICENSE_CONVERTED',
        actorId: session.sub,
        actorName: session.username,
        actorRole: session.role,
        ts: nowTs,
        flag: null,
        meta: {
            key: newKey,
            oldKey,
            clientName: newLicense.clientName || '',
            clientPhone: newLicense.clientPhone || '',
            plan,
            price: priceNum,
            discountedPrice: discountedNum,
            issuedByName: session.username,
        },
    });

    return NextResponse.json({ success: true, key: newKey, license: newLicense });
}
