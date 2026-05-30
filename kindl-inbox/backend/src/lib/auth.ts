import { createServiceClient } from './supabase'
import type { UserTier } from 'shared'

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

  const { data: profile } = await supabase
    .from('profiles')
    .select('tier')
    .eq('id', user.id)
    .single()

  return {
    userId: user.id,
    email: user.email ?? '',
    tier: (profile?.tier as UserTier) ?? 'free',
  }
}
