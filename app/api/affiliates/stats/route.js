import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { listAllLicenses, getAffiliate, listAffiliatePayments } from '@/lib/kv';

export async function GET(req) {
    const { error, status, session } = await requireAuth(req);
    if (error) return NextResponse.json({ error }, { status });

    // Must be affiliate or super
    if (session.role !== 'affiliate' && session.role !== 'super') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const targetId = session.role === 'super'
        ? (searchParams.get('affiliateId') || session.sub)
        : session.sub;

    const [affiliate, allLicenses, payments] = await Promise.all([
        getAffiliate(targetId),
        listAllLicenses(),
        listAffiliatePayments(targetId),
    ]);

    if (!affiliate) return NextResponse.json({ error: 'Affiliate not found' }, { status: 404 });

    const nowTs = Math.floor(Date.now() / 1000);
    const mine = allLicenses
        .filter(l => l.affiliateId === targetId)
        .filter(l => !(l.revoked && l.revokedReason?.startsWith('Converted to')));

    const result = mine.map(l => {
        const isExpired = !l.isLifetime && (l.expiryTs || 0) <= nowTs;
        const isRevoked = !!l.revoked;
        const isTrial = l.plan === 'trial' || l.plan === 'trial1day';
        const price = Math.max(0, parseFloat(l.discountedPrice ?? l.price) || 0);
        const status = isRevoked ? 'revoked' : isExpired ? 'expired' : 'active';
        const converted = !isTrial && price > 0;

        return {
            key: l.key,
            clientName: l.clientName || '',
            clientPhone: l.clientPhone || '',
            plan: l.plan || '',
            price,
            issuedAt: l.issuedAt,
            status,
            isTrial,
            converted,
            issuedByName: l.issuedByName || '',
        };
    }).sort((a, b) => (b.issuedAt || 0) - (a.issuedAt || 0));

    const totalClients = result.length;
    const demoClients = result.filter(l => l.isTrial || l.price === 0).length;
    const convertedClients = result.filter(l => l.converted).length;
    const totalRevenue = result.filter(l => l.converted).reduce((s, l) => s + l.price, 0);
    const commissionAmount = totalRevenue * (affiliate.commission / 100);
    const totalPaid = payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
    const balance = Math.max(0, commissionAmount - totalPaid);

    return NextResponse.json({
        affiliate: {
            id: affiliate.id,
            name: affiliate.name,
            username: affiliate.username,
            commission: affiliate.commission,
        },
        stats: {
            totalClients,
            demoClients,
            convertedClients,
            totalRevenue,
            commissionAmount,
            commissionPercent: affiliate.commission,
            totalPaid,
            balance,
        },
        licenses: result,
        payments,
    });
}
