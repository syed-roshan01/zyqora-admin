# Zyqora Admin — Project Memory Bank

> Last updated: 2026-04-22  
> This file is the single source of truth for understanding the entire zyqora-admin codebase.

---

## 1. Project Overview

**Zyqora Admin** is a Next.js 14 admin panel that manages licenses for a WhatsApp automation desktop app.  
Hosted on **Vercel**. Database is **Vercel KV** (Redis). No SQL, no ORM.

- **Repo:** https://github.com/syed-roshan01/zyqora-admin  
- **Local path:** `C:\Users\toros\OneDrive\Desktop\zyqora-admin`  
- **Dev server:** `npm run dev` → http://localhost:3001

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| UI | React 18, custom CSS (no Tailwind) |
| Database | Vercel KV (`@vercel/kv`) — Redis-backed |
| Auth | JWT via `jose` (HS256, 8h expiry) + `bcryptjs` (cost 12) |
| PDF Export | `jspdf` + `jspdf-autotable` |
| Styling | `app/globals.css` — dark theme, `#0a0d14` background |

---

## 3. Role System

| Role | What They Can Do |
|------|-----------------|
| `super` | Everything — all data globally, manage admins & affiliates, delete licenses, view logs, record withdrawals |
| `admin` | Own scoped data only — generate/revoke/update own licenses, own expenses, view payments & withdrawals |
| `affiliate` | Standalone `/affiliate-dashboard` only — no sidebar, read-only: stats, leads, payment history |

---

## 4. Auth Flow

1. Login → POST `/api/auth/login` — tries admin first, then affiliate
2. Returns `{ token, username, role, name? }`
3. Token stored in `localStorage` as `zyqora_admin_token`
4. User object stored as `zyqora_admin_user`
5. All API calls: `Authorization: Bearer {token}` via `lib/apiFetch.js`
6. On 401: clear localStorage + redirect to `/login`
7. First boot: auto-seeds super admin from env `SUPER_ADMIN_USER` + `SUPER_ADMIN_PASS`
8. Root `app/page.jsx` redirects: affiliate → `/affiliate-dashboard`, others → `/dashboard`

---

## 5. Directory Structure

```
app/
  layout.jsx                    — Root layout, loads globals.css, sets favicon
  page.jsx                      — Root redirect (role-based)
  globals.css                   — ALL styles (dark theme, buttons, cards, modals, etc.)
  login/page.jsx                — Shared login for all roles
  dashboard/page.jsx            — Stats overview + recent licenses
  licenses/page.jsx             — License CRUD + export (2000+ lines)
  sales/page.jsx                — Revenue reports by period/admin
  expenses/page.jsx             — Expense log with edit history
  admins/page.jsx               — Super: admin CRUD + view their licenses
  affiliates/page.jsx           — Super: affiliate CRUD + detail/pay modals
  affiliate-dashboard/page.jsx  — Affiliate standalone portal
  payments/page.jsx             — Payment monitor (super+admin)
  withdrawals/page.jsx          — Withdrawal tracker (super+admin)
  logs/page.jsx                 — Activity log (super only)
  api/                          — All API routes (see Section 8)

components/
  AppLayout.jsx                 — Sidebar + auth guard

lib/
  apiFetch.js   — Client fetch wrapper (auto-auth, 401 redirect)
  auth.js       — signToken, verifyToken, getSession, requireAuth, requireSuper
  kv.js         — All Vercel KV CRUD helpers
  license.js    — Key gen/validation, planToExpiry, PLAN_OPTIONS, PLAN_COLORS
  logs.js       — saveLog, listLogs, clearLogs
```

---

## 6. License Key Format

```
ZYQ-{expiryHex8}-{deviceHex2+hmac6}-{hmac8}-{hmac8}
```

- Signed with HMAC-SHA256 using `LICENSE_SECRET` env var
- `expiryHex` = unix timestamp as 8-char hex (uppercase)
- `deviceHex` = device limit as 2-char hex
- Lifetime = `expiryTs === 0xFFFFFFFF`

### Plans

| Plan | Duration |
|------|---------|
| `trial1day` | 1 day |
| `trial` | 3 days |
| `weekly` | 7 days |
| `monthly` | 30 days |
| `3months` | 90 days |
| `6months` | 180 days |
| `yearly` | 365 days |
| `lifetime` | Forever |
| `custom` | Specify days |

