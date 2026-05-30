import { Hono } from 'hono'
import { verifyAuth } from '../lib/auth'
import { getTodayUsage } from '../lib/usage'

const FREE_LIMIT = 10

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
    limit: auth.tier === 'pro' ? null : FREE_LIMIT,
    tier: auth.tier,
  })
})

export default app
