import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

// Custom storage adapter — uses chrome.storage.local instead of localStorage.
// Required because MV3 service workers don't have localStorage, and
// we want session to persist across popup opens and service worker restarts.
function makeChromeStorageAdapter() {
  return {
    getItem: (key: string): Promise<string | null> =>
      new Promise((resolve) => {
        chrome.storage.local.get(key, (result) => resolve(result[key] ?? null))
      }),
    setItem: (key: string, value: string): Promise<void> =>
      new Promise((resolve) => {
        chrome.storage.local.set({ [key]: value }, resolve)
      }),
    removeItem: (key: string): Promise<void> =>
      new Promise((resolve) => {
        chrome.storage.local.remove(key, resolve)
      }),
  }
}

let _client: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient {
  if (!_client) {
    _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: makeChromeStorageAdapter(),
        flowType: 'pkce',
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  }
  return _client
}
