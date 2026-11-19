import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
process.env.JWT_SECRET = 'test-secret-for-jwt-0123456789'; process.env.WA_RELAY_SECRET = 'relay-secret-for-tests-0123456789'; process.env.NODE_ENV = 'test';
delete process.env.META_APP_SECRET; delete process.env.META_WEBHOOK_VERIFY_TOKEN;

const { kv, stats, _reset } = await import('./kv-mock.mjs');
const { signToken } = await import('../lib/auth.js');
const { generateKey } = await import('../lib/license.js');
const { PLANS } = await import('../lib/plans.js');

const reg = await import('../app/api/wa-relay/register/route.js');
const unreg = await import('../app/api/wa-relay/unregister/route.js');
const pull = await import('../app/api/wa-relay/pull/route.js');
const hook = await import('../app/api/wa-relay/hook/[id]/route.js');
const glob = await import('../app/api/wa-relay/global/route.js');
const sub = await import('../app/api/wa-onboarding/submit/route.js');
const stat = await import('../app/api/wa-onboarding/status/route.js');
const resp = await import('../app/api/wa-onboarding/respond/route.js');
const canc = await import('../app/api/wa-onboarding/cancel/route.js');
const cfgR = await import('../app/api/wa-onboarding/config/route.js');
const admList = await import('../app/api/wa-onboarding/admin/route.js');
const admOne = await import('../app/api/wa-onboarding/admin/[id]/route.js');
const relAdmin = await import('../app/api/wa-relay/admin/route.js');

const MID = 'A1B2C3D4E5F60718';
const KEY = generateKey({ machineId: MID, expiryTs: Math.floor(Date.now() / 1000) + 86400 * 365, deviceLimit: 1 });
const req = (url, { method = 'POST', body, headers = {}, raw } = {}) => new Request('http://localhost' + url, { method, headers: { 'content-type': 'application/json', ...headers }, body: raw !== undefined ? raw : body ? JSON.stringify(body) : undefined });
const call = async (fn, r, params) => { const res = await fn(r, params ? { params } : undefined); const text = await res.text(); let j = null; try { j = JSON.parse(text); } catch {} return { status: res.status, json: j, text }; };
const tok = async (role, sub = role + '-1') => ({ Authorization: 'Bearer ' + (await signToken({ sub, username: role + 'user', role })) });
const goodForm = () => ({ businessLegalName: 'Acme Pvt Ltd', businessEmail: 'ops@acme.in', country: 'India', contactPhone: '+91 99999 00000', businessCategory: 'Retail', consent: true, notes: 'Need help', website: 'acme.in' });

test.beforeEach(async () => {
    _reset();
    await kv.set(`license:${KEY}`, { key: KEY, licenseMode: 'desktop', revoked: false, clientName: 'Acme', features: { officialApi: true }, issuedBy: 'x' });
    await kv.set('admin:admin-1', { id: 'admin-1', username: 'adminuser', name: 'Priya', active: true });
});

test('plans: Official API flag is plan-configurable (Starter off, Growth/Pro on)', () => {
    assert.equal(PLANS.starter.features.officialApi, false); assert.equal(PLANS.growth.features.officialApi, true); assert.equal(PLANS.pro.features.officialApi, true);
});

test('relay: register requires a real license; revoked/forged/wrong-machine rejected; plan flag respected', async () => {
    assert.equal((await call(reg.POST, req('/', { body: { licenseKey: 'nope', machineId: MID, wabaId: '1111111', phoneNumberId: '2222222' } }))).status, 400);
    assert.equal((await call(reg.POST, req('/', { body: { licenseKey: KEY, machineId: 'FFFFFFFFFFFFFFFF', wabaId: '1111111', phoneNumberId: '2222222' } }))).status, 403);
    await kv.set(`license:${KEY}`, { key: KEY, licenseMode: 'desktop', revoked: true });
    assert.equal((await call(reg.POST, req('/', { body: { licenseKey: KEY, machineId: MID, wabaId: '1111111', phoneNumberId: '2222222' } }))).status, 403);
    await kv.set(`license:${KEY}`, { key: KEY, licenseMode: 'desktop', features: { officialApi: false } });
    assert.equal((await call(reg.POST, req('/', { body: { licenseKey: KEY, machineId: MID, wabaId: '1111111', phoneNumberId: '2222222' } }))).status, 403);
});

async function register() {
    const r = await call(reg.POST, req('/', { body: { licenseKey: KEY, machineId: MID, wabaId: '1111111', phoneNumberId: '2222222' } })); assert.equal(r.status, 200, r.text); return r.json;
}
const sig = (body) => 'sha256=' + crypto.createHmac('sha256', 'whatever-app-secret').update(body).digest('hex');
const post = (id, body, headers) => call(hook.POST, req('/', { raw: body, headers: { 'x-hub-signature-256': sig(body), ...headers } }), { id });

