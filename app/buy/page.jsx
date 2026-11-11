'use client';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

const CSS = `
.buy-wrap{min-height:100vh;background:#0b1220;color:#e8eefc;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:28px 16px 60px}
.buy-in{max-width:1040px;margin:0 auto}
.buy-h{text-align:center;margin-bottom:26px}
.buy-h h1{font-size:28px;margin:0 0 6px}
.buy-h p{margin:0;color:#8fa3c7;font-size:14px}
.buy-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:22px}
.plan{position:relative;display:flex;flex-direction:column;justify-content:flex-start;align-items:stretch;text-align:left;background:#111b2e;border:2px solid #1f2c47;border-radius:16px;padding:20px 18px;cursor:pointer;color:inherit;font:inherit;transition:border-color .15s,transform .15s}
.plan:hover{transform:translateY(-2px)}
.plan.sel{border-color:#25d366;background:#0f2a24}
.plan .pop{position:absolute;top:-11px;right:14px;background:#25d366;color:#04140d;font-size:11px;font-weight:700;padding:3px 10px;border-radius:99px}
.plan h3{margin:0 0 4px;font-size:18px}
.plan .pr{font-size:30px;font-weight:800;margin:6px 0 2px}
.plan .pr small{font-size:13px;font-weight:500;color:#8fa3c7}
.plan ul{list-style:none;padding:0;margin:12px 0 0;display:grid;gap:7px;font-size:13.5px;color:#c4d2ee}
.plan li::before{content:'\\2713';color:#25d366;font-weight:700;margin-right:8px}
.card{background:#111b2e;border:1px solid #1f2c47;border-radius:16px;padding:22px 20px;max-width:560px;margin:0 auto}
.card h2{margin:0 0 14px;font-size:18px}
.fld{margin-bottom:14px}
.fld label{display:block;font-size:12.5px;color:#8fa3c7;margin-bottom:5px}
.fld input{width:100%;box-sizing:border-box;background:#0b1220;border:1.5px solid #26355a;border-radius:10px;color:#e8eefc;padding:11px 12px;font-size:15px;outline:none}
.fld input:focus{border-color:#25d366}
.fld .hint{font-size:12px;color:#8fa3c7;margin-top:5px}
.row2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.pay{width:100%;border:0;border-radius:12px;padding:14px;font-size:16px;font-weight:700;cursor:pointer;background:linear-gradient(135deg,#47d98d,#2eb878);color:#04140d}
.pay:disabled{opacity:.5;cursor:not-allowed}
.btn2{display:block;width:100%;box-sizing:border-box;text-align:center;text-decoration:none;border:1.5px solid #26355a;border-radius:12px;padding:12px;font-size:15px;font-weight:600;color:#e8eefc;background:#0b1220;cursor:pointer}
.err{background:#3a1520;border:1px solid #7a2438;color:#ffb3c0;padding:10px 12px;border-radius:10px;font-size:13.5px;margin-bottom:14px}
.note{text-align:center;color:#6f84ab;font-size:12.5px;margin-top:14px}
.qrbox{display:flex;flex-direction:column;align-items:center;gap:10px;background:#0b1220;border:1px solid #26355a;border-radius:14px;padding:18px;margin-bottom:16px}
.qrbox .amt{font-size:26px;font-weight:800;color:#fff}
.qr{background:#fff;padding:12px;border-radius:12px;width:200px;height:200px;display:flex;align-items:center;justify-content:center}
.upiid{font-family:monospace;font-size:14px;color:#c4d2ee;background:#0f1a30;border:1px dashed #2b3c63;border-radius:8px;padding:8px 10px;word-break:break-all;text-align:center}
.steps{font-size:13px;color:#9fb2d6;line-height:1.6;margin:4px 0 16px;padding-left:18px}
.back{background:none;border:0;color:#8fa3c7;font-size:13px;cursor:pointer;padding:0;margin-bottom:12px}
@media(max-width:820px){.buy-grid{grid-template-columns:1fr}.row2{grid-template-columns:1fr}.buy-h h1{font-size:23px}}
`;

