import { Hono } from 'hono'
import Stripe from 'stripe'
import { createServiceClient } from '../lib/supabase'

const app = new Hono()

app.post('/stripe', async (c) => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
  const sig = c.req.header('stripe-signature')
  const rawBody = await c.req.text()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig!, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    console.error('[webhook] Signature verification failed:', err)
    return c.json({ error: 'Webhook signature invalid' }, 400)
  }

  const supabase = createServiceClient()

  try {
    switch (event.type) {

      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.metadata?.user_id
        const customerId = typeof session.customer === 'string' ? session.customer : null
        if (userId && customerId) {
          await supabase
            .from('profiles')
            .update({ tier: 'pro', stripe_customer_id: customerId })
            .eq('id', userId)
        }
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const active = sub.status === 'active' || sub.status === 'trialing'
        const customerId = typeof sub.customer === 'string' ? sub.customer : null
        if (customerId) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('stripe_customer_id', customerId)
            .single()
          if (profile) {
            await supabase
              .from('profiles')
              .update({ tier: active ? 'pro' : 'free' })
              .eq('id', profile.id)
          }
        }
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const customerId = typeof sub.customer === 'string' ? sub.customer : null
        if (customerId) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('stripe_customer_id', customerId)
            .single()
          if (profile) {
            await supabase.from('profiles').update({ tier: 'free' }).eq('id', profile.id)
          }
        }
        break
      }
    }
  } catch (err) {
    console.error('[webhook] Handler error:', err)
    // Return 200 so Stripe doesn't retry — log the error for investigation
  }

  return c.json({ received: true })
})

export default app