test('relay: Meta verification handshake + mailbox store/pull/ack; the relay never needs or sees an App Secret', async () => {
    const r = await register(); assert.match(r.callbackUrl, /\/api\/wa-relay\/hook\//); assert.equal((await register()).bindingId, r.bindingId);      // idempotent
    const ok = await hook.GET(req(`/?hub.mode=subscribe&hub.verify_token=${r.verifyToken}&hub.challenge=12345`, { method: 'GET' }), { params: { id: r.bindingId } });
    assert.equal(ok.status, 200); assert.equal(await ok.text(), '12345');
    assert.equal((await hook.GET(req(`/?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=1`, { method: 'GET' }), { params: { id: r.bindingId } })).status, 403);
    const b1 = JSON.stringify({ object: 'whatsapp_business_account', entry: [{ id: '1111111' }] });
    assert.equal((await post(r.bindingId, b1)).status, 200); assert.equal((await post(r.bindingId, b1 + ' ')).status, 200);
    let p = await call(pull.POST, req('/', { body: { bindingId: r.bindingId, pullSecret: r.pullSecret } }));
    assert.equal(p.json.count, 2); assert.equal(p.json.events[0].body, b1); assert.match(p.json.events[0].sig, /^sha256=/); assert.equal(p.json.nextPollSec, 15);
    p = await call(pull.POST, req('/', { body: { bindingId: r.bindingId, pullSecret: r.pullSecret, ack: 2, streak: 0 } }));       // ack removes what was handled
    assert.equal(p.json.count, 0); assert.equal(p.json.nextPollSec, 30);
    assert.equal((await call(pull.POST, req('/', { body: { bindingId: r.bindingId, pullSecret: r.pullSecret, streak: 50 } }))).json.nextPollSec, 600);   // idle backoff protects the free tier
    assert.equal((await call(pull.POST, req('/', { body: { bindingId: r.bindingId, pullSecret: r.pullSecret, streak: 50, active: true } }))).json.nextPollSec, 30);  // just sent something => quicker
});

test('relay: hostile traffic is rejected WITHOUT touching KV (forged ids, bad secrets); oversize/bad-signature-header refused', async () => {
    const r = await register(); const before = stats.commands;
    assert.equal((await post('forged.id', '{}')).status, 403);
    assert.equal((await post(r.bindingId.split('.')[0] + '.' + '0'.repeat(20), '{}')).status, 403);
    assert.equal((await call(pull.POST, req('/', { body: { bindingId: r.bindingId, pullSecret: 'x'.repeat(64) } }))).status, 403);
    assert.equal((await call(pull.POST, req('/', { body: { bindingId: 'forged.id', pullSecret: r.pullSecret } }))).status, 403);
    assert.equal(stats.commands, before, 'forged requests consumed KV commands');
    assert.equal((await call(hook.POST, req('/', { raw: '{}', headers: { 'x-hub-signature-256': 'nope' } }), { id: r.bindingId })).status, 400);
    assert.equal((await call(hook.POST, req('/', { raw: 'x'.repeat(300 * 1024), headers: { 'x-hub-signature-256': sig('x') } }), { id: r.bindingId })).status, 413);
    const idle = stats.commands; await call(pull.POST, req('/', { body: { bindingId: r.bindingId, pullSecret: r.pullSecret, seq: 1 } })); assert.equal(stats.commands - idle, 1, 'an idle poll must cost exactly one KV command');
});

test('relay: queue is capped (oldest dropped), unregister revokes and deletes the mailbox, revoked pollers are told', async () => {
    const r = await register(); for (let i = 0; i < 210; i++) await post(r.bindingId, JSON.stringify({ n: i }));
    const p = await call(pull.POST, req('/', { body: { bindingId: r.bindingId, pullSecret: r.pullSecret } })); assert.equal(p.json.count, 50);
    assert.equal(await kv.llen(`walr:q:${r.bindingId}`), 200); assert.equal(JSON.parse(p.json.events[0].body).n, 10);
    assert.equal((await call(unreg.POST, req('/', { body: { bindingId: r.bindingId, pullSecret: 'bad' } }))).status, 403);
    assert.equal((await call(unreg.POST, req('/', { body: { bindingId: r.bindingId, pullSecret: r.pullSecret } }))).status, 200);
    assert.equal(await kv.llen(`walr:q:${r.bindingId}`), 0);
    assert.equal((await call(pull.POST, req('/', { body: { bindingId: r.bindingId, pullSecret: r.pullSecret, seq: 5 } }))).status, 403);
});

test('relay: the Zyqora-app (Tech Provider) endpoint is OFF until configured, then verifies signatures and routes by WABA', async () => {
    assert.equal((await glob.GET(req('/?hub.mode=subscribe', { method: 'GET' }))).status, 404); assert.equal((await call(glob.POST, req('/', { raw: '{}' }))).status, 404);
    process.env.META_APP_SECRET = 'meta-secret-xyz'; process.env.META_WEBHOOK_VERIFY_TOKEN = 'vt-123';
    try {
        const r = await register(); const body = JSON.stringify({ object: 'whatsapp_business_account', entry: [{ id: '1111111', changes: [] }] });
        assert.equal((await call(glob.POST, req('/', { raw: body, headers: { 'x-hub-signature-256': sig(body) } }))).status, 403);
        const good = 'sha256=' + crypto.createHmac('sha256', 'meta-secret-xyz').update(body).digest('hex');
        assert.equal((await call(glob.POST, req('/', { raw: body, headers: { 'x-hub-signature-256': good } }))).status, 200);
        assert.equal(await kv.llen(`walr:q:${r.bindingId}`), 1);
        assert.equal(await (await glob.GET(req('/?hub.mode=subscribe&hub.verify_token=vt-123&hub.challenge=77', { method: 'GET' }))).text(), '77');
    } finally { delete process.env.META_APP_SECRET; delete process.env.META_WEBHOOK_VERIFY_TOKEN; }
});

test('onboarding: submit validates, refuses credentials, requires license+machine, blocks duplicates', async () => {
    const b = (o = {}) => ({ licenseKey: KEY, machineId: MID, form: { ...goodForm(), ...o } });
    assert.equal((await call(sub.POST, req('/', { body: { ...b(), machineId: 'FFFFFFFFFFFFFFFF' } }))).status, 403);
    assert.equal((await call(sub.POST, req('/', { body: b({ businessLegalName: '' }) }))).status, 400);
    assert.equal((await call(sub.POST, req('/', { body: b({ consent: false }) }))).status, 400);
    assert.equal((await call(sub.POST, req('/', { body: b({ businessEmail: 'bad' }) }))).status, 400);
    for (const secret of ['my password is hunter2', 'OTP: 123456', 'token EAAGm0PX4ZCpsBAJ1234567890abcdefghij', 'recovery code = abc']) {
        const r = await call(sub.POST, req('/', { body: b({ notes: secret }) })); assert.equal(r.status, 400, secret); assert.match(r.json.error, /passwords, OTPs/);
    }
    const ok = await call(sub.POST, req('/', { body: b() })); assert.equal(ok.status, 201); assert.equal(ok.json.request.status, 'request_submitted'); assert.equal(ok.json.request.steps.find((s) => s.state === 'current').key, 'request_submitted');
    assert.equal((await call(sub.POST, req('/', { body: b() }))).status, 409);
});

test('onboarding: RBAC — whitelabel/affiliate/no-token refused; admin can work requests; suspend/disconnect/config are super-only', async () => {
    const created = await call(sub.POST, req('/', { body: { licenseKey: KEY, machineId: MID, form: goodForm() } })); const id = (await kv.smembers('waob:all'))[0];
    for (const role of ['whitelabel', 'affiliate']) { const h = await tok(role); assert.equal((await call(admList.GET, req('/', { method: 'GET', headers: h }))).status, 403); assert.equal((await call(admOne.PATCH, req('/', { method: 'PATCH', headers: h, body: { action: 'note', text: 'x' } }), { id })).status, 403); assert.equal((await call(relAdmin.GET, req('/', { method: 'GET', headers: h }))).status, 403); }
    assert.equal((await call(admList.GET, req('/', { method: 'GET' }))).status, 401); assert.equal((await call(admOne.GET, req('/', { method: 'GET' }), { id })).status, 401);
    const A = await tok('admin', 'admin-1'), S = await tok('super', 'super-1');
    assert.equal((await call(admList.GET, req('/', { method: 'GET', headers: A }))).json.total, 1);
    assert.equal((await call(admOne.PATCH, req('/', { method: 'PATCH', headers: A, body: { action: 'suspend', reason: 'x' } }), { id })).status, 403);
    assert.equal((await call(admOne.PATCH, req('/', { method: 'PATCH', headers: A, body: { action: 'disconnect' } }), { id })).status, 403);
    assert.equal((await call(cfgR.PUT, req('/', { method: 'PUT', headers: A, body: { statuses: {} } }))).status, 403);
    assert.equal((await call(admOne.PATCH, req('/', { method: 'PATCH', headers: S, body: { action: 'suspend', reason: 'review' } }), { id })).status, 200);
    assert.equal((await call(cfgR.PUT, req('/', { method: 'PUT', headers: S, body: { statuses: { under_review: { label: 'In Review', description: 'Custom text', nextStep: 'n', customerAction: null } } } }))).status, 200);
    assert.equal((await call(cfgR.GET, req('/', { method: 'GET', headers: A }))).json.statuses.find((s) => s.key === 'under_review').label, 'In Review');
});

test('onboarding: admin workflow — assign, status guard for Connected, request info -> customer reply, IDs, audit history; internal notes NEVER reach the customer', async () => {
    await call(sub.POST, req('/', { body: { licenseKey: KEY, machineId: MID, form: goodForm() } })); const id = (await kv.smembers('waob:all'))[0]; const A = await tok('admin', 'admin-1');
    const patch = (body) => call(admOne.PATCH, req('/', { method: 'PATCH', headers: A, body }), { id });
    assert.equal((await patch({ action: 'assign', adminId: 'me' })).json.request.assignedTo.name, 'Priya'); assert.equal((await patch({ action: 'assign', adminId: 'ghost' })).status, 400);
    assert.equal((await patch({ action: 'status', status: 'bogus' })).status, 400);
    assert.equal((await patch({ action: 'status', status: 'connected' })).status, 400);                                    // needs IDs first
    assert.equal((await patch({ action: 'ids', ids: { wabaId: 'abc' } })).status, 400);
    assert.equal((await patch({ action: 'ids', ids: { wabaId: '1111111', phoneNumberId: '2222222', businessPortfolioId: '3333333', verificationApprovedAt: '2026-11-01' } })).status, 200);
    await patch({ action: 'note', visibility: 'internal', text: 'INTERNAL-ONLY-SECRET-NOTE customer is difficult' });
    await patch({ action: 'note', visibility: 'customer', text: 'Please keep your phone nearby.' });
    assert.equal((await patch({ action: 'note', visibility: 'customer', text: 'my password: abc' })).status, 400);
    await patch({ action: 'failed_attempt', message: 'Meta rejected docs (internal)' }); await patch({ action: 'retry', message: 'resubmitted' });
    await patch({ action: 'request_info', message: 'Please upload a clearer certificate.' });
    let s = await call(stat.POST, req('/', { body: { licenseKey: KEY, machineId: MID } })); const v = s.json.request;
    assert.equal(v.status, 'awaiting_customer_info'); assert.equal(v.customerAction, 'Please upload a clearer certificate.'); assert.equal(v.assignedAgent, 'Priya');
    assert.deepEqual(v.notes.map((n) => n.text), ['Please keep your phone nearby.']);
    for (const leak of ['INTERNAL-ONLY', 'Meta rejected docs', 'admin-1', 'failedAttempts', 'internal', 'licenseKey', 'machineId']) assert.ok(!s.text.includes(leak), 'customer view leaked: ' + leak);
    const r = await call(resp.POST, req('/', { body: { licenseKey: KEY, machineId: MID, message: 'Uploaded the new certificate.' } })); assert.equal(r.json.request.status, 'under_review');
    assert.equal((await call(resp.POST, req('/', { body: { licenseKey: KEY, machineId: MID, message: 'password: 1234' } }))).status, 400);
    assert.equal((await patch({ action: 'status', status: 'connected', reason: 'verified in test', customerNote: 'You are live!' })).status, 200);
    const full = (await call(admOne.GET, req('/', { method: 'GET', headers: A }), { id })).json.request;
    assert.ok(full.history.some((h) => h.type === 'status' && h.to === 'connected' && h.byName === 'adminuser')); assert.ok(full.history.length >= 9); assert.equal(full.retries, 1);
    assert.ok(JSON.stringify(full.notes).includes('INTERNAL-ONLY'));                                                         // admins DO see internal notes
    assert.equal((await call(canc.POST, req('/', { body: { licenseKey: KEY, machineId: MID } }))).status, 409);            // connected cannot be cancelled by customer
});

test('onboarding: customer can cancel then resubmit; filters and search work; whitelabel cannot reach relay admin', async () => {
    await call(sub.POST, req('/', { body: { licenseKey: KEY, machineId: MID, form: goodForm() } }));
    assert.equal((await call(canc.POST, req('/', { body: { licenseKey: KEY, machineId: MID } }))).json.request.status, 'cancelled');
    assert.equal((await call(sub.POST, req('/', { body: { licenseKey: KEY, machineId: MID, form: goodForm() } }))).status, 201);
    const A = await tok('admin', 'admin-1');
    assert.equal((await call(admList.GET, req('/?status=request_submitted', { method: 'GET', headers: A }))).json.total, 1);
    assert.equal((await call(admList.GET, req('/?q=acme', { method: 'GET', headers: A }))).json.total, 2); assert.equal((await call(admList.GET, req('/?q=zzz', { method: 'GET', headers: A }))).json.total, 0);
    assert.equal((await call(admList.GET, req('/?assignee=unassigned', { method: 'GET', headers: A }))).json.total, 2);
    const ra = await call(relAdmin.GET, req('/', { method: 'GET', headers: A })); assert.equal(ra.status, 200); assert.ok(!ra.text.includes('pullSecret'));
});
