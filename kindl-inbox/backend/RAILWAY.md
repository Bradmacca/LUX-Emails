# Railway environment variables

Service: **modest-cooperation**  
Root directory: `kindl-inbox/backend`

## Option A — Railway dashboard (easiest)

1. Open Railway → **modest-cooperation** → **Variables** tab
2. Click **+ New Variable** for each row below
3. Copy values from your local `backend/.env`

| Variable name | Required | Where to get it |
|---------------|----------|-----------------|
| `ANTHROPIC_API_KEY` | Yes | console.anthropic.com |
| `SUPABASE_URL` | Yes | Supabase → Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase → Settings → API → service_role (secret) |
| `STRIPE_SECRET_KEY` | Later | Stripe dashboard |
| `STRIPE_WEBHOOK_SECRET` | Later | Stripe webhook settings |
| `STRIPE_PRICE_ID_PRO` | Later | Stripe product price ID |

4. Click **Deploy** (or wait for auto-redeploy)

**Do not** add `PORT` — Railway sets it automatically.

## Option B — CLI script (bulk upload from .env)

```powershell
cd kindl-inbox/backend
npx @railway/cli login
npx @railway/cli link
.\set-railway-vars.ps1
```

Then redeploy in Railway.

## Verify

Open `https://api.usekindl.xyz` — should return:

```
Kindl Inbox API — usekindl.com
```

Test analysis by updating `extension/.env`:

```
VITE_API_BASE_URL=https://api.usekindl.xyz
```

Rebuild extension: `npm run build` in `kindl-inbox/extension`
