// Emails the license key + a professional invoice to the customer via Brevo.
// Env: BREVO_API_KEY, BREVO_SENDER_EMAIL, BREVO_SENDER_NAME. If unset it's a no-op.
// A failure here must never affect key delivery, so all errors are swallowed.
import { BUSINESS } from '@/lib/business';

const money = (v) => '₹' + Math.max(0, Number(v) || 0).toLocaleString('en-IN');
function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function invoiceRows(inv) {
    const rows = [
        ['Plan', `Zyqora ${esc(inv.plan)} — 1 year license`],
        ['Validity', esc(inv.validity || '1 year from activation')],
        ['Devices', String(inv.deviceLimit || 1)],
        ['Machine ID', `<span style="font-family:monospace">${esc(inv.machineId)}</span>`],
    ];
    if (inv.paymentRef) rows.push(['Payment ref (UPI)', `<span style="font-family:monospace">${esc(inv.paymentRef)}</span>`]);
    return rows.map(([k, v]) => `
        <tr>
          <td style="padding:9px 14px;border-bottom:1px solid #eef1f6;color:#64748b;font-size:13px;white-space:nowrap">${k}</td>
          <td style="padding:9px 14px;border-bottom:1px solid #eef1f6;color:#1e293b;font-size:13px">${v}</td>
        </tr>`).join('');
}

function buildHtml({ name, key, planName, expiryText, invoice }) {
    const B = BUSINESS;
    const inv = invoice || {};
    return `<!doctype html><html><body style="margin:0;background:#f4f6fa;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fa;padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(15,23,42,.06)">
        <!-- header -->
        <tr><td style="background:#0b224a;padding:26px 28px">
          <table role="presentation" width="100%"><tr>
            <td style="color:#fff;font-size:22px;font-weight:800;letter-spacing:.3px">${esc(B.name)}</td>
            <td align="right" style="color:#9fb8e6;font-size:13px">${esc(B.tagline)}</td>
          </tr></table>
          <div style="height:4px;background:linear-gradient(90deg,#25d366,#4a9eff);margin-top:18px;border-radius:2px"></div>
        </td></tr>
        <!-- body -->
        <tr><td style="padding:28px">
          <p style="margin:0 0 6px;font-size:16px;color:#0f172a">Hi ${esc(name || 'there')},</p>
          <p style="margin:0 0 18px;font-size:14px;color:#475569;line-height:1.6">Thank you for your purchase. Your <b>Zyqora ${esc(planName)}</b> license is active. Here is your license key:</p>
          <div style="font-family:monospace;font-size:16px;font-weight:700;color:#065f46;background:#ecfdf3;border:1px dashed #25d366;border-radius:10px;padding:14px;text-align:center;word-break:break-all">${esc(key)}</div>
          <p style="margin:16px 0 0;font-size:13.5px;color:#475569;line-height:1.6">
            If you bought from inside the Zyqora app, it activates automatically — just open the License screen.
            Otherwise, paste this key there and tap Activate.${expiryText ? ` Valid until <b>${esc(expiryText)}</b>.` : ''}
          </p>

          <!-- invoice -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:26px;border:1px solid #e8edf5;border-radius:12px;overflow:hidden">
            <tr><td style="background:#f8fafc;padding:14px 16px;border-bottom:1px solid #e8edf5">
              <table role="presentation" width="100%"><tr>
                <td style="font-size:15px;font-weight:700;color:#0f172a">Invoice</td>
                <td align="right" style="font-size:12.5px;color:#64748b">
                  ${inv.invoiceId ? `No. <b style="color:#334155">${esc(inv.invoiceId)}</b><br>` : ''}${inv.date ? esc(inv.date) : ''}
                </td>
              </tr></table>
            </td></tr>
            <tr><td style="padding:14px 16px;border-bottom:1px solid #eef1f6">
              <table role="presentation" width="100%"><tr valign="top">
                <td style="font-size:12px;color:#64748b">
                  <div style="text-transform:uppercase;letter-spacing:.05em;font-size:10.5px;color:#94a3b8;margin-bottom:4px">Billed to</div>
                  <div style="color:#1e293b;font-size:13px;font-weight:600">${esc(name || '—')}</div>
                </td>
                <td align="right" style="font-size:12px;color:#64748b">
                  <div style="text-transform:uppercase;letter-spacing:.05em;font-size:10.5px;color:#94a3b8;margin-bottom:4px">From</div>
                  <div style="color:#1e293b;font-size:13px;font-weight:600">${esc(B.name)}</div>
                  <div style="font-size:12px">${esc(B.website)} · ${esc(B.email)}</div>
                </td>
              </tr></table>
            </td></tr>
            ${invoiceRows(inv)}
            <tr><td style="padding:14px 16px;background:#f8fafc">
              <table role="presentation" width="100%"><tr>
                <td style="font-size:15px;font-weight:800;color:#0f172a">Total paid</td>
                <td align="right" style="font-size:18px;font-weight:800;color:#065f46">${money(inv.amount)}</td>
              </tr></table>
            </td></tr>
          </table>

          <p style="margin:22px 0 0;font-size:12.5px;color:#64748b;line-height:1.6">
            Need help? WhatsApp <b>${esc(B.phone)}</b> or reply to this email.
          </p>
        </td></tr>
        <!-- footer -->
        <tr><td style="background:#f8fafc;padding:16px 28px;border-top:1px solid #eef1f6">
          <p style="margin:0;font-size:11.5px;color:#94a3b8;line-height:1.6">
            ${esc(B.name)} · ${esc(B.website)}${B.address ? ` · ${esc(B.address)}` : ''}<br>
            This is a system-generated invoice and does not require a signature.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export async function sendKeyEmail({ to, name, key, planName, expiryText, invoice }) {
    const apiKey = process.env.BREVO_API_KEY;
    const senderEmail = process.env.BREVO_SENDER_EMAIL;
    const senderName = process.env.BREVO_SENDER_NAME || 'Zyqora';
    if (!apiKey || !senderEmail || !to) return false;
    try {
        const res = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
            body: JSON.stringify({
                sender: { name: senderName, email: senderEmail },
                to: [{ email: to, name: name || undefined }],
                subject: `Your Zyqora ${planName} license key & invoice`,
                htmlContent: buildHtml({ name, key, planName, expiryText, invoice }),
            }),
        });
        return res.ok;
    } catch {
        return false;
    }
}