---

## 7. KV Data Model (Redis Keys)

```
admin:{id}                        — Admin object
admin:u:{username_lower}          — Maps username → id
admins                            — Set of all admin ids

license:{KEY}                     — License object
licenses                          — Set of all license keys
licenses:admin:{adminId}          — Set of license keys per admin

expense:{id}                      — Expense object
expenses                          — Set of all expense ids
expenses:admin:{adminId}          — Set of expense ids per admin

affiliate:{id}                    — Affiliate object
affiliate:u:{username_lower}      — Maps username → id
affiliates                        — Set of all affiliate ids

payment:{id}                      — Payment object (affiliate payout)
payments                          — Set of all payment ids
payments:affiliate:{affiliateId}  — Set of payment ids per affiliate

withdrawal:{id}                   — Withdrawal object (admin profit withdrawal)
withdrawals                       — Set of all withdrawal ids
withdrawals:admin:{adminId}       — Set of withdrawal ids per admin

log:{id}                          — Log entry object
logs_list                         — Redis list (lpush, ltrim 1000)
```

---

## 8. API Routes Reference

### Auth
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/login` | Public | Login; tries admin then affiliate |
| GET | `/api/auth/me` | Any | Current user profile |

### Licenses
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/licenses/generate` | Any | Generate new license; saves `affiliateCommissionAmount` |
| GET | `/api/licenses/list` | Any | List (role-filtered) |
| POST | `/api/licenses/revoke` | Any | Revoke; admin=own only, super=any |
| POST | `/api/licenses/delete` | Super | Hard delete; logs warning if price > 0 |
| POST | `/api/licenses/update` | Any | Edit client/price/features; admin=own only |
| POST | `/api/licenses/validate` | **Public** | Called by desktop app on startup |
| POST | `/api/licenses/convert` | Any | Convert trial/free → paid; revokes old, creates new |

### Admins (super only)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/admins/create` | Create admin account |
| GET | `/api/admins/list` | List all admins + license count |
| POST | `/api/admins/[id]/toggle` | Activate/deactivate (no self-deactivation) |
| POST | `/api/admins/[id]/change-password` | Change password (min 6 chars) |
| GET | `/api/admins/[id]/licenses` | Admin's issued licenses |
| POST | `/api/admins/[id]/update-share` | Set `sharePercent` (0–100) |

### Affiliates
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/affiliates/create` | Super | Create affiliate account |
| GET | `/api/affiliates/list` | Admin/Super | List affiliates |
| GET | `/api/affiliates/stats` | Affiliate/Super | Stats (affiliate=own, super=`?affiliateId=X`) |
| POST | `/api/affiliates/[id]/toggle` | Super | Activate/deactivate |
| POST | `/api/affiliates/[id]/change-password` | Super | Change password |
| POST | `/api/affiliates/[id]/update-commission` | Super | Set commission % |
| POST | `/api/affiliates/[id]/pay` | Admin/Super | Record payout |
| GET | `/api/affiliates/[id]/payments` | Any auth | Payments (affiliate=own, others=any) |
| POST | `/api/affiliates/[id]/delete` | Super | Delete affiliate |
| GET | `/api/affiliates/payments/list` | Admin/Super | All payments across all affiliates |
| PUT | `/api/affiliates/payments/[id]` | Admin/Super | Edit payment amount/note/date |

### Financial
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/sales` | Any | Price > 0 licenses (role-filtered) |
| GET | `/api/expenses` | Any | Expenses (role-filtered) |
| POST | `/api/expenses` | Any | Create expense |
| PATCH | `/api/expenses` | Any | Edit expense (admin=own, super=any); snapshots `originalValues` |
| GET | `/api/stats` | Admin/Super | Global financial summary |
| GET | `/api/withdrawals` | Any | Withdrawals (super=all, admin=own) |
| POST | `/api/withdrawals` | Super | Record withdrawal |
| PUT | `/api/withdrawals/[id]` | Super | Edit withdrawal |

