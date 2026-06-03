import { createServiceClient } from './supabase'
import type { UserTier } from '../types.js'

export interface AuthResult {
  userId: string
  email: string
  tier: UserTier
}

export async function verifyAuth(authHeader: string | null | undefined): Promise<AuthResult> {
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing or invalid Authorization header')
  }

  const token = authHeader.slice(7)
  const supabase = createServiceClient()

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) throw new Error('Invalid or expired token')

  let { data: profile } = await supabase
    .from('profiles')
    .select('tier')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile) {
    const { data: created, error: createError } = await supabase
      .from('profiles')
      .upsert({ id: user.id, email: user.email ?? '', tier: 'free' }, { onConflict: 'id' })
      .select('tier')
      .single()

    if (createError) {
      console.error('[auth] failed to create profile:', createError.message)
    } else {
      profile = created
    }
  }

  return {
    userId: user.id,
    email: user.email ?? '',
    tier: (profile?.tier as UserTier) ?? 'free',
  }
}
