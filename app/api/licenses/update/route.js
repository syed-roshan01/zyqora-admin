import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getLicense, saveLicense } from '@/lib/kv';

export async function POST(req) {
    const { error, status, session } = await requireAuth(req);
    if (error) return NextResponse.json({ error }, { status });

    const { key, clientName, clientPhone, clientEmail, businessCategory, website, price, notes, features, validationException } = await req.json();
    if (!key) return NextResponse.json({ error: 'key is required' }, { status: 400 });

    const license = await getLicense(key.trim().toUpperCase());
    if (!license) return NextResponse.json({ error: 'License not found' }, { status: 404 });

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
        ...(session.role === 'super' && validationException !== undefined
            ? { validationException: !!validationException }
            : {}),
    };
    await saveLicense(updated);
    return NextResponse.json({ success: true, license: updated });
}
