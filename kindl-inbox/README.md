# Kindl Inbox

A Chrome Extension (Manifest V3) that injects an AI-powered email analyser and reply generator into Gmail, acting as a lead magnet for [UseKindl](https://usekindl.com).

## What it does

When you open an email in Gmail, a 340px sidebar panel slides in on the right with:

- **AI analysis** — tone, intent, urgency, and key points (powered by Claude)
- **Three reply drafts** — Short & direct / Professional / Detailed, each with a one-click Copy button
- **Save to UseKindl** — placeholder for Phase 2

Free tier: 3 analyses per day (claude-haiku). Pro tier ($9/mo): unlimited (claude-sonnet).

## Tech stack

| Layer      | Technology |
|------------|-----------|
| Extension  | React 18 + Vite 5 + CRXJS (Manifest V3) |
| Backend    | Hono on Vercel serverless (zero-config deploy) |
| AI         | Anthropic Claude (haiku-4-5 free / sonnet-4-5 pro) |
| Auth       | Supabase — Google OAuth (PKCE) + email OTP |
| Payments   | Stripe subscription ($9/mo Pro) |
| Database   | Supabase Postgres (profiles, usage, auth_pending) |

## Project structure

```
kindl-inbox/
├── shared/                       # Shared TypeScript types (AnalyseRequest, AnalyseResponse, …)
├── extension/                    # Chrome extension
│   ├── manifest.json
│   ├── vite.config.ts
│   └── src/
│       ├── content/              # Content script: Gmail observer + Shadow DOM mount
│       ├── sidebar/              # React sidebar component (all UI states + CSS)
│       ├── popup/                # Toolbar popup (sign-in, usage badge, upgrade CTA)
│       ├── background/           # Service worker: auth proxy + API calls
│       └── lib/                  # Supabase client, messaging types
└── backend/                      # Vercel serverless API
    ├── src/
    │   ├── index.ts              # Hono app entry (all routes mounted here)
    │   ├── routes/               # analyse, usage, checkout, auth, webhooks
    │   └── lib/                  # auth.ts, claude.ts, usage.ts, supabase.ts
    ├── public/auth/callback.html # Magic-link relay page
    └── supabase/migrations/      # SQL migration (run once in Supabase SQL editor)
```

## Getting started

### Prerequisites

- Node.js 18+
- [Vercel CLI](https://vercel.com/docs/cli): `npm i -g vercel`
- Supabase project (free tier works)
- Anthropic API key
- Stripe account (optional for development)

### 1. Install dependencies

```bash
cd kindl-inbox
npm install
```

### 2. Environment variables

Copy and fill in both `.env.example` files:

```bash
cp extension/.env.example extension/.env
cp backend/.env.example   backend/.env
```

**`extension/.env`**
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_API_BASE_URL=http://localhost:3000
```

**`backend/.env`**
```
ANTHROPIC_API_KEY=sk-ant-...
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_PRO=price_...
```

### 3. Run the Supabase migration

Open your Supabase project → SQL Editor → paste the contents of
`backend/supabase/migrations/001_initial.sql` and run it.

### 4. Start the backend

```bash
npm run dev:backend
# Starts Hono API at http://localhost:3000 via Vercel CLI
```

### 5. Build and load the extension

```bash
npm run dev:extension
# Builds to extension/dist/ with HMR
```

In Chrome:

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select `extension/dist`
4. Note the Extension ID shown (e.g. `abcdefghijklmnop…`)

### 6. Configure Supabase auth

**Google OAuth:**

1. Create a Google Cloud OAuth 2.0 client ID (Web application type)
2. Authorised redirect URI: `https://<your-project>.supabase.co/auth/v1/callback`
3. In Supabase Dashboard → Authentication → Providers → Google: paste Client ID + Secret
4. In Supabase → Auth → URL Configuration → Redirect URLs: add  
   `https://<extension-id>.chromiumapp.org/*`

**Email OTP (6-digit codes):**

1. Supabase Dashboard → Authentication → Email
2. Enable **"Email OTP"** and set OTP length to **6**

### 7. Deploy to production

```bash
cd backend && vercel deploy --prod
# Note the deployment URL (e.g. https://kindl-inbox-api.vercel.app)
```

Update `extension/.env`:
```
VITE_API_BASE_URL=https://kindl-inbox-api.vercel.app
```

Rebuild the extension:
```bash
cd extension && npm run build
```

Submit `extension/dist` to the Chrome Web Store.

## Stripe setup

1. Create a Product in Stripe with a monthly recurring price of $9
2. Copy the price ID (`price_xxx`) → `STRIPE_PRICE_ID_PRO`
3. Create a webhook in Stripe Dashboard pointing to  
   `https://your-api.vercel.app/api/webhooks/stripe`
4. Subscribe to events: `checkout.session.completed`,  
   `customer.subscription.updated`, `customer.subscription.deleted`
5. Copy the webhook signing secret → `STRIPE_WEBHOOK_SECRET`

## Gmail DOM selectors

Gmail's class names change without notice. All selectors are centralised in
`extension/src/content/gmailSelectors.ts`. If the sidebar stops detecting emails,
check that file first and update the selectors by inspecting Gmail's DOM.

## Claude models

| Tier | Model ID |
|------|---------|
| Free | `claude-haiku-4-5-20251001` |
| Pro  | `claude-sonnet-4-5-20250929` |

Update model IDs in `backend/src/lib/claude.ts` as Anthropic releases newer versions.

## Architecture

```
Gmail tab                      Chrome Extension               Vercel Backend
──────────────────────         ──────────────────────         ──────────────────
Content script                 Background service worker       POST /api/analyse
  MutationObserver    ──msg──▶  reads JWT from storage  ──▶    verifyAuth (Supabase)
  extract email text             fetch() with Bearer           getTodayUsage
  mount shadow DOM               handle 401/429/200            analyseEmail (Claude)
  render <Sidebar />  ◀──res──  sendResponse                  incrementUsage
                                                               ──────────────────
Popup page                                                     GET  /api/usage
  Google OAuth        ──msg──▶  chrome.identity               POST /api/checkout (Stripe)
  Email OTP                     launchWebAuthFlow              POST /api/webhooks/stripe
  usage badge                   verifyOtp                      GET  /api/auth/pending
  sign out                      chrome.storage.local
```
