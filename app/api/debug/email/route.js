import { NextResponse } from 'next/server';
// Diagnostic endpoint disabled after email delivery was confirmed working.
// (Safe to delete the app/api/debug folder entirely.)
export async function GET() {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
}
