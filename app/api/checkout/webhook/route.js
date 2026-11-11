import { NextResponse } from 'next/server';
// Deprecated: the payment gateway webhook is no longer used. Checkout is now
// direct UPI with manual admin approval. Kept as a 410 so any stale caller fails
// clearly instead of hitting a missing route.
export async function POST() { return NextResponse.json({ error: 'gone' }, { status: 410 }); }
export async function GET()  { return NextResponse.json({ error: 'gone' }, { status: 410 }); }
