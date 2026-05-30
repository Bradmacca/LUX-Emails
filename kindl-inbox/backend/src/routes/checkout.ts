import { Hono } from 'hono'
import Stripe from 'stripe'
import { verifyAuth } from '../lib/auth'

const app = new Hono()

app.post('/', async (c) => {
  let auth
  try {
    auth = await verifyAuth(c.req.header('Authorization'))
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Unauthorized' }, 401)
  }

  if (auth.tier === 'pro') {
    return c.json({ error: 'Already on Pro tier' }, 400)
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: process.env.STRIPE_PRICE_ID_PRO!, quantity: 1 }],
      metadata: { user_id: auth.userId, email: auth.email },
      customer_email: auth.email,
      success_url: 'https://usekindl.com/upgrade/success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://usekindl.com/upgrade',
    })

    return c.json({ url: session.url })
  } catch (err) {
    console.error('[checkout] Stripe error:', err)
    return c.json({ error: 'Failed to create checkout session' }, 500)
  }
})

export default app
