// Sellable plans for the public /buy checkout. The customer pays by UPI to the
// business QR and submits the payment reference; an admin approves it in the
// Orders screen, which issues the license automatically.
//
// Each plan maps to a license: `durationPlan` -> planToExpiry(), plus deviceLimit
// and the feature flags stamped onto the issued license. `highlights`/`popular`
// are display-only (public /buy cards). Prices are one-time, 1 year.

const ALL = { mobile: true, trustBuilder: true, autoReply: true, chatbot: true, liveChat: true, groupGrabber: true, aiAutomation: true, forms: true };

export const PLANS = {
    starter: {
        id: 'starter',
        name: 'Starter',
        price: 999,
        durationPlan: 'yearly',
        deviceLimit: 3,
        popular: false,
        highlights: ['3 WhatsApp devices', 'Bulk campaigns & templates', 'Chatbot, auto-reply, live chat', 'Group grabber, forms, trust builder'],
        features: { ...ALL, aiAutomation: false },   // everything except AI automation
    },
    growth: {
        id: 'growth',
        name: 'Growth',
        price: 1499,
        durationPlan: 'yearly',
        deviceLimit: 10,
        popular: true,
        highlights: ['10 WhatsApp devices', 'Everything in Starter', 'AI automation included', 'Priority support'],
        features: { ...ALL },
    },
    pro: {
        id: 'pro',
        name: 'Pro',
        price: 1999,
        durationPlan: 'yearly',
        deviceLimit: 15,
        popular: false,
        highlights: ['15 WhatsApp devices', 'Everything in Growth', 'Highest sending capacity', 'Priority support'],
        features: { ...ALL },
    },
};

// Your UPI collection identity for the /buy page (overridable via env).
export const UPI = {
    id:   process.env.UPI_ID   || 'paytm.s353ueo@pty',
    name: process.env.UPI_NAME || 'Zyqora',
    wa:   process.env.SUPPORT_WHATSAPP || '919217758442',
};

// Public plan cards for the /buy page — never leak deviceLimit/features/durationPlan.
export function publicPlans() {
    return Object.values(PLANS).map(p => ({
        id: p.id, name: p.name, price: p.price, popular: !!p.popular, highlights: p.highlights,
    }));
}
