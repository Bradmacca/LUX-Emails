# Chrome Web Store Assets

Place the following files here before submitting to the Chrome Web Store.

## Required

| File | Size | Notes |
|------|------|-------|
| `icon16.png` | 16×16 px | Extension toolbar icon (small) |
| `icon48.png` | 48×48 px | Extensions management page icon |
| `icon128.png` | 128×128 px | Chrome Web Store listing icon |
| `screenshot-1.png` | 1280×800 px | Sidebar open with email analysis visible |
| `screenshot-2.png` | 1280×800 px | Reply drafts with Copy button |
| `screenshot-3.png` | 1280×800 px | Sign-in popup (Google + email options) |
| `screenshot-4.png` | 1280×800 px | Free-tier upgrade prompt |
| `promo-small.png` | 440×280 px | Small promotional tile |
| `promo-large.png` | 920×680 px | Large promotional tile (marquee) |

## Store listing copy

**Name:** Kindl Inbox

**Short description (up to 132 chars):**
AI email analyser and reply generator for Gmail. Get tone, intent, urgency analysis + 3 reply drafts in one click.

**Detailed description:**
Kindl Inbox adds a smart AI sidebar to Gmail that analyses every email you open and suggests three ready-to-send reply drafts.

**What you get:**
- Instant analysis: tone (friendly/formal/urgent), intent summary, urgency level, and key points
- Three reply options: Short & direct / Professional / Detailed — copy with one click
- Powered by Anthropic Claude (Haiku for free users, Sonnet for Pro)
- Shadow DOM injection — no Gmail CSS conflicts, no data leaks
- Sign in with Google or email

**Pricing:**
- Free: 10 analyses per day
- Pro ($9/mo): unlimited analyses with Claude Sonnet

**Privacy:** Email text is sent to the Kindl Inbox backend only when you open an email. It is not stored. See usekindl.com/privacy.

## Icons

Add icons to `extension/public/icons/` and reference them in `manifest.json`:

```json
"icons": {
  "16":  "public/icons/icon16.png",
  "48":  "public/icons/icon48.png",
  "128": "public/icons/icon128.png"
}
```

Also add to the `action` section:
```json
"action": {
  "default_popup": "src/popup/index.html",
  "default_title": "Kindl Inbox",
  "default_icon": {
    "16":  "public/icons/icon16.png",
    "48":  "public/icons/icon48.png"
  }
}
```
