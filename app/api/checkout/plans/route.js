import { NextResponse } from 'next/server';
import { publicPlans, UPI } from '@/lib/plans';

// PUBLIC: plan cards + UPI collection details for the /buy page.
export async function GET() {
    return NextResponse.json({ plans: publicPlans(), upi: UPI });
}
