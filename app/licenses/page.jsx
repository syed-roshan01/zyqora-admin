'use client';
import { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { apiFetch } from '@/lib/apiFetch';

const PLANS = [
    { value: 'trial',    label: 'Trial (3 days)'      },
    { value: 'weekly',   label: 'Weekly (7 days)'     },
    { value: 'monthly',  label: 'Monthly (30 days)'   },
    { value: '3months',  label: '3 Months (90 days)'  },
    { value: '6months',  label: '6 Months (180 days)' },
    { value: 'yearly',   label: 'Yearly (365 days)'   },
    { value: 'lifetime', label: 'Lifetime'            },
    { value: 'custom',   label: 'Custom days'         },
];

const FEATURE_OPTIONS = [
    { key: 'mobile',       label: 'Open on Mobile',  sub: 'Cloudflare tunnel' },
    { key: 'trustBuilder', label: 'Trust Builder',   sub: 'Account warming'   },
    { key: 'autoReply',    label: 'Auto Reply',      sub: 'Auto responses'    },
    { key: 'chatbot',      label: 'Chatbot Flows',   sub: 'Flow builder'      },
    { key: 'liveChat',     label: 'Live Chat',       sub: 'Real-time chat'    },
    { key: 'groupGrabber', label: 'Group Grabber',   sub: 'Extract groups'    },
    { key: 'aiAutomation', label: 'AI Automation',   sub: 'AI-powered actions' },
];

const DEFAULT_FEATURES = { mobile: true, trustBuilder: true, autoReply: true, chatbot: true, liveChat: true, groupGrabber: true, aiAutomation: true };

const DEFAULT_FORM = {
    clientName: '', clientPhone: '', clientEmail: '',
    businessCategory: '', website: '',
    machineId: '', plan: 'monthly', deviceLimit: '1',
    customDays: '', notes: '', price: '', discountedPrice: '',
    features: { ...DEFAULT_FEATURES },
};

function fmtDate(ts) {
    if (!ts) return '—';
    return new Date(ts * 1000).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function toAmountNumber(v) {
    const raw = String(v ?? '').trim();
    if (!raw) return 0;

    const normalized = raw.replace(/,/g, '');
    const num = Number(normalized);
    if (Number.isFinite(num)) return num;

    const fallback = parseFloat(normalized.replace(/[^0-9.-]/g, ''));
    return Number.isFinite(fallback) ? fallback : 0;
}

function amountPlain(v) {
    const n = toAmountNumber(v);
    if (!Number.isFinite(n)) return '0';

    // Use fullwide conversion first to avoid exponent notation for very large values.
    let plain = n.toLocaleString('fullwide', {
        useGrouping: false,
        maximumFractionDigits: 20,
    });

    if (plain.includes('e') || plain.includes('E')) {
        plain = Number(n).toFixed(2);
    }

    if (plain.includes('.')) {
        plain = plain.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
    }
    return plain;
}

function fmtMoney(v) {
    const amount = Number(amountPlain(v));
    const formatted = new Intl.NumberFormat('en-IN', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
        notation: 'standard',
        useGrouping: true,
    }).format(amount);
    return `INR ${formatted}`;
}

async function loadImageAsDataUrl(path) {
    const res = await fetch(path);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
    });
}

function getDaysLeft(l) {
    if (l.isLifetime) return null;
    return Math.floor((l.expiryTs - Math.floor(Date.now() / 1000)) / 86400);
}

