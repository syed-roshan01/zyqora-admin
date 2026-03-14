import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { saveLicense } from '@/lib/kv';
import { generateKey, planToExpiry } from '@/lib/license';

export async function POST(req) {
    const { error, status, session } = await requireAuth(req);
    if (error) return NextResponse.json({ error }, { status });

    const { clientName, clientPhone, clientEmail, machineId,
            plan, deviceLimit, customDays, notes, price, features,
            businessCategory, website, validationException } = await req.json();

    const DEFAULT_FEATURES = { mobile: true, trustBuilder: true, autoReply: true, chatbot: true, aiAutomation: true, liveChat: true, groupGrabber: true };

    if (!machineId?.trim() || !plan || !clientName?.trim())
        return NextResponse.json({ error: 'clientName, machineId and plan are required' }, { status: 400 });

    const dl       = Math.max(1, Math.min(255, parseInt(deviceLimit) || 1));
    const expiryTs = planToExpiry(plan, customDays);
    const isLifetime = plan === 'lifetime';
    const key = generateKey({ machineId: machineId.trim().toUpperCase(), expiryTs, deviceLimit: dl });
    const priceNum = parseFloat(price) || 0;

    const license = {
        key,
        plan,
        deviceLimit: dl,
        expiryTs,
        isLifetime,
        price:        priceNum,
        machineId:    machineId.trim().toUpperCase(),
        clientName:   clientName.trim(),
        clientPhone:      (clientPhone || '').trim(),
        clientEmail:      (clientEmail || '').trim(),
        businessCategory: (businessCategory || '').trim(),
        website:          (website || '').trim() || 'No website',
        notes:            (notes || '').trim(),
        features:     features || DEFAULT_FEATURES,
        validationException: session.role === 'super' && validationException === true,
        exceptionBoundMachineId: null,
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

    await saveLicense(license);
    return NextResponse.json({ success: true, key, license });
}
