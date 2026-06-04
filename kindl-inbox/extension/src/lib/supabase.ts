import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string
const AUTH_STORAGE_KEY = 'kindl-supabase-auth'

// In-memory cache so PKCE state survives service-worker restarts during OAuth.
const memoryCache: Record<string, string> = {}
let cacheHydrated = false

async function hydrateCache(): Promise<void> {
  if (cacheHydrated) return
  const all = await chrome.storage.local.get(null)
  for (const [key, value] of Object.entries(all)) {
    if (typeof value === 'string') memoryCache[key] = value
  }
  cacheHydrated = true
}

function makeChromeStorageAdapter() {
  return {
    getItem: async (key: string): Promise<string | null> => {
      await hydrateCache()
      if (key in memoryCache) return memoryCache[key]
      return new Promise((resolve) => {
        chrome.storage.local.get(key, (result) => {
          const value = result[key] ?? null
          if (typeof value === 'string') memoryCache[key] = value
          resolve(typeof value === 'string' ? value : null)
        })
      })
    },
    setItem: async (key: string, value: string): Promise<void> => {
      memoryCache[key] = value
      return new Promise((resolve) => {
        chrome.storage.local.set({ [key]: value }, resolve)
      })
    },
    removeItem: async (key: string): Promise<void> => {
      delete memoryCache[key]
      return new Promise((resolve) => {
        chrome.storage.local.remove(key, resolve)
      })
    },
  }
}

let _client: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient {
  if (!_client) {
    _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: makeChromeStorageAdapter(),
        storageKey: AUTH_STORAGE_KEY,
        flowType: 'pkce',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  }
  return _client
}

export function getAuthCodeVerifierKey(): string {
  return `${AUTH_STORAGE_KEY}-code-verifier`
}

/** Run Google OAuth in the same context (popup) so PKCE state is not lost. */
export async function signInWithGoogleChrome(): Promise<{
  email: string
  accessToken: string
  refreshToken: string
}> {
  const supabase = getSupabaseClient()
  const redirectUrl = chrome.identity.getRedirectURL()

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: redirectUrl, skipBrowserRedirect: true },
  })
  if (error || !data.url) {
    throw new Error(error?.message ?? 'Could not start Google sign-in')
  }

  // Ensure PKCE verifier is persisted before opening the OAuth window
  const verifierKey = getAuthCodeVerifierKey()
  let verifier = await chrome.storage.local.get(verifierKey).then((r) => r[verifierKey] as string | undefined)
  if (!verifier) {
    await new Promise((r) => setTimeout(r, 150))
    verifier = await chrome.storage.local.get(verifierKey).then((r) => r[verifierKey] as string | undefined)
  }
  if (!verifier) {
    throw new Error('Sign-in could not start — please try again.')
  }

  const responseUrl = await new Promise<string>((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(
      { url: data.url, interactive: true },
      (url) => {
        if (chrome.runtime.lastError || !url) {
          reject(new Error(chrome.runtime.lastError?.message ?? 'Sign-in was cancelled'))
        } else {
          resolve(url)
        }
      }
    )
  })

  const code = new URL(responseUrl).searchParams.get('code')
  if (!code) throw new Error('No authorisation code returned from Google')

  const { data: sessionData, error: sessionError } =
    await supabase.auth.exchangeCodeForSession(code)
  if (sessionError || !sessionData.session) {
    throw new Error(sessionError?.message ?? 'Failed to create session')
  }

  return {
    email: sessionData.session.user.email ?? '',
    accessToken: sessionData.session.access_token,
    refreshToken: sessionData.session.refresh_token,
  }
}