function csvEscape(value) {
    const s = String(value ?? '');
    if (s.includes('"') || s.includes(',') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
}

function getLicenseStatus(l, nowTs) {
    if (l.revoked) return 'Revoked';
    if (!l.isLifetime && (l.expiryTs || 0) <= nowTs) return 'Expired';
    return 'Active';
}

export default function LicensesPage() {
    const [user,     setUser]     = useState(null);
    const [licenses, setLicenses] = useState([]);
    const [loading,  setLoading]  = useState(true);
    const [search,   setSearch]   = useState('');
    const [showGen,  setShowGen]  = useState(false);
    const [form,     setForm]     = useState(DEFAULT_FORM);
    const [genBusy,  setGenBusy]  = useState(false);
    const [genErr,   setGenErr]   = useState('');
    const [genKey,   setGenKey]   = useState('');
    const [generatedLicense, setGeneratedLicense] = useState(null);
    const [invoiceBusy, setInvoiceBusy] = useState(false);
    const [showRev,  setShowRev]  = useState(null); // key to revoke
    const [revReason,setRevReason]= useState('');
    const [revBusy,  setRevBusy]  = useState(false);
    const [copied,   setCopied]   = useState('');
    const [showDel,  setShowDel]  = useState(null); // { key, clientName }
    const [delBusy,  setDelBusy]  = useState(false);
    const [showDetail,setShowDetail]= useState(null);   // license object
    const [showEdit,  setShowEdit]  = useState(null);   // license object
    const [editForm,  setEditForm]  = useState({ clientName: '', clientPhone: '', clientEmail: '', businessCategory: '', website: '', price: '', notes: '', features: { ...DEFAULT_FEATURES } });
    const [editBusy,  setEditBusy]  = useState(false);
    const [editErr,   setEditErr]   = useState('');
    const [exportFormat, setExportFormat] = useState('csv');
    const [exportBusy, setExportBusy] = useState(false);

    const load = async () => {
        setLoading(true);
        const r = await apiFetch('/api/licenses/list');
        if (r?.ok) setLicenses(r.data);
        setLoading(false);
    };

    useEffect(() => {
        try { const u = localStorage.getItem('zyqora_admin_user'); if (u) setUser(JSON.parse(u)); } catch {}
        load();
    }, []);

    const filtered = licenses.filter(l => {
        const q = search.toLowerCase();
        return !q || l.clientName?.toLowerCase().includes(q) ||
               l.key.toLowerCase().includes(q) ||
               l.clientPhone?.toLowerCase().includes(q) ||
               l.machineId?.toLowerCase().includes(q);
    });

    const formPrice = toAmountNumber(form.price);
    const formDiscounted = form.discountedPrice === ''
        ? formPrice
        : Math.min(formPrice, toAmountNumber(form.discountedPrice));
    const formDiscount = Math.max(0, formPrice - formDiscounted);
    const formDiscountPercent = formPrice > 0 ? (formDiscount / formPrice) * 100 : 0;
    const formDiscountPercentRounded = Math.round(formDiscountPercent);

    const copyKey = (key) => {
        navigator.clipboard.writeText(key);
        setCopied(key);
        setTimeout(() => setCopied(''), 1800);
    };

    const generate = async (e) => {
        e.preventDefault();
        setGenBusy(true);
        setGenErr('');
        const r = await apiFetch('/api/licenses/generate', { method: 'POST', body: form });
        if (!r) return;
        if (!r.ok) { setGenErr(r.data.error || 'Failed'); setGenBusy(false); return; }
        setGenKey(r.data.key);
        setGeneratedLicense(r.data.license || null);
        setGenBusy(false);
        load();
    };

    const downloadInvoiceForLicense = async (license) => {
        if (!license) return;
        setInvoiceBusy(true);
        try {
            const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
                import('jspdf'),
                import('jspdf-autotable'),
            ]);

            const l = license;
            const doc = new jsPDF({ unit: 'pt', format: 'a4' });
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();

            const logo = await loadImageAsDataUrl('/favicon_io/android-chrome-192x192.png').catch(() => null);
            const issuedDate = fmtDate(l.issuedAt);
            const dueDate = l.isLifetime ? 'Lifetime' : fmtDate(l.expiryTs);
            const invoiceId = `INV-${String(l.key || '').slice(0, 8)}`;
            const baseAmount = toAmountNumber(l.price);
            const paidAmount = Math.min(baseAmount, toAmountNumber(l.discountedPrice ?? l.price));
            const discountAmount = Math.max(0, baseAmount - paidAmount);
            const hasDiscount = discountAmount > 0;
            const discountPercent = baseAmount > 0 ? (discountAmount / baseAmount) * 100 : 0;
            const discountPercentRounded = Math.round(discountPercent);
            const subtotalAmount = fmtMoney(baseAmount);
            const discountPercentText = `${discountPercentRounded}%`;
            const totalAmount = fmtMoney(paidAmount);
            const activeFeatures = FEATURE_OPTIONS
                .filter(f => (l.features ? l.features[f.key] !== false : true))
                .map(f => f.label)
                .join(', ') || '-';

            // Header band
            doc.setFillColor(12, 36, 74);
            doc.rect(0, 0, pageWidth, 100, 'F');
            doc.setFillColor(14, 116, 144);
            doc.rect(0, 92, pageWidth, 8, 'F');

            if (logo) {
                doc.addImage(logo, 'PNG', 40, 20, 48, 48);
            }

            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(24);
            doc.text('ZYQORA', 96, 44);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.text('License Activation Invoice', 96, 63);

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(14);
            doc.text('INVOICE', pageWidth - 130, 38);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.text(`Invoice #: ${invoiceId}`, pageWidth - 200, 56);
            doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`, pageWidth - 200, 72);
            doc.text(`Issued: ${issuedDate}`, pageWidth - 200, 88);

            doc.setFillColor(245, 247, 251);
            doc.rect(40, 118, pageWidth - 80, 84, 'F');

            doc.setTextColor(30, 41, 59);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.text('Bill To', 52, 138);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.text(`Client: ${l.clientName || '-'}`, 52, 156);
            doc.text(`Phone: ${l.clientPhone || '-'}`, 52, 172);
            doc.text(`Email: ${l.clientEmail || '-'}`, 52, 188);

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.text('Account Details', pageWidth - 250, 138);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.text(`Issued By: ${l.issuedByName || '-'}`, pageWidth - 250, 156);
            doc.text(`Business: ${l.businessCategory || '-'}`, pageWidth - 250, 172);
            doc.text(`Website: ${l.website || 'No website'}`, pageWidth - 250, 188);

            autoTable(doc, {
                startY: 224,
                head: [['Description', 'Details', 'Amount']],
                body: [
                    ['Product', 'Zyqora Software License Activation', subtotalAmount],
                    ['Plan', String(l.plan || '-').toUpperCase(), ''],
                    ['Validity', `${issuedDate} to ${dueDate}`, ''],
                    ['Device Limit', String(l.deviceLimit || 1), ''],
                    ['License Key', l.key || '-', ''],
                    ['Machine ID', l.machineId || '-', ''],
                    ['Features Included', activeFeatures, ''],
                    ...(hasDiscount ? [['Discounted Price', 'Final payable amount after discount', totalAmount]] : []),
                ],
                theme: 'grid',
                styles: { fontSize: 9.5, cellPadding: 7, textColor: [30, 41, 59] },
                headStyles: { fillColor: [12, 36, 74], textColor: [255, 255, 255], fontStyle: 'bold' },
                columnStyles: {
                    0: { cellWidth: 130, fontStyle: 'bold' },
                    1: { cellWidth: 330 },
                    2: { cellWidth: 80, halign: 'right', fontStyle: 'bold' },
                },
            });

            let finalY = doc.lastAutoTable?.finalY || 450;
            doc.setDrawColor(226, 232, 240);
            doc.line(40, finalY + 24, pageWidth - 40, finalY + 24);

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(12);
            doc.text('Subtotal', pageWidth - 200, finalY + 46);
            doc.text(subtotalAmount, pageWidth - 60, finalY + 46, { align: 'right' });

            let totalY = finalY + 68;
            if (hasDiscount) {
                doc.setFontSize(10);
                doc.setFont('helvetica', 'normal');
                doc.text('Discount', pageWidth - 200, finalY + 62);
                doc.text(discountPercentText, pageWidth - 60, finalY + 62, { align: 'right' });
                totalY = finalY + 84;
            }

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(13);
            doc.text('Total Amount', pageWidth - 200, totalY);
            doc.text(totalAmount, pageWidth - 60, totalY, { align: 'right' });

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9.5);
            doc.setTextColor(71, 85, 105);
            const note = l.notes ? `Note: ${l.notes}` : 'Note: This invoice confirms successful license issuance for the above client.';
            doc.text(note, 40, finalY + 48, { maxWidth: 320 });

            finalY += 108;
            if (finalY > pageHeight - 180) {
                doc.addPage();
                finalY = 60;
            }

            doc.setFillColor(240, 249, 255);
            doc.rect(40, finalY, pageWidth - 80, 158, 'F');
            doc.setDrawColor(14, 116, 144);
            doc.rect(40, finalY, pageWidth - 80, 158);

            doc.setTextColor(3, 105, 161);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.text('Terms and Conditions', 52, finalY + 22);

            doc.setTextColor(71, 85, 105);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9.2);
            const terms = [
                'For assistance, please contact Zyqora Support at +91 92177 58442.',
                'Complimentary support is available for 3 days from the date of license activation.',
                'Extended monthly support can be opted for through an additional paid support plan.',
                'Each successful referral qualifies for a one-month extension to the active plan, subject to verification by Zyqora.',
                'Zyqora includes anti-ban safeguards; use Trust Builder and the safest sending methods before scaling campaigns.',
                'All templates and outbound messages must comply with Meta and WhatsApp policy guidelines.',
                'Avoid spam or abusive outreach; repeated user reports can lead to temporary or permanent account restrictions.',
                'Zyqora is not liable for any number blocking, limitations, or bans imposed by WhatsApp or Meta.'
            ];
            doc.text(terms.map((t, i) => `${i + 1}. ${t}`).join('\n'), 52, finalY + 40, { maxWidth: pageWidth - 104, lineHeightFactor: 1.5 });

            doc.setFillColor(248, 250, 252);
            doc.rect(0, pageHeight - 54, pageWidth, 54, 'F');
            doc.setTextColor(100, 116, 139);
            doc.setFontSize(9);
            doc.text('Zyqora Support: +91 92177 58442', 40, pageHeight - 32);
            doc.text('Thank you for choosing Zyqora.', pageWidth - 40, pageHeight - 32, { align: 'right' });
            doc.text('This is a system-generated invoice and does not require a signature.', 40, pageHeight - 18);

            const safeName = (l.clientName || 'client').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
            doc.save(`zyqora-invoice-${safeName || 'client'}-${new Date().toISOString().slice(0, 10)}.pdf`);
        } finally {
            setInvoiceBusy(false);
        }
    };

    const downloadGeneratedInvoice = async () => {
        await downloadInvoiceForLicense(generatedLicense);
    };

    const revoke = async () => {
        setRevBusy(true);
        const r = await apiFetch('/api/licenses/revoke', { method: 'POST', body: { key: showRev, reason: revReason } });
        if (r?.ok) { setShowRev(null); setRevReason(''); load(); }
        setRevBusy(false);
    };

    const deleteLic = async () => {
        setDelBusy(true);
        const r = await apiFetch('/api/licenses/delete', { method: 'POST', body: { key: showDel.key } });
        if (r?.ok) { setShowDel(null); load(); }
        setDelBusy(false);
    };

    const updateLicense = async (e) => {
        e.preventDefault();
        setEditBusy(true);
        setEditErr('');
        const r = await apiFetch('/api/licenses/update', { method: 'POST', body: { key: showEdit.key, clientName: editForm.clientName, clientPhone: editForm.clientPhone, clientEmail: editForm.clientEmail, businessCategory: editForm.businessCategory, website: editForm.website, price: editForm.price, notes: editForm.notes, features: editForm.features } });
        if (!r?.ok) { setEditErr(r?.data?.error || 'Failed to update'); setEditBusy(false); return; }
        setShowEdit(null);
        setEditBusy(false);
        load();
    };

    const downloadCsv = () => {
        const nowTs = Math.floor(Date.now() / 1000);
        const headers = [
            'Client Name', 'Phone', 'Email', 'Business Category', 'Website',
            'Plan', 'Price', 'Discounted Price', 'Discount Amount', 'Device Limit', 'Machine ID', 'Key',
            'Issued By', 'Issued At', 'Expiry', 'Status',
            'Revoked By', 'Revoked At', 'Revoked Reason',
            'Features', 'Notes'
        ];

        const rows = licenses.map(l => {
            const features = FEATURE_OPTIONS
                .filter(f => (l.features ? l.features[f.key] !== false : true))
                .map(f => f.label)
                .join(' | ');

            return [
                l.clientName || '',
                l.clientPhone || '',
                l.clientEmail || '',
                l.businessCategory || '',
                l.website || '',
                l.plan || '',
                toAmountNumber(l.price),
                toAmountNumber(l.discountedPrice ?? l.price),
                Math.max(0, toAmountNumber(l.price) - toAmountNumber(l.discountedPrice ?? l.price)),
                l.deviceLimit || 1,
                l.machineId || '',
                l.key || '',
                l.issuedByName || '',
                fmtDate(l.issuedAt),
                l.isLifetime ? 'Lifetime' : fmtDate(l.expiryTs),
                getLicenseStatus(l, nowTs),
                l.revokedByName || '',
                l.revokedAt ? fmtDate(l.revokedAt) : '',
                l.revokedReason || '',
                features,
                l.notes || '',
            ].map(csvEscape).join(',');
        });

        const csv = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const stamp = new Date().toISOString().slice(0, 10);
        a.href = url;
        a.download = `licenses-full-${stamp}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    };

    const downloadPdf = async () => {
        const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
            import('jspdf'),
            import('jspdf-autotable'),
        ]);

        const nowTs = Math.floor(Date.now() / 1000);
        const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
        doc.setFontSize(14);
        doc.text('Zyqora Licenses - Full Export', 36, 30);
        doc.setFontSize(10);
        doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, 36, 48);

        const body = licenses.map((l) => {
            const features = FEATURE_OPTIONS
                .filter(f => (l.features ? l.features[f.key] !== false : true))
                .map(f => f.label)
                .join(', ');

            const details = [
                `Phone: ${l.clientPhone || '-'}`,
                `Email: ${l.clientEmail || '-'}`,
                `Category: ${l.businessCategory || '-'}`,
                `Website: ${l.website || '-'}`,
                `Machine: ${l.machineId || '-'}`,
                `Key: ${l.key || '-'}`,
                `Features: ${features || '-'}`,
                `Notes: ${l.notes || '-'}`,
            ].join('\n');

            return [
                l.clientName || '-',
                l.plan || '-',
                fmtMoney(l.discountedPrice ?? l.price),
                l.deviceLimit || 1,
                l.issuedByName || '-',
                fmtDate(l.issuedAt),
                l.isLifetime ? 'Lifetime' : fmtDate(l.expiryTs),
                getLicenseStatus(l, nowTs),
                details,
            ];
        });

        autoTable(doc, {
            startY: 60,
            head: [[
                'Client', 'Plan', 'Price', 'Devices', 'Issued By',
                'Issued At', 'Expiry', 'Status', 'Details'
            ]],
            body,
            styles: { fontSize: 8, cellPadding: 3, valign: 'top' },
            headStyles: { fillColor: [124, 58, 237] },
            columnStyles: {
                0: { cellWidth: 85 },
                1: { cellWidth: 50 },
                2: { cellWidth: 52 },
                3: { cellWidth: 40 },
                4: { cellWidth: 68 },
                5: { cellWidth: 58 },
                6: { cellWidth: 58 },
                7: { cellWidth: 48 },
                8: { cellWidth: 250 },
            },
            didDrawPage: (data) => {
                const pageNo = doc.getNumberOfPages();
                doc.setFontSize(8);
                doc.text(`Page ${pageNo}`, data.settings.margin.left, doc.internal.pageSize.height - 12);
            },
        });

        const stamp = new Date().toISOString().slice(0, 10);
        doc.save(`licenses-full-${stamp}.pdf`);
    };

    const downloadLicenses = async () => {
        if (!licenses.length) return;
        setExportBusy(true);
        try {
            if (exportFormat === 'pdf') {
                await downloadPdf();
            } else {
                downloadCsv();
            }
        } finally {
            setExportBusy(false);
        }
    };

    const now = Math.floor(Date.now() / 1000);

    return (
        <AppLayout>
            <div className="page">
                <div className="page-header">
                    <div>
                        <div className="page-title">Licenses</div>
                        <div className="page-subtitle">{licenses.length} total issued</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <select
                            className="form-select"
                            style={{ width: 120 }}
                            value={exportFormat}
                            onChange={e => setExportFormat(e.target.value)}
                        >
                            <option value="csv">CSV</option>
                            <option value="pdf">PDF</option>
                        </select>
                        <button
                            className="btn btn-ghost"
                            onClick={downloadLicenses}
                            disabled={exportBusy || licenses.length === 0}
                            title={licenses.length === 0 ? 'No licenses to export' : 'Download full license data'}
                        >
                            {exportBusy ? 'Preparing…' : 'Download'}
                        </button>
                        <button className="btn btn-primary" onClick={() => { setShowGen(true); setGenKey(''); setGeneratedLicense(null); setForm(DEFAULT_FORM); }}>
                            + Generate Key
                        </button>
                    </div>
                </div>

                <div className="page-body">
                    {/* Search */}
                    <div className="search-bar" style={{ marginBottom: 16 }}>
                        <input
                            className="form-input search-input"
                            placeholder="Search by client, key, phone or machine ID…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                        {search && (
                            <button className="btn btn-ghost btn-sm" onClick={() => setSearch('')}>Clear</button>
                        )}
                    </div>

                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>Client</th>
                                    <th>Key</th>
                                    <th>Plan</th>
                                    <th>Devices</th>
                                    <th>Expiry / Days Left</th>
                                    <th>Machine ID</th>
                                    <th>Issued By</th>
                                    <th>Issued At</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={10} className="empty">Loading…</td></tr>
                                ) : filtered.length === 0 ? (
                                    <tr><td colSpan={10} className="empty">No licenses found</td></tr>
                                ) : filtered.map(l => {
                                    const days = getDaysLeft(l);
                                    const isExpired = !l.isLifetime && days !== null && days < 0;
                                    return (
                                        <tr key={l.key}>
                                            <td>
                                                <div className="bold" style={{ cursor: 'pointer', color: '#a78bfa', textDecoration: 'underline', textDecorationStyle: 'dotted' }} onClick={() => setShowDetail(l)}>{l.clientName}</div>
                                                {l.clientPhone && <div className="dim">{l.clientPhone}</div>}
                                            </td>
                                            <td>
                                                <span
                                                    className="mono copy-key"
                                                    title="Click to copy"
                                                    onClick={() => copyKey(l.key)}
                                                >
                                                    {copied === l.key ? '✓ Copied!' : l.key.slice(0, 23) + '…'}
                                                </span>
                                            </td>
                                            <td><span className={`badge badge-plan-${l.plan}`}>{l.plan}</span></td>
                                            <td style={{ textAlign: 'center' }}>{l.deviceLimit}</td>
                                            <td>
                                                {l.isLifetime ? (
                                                    <span style={{ color: '#a78bfa', fontWeight: 600 }}>Lifetime</span>
                                                ) : (
                                                    <>
                                                        <div>{fmtDate(l.expiryTs)}</div>
                                                        <div className="dim" style={{ color: days !== null && days < 7 && days >= 0 ? '#f59e0b' : '' }}>
                                                            {days !== null && days >= 0 ? `${days}d left` : days !== null ? 'Expired' : ''}
                                                        </div>
                                                    </>
                                                )}
                                            </td>
                                            <td><span className="mono" style={{ fontSize: 11 }}>{l.machineId?.slice(0, 16)}…</span></td>
                                            <td>{l.issuedByName}</td>
                                            <td>{fmtDate(l.issuedAt)}</td>
                                            <td>
                                                {l.revoked   && <span className="badge badge-revoked">Revoked</span>}
                                                {!l.revoked && isExpired && <span className="badge badge-expired">Expired</span>}
                                                {!l.revoked && !isExpired && <span className="badge badge-active">Active</span>}
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: 6 }}>
                                                    <button
                                                        className="btn btn-ghost btn-sm"
                                                        onClick={() => { setShowEdit(l); setEditForm({ clientName: l.clientName || '', clientPhone: l.clientPhone || '', clientEmail: l.clientEmail || '', businessCategory: l.businessCategory || '', website: l.website || '', price: l.price ?? '', notes: l.notes || '', features: { ...DEFAULT_FEATURES, ...(l.features || {}) } }); setEditErr(''); }}
                                                        title="Edit price & notes"
                                                    >✎</button>
                                                    {!l.revoked && (
                                                        <button
                                                            className="btn btn-danger btn-sm"
                                                            onClick={() => { setShowRev(l.key); setRevReason(''); }}
                                                        >
                                                            Revoke
                                                        </button>
                                                    )}
                                                    {user?.role === 'super' && (
                                                        <button
                                                            className="btn btn-ghost btn-sm"
                                                            style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,.3)' }}
                                                            onClick={() => setShowDel({ key: l.key, clientName: l.clientName })}
                                                        >
                                                            Delete
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* ── Generate Modal ─────────────────────────────────────────── */}
            {showGen && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && !genKey && setShowGen(false)}>
                    <div className="modal">
                        <div className="modal-header">
                            <span className="modal-title">{genKey ? '✓ Key Generated' : 'Generate License Key'}</span>
                            <button className="modal-close" onClick={() => setShowGen(false)}>×</button>
                        </div>

                        {genKey ? (
                            <div className="modal-body">
                                <div style={{ background: '#161c2d', border: '1px solid #7c3aed', borderRadius: 10, padding: '16px 18px' }}>
                                    <div style={{ fontSize: 11, color: '#4a5980', marginBottom: 6, fontWeight: 600 }}>LICENSE KEY</div>
                                    <div style={{ fontFamily: 'Courier New, monospace', fontSize: 15, color: '#a78bfa', letterSpacing: '.5px', wordBreak: 'break-all' }}>{genKey}</div>
                                </div>
                                <button
                                    className="btn btn-primary"
                                    style={{ width: '100%' }}
                                    onClick={() => { navigator.clipboard.writeText(genKey); setCopied('__genkey__'); setTimeout(() => setCopied(''), 2000); }}
                                >
                                    {copied === '__genkey__' ? '✓ Key Copied!' : 'Copy Key'}
                                </button>
                                <button
                                    className="btn btn-ghost"
                                    style={{ width: '100%' }}
                                    onClick={downloadGeneratedInvoice}
                                    disabled={!generatedLicense || invoiceBusy}
                                >
                                    {invoiceBusy ? 'Preparing Invoice…' : 'Download Invoice (PDF)'}
                                </button>
                                <button
                                    className="btn btn-ghost"
                                    style={{ width: '100%' }}
                                    onClick={() => { setGenKey(''); setGeneratedLicense(null); setForm(DEFAULT_FORM); }}
                                >
                                    Generate Another
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={generate}>
                                <div className="modal-body">
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label className="form-label">Client Name *</label>
                                            <input className="form-input" required value={form.clientName}
                                                onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))} placeholder="e.g. John Doe" />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">WhatsApp / Phone</label>
                                            <input className="form-input" value={form.clientPhone}
                                                onChange={e => setForm(f => ({ ...f, clientPhone: e.target.value }))} placeholder="+91 9876543210" />
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Email</label>
                                        <input className="form-input" type="email" value={form.clientEmail}
                                            onChange={e => setForm(f => ({ ...f, clientEmail: e.target.value }))} placeholder="client@email.com" />
                                    </div>
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label className="form-label">Business Category</label>
                                            <input className="form-input" value={form.businessCategory}
                                                onChange={e => setForm(f => ({ ...f, businessCategory: e.target.value }))} placeholder="e.g. E-commerce, Real Estate" />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Website</label>
                                            <input className="form-input" value={form.website}
                                                onChange={e => setForm(f => ({ ...f, website: e.target.value }))} placeholder="https://example.com" />
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Machine ID *</label>
                                        <input className="form-input" required value={form.machineId}
                                            onChange={e => setForm(f => ({ ...f, machineId: e.target.value }))}
                                            placeholder="Paste from Zyqora app License screen"
                                            style={{ fontFamily: 'Courier New, monospace', fontSize: 12 }} />
                                        <span style={{ fontSize: 11, color: '#3a4560' }}>Found in the Zyqora desktop app → License screen → bottom</span>
                                    </div>
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label className="form-label">Plan *</label>
                                            <select className="form-select" value={form.plan}
                                                onChange={e => setForm(f => ({ ...f, plan: e.target.value }))}>
                                                {PLANS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Device Limit *</label>
                                            <input className="form-input" type="number" min={1} max={255} required value={form.deviceLimit}
                                                onChange={e => setForm(f => ({ ...f, deviceLimit: e.target.value }))} />
                                        </div>
                                    </div>
                                    {form.plan === 'custom' && (
                                        <div className="form-group">
                                            <label className="form-label">Custom Days *</label>
                                            <input className="form-input" type="number" min={1} required={form.plan === 'custom'} value={form.customDays}
                                                onChange={e => setForm(f => ({ ...f, customDays: e.target.value }))} placeholder="e.g. 45" />
                                        </div>
                                    )}
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label className="form-label">Price (₹)</label>
                                            <input className="form-input" type="number" min="0" step="0.01" value={form.price}
                                                onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                                                placeholder="e.g. 999" />
                                            <label className="form-label" style={{ marginTop: 8 }}>Discounted Price (₹)</label>
                                            <input className="form-input" type="number" min="0" step="0.01" value={form.discountedPrice}
                                                onChange={e => setForm(f => ({ ...f, discountedPrice: e.target.value }))}
                                                placeholder="Leave blank for no discount" />
                                            <span style={{ fontSize: 11, color: '#4a5980', marginTop: 6 }}>
                                                Auto Discount: <span style={{ color: '#22c55e', fontWeight: 700 }}>{fmtMoney(formDiscount)}</span>
                                                <span style={{ color: '#4a9eff', fontWeight: 700 }}> ({formDiscountPercentRounded}%)</span>
                                            </span>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Notes</label>
                                            <textarea className="form-textarea" value={form.notes}
                                                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                                                placeholder="Internal note" style={{ minHeight: 42 }} />
                                        </div>
                                    </div>
                                    {/* Feature Flags */}
                                    <div className="form-group">
                                        <label className="form-label" style={{ marginBottom: 8 }}>Features Included</label>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                                            {FEATURE_OPTIONS.map(({ key, label, sub }) => (
                                                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '8px 10px', borderRadius: 8, border: '1px solid', borderColor: form.features[key] ? '#7c3aed' : '#252d42', background: form.features[key] ? 'rgba(124,58,237,.1)' : 'transparent', transition: 'all .15s', userSelect: 'none' }}>
                                                    <input type="checkbox" checked={form.features[key] ?? true}
                                                        onChange={e => setForm(f => ({ ...f, features: { ...f.features, [key]: e.target.checked } }))}
                                                        style={{ accentColor: '#7c3aed', width: 14, height: 14, flexShrink: 0 }} />
                                                    <span style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                                        <span style={{ fontSize: 12.5, fontWeight: 600, color: form.features[key] ? '#e2e8f0' : '#4a5980' }}>{label}</span>
                                                        <span style={{ fontSize: 10.5, color: '#3a4560' }}>{sub}</span>
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                        <button type="button" onClick={() => setForm(f => ({ ...f, features: { ...DEFAULT_FEATURES } }))}
                                            style={{ marginTop: 6, background: 'none', border: 'none', color: '#4a5980', fontSize: 11, cursor: 'pointer', textAlign: 'left', padding: 0 }}>
                                            ↺ Select all
                                        </button>
                                    </div>
                                    {genErr && <div className="form-error">{genErr}</div>}
                                </div>
                                <div className="modal-footer">
                                    <button type="button" className="btn btn-ghost" onClick={() => setShowGen(false)}>Cancel</button>
                                    <button type="submit" className="btn btn-primary" disabled={genBusy}>
                                        {genBusy ? 'Generating…' : 'Generate Key'}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {/* ── Delete Modal ───────────────────────────────────────────── */}
            {showDel && (
                <div className="modal-overlay">
                    <div className="modal" style={{ maxWidth: 420 }}>
                        <div className="modal-header">
                            <span className="modal-title">Delete License</span>
                            <button className="modal-close" onClick={() => setShowDel(null)} disabled={delBusy}>×</button>
                        </div>
                        <div className="modal-body">
                            <p style={{ color: '#94a3b8', fontSize: 13 }}>
                                Permanently delete license for <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{showDel.clientName}</span>?<br />
                                <span style={{ fontSize: 12, color: '#ef4444' }}>This removes the record entirely and cannot be undone.</span>
                            </p>
                            <div style={{ fontFamily: 'Courier New, monospace', fontSize: 11, color: '#64748b', background: 'rgba(255,255,255,.03)', borderRadius: 7, padding: '8px 12px', wordBreak: 'break-all' }}>
                                {showDel.key}
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setShowDel(null)} disabled={delBusy}>Cancel</button>
                            <button className="btn btn-danger" onClick={deleteLic} disabled={delBusy}>
                                {delBusy ? 'Deleting…' : 'Delete Permanently'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Revoke Modal ───────────────────────────────────────────── */}
            {showRev && (
                <div className="modal-overlay">
                    <div className="modal" style={{ maxWidth: 420 }}>
                        <div className="modal-header">
                            <span className="modal-title">Revoke License</span>
                            <button className="modal-close" onClick={() => setShowRev(null)}>×</button>
                        </div>
                        <div className="modal-body">
                            <div style={{ color: '#94a3b8', fontSize: 13 }}>
                                This will immediately invalidate the key. The client's app will show as unlicensed on next startup.
                            </div>
                            <div style={{ fontFamily: 'Courier New, monospace', fontSize: 12, color: '#ef4444', background: 'rgba(239,68,68,.08)', borderRadius: 7, padding: '8px 12px', wordBreak: 'break-all' }}>
                                {showRev}
                            </div>
                            <div className="form-group">
                                <label className="form-label">Reason (optional)</label>
                                <input className="form-input" value={revReason}
                                    onChange={e => setRevReason(e.target.value)}
                                    placeholder="e.g. Refund requested" autoFocus />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setShowRev(null)}>Cancel</button>
                            <button className="btn btn-danger" onClick={revoke} disabled={revBusy}>
                                {revBusy ? 'Revoking…' : 'Confirm Revoke'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* ── Detail Modal ──────────────────────────────────────────── */}
            {showDetail && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowDetail(null)}>
                    <div className="modal" style={{ maxWidth: 580 }}>
                        <div className="modal-header">
                            <span className="modal-title">📋 License Details</span>
                            <button className="modal-close" onClick={() => setShowDetail(null)}>×</button>
                        </div>
                        <div className="modal-body">
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 24px' }}>
                                <div>
                                    <div style={{ fontSize: 10, color: '#4a5980', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Client Name</div>
                                    <div style={{ fontSize: 13, color: '#e2e8f0' }}>{showDetail.clientName}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 10, color: '#4a5980', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Phone</div>
                                    <div style={{ fontSize: 13, color: '#e2e8f0' }}>{showDetail.clientPhone || '—'}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 10, color: '#4a5980', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Email</div>
                                    <div style={{ fontSize: 13, color: '#e2e8f0' }}>{showDetail.clientEmail || '—'}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 10, color: '#4a5980', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Business Category</div>
                                    <div style={{ fontSize: 13, color: '#e2e8f0' }}>{showDetail.businessCategory || '—'}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 10, color: '#4a5980', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Website</div>
                                    <div style={{ fontSize: 13, color: '#e2e8f0' }}>{showDetail.website || 'No website'}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 10, color: '#4a5980', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Plan</div>
                                    <div><span className={`badge badge-plan-${showDetail.plan}`}>{showDetail.plan}</span></div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 10, color: '#4a5980', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Expiry</div>
                                    <div style={{ fontSize: 13, color: showDetail.isLifetime ? '#a78bfa' : '#e2e8f0' }}>{showDetail.isLifetime ? 'Lifetime ∞' : fmtDate(showDetail.expiryTs)}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 10, color: '#4a5980', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Days Left</div>
                                    <div style={{ fontSize: 13, color: '#e2e8f0' }}>{showDetail.isLifetime ? '∞' : (() => { const d = getDaysLeft(showDetail); return d !== null && d >= 0 ? `${d}d` : 'Expired'; })()}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 10, color: '#4a5980', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Device Limit</div>
                                    <div style={{ fontSize: 13, color: '#e2e8f0' }}>{showDetail.deviceLimit}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 10, color: '#4a5980', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Price</div>
                                    <div style={{ fontSize: 13, color: '#e2e8f0' }}>{fmtMoney(showDetail.price)}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 10, color: '#4a5980', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Discounted Price</div>
                                    <div style={{ fontSize: 13, color: '#22c55e' }}>{fmtMoney(showDetail.discountedPrice ?? showDetail.price)}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 10, color: '#4a5980', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Discount</div>
                                    <div style={{ fontSize: 13, color: '#f59e0b' }}>
                                        {fmtMoney(Math.max(0, toAmountNumber(showDetail.price) - toAmountNumber(showDetail.discountedPrice ?? showDetail.price)))}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 10, color: '#4a5980', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Issued By</div>
                                    <div style={{ fontSize: 13, color: '#e2e8f0' }}>{showDetail.issuedByName}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 10, color: '#4a5980', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Issued At</div>
                                    <div style={{ fontSize: 13, color: '#e2e8f0' }}>{fmtDate(showDetail.issuedAt)}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 10, color: '#4a5980', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Activated</div>
                                    <div style={{ fontSize: 13, color: '#e2e8f0' }}>{showDetail.activated ? fmtDate(showDetail.activatedAt) : <span style={{ color: '#64748b' }}>Not yet</span>}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 10, color: '#4a5980', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Status</div>
                                    <div>{showDetail.revoked ? <span className="badge badge-revoked">Revoked</span> : (() => { const d = getDaysLeft(showDetail); return (!showDetail.isLifetime && d !== null && d < 0) ? <span className="badge badge-expired">Expired</span> : <span className="badge badge-active">Active</span>; })()}</div>
                                </div>
                                <div style={{ gridColumn: 'span 2' }}>
                                    <div style={{ fontSize: 10, color: '#4a5980', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Machine ID</div>
                                    <div style={{ fontFamily: 'Courier New, monospace', fontSize: 11, color: '#94a3b8', wordBreak: 'break-all', background: 'rgba(255,255,255,.03)', borderRadius: 6, padding: '6px 10px' }}>{showDetail.machineId}</div>
                                </div>
                                <div style={{ gridColumn: 'span 2' }}>
                                    <div style={{ fontSize: 10, color: '#4a5980', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>License Key</div>
                                    <div style={{ fontFamily: 'Courier New, monospace', fontSize: 10, color: '#a78bfa', wordBreak: 'break-all', background: 'rgba(124,58,237,.07)', borderRadius: 6, padding: '6px 10px' }}>{showDetail.key}</div>
                                </div>
                                {showDetail.notes && (
                                    <div style={{ gridColumn: 'span 2' }}>
                                        <div style={{ fontSize: 10, color: '#4a5980', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Notes</div>
                                        <div style={{ fontSize: 12, color: '#94a3b8' }}>{showDetail.notes}</div>
                                    </div>
                                )}
                                {showDetail.revoked && (
                                    <div style={{ gridColumn: 'span 2' }}>
                                        <div style={{ fontSize: 10, color: '#ef4444', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Revoke Reason</div>
                                        <div style={{ fontSize: 12, color: '#f87171' }}>{showDetail.revokedReason || '—'} <span style={{ color: '#64748b' }}>(by {showDetail.revokedByName})</span></div>
                                    </div>
                                )}
                            </div>

                            {/* Features */}
                            <div style={{ marginTop: 16 }}>
                                <div style={{ fontSize: 10, color: '#4a5980', fontWeight: 600, textTransform: 'uppercase', marginBottom: 8 }}>Features Opted</div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                                    {FEATURE_OPTIONS.map(({ key, label, sub }) => {
                                        const enabled = showDetail.features ? showDetail.features[key] !== false : true;
                                        return (
                                            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 10px', borderRadius: 8, background: enabled ? 'rgba(34,197,94,.08)' : 'rgba(239,68,68,.07)', border: `1px solid ${enabled ? 'rgba(34,197,94,.25)' : 'rgba(239,68,68,.2)'}` }}>
                                                <span style={{ fontSize: 13, color: enabled ? '#22c55e' : '#ef4444', flexShrink: 0 }}>{enabled ? '✓' : '✗'}</span>
                                                <span style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                                    <span style={{ fontSize: 11.5, fontWeight: 600, color: enabled ? '#e2e8f0' : '#64748b' }}>{label}</span>
                                                    <span style={{ fontSize: 10, color: '#3a4560' }}>{sub}</span>
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setShowDetail(null)}>Close</button>
                            <button className="btn btn-ghost" onClick={() => downloadInvoiceForLicense(showDetail)} disabled={invoiceBusy}>
                                {invoiceBusy ? 'Preparing Invoice…' : 'Download Invoice'}
                            </button>
                            <button className="btn btn-primary" onClick={() => { setShowEdit(showDetail); setEditForm({ clientName: showDetail.clientName || '', clientPhone: showDetail.clientPhone || '', clientEmail: showDetail.clientEmail || '', price: showDetail.price ?? '', notes: showDetail.notes || '', features: { ...DEFAULT_FEATURES, ...(showDetail.features || {}) } }); setEditErr(''); setShowDetail(null); }}>✎ Edit</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Edit Modal ────────────────────────────────────────────── */}
            {showEdit && (
                <div className="modal-overlay">
                    <div className="modal" style={{ maxWidth: 540 }}>
                        <div className="modal-header">
                            <span className="modal-title">✎ Edit License</span>
                            <button className="modal-close" onClick={() => setShowEdit(null)} disabled={editBusy}>×</button>
                        </div>
                        <form onSubmit={updateLicense}>
                            <div className="modal-body">
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Client Name *</label>
                                        <input className="form-input" required value={editForm.clientName}
                                            onChange={e => setEditForm(f => ({ ...f, clientName: e.target.value }))}
                                            placeholder="e.g. John Doe" autoFocus />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">WhatsApp / Phone</label>
                                        <input className="form-input" value={editForm.clientPhone}
                                            onChange={e => setEditForm(f => ({ ...f, clientPhone: e.target.value }))}
                                            placeholder="+91 9876543210" />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Email</label>
                                    <input className="form-input" type="email" value={editForm.clientEmail}
                                        onChange={e => setEditForm(f => ({ ...f, clientEmail: e.target.value }))}
                                        placeholder="client@email.com" />
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Business Category</label>
                                        <input className="form-input" value={editForm.businessCategory}
                                            onChange={e => setEditForm(f => ({ ...f, businessCategory: e.target.value }))}
                                            placeholder="e.g. E-commerce, Real Estate" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Website</label>
                                        <input className="form-input" value={editForm.website}
                                            onChange={e => setEditForm(f => ({ ...f, website: e.target.value }))}
                                            placeholder="https://example.com" />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Price (₹)</label>
                                    <input className="form-input" type="number" min="0" step="0.01" value={editForm.price}
                                        onChange={e => setEditForm(f => ({ ...f, price: e.target.value }))}
                                        placeholder="e.g. 999" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Notes</label>
                                    <textarea className="form-textarea" value={editForm.notes}
                                        onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                                        placeholder="Internal notes" style={{ minHeight: 80 }} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label" style={{ marginBottom: 8 }}>Features</label>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                                        {FEATURE_OPTIONS.map(({ key, label, sub }) => (
                                            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '7px 10px', borderRadius: 8, border: '1px solid', borderColor: editForm.features[key] ? '#7c3aed' : '#252d42', background: editForm.features[key] ? 'rgba(124,58,237,.1)' : 'transparent', transition: 'all .15s', userSelect: 'none' }}>
                                                <input type="checkbox" checked={editForm.features[key] ?? true}
                                                    onChange={e => setEditForm(f => ({ ...f, features: { ...f.features, [key]: e.target.checked } }))}
                                                    style={{ accentColor: '#7c3aed', width: 14, height: 14, flexShrink: 0 }} />
                                                <span style={{ fontSize: 11.5, fontWeight: 600, color: editForm.features[key] ? '#e2e8f0' : '#4a5980' }}>{label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                {editErr && <div className="form-error">{editErr}</div>}
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowEdit(null)} disabled={editBusy}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={editBusy}>
                                    {editBusy ? 'Saving…' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
