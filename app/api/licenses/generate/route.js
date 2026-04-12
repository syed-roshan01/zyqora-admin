import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { saveLicense, getAffiliate } from '@/lib/kv';
import { saveLog } from '@/lib/logs';
import { generateKey, planToExpiry } from '@/lib/license';

export async function POST(req) {
    const { error, status, session } = await requireAuth(req);
    if (error) return NextResponse.json({ error }, { status });

    const { clientName, clientPhone, clientEmail, machineId,
            plan, deviceLimit, customDays, notes, price, discountedPrice, features,
            businessCategory, website, affiliateId, affiliateName } = await req.json();

    const DEFAULT_FEATURES = { mobile: true, trustBuilder: true, autoReply: true, chatbot: true, liveChat: true, groupGrabber: true, aiAutomation: true };

    if (!machineId?.trim() || !plan || !clientName?.trim())
        return NextResponse.json({ error: 'clientName, machineId and plan are required' }, { status: 400 });

    const dl       = Math.max(1, Math.min(255, parseInt(deviceLimit) || 1));
    const expiryTs = planToExpiry(plan, customDays);
    const isLifetime = plan === 'lifetime';
    const key = generateKey({ machineId: machineId.trim().toUpperCase(), expiryTs, deviceLimit: dl });
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
        machineId:    machineId.trim().toUpperCase(),
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
        issuedBy:     session.sub,
        issuedByName: session.username,
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