function BuyInner() {
    const sp = useSearchParams();
    const router = useRouter();
    const [plans, setPlans] = useState([]);
    const [upi, setUpi] = useState({ id: '', name: 'Zyqora', wa: '919217758442' });
    const [planId, setPlanId] = useState(sp.get('plan') || 'growth');
    const [mode] = useState(sp.get('mode') === 'app' ? 'app' : 'desktop');
    const [form, setForm] = useState({ name: '', phone: '', email: '', machineId: (sp.get('machineId') || '').toUpperCase() });
    const [utr, setUtr] = useState('');
    const [step, setStep] = useState('details');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [qrReady, setQrReady] = useState(false);
    const qrRef = useRef(null);

    useEffect(() => {
        fetch('/api/checkout/plans').then(r => r.json()).then(d => {
            setPlans(d.plans || []);
            if (d.upi) setUpi(d.upi);
        }).catch(() => setError('Could not load plans. Please refresh.'));
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
        s.async = true;
        s.onload = () => setQrReady(true);
        document.body.appendChild(s);
        return () => { try { document.body.removeChild(s); } catch { /* ignore */ } };
    }, []);

    const set = (k) => (e) => setForm(f => ({ ...f, [k]: k === 'machineId' ? e.target.value.toUpperCase().replace(/[^A-F0-9]/g, '') : e.target.value }));
    const plan = plans.find(p => p.id === planId);
    const locked = !!sp.get('machineId');

    function upiLink() {
        if (!plan) return '#';
        const tn = `Zyqora ${plan.name} ${form.machineId}`.trim();
        const p = new URLSearchParams({ pa: upi.id, pn: upi.name || 'Zyqora', am: String(plan.price), cu: 'INR', tn });
        return `upi://pay?${p.toString()}`;
    }

    useEffect(() => {
        if (step !== 'pay' || !qrReady || !plan || !qrRef.current || !window.QRCode) return;
        qrRef.current.innerHTML = '';
        try {
            new window.QRCode(qrRef.current, { text: upiLink(), width: 176, height: 176, correctLevel: window.QRCode.CorrectLevel.M });
        } catch { /* ignore */ }
    }, [step, qrReady, planId, form.machineId]);

    function goToPay(e) {
        e.preventDefault();
        setError('');
        if (!plan) return setError('Choose a plan');
        if (!/^[A-F0-9]{16}$/.test(form.machineId)) return setError('Enter your 16-character Machine ID exactly as shown in the app');
        if (form.name.trim().length < 2) return setError('Enter your name');
        if (form.phone.replace(/\D/g, '').length < 10) return setError('Enter a valid phone number with country code');
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) return setError('Enter a valid email');
        setStep('pay');
    }

    async function submitPayment(e) {
        e.preventDefault();
        setError('');
        if (!/^[A-Za-z0-9]{6,40}$/.test(utr.trim().replace(/\s+/g, ''))) return setError('Enter the UPI reference / UTR number shown in your payment app after paying');
        setBusy(true);
        try {
            const res = await fetch('/api/checkout/create-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ planId, mode, ...form, utr }),
            });
            const data = await res.json();
            if (!res.ok || !data.ok) throw new Error(data.error || 'Could not submit. Please try again.');
            router.push(`/buy/success?order_id=${encodeURIComponent(data.orderId)}`);
        } catch (err) {
            setError(err.message);
            setBusy(false);
        }
    }

    return (
        <div className="buy-wrap">
            <style dangerouslySetInnerHTML={{ __html: CSS }} />
            <div className="buy-in">
                <div className="buy-h">
                    <h1>Get your Zyqora license</h1>
                    <p>Pay once for a year by UPI. Your key is activated after we confirm the payment.</p>
                </div>

                {step === 'details' && (
                    <>
                        <div className="buy-grid">
                            {plans.map(p => (
                                <button type="button" key={p.id} className={`plan${p.id === planId ? ' sel' : ''}`} onClick={() => setPlanId(p.id)}>
                                    {p.popular && <span className="pop">MOST POPULAR</span>}
                                    <h3>{p.name}</h3>
                                    <div className="pr">₹{p.price.toLocaleString('en-IN')} <small>/ year</small></div>
                                    <ul>{p.highlights.map(h => <li key={h}>{h}</li>)}</ul>
                                </button>
                            ))}
                        </div>

                        <p className="note" style={{ marginTop: 0, marginBottom: 18 }}>
                            Need more devices or a custom plan? <a href={`https://wa.me/${upi.wa}?text=Hi%2C%20I%20need%20a%20custom%20Zyqora%20plan`} style={{ color: '#25d366' }}>Contact us on WhatsApp</a>
                        </p>

                        <form className="card" onSubmit={goToPay}>
                            <h2>Your details {plan ? `· ${plan.name} · ₹${plan.price.toLocaleString('en-IN')}` : ''}</h2>
                            {error && <div className="err">{error}</div>}
                            <div className="fld">
                                <label>Machine ID (shown in the Zyqora app{mode === 'app' ? ' on your phone' : ''})</label>
                                <input value={form.machineId} onChange={set('machineId')} readOnly={locked} placeholder="e.g. 56F04B1E640F4A2E" maxLength={16} inputMode="text" autoCapitalize="characters" />
                                <div className="hint">{locked ? 'Filled in from the app.' : 'Open Zyqora → License screen → copy the 16-character Machine ID. Your key works only on this device.'}</div>
                            </div>
                            <div className="fld"><label>Full name</label><input value={form.name} onChange={set('name')} placeholder="Your name" /></div>
                            <div className="row2">
                                <div className="fld"><label>Phone (with country code)</label><input value={form.phone} onChange={set('phone')} placeholder="91XXXXXXXXXX" inputMode="tel" /></div>
                                <div className="fld"><label>Email</label><input value={form.email} onChange={set('email')} placeholder="you@example.com" inputMode="email" /></div>
                            </div>
                            <button type="submit" className="pay">Continue to payment →</button>
                        </form>
                    </>
                )}

                {step === 'pay' && plan && (
                    <form className="card" onSubmit={submitPayment}>
                        <button type="button" className="back" onClick={() => { setStep('details'); setError(''); }}>← Change plan or details</button>
                        <h2>Pay ₹{plan.price.toLocaleString('en-IN')} — {plan.name}</h2>

                        <div className="qrbox">
                            <div className="amt">₹{plan.price.toLocaleString('en-IN')}</div>
                            <div className="qr" ref={qrRef} />
                            <div style={{ fontSize: 12.5, color: '#9fb2d6' }}>Scan with any UPI app (GPay, PhonePe, Paytm)</div>
                            <div className="upiid">{upi.id}</div>
                        </div>

                        <a className="btn2" href={upiLink()} style={{ marginBottom: 14 }}>Open a UPI app on this device</a>

                        <ol className="steps">
                            <li>Pay the exact amount ₹{plan.price.toLocaleString('en-IN')} to the UPI ID above.</li>
                            <li>Copy the <b>UPI reference / UTR number</b> your app shows after a successful payment.</li>
                            <li>Paste it below and submit — we verify and activate your key.</li>
                        </ol>

                        {error && <div className="err">{error}</div>}
                        <div className="fld">
                            <label>UPI reference / UTR number</label>
                            <input value={utr} onChange={e => setUtr(e.target.value)} placeholder="e.g. 4312 7765 9921" maxLength={40} />
                            <div className="hint">Found in your payment history as “UPI transaction ID”, “UTR” or “Reference no.”</div>
                        </div>
                        <button type="submit" className="pay" disabled={busy}>{busy ? 'Submitting…' : "I've paid — submit for activation"}</button>
                        <p className="note">Keys are usually activated within a few hours during business time. You'll get it by email and it activates automatically in the app.</p>
                    </form>
                )}
            </div>
        </div>
    );
}

export default function BuyPage() {
    return (
        <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0b1220' }} />}>
            <BuyInner />
        </Suspense>
    );
}
