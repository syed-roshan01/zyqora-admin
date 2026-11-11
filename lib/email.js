// Optional: emails the license key to the customer via Resend.
// Set RESEND_API_KEY and EMAIL_FROM (a verified sender) to enable; otherwise a no-op.
// A failure here must never affect key delivery, so errors are swallowed.

export async function sendKeyEmail({ to, name, key, planName, expiryText }) {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;
    if (!apiKey || !from || !to) return false;
    try {
        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                from,
                to: [to],
                subject: `Your Zyqora ${planName} license key`,
                html: `<p>Hi ${escapeHtml(name || 'there')},</p>
<p>Thank you for choosing Zyqora ${escapeHtml(planName)}. Your license key:</p>
<p style="font-size:18px;font-family:monospace;background:#f3f4f6;padding:12px;border-radius:8px">${escapeHtml(key)}</p>
<p>${expiryText ? `Valid until ${escapeHtml(expiryText)}.<br>` : ''}Open Zyqora, go to the License screen and paste the key (the app activates automatically if you bought from inside it).</p>
<p>Need help? Reply to this email or WhatsApp +91 92177 58442.</p>`,
            }),
        });
        return res.ok;
    } catch {
        return false;
    }
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