### Logs
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/logs` | Super | Last 300 log entries |
| DELETE | `/api/logs` | Super | Wipe all logs |

---

## 9. Key Business Logic

### Revenue Basis Formula
```
totalRevenueBasis = totalRevenue(non-revoked, price > 0)
                  − totalExpenses
                  − affiliateCommissions
```

### Money Left (Business)
```
moneyLeft = totalRevenueBasis − allWithdrawn(all admins)
```

### Admin Balance Owed
```
balanceOwed = totalRevenueBasis × sharePercent% − totalWithdrawn[adminId]
```

### Money Left (Dashboard — super)
```
actualCash = totalRevenue − totalExpenses − totalWithdrawn − totalAffiliatePaid
```

### Affiliate Commission
- Stored as `affiliateCommissionAmount` on the license at generate/convert time
- Fallback: `price × affiliateCommission% / 100` (if stored value is 0)
- `discountedPrice` is used as the revenue basis for commission (if > 0)

### License Conversion Flow
1. POST `/api/licenses/convert` with `{ oldKey, plan, price, ... }`
2. Old trial license → revoked with `revokedReason: "Converted to X plan (key: NEW)"`
3. New paid license created inheriting all client data + same `machineId`
4. `convertedFromKey` set on new license
5. Converted-origin revoked licenses **hidden** from affiliate stats and licenses page

### Validation Exception Mode
- Per-license flag: `validationException: true`
- Allows re-binding to a new machine without issuing a new key
- Stores `exceptionBoundMachineId` on first re-bind
- Set via license update (`/api/licenses/update`)

---

## 10. Object Shapes

### License Object
```js
{
  key, plan, deviceLimit, expiryTs, isLifetime,
  price, discountedPrice, discountAmount,
  machineId, clientName, clientPhone, clientEmail,
  businessCategory, website, notes,
  features: { mobile, trustBuilder, autoReply, chatbot, liveChat, groupGrabber, aiAutomation, forms },
  affiliateId, affiliateName, affiliateCommissionAmount,
  issuedBy, issuedByName, issuedAt,
  activated, activatedAt,
  revoked, revokedBy, revokedByName, revokedAt, revokedReason,
  convertedFromKey,              // set when created via convert
  validationException,           // optional: super-set exception mode
  exceptionBoundMachineId,       // set on re-bind in exception mode
}
```

### Admin Object
```js
{
  id, username, passwordHash, role,  // 'super' | 'admin'
  active, sharePercent,              // sharePercent: 0-100
  createdBy, createdByName, createdAt,
}
```

### Affiliate Object
```js
{
  id, username, name, passwordHash, commission,  // commission: 0-100 (%)
  active, createdBy, createdByName, createdAt,
}
```

### Expense Object
```js
{
  id, title, amount, category, location, notes,
  spentBy, spentByName, spentAt, createdAt,
  editedAt, editedBy, editedByName,  // set on PATCH
  originalValues,                    // snapshot of old values before edit
}
```

### Payment Object (affiliate payout)
```js
{
  id,  // pay_{Date.now()}_{random6}
  affiliateId, affiliateName, amount, note,
  paidBy, paidByName, paidAt,        // paidAt: unix timestamp
  updatedAt, updatedBy, updatedByName,  // set on PUT edit
}
```

### Withdrawal Object
```js
{
  id,  // wd_{Date.now()}_{random6}
  adminId, adminUsername, amount, note,
  withdrawnAt, recordedBy, recordedByName, createdAt,
  updatedAt, updatedBy, updatedByName,  // set on PUT edit
}
```

### Log Object
```js
{
  id,  // crypto.randomUUID()
  action,    // 'LICENSE_GENERATED' | 'LICENSE_REVOKED' | 'LICENSE_DELETED' | 'LICENSE_CONVERTED'
  actorId, actorName, actorRole,
  ts,        // unix timestamp
  flag,      // null | 'warning' (red row in logs for deleted paid license)
  meta: { key, clientName, clientPhone, plan, price, discountedPrice, deviceLimit,
          issuedByName, affiliateId, affiliateName, reason }
}
```

---

## 11. Filtering Rules

| Context | Rule |
|---------|------|
| Licenses page | Hides: `l.revoked && l.revokedReason?.startsWith('Converted to')` |
| Affiliate dashboard | Hides all revoked licenses |
| Affiliate stats API | Excludes converted-origin revoked licenses from all counts |
| Sales API | Returns only `price > 0` licenses |
| Stats API | Revenue = non-revoked (`!l.revoked`) + `price > 0` |

---

## 12. Activity Log Events

| Action | Icon | Color | Trigger |
|--------|------|-------|---------|
| `LICENSE_GENERATED` | ✦ | Green | Generate new license |
| `LICENSE_REVOKED` | ⊘ | Amber | Revoke or convert (old key) |
| `LICENSE_DELETED` | ✕ | Red | Hard delete |
| `LICENSE_CONVERTED` | ⇄ | Indigo | Successful conversion |
| (any with `flag:'warning'`) | — | Red row tint | Deleted paid license |

Logs capped at 1000 in Redis list. GET returns last 300. Clear Logs = 3-step confirm.

---

## 13. AppLayout Sidebar Navigation

| Item | Icon | Visible To |
|------|------|-----------|
| Dashboard | ◈ | All (not affiliate) |
| Licenses | ⚿ | All |
| Sales | ₹ | All |
| Expenses | ₹- | All |
| Admins | ⊛ | Super only |
| Affiliates | ◎ | All |
| Payments | ⊕ | All |
| Withdrawals | ↑ | All |
| Logs | ☰ | Super only |

Affiliates use a standalone page (no `AppLayout`).

---

## 14. CSS Classes Reference

### Buttons
`.btn` `.btn-primary` `.btn-danger` `.btn-ghost` `.btn-sm`

### Forms
`.form-group` `.form-label` `.form-input` `.form-select` `.form-textarea` `.form-error` `.form-row`

### Layout
`.page` `.page-body` `.page-header` `.page-title` `.page-subtitle`

### Cards
`.card` `.stats-grid` `.stat-card` `.stat-label` `.stat-value` `.stat-sub`

### Stat Color Modifiers
`.stat-accent` (purple) `.stat-green` `.stat-red` `.stat-blue`

### Badges
`.badge` `.badge-active` `.badge-revoked` `.badge-expired` `.badge-super` `.badge-admin`  
`.badge-plan-trial1day` `.badge-plan-trial` `.badge-plan-weekly` `.badge-plan-monthly`  
`.badge-plan-3months` `.badge-plan-6months` `.badge-plan-yearly` `.badge-plan-lifetime` `.badge-plan-custom`

### Modal
`.modal-overlay` `.modal` `.modal-header` `.modal-body` `.modal-footer`

### Table
`.table-wrap` → `table` `thead` `tbody` `th` `td`

### Sidebar
`.sidebar` `.sidebar-logo` `.sidebar-logo-name` `.sidebar-logo-sub`  
`.sidebar-nav` `.nav-item` `.nav-item.active` `.nav-icon`  
`.sidebar-footer` `.sidebar-user-name` `.sidebar-user-role`

### Utilities
`.empty` — centered placeholder text  
`.mono` — monospace font (license keys)  
`.bold` — font-weight 700

---

## 15. Environment Variables

| Variable | Purpose |
|----------|---------|
| `JWT_SECRET` | JWT signing secret |
| `LICENSE_SECRET` | HMAC key for license key generation |
| `SUPER_ADMIN_USER` | Username for auto-seeded super admin |
| `SUPER_ADMIN_PASS` | Password for auto-seeded super admin |
| `KV_URL` | Vercel KV connection URL |
| `KV_REST_API_URL` | Vercel KV REST endpoint |
| `KV_REST_API_TOKEN` | Vercel KV read-write token |
| `KV_REST_API_READ_ONLY_TOKEN` | Vercel KV read-only token |

---

## 16. Dashboard — Super vs Admin Differences

| Card | Super | Admin |
|------|-------|-------|
| Total Licenses | All licenses | Own licenses |
| Admins | Shows admin count | Hidden |
| Total Revenue | All | Own scoped |
| Money Left | `totalRevenue − expenses − withdrawals − affPaid` (own calc) | Uses `globalStats.moneyLeft` from `/api/stats` |
| Affiliate Commission | Shows `affiliateStillOwed` | Hidden |
| Net After Affiliates | Shows `actualCash − affiliateStillOwed` | Hidden |
| Top Expense Users | Shown | Hidden |

---

## 17. Withdrawals Page — Super vs Admin

**Super view:**
- 3 summary cards: Net Revenue Basis / Total Withdrawn / Money Left
- Per-admin overview grid (Revenue / Share Earned / Withdrawn / Balance Owed + "X% share" button)
- "+ Add Withdrawal" button
- Filterable transaction history table with ✏️ edit

**Admin view:**
- 5 cards: Net Revenue Basis / Share Earned / Withdrawn / Balance Owed / Money Left (Business)
- All values from `globalStats` (global pool, not scoped)
- Own transaction history only

---

## 18. Affiliates Page Columns

Table: `#` | `Name` (→ detail modal) | `Username` | `Commission%` | `Earned` | `Paid Out` | `Balance` | `Status` | `Joined` | `Actions`

