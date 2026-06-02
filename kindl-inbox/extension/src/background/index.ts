import { getSupabaseClient } from '../lib/supabase'
import type { ExtMessage, ExtResponse } from '../lib/messaging'
import { FREE_DAILY_LIMIT } from 'shared'
import { apiFetch } from './apiFetch'

const API_BASE = import.meta.env.VITE_API_BASE_URL as string
const SESSION_KEY = 'kindl_session'

// ── Storage helpers ───────────────────────────────────────────────────────────

type StoredSession = { access_token: string; refresh_token: string; email: string }

function getSession(): Promise<StoredSession | null> {
  return new Promise((resolve) =>
    chrome.storage.local.get(SESSION_KEY, (r) => resolve(r[SESSION_KEY] ?? null))
  )
}

function saveSession(data: StoredSession): Promise<void> {
  return new Promise((resolve) =>
    chrome.storage.local.set({ [SESSION_KEY]: data }, resolve)
  )
}

function clearSession(): Promise<void> {
  return new Promise((resolve) =>
    chrome.storage.local.remove(SESSION_KEY, resolve)
  )
}

// ── Message handler ───────────────────────────────────────────────────────────

async function handleMessage(message: ExtMessage): Promise<ExtResponse> {
  switch (message.type) {

    // ── Analyse email ─────────────────────────────────────────────────────────
    case 'ANALYSE_EMAIL': {
      const session = await getSession()
      if (!session) return { type: 'AUTH_REQUIRED' }

      const { emailText, emailSubject, senderName } = message.payload
      let res: Response
      try {
        res = await apiFetch(`${API_BASE}/api/analyse`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ emailText, emailSubject, senderName }),
        })
      } catch {
        return { type: 'ANALYSE_ERROR', error: 'Network error — check your connection.' }
      }

      if (res.status === 401) {
        await clearSession()
        return { type: 'AUTH_REQUIRED' }
      }
      if (res.status === 429) {
        const body = await res.json().catch(() => ({}))
        return { type: 'RATE_LIMITED', count: body.count ?? FREE_DAILY_LIMIT, limit: body.limit ?? FREE_DAILY_LIMIT }
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        return { type: 'ANALYSE_ERROR', error: body.error ?? 'Analysis failed. Please try again.' }
      }

      const data = await res.json()

      // Refresh cached usage so the popup shows an up-to-date count
      try {
        const usageRes = await apiFetch(`${API_BASE}/api/usage`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (usageRes.ok) {
          const usage = await usageRes.json()
          await chrome.storage.local.set({ kindl_usage: usage })
        }
      } catch {
        // Non-fatal — popup will refetch on next open
      }

      return { type: 'ANALYSE_RESULT', data }
    }

    // ── Get usage ─────────────────────────────────────────────────────────────
    case 'GET_USAGE': {
      const session = await getSession()
      if (!session) return { type: 'AUTH_REQUIRED' }

      try {
        const res = await apiFetch(`${API_BASE}/api/usage`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (res.status === 401) {
          await clearSession()
          return { type: 'AUTH_REQUIRED' }
        }
        if (!res.ok) {
          return {
            type: 'USAGE_ERROR',
            error: res.status === 502 || res.status === 503
              ? 'API is temporarily unavailable — retry in a moment.'
              : `Could not load usage (${res.status}).`,
          }
        }
        const data = await res.json()
        await chrome.storage.local.set({ kindl_usage: data })
        return { type: 'USAGE_RESULT', data }
      } catch (err) {
        const timedOut = err instanceof Error && err.name === 'AbortError'
        return {
          type: 'USAGE_ERROR',
          error: timedOut
            ? 'API timed out — the server may be starting up. Try again.'
            : 'Network error — could not reach the API.',
        }
      }
    }

    // ── Google OAuth (PKCE via chrome.identity) ───────────────────────────────
    case 'SIGN_IN_GOOGLE': {
      try {
        const supabase = getSupabaseClient()
        const redirectUrl = chrome.identity.getRedirectURL()

        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: redirectUrl, skipBrowserRedirect: true },
        })
        if (error || !data.url) throw new Error(error?.message ?? 'Could not start Google sign-in')

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

        const userEmail = sessionData.session.user.email ?? ''
        await saveSession({
          access_token: sessionData.session.access_token,
          refresh_token: sessionData.session.refresh_token,
          email: userEmail,
        })

        return { type: 'SIGN_IN_SUCCESS', email: userEmail, accessToken: sessionData.session.access_token }
      } catch (err) {
        return { type: 'SIGN_IN_ERROR', error: err instanceof Error ? err.message : 'Sign-in failed' }
      }
    }

    // ── Email OTP — send code ─────────────────────────────────────────────────
    case 'SIGN_IN_EMAIL_OTP': {
      try {
        const supabase = getSupabaseClient()
        const { error } = await supabase.auth.signInWithOtp({
          email: message.payload.email,
          options: { shouldCreateUser: true },
        })
        if (error) throw error
        return { type: 'OTP_SENT' }
      } catch (err) {
        return {
          type: 'SIGN_IN_ERROR',
          error: err instanceof Error ? err.message : 'Failed to send code',
        }
      }
    }

    // ── Email OTP — verify code ───────────────────────────────────────────────
    case 'VERIFY_EMAIL_OTP': {
      try {
        const supabase = getSupabaseClient()
        const { data, error } = await supabase.auth.verifyOtp({
          email: message.payload.email,
          token: message.payload.token,
          type: 'email',
        })
        if (error || !data.session) {
          throw new Error(error?.message ?? 'Invalid or expired code — please try again')
        }

        const userEmail = data.session.user.email ?? message.payload.email
        await saveSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          email: userEmail,
        })

        return { type: 'SIGN_IN_SUCCESS', email: userEmail, accessToken: data.session.access_token }
      } catch (err) {
        return {
          type: 'SIGN_IN_ERROR',
          error: err instanceof Error ? err.message : 'Verification failed',
        }
      }
    }

    // ── Sign out ──────────────────────────────────────────────────────────────
    case 'SIGN_OUT': {
      try {
        const supabase = getSupabaseClient()
        await supabase.auth.signOut()
      } catch {
        // Clear local session regardless of remote signout errors
      }
      await clearSession()
      return { type: 'SIGN_OUT_SUCCESS' }
    }

    // ── Get current session info ──────────────────────────────────────────────
    case 'GET_SESSION': {
      const session = await getSession()
      return {
        type: 'SESSION_RESULT',
        email: session?.email ?? null,
        accessToken: session?.access_token ?? null,
      }
    }

    default:
      return { type: 'ANALYSE_ERROR', error: 'Unknown message type' }
  }
}

// Keep message channel open by returning true for async responses
chrome.runtime.onMessage.addListener(
  (message: ExtMessage, _sender, sendResponse) => {
    handleMessage(message)
      .then(sendResponse)
      .catch((err) =>
        sendResponse({ type: 'ANALYSE_ERROR', error: err?.message ?? 'Unexpected error' })
      )
    return true
  }
)
