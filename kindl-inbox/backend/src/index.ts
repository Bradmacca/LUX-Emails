import { Hono } from 'hono'
import { cors } from 'hono/cors'
import analyse from './routes/analyse'
import usage from './routes/usage'
import checkout from './routes/checkout'
import authRoutes from './routes/auth'
import webhooks from './routes/webhooks'

const app = new Hono()

// Allow requests from Chrome extension origins.
// The extension's background service worker sends the Origin header as
// "chrome-extension://<extension-id>" — we reflect it back so CORS passes.
app.use(
  '*',
  cors({
    origin: (origin) => {
      if (!origin) return null
      if (origin.startsWith('chrome-extension://')) return origin
      if (origin === 'https://usekindl.com') return origin
      return null
    },
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Authorization', 'Content-Type', 'stripe-signature'],
    maxAge: 86400,
    credentials: false,
  })
)

app.route('/api/analyse', analyse)
app.route('/api/usage', usage)
app.route('/api/checkout', checkout)
app.route('/api/auth', authRoutes)
app.route('/api/webhooks', webhooks)

app.get('/', (c) => c.text('Kindl Inbox API — usekindl.com'))

export default app
