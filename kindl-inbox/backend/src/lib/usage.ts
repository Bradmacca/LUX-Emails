import { createServiceClient } from './supabase'

function todayUtc(): string {
  return new Date().toISOString().split('T')[0]
}

export async function ensureProfile(userId: string, email: string): Promise<void> {
  const supabase = createServiceClient()
  const { error } = await supabase.from('profiles').upsert(
    { id: userId, email },
    { onConflict: 'id', ignoreDuplicates: true }
  )
  if (error) {
    console.error('[usage] ensureProfile failed:', error.message)
    throw new Error('Could not ensure user profile')
  }
}

export async function getTodayUsage(userId: string): Promise<number> {
  const supabase = createServiceClient()
  const today = todayUtc()

  const { data, error } = await supabase
    .from('usage')
    .select('count')
    .eq('user_id', userId)
    .eq('date', today)
    .maybeSingle()

  if (error) {
    console.error('[usage] getTodayUsage failed:', error.message)
    return 0
  }

  return data?.count ?? 0
}

async function incrementUsageDirect(userId: string, date: string): Promise<void> {
  const supabase = createServiceClient()

  const { data: existing, error: readError } = await supabase
    .from('usage')
    .select('count')
    .eq('user_id', userId)
    .eq('date', date)
    .maybeSingle()

  if (readError) {
    throw new Error(`Failed to read usage: ${readError.message}`)
  }

  if (existing) {
    const { error } = await supabase
      .from('usage')
      .update({ count: existing.count + 1 })
      .eq('user_id', userId)
      .eq('date', date)
    if (error) throw new Error(`Failed to update usage: ${error.message}`)
    return
  }

  const { error } = await supabase
    .from('usage')
    .insert({ user_id: userId, date, count: 1 })
  if (error) throw new Error(`Failed to insert usage: ${error.message}`)
}

export async function incrementUsage(userId: string, email: string): Promise<void> {
  await ensureProfile(userId, email)

  const supabase = createServiceClient()
  const today = todayUtc()

  const { error: rpcError } = await supabase.rpc('increment_usage', {
    p_user_id: userId,
    p_date: today,
  })

  if (rpcError) {
    console.warn('[usage] RPC increment failed, using direct upsert:', rpcError.message)
    await incrementUsageDirect(userId, today)
  }
}
