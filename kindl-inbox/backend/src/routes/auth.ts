import { Hono } from 'hono'
import { createServiceClient } from '../lib/supabase'

const app = new Hono()

// POST /api/auth/complete
// Called by the magic-link relay page after exchanging the auth code.
// Stores a short-lived session keyed by a client-generated `state` string
// so the extension popup can poll for it.
app.post('/complete', async (c) => {
  let body: { state?: string; access_token?: string; refresh_token?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const { state, access_token, refresh_token } = body
  if (!state || !access_token) {
    return c.json({ error: 'Missing state or access_token' }, 400)
  }

  const supabase = createServiceClient()
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()

  const { error } = await supabase.from('auth_pending').upsert({
    state,
    access_token,
    refresh_token: refresh_token ?? null,
    expires_at: expiresAt,
  })

  if (error) {
    console.error('[auth/complete] Supabase error:', error)
    return c.json({ error: 'Failed to store session' }, 500)
  }

  return c.json({ ok: true })
})

// GET /api/auth/pending?state=xxx
// Extension popup polls this every 2 s after sending a magic link.
// Returns the session tokens once (one-time read — deletes row after fetch).
app.get('/pending', async (c) => {
  const state = c.req.query('state')
  if (!state) return c.json({ ready: false })

  const supabase = createServiceClient()

  const { data } = await supabase
    .from('auth_pending')
    .select('access_token, refresh_token')
    .eq('state', state)
    .gt('expires_at', new Date().toISOString())
    .single()

  if (!data) return c.json({ ready: false })

  // One-time use — delete after reading
  await supabase.from('auth_pending').delete().eq('state', state)

  return c.json({
    ready: true,
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  })
})

export default app
