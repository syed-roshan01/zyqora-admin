import { NextResponse } from 'next/server';
import { requireSuper } from '@/lib/auth';
import { getWhitelabel, saveWhitelabel } from '@/lib/kv';
import { LICENSE_MODES } from '@/lib/license';

const MAX_LIMIT = 999999;

// Super admin updates a whitelabel client's profile, allowed license types
// and/or license limit. Changes are saved to KV immediately and take effect
// for the client in real time (their panel enforces the live record).
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

    let licenseLimit = whitelabel.licenseLimit;
    if (body.licenseLimit !== undefined) {
        licenseLimit = Math.floor(Number(body.licenseLimit));
        if (!Number.isFinite(licenseLimit) || licenseLimit < 1 || licenseLimit > MAX_LIMIT)
            return NextResponse.json({ error: `License limit must be between 1 and ${MAX_LIMIT}` }, { status: 400 });
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
        licenseLimit,
        updatedAt: Math.floor(Date.now() / 1000),
        updatedBy: session.sub,
        updatedByName: session.username,
    };

    await saveWhitelabel(updated);

    const { passwordHash, ...safe } = updated;
    return NextResponse.json({ success: true, whitelabel: safe });
}
