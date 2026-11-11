// Seller details printed on invoices (PDF + email). Not secret — these appear on
// customer invoices. Edit here to change them everywhere.
export const BUSINESS = {
    name:       'Zyqora Technologies',
    tagline:    'WhatsApp Automation Software',
    website:    'zyqora.in',
    email:      'billing@zyqora.in',     // billing / "From"
    support:    'support@zyqora.in',     // customer support
    phone:      '+91 92177 58442',
    address:    '',                      // optional; leave '' to omit
    gstin:      '',                      // no GST
    logoPath:   '/zyqora-logo.png',      // client-side PDF (admin /public)
    logoSymbol: '/zyqora-symbol.png',    // footer mark (admin /public)
    logoUrl:    'https://zyqora-admin.vercel.app/zyqora-logo.png',  // for emails (absolute)
};
