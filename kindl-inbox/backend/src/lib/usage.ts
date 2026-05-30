import { createServiceClient } from './supabase'

export async function getTodayUsage(userId: string): Promise<number> {
  const supabase = createServiceClient()
  const today = new Date().toISOString().split('T')[0]

  const { data } = await supabase
    .from('usage')
    .select('count')
    .eq('user_id', userId)
    .eq('date', today)
    .single()

  return data?.count ?? 0
}

export async function incrementUsage(userId: string): Promise<void> {
  const supabase = createServiceClient()
  const today = new Date().toISOString().split('T')[0]

  // Uses the SQL function from the migration for an atomic upsert+increment
  await supabase.rpc('increment_usage', { p_user_id: userId, p_date: today })
}
