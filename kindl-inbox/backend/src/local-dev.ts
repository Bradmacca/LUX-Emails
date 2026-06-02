import { serve } from '@hono/node-server'
import app from './index.js'

const port = Number(process.env.PORT) || 3000

console.log(`Kindl Inbox API starting on port ${port}`)

serve({ fetch: app.fetch, port, hostname: '0.0.0.0' })
