import { Hono } from 'hono'
import { FREE_DAILY_LIMIT } from '../../../shared/types.ts'
import { verifyAuth } from '../lib/auth'
import { getTodayUsage } from '../lib/usage'

const app = new Hono()

app.get('/', async (c) => {
  let auth
  try {
    auth = await verifyAuth(c.req.header('Authorization'))
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Unauthorized' }, 401)
  }

  const count = await getTodayUsage(auth.userId)

  return c.json({
    count,
    limit: auth.tier === 'pro' ? null : FREE_DAILY_LIMIT,
    tier: auth.tier,
  })
})

export default app