Totals row: `Affiliates N | Total Earned ₹X | Paid Out ₹X | Balance Owed ₹X`

**Detail modal:** avatar initial, 4 count stats + 3 financial stats + license table + "Pay Now" footer button  
**Pay modal:** 3 summary boxes (Earned/Paid/Balance) + amount input + optional note

---

## 19. Lib Files Summary

### `lib/apiFetch.js`
- `getToken()` / `setToken(token)` / `clearToken()` — localStorage helpers
- `apiFetch(path, opts)` — wraps fetch with Bearer token; auto-redirects on 401; auto JSON body

### `lib/auth.js`
- `signToken(payload)` → JWT string (8h)
- `verifyToken(token)` → payload or null
- `getTokenFromRequest(req)` → extracts Bearer token from header
- `getSession(req)` → verifies token, returns payload
- `requireAuth(req)` → `{ session }` or `{ error, status }`
- `requireSuper(req)` → same but enforces `role === 'super'`

### `lib/kv.js`
Admin: `getAdmin`, `getAdminByUsername`, `saveAdmin`, `listAdmins`, `getAdminLicenseKeys`  
Licenses: `getLicense`, `saveLicense`, `listAllLicenses`, `listAdminLicenses`, `deleteLicense`  
Expenses: `getExpense`, `saveExpense`, `listAllExpenses`, `listAdminExpenses`  
Affiliates: `getAffiliate`, `getAffiliateByUsername`, `saveAffiliate`, `listAffiliates`, `deleteAffiliate`  
Payments: `getPayment`, `savePayment`, `listAffiliatePayments`, `listAllPayments`  
Withdrawals: `getWithdrawal`, `saveWithdrawal`, `listAllWithdrawals`, `listAdminWithdrawals`  
Stats: `getStats` (basic — total licenses + admin count)

