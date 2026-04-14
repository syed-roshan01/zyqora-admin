import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getLicense, saveLicense, getAffiliate } from '@/lib/kv';

export async function POST(req) {
    const { error, status, session } = await requireAuth(req);
    if (error) return NextResponse.json({ error }, { status });

    const { key, clientName, clientPhone, clientEmail, businessCategory, website, price, notes, features, validationException, affiliateId, affiliateName } = await req.json();
    if (!key) return NextResponse.json({ error: 'key is required' }, { status: 400 });

    const license = await getLicense(key.trim().toUpperCase());
    if (!license) return NextResponse.json({ error: 'License not found' }, { status: 404 });

    const canSetValidationException = session.role === 'super' && validationException !== undefined;
    const nextValidationException = canSetValidationException ? !!validationException : license.validationException;

    const updated = {
        ...license,
        ...(clientName       !== undefined ? { clientName:       clientName.trim()              } : {}),
        ...(clientPhone      !== undefined ? { clientPhone:      clientPhone.trim()             } : {}),
        ...(clientEmail      !== undefined ? { clientEmail:      clientEmail.trim()             } : {}),
        ...(businessCategory !== undefined ? { businessCategory: businessCategory.trim()        } : {}),
        ...(website          !== undefined ? { website:          website.trim() || 'No website' } : {}),
        price: parseFloat(price) || 0,
        notes: (notes || '').trim(),
        ...(features !== undefined ? { features } : {}),
        ...(session.role === 'super' && affiliateId !== undefined ? { affiliateId: affiliateId || null, affiliateName: affiliateName || null } : {}),
        ...(canSetValidationException
            ? { validationException: nextValidationException }
            : {}),
        // When a super admin touches exception mode, reset bound machine so it can re-bind cleanly.
        ...(canSetValidationException
            ? { exceptionBoundMachineId: null }
            : {}),
    };

    // Recompute affiliateCommissionAmount when affiliate is changed by super
    if (session.role === 'super' && affiliateId !== undefined) {
        if (affiliateId) {
            const aff = await getAffiliate(affiliateId);
            if (aff) {
                const revenue = (updated.discountedPrice > 0 ? updated.discountedPrice : updated.price) || 0;
                updated.affiliateCommissionAmount = parseFloat(((revenue * aff.commission) / 100).toFixed(2));
            } else {
                updated.affiliateCommissionAmount = null;
            }
        } else {
            // affiliate removed
            updated.affiliateCommissionAmount = null;
        }
    }

    await saveLicense(updated);
    return NextResponse.json({ success: true, license: updated });
}
