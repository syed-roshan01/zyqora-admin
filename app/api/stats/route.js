import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { listAllLicenses, listAllExpenses, listAffiliates, listAllWithdrawals } from '@/lib/kv';

/**
 * GET /api/stats
 * Returns global financial summary for super + admin users.
 * Admin users need this to see their Balance Owed relative to the global revenue pool.
 */
export async function GET(req) {
    const { error, status, session } = await requireAuth(req);
    if (error) return NextResponse.json({ error }, { status });
    if (session.role === 'affiliate') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const [licenses, expenses, affiliates, withdrawals] = await Promise.all([
        listAllLicenses(),
        listAllExpenses(),
        listAffiliates(),
        listAllWithdrawals(),
    ]);

    const paidSales = licenses.filter(l => !l.revoked && l.price > 0);
    const totalRevenue = paidSales.reduce((s, l) => s + Number(l.price), 0);
    const totalExpenses = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);

    const affCommMap = Object.fromEntries(affiliates.map(a => [a.id, a.commission || 0]));
    const affilCommission = paidSales
        .filter(l => l.affiliateId)
        .reduce((sum, l) => {
            const stored = parseFloat(l.affiliateCommissionAmount);
            if (stored > 0) return sum + stored;
            const revenue = parseFloat(l.discountedPrice ?? l.price) || 0;
            const pct = affCommMap[l.affiliateId] || 0;
            return sum + (revenue * pct / 100);
        }, 0);

    const totalRevenueBasis = totalRevenue - totalExpenses - affilCommission;
    const allWithdrawn = withdrawals.reduce((s, w) => s + (Number(w.amount) || 0), 0);
    const moneyLeft = totalRevenueBasis - allWithdrawn;

    return NextResponse.json({ totalRevenueBasis, allWithdrawn, moneyLeft, totalRevenue, totalExpenses, affilCommission });
}
