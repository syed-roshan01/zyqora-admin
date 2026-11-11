import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// TEMPORARY diagnostic: GET /api/debug/email?token=zyq-dbg-7731&to=you@example.com
// Returns whether Brevo env vars are present and the raw Brevo API response, so
// email delivery problems are visible without digging through logs.
// Delete this route once email is confirmed working.
export async function GET(req) {
    const url = new URL(req.url);
    if (url.searchParams.get('token') !== 'zyq-dbg-7731')
        return NextResponse.json({ error: 'forbidden' }, { status: 403 });

    const to = url.searchParams.get('to');
    const apiKey = process.env.BREVO_API_KEY;
    const senderEmail = process.env.BREVO_SENDER_EMAIL;
    const senderName = process.env.BREVO_SENDER_NAME || 'Zyqora';
    const diag = {
        hasKey: !!apiKey,
        keyLooksValid: apiKey ? apiKey.startsWith('xkeysib-') : false,
        senderEmail: senderEmail || null,
        senderName,
        to: to || null,
    };
    if (!apiKey || !senderEmail || !to)
        return NextResponse.json({ ok: false, reason: 'missing BREVO env vars or ?to=', diag });

    try {
        const res = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
            body: JSON.stringify({
                sender: { name: senderName, email: senderEmail },
                to: [{ email: to }],
                subject: 'Zyqora email test',
                htmlContent: '<p>This is a Zyqora test email. If you received it, Brevo is working.</p>',
            }),
        });
        let body = '';
        try { body = await res.text(); } catch { /* ignore */ }
        return NextResponse.json({ ok: res.ok, status: res.status, body, diag });
    } catch (e) {
        return NextResponse.json({ ok: false, error: e && e.message, diag });
    }
}
