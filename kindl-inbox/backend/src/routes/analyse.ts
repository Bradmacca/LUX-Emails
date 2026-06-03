import { Hono } from 'hono'
import { FREE_DAILY_LIMIT } from '../types.js'
import { verifyAuth } from '../lib/auth'
import { analyseEmail } from '../lib/claude'
import { getTodayUsage, incrementUsage } from '../lib/usage'

const app = new Hono()

app.post('/', async (c) => {
  let auth
  try {
    auth = await verifyAuth(c.req.header('Authorization'))
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Unauthorized' }, 401)
  }

  // Enforce free-tier rate limit before hitting Claude
  if (auth.tier === 'free') {
    const count = await getTodayUsage(auth.userId)
    if (count >= FREE_DAILY_LIMIT) {
      return c.json({ error: 'RATE_LIMIT', count, limit: FREE_DAILY_LIMIT }, 429)
    }
  }

  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const { emailText, emailSubject, senderName } = body as {
    emailText?: string
    emailSubject?: string
    senderName?: string
  }

  if (!emailText || !emailSubject || !senderName) {
    return c.json({ error: 'Missing required fields: emailText, emailSubject, senderName' }, 400)
  }

  try {
    const result = await analyseEmail(
      String(emailSubject),
      String(senderName),
      String(emailText),
      auth.tier
    )

    // Increment usage only after a successful Claude response
    try {
      await incrementUsage(auth.userId, auth.email)
    } catch (err) {
      console.error('[analyse] usage increment failed:', err)
    }

    return c.json(result)
  } catch (err) {
    console.error('[analyse] Claude error:', err)
    return c.json({ error: 'Analysis failed — please try again shortly' }, 500)
  }
})

export default app
