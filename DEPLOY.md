# Zyqora Admin Panel — Deploy Guide

## 1. Push to GitHub

Create a new GitHub repo named `zyqora-admin` and push this folder to it.

```bash
git init
git add .
git commit -m "init: zyqora admin panel"
git remote add origin https://github.com/<your-username>/zyqora-admin.git
git push -u origin main
```

---

## 2. Create Vercel Project

1. Go to [vercel.com](https://vercel.com) → **Add New → Project**
2. Import your `zyqora-admin` GitHub repo
3. Framework preset: **Next.js** (auto-detected)
4. Click **Deploy**

---

## 3. Create KV Database

1. In your Vercel project → **Storage** tab
2. Click **Create Database → KV**
3. Name it `zyqora-kv`, select the same region as your project
4. Click **Connect** — this automatically adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` to your project's environment variables

---

## 4. Add Environment Variables

In Vercel → Project → **Settings → Environment Variables**, add:

| Variable | Value |
|---|---|
| `JWT_SECRET` | Run `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` and paste the output |
| `SUPER_ADMIN_USER` | `toros` (or your chosen username) |
| `SUPER_ADMIN_PASS` | A strong password you'll use to log in |
| `LICENSE_SECRET` | `Zyq$7mKp9xLv2WnBd5tYs6hJfQe1cR8uAoVz3TGw` (must match Zyqora app's server.js) |

> `KV_REST_API_URL` and `KV_REST_API_TOKEN` are added automatically in Step 3.

---

## 5. Redeploy

After adding env vars → **Deployments → Redeploy** (or push a new commit).

---

## 6. First Login

Visit `https://your-project.vercel.app` → redirected to `/login`.

Enter the username and password from Step 4.

**On first login**, the super admin account is auto-created in KV from your env vars.

---

## 7. Integrate with Zyqora Desktop App (Online Validation)

In `server.js`, replace the local HMAC check with an online call:

```js
const ADMIN_PANEL_URL = 'https://your-project.vercel.app';

async function validateOnline(key, machineId) {
    try {
        const res = await fetch(`${ADMIN_PANEL_URL}/api/licenses/validate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key, machineId }),
            signal: AbortSignal.timeout(8000), // 8s timeout
        });
        return await res.json();
    } catch {
        return null; // offline — fall back to local HMAC check
    }
}
```

Call this in your `/api/license/activate` and `/api/license/status` handlers. If it returns `null` (offline), fall back to the current local HMAC logic.

---

## Roles

| Role | Can do |
|---|---|
| **super** | Everything: create admins, see all licenses, revoke any license |
| **admin** | Generate keys for their own clients, see only their own licenses, revoke their own keys |

---

## Validate Endpoint (called by Zyqora app)

```
POST /api/licenses/validate
Body: { "key": "ZYQ-...", "machineId": "XXXX-XXXX-..." }

Response (valid):
{
  "valid": true,
  "plan": "monthly",
  "deviceLimit": 1,
  "isLifetime": false,
  "daysLeft": 28,
  "secondsLeft": 2419200,
  "expiry": "2025-08-01T00:00:00.000Z"
}

Response (invalid):
{ "valid": false, "error": "Key has been revoked" }
```