### `lib/license.js`
- `generateKey({ machineId, expiryTs, deviceLimit })` → `ZYQ-...` key string
- `validateKey(key, machineId)` → `{ expiryTs, deviceLimit, valid, isLifetime }` or null
- `planToExpiry(plan, customDays)` → unix timestamp
- `PLAN_OPTIONS` — array of `{ value, label }` for dropdowns
- `PLAN_COLORS` — plan → hex color map

### `lib/logs.js`
- `saveLog(log)` — lpush to `logs_list`, trim to 1000, set `log:{id}`
- `listLogs(limit = 300)` — lrange + parallel get
- `clearLogs()` — deletes all individual `log:{id}` keys + `logs_list`

---

## 20. Known Patterns & Conventions

- All pages use `'use client'` — no server components in page files
- Modals rendered outside `<AppLayout>` using `<>` fragment wrapper
- Date display: `en-IN` locale (`02 Apr 2026` format)
- Money display: `₹` prefix, `en-IN` locale with `toLocaleString`
- Timestamps always stored as **unix seconds** (`Math.floor(Date.now() / 1000)`)
- IDs: `crypto.randomUUID()` for most; `pay_{ts}_{random6}` for payments; `wd_{ts}_{random6}` for withdrawals
- Passwords: bcrypt cost 12, minimum 6 characters
- All form state uses functional updater: `setForm(f => ({ ...f, field: value }))`
- `useMemo` used for derived financial calculations in withdrawals page
- Error state pattern: `const [err, setErr] = useState('')` + `<div className="form-error">{err}</div>`
