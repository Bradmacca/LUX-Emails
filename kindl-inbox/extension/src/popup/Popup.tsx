import React, { useEffect, useState } from 'react'
import SignIn from './SignIn'
import type { UsageResponse } from 'shared'
import { FREE_DAILY_LIMIT } from 'shared'

interface Session {
  email: string
  accessToken: string
}

const SESSION_KEY = 'kindl_session'

export default function Popup() {
  const [session, setSession] = useState<Session | null | 'loading'>('loading')
  const [usage, setUsage] = useState<UsageResponse | null>(null)

  // Read persisted session from chrome.storage.local on mount
  useEffect(() => {
    chrome.storage.local.get([SESSION_KEY, 'kindl_usage'], (result) => {
      const stored = result[SESSION_KEY]
      if (stored?.access_token && stored?.email) {
        setSession({ email: stored.email, accessToken: stored.access_token })
        if (result.kindl_usage) setUsage(result.kindl_usage as UsageResponse)
        fetchUsage()
      } else {
        setSession(null)
      }
    })

    const onStorageChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string
    ) => {
      if (area !== 'local') return
      if (changes.kindl_usage?.newValue) {
        setUsage(changes.kindl_usage.newValue as UsageResponse)
      }
    }
    chrome.storage.onChanged.addListener(onStorageChange)
    return () => chrome.storage.onChanged.removeListener(onStorageChange)
  }, [])

  function fetchUsage() {
    chrome.runtime.sendMessage({ type: 'GET_USAGE' }, (res) => {
      if (res?.type === 'USAGE_RESULT') {
        setUsage(res.data)
        chrome.storage.local.set({ kindl_usage: res.data })
      }
    })
  }

  function handleSignedIn(email: string, accessToken: string) {
    setSession({ email, accessToken })
    fetchUsage()
  }

  function handleSignOut() {
    chrome.runtime.sendMessage({ type: 'SIGN_OUT' }, () => {
      setSession(null)
      setUsage(null)
    })
  }

  if (session === 'loading') {
    return (
      <div style={s.center}>
        <div style={s.spinner} />
      </div>
    )
  }

  if (!session) {
    return <SignIn onSignedIn={handleSignedIn} />
  }

  const isPro = usage?.tier === 'pro'
  const usageCount = usage?.count ?? 0
  const usageLimit = usage?.limit ?? FREE_DAILY_LIMIT
  const usagePct = isPro ? 0 : Math.min((usageCount / usageLimit) * 100, 100)

  return (
    <div style={s.root}>
      <div style={s.header}>
        <span style={s.logoText}>Kindl Inbox</span>
        <span style={isPro ? s.badgePro : s.badgeFree}>
          {isPro ? '⚡ Pro' : 'Free'}
        </span>
      </div>

      <div style={s.body}>
        {/* User row */}
        <div style={s.userRow}>
          <div style={s.avatar}>{session.email[0].toUpperCase()}</div>
          <div style={{ minWidth: 0 }}>
            <div style={s.emailText} title={session.email}>{session.email}</div>
          </div>
        </div>

        {/* Usage card */}
        <div style={s.usageCard}>
          <div style={s.usageLabel}>Today's usage</div>
          {usage ? (
            <>
              <div style={s.usageCount}>
                {isPro ? 'Unlimited analyses' : `${usageCount} / ${usageLimit} analyses`}
              </div>
              {!isPro && (
                <div style={s.barTrack}>
                  <div style={{ ...s.barFill, width: `${usagePct}%` }} />
                </div>
              )}
            </>
          ) : (
            <div style={s.usageCount}>Loading…</div>
          )}
        </div>

        {/* Upgrade CTA */}
        {!isPro && (
          <button
            style={s.upgradeBtn}
            onClick={() => chrome.tabs.create({ url: 'https://usekindl.com/upgrade' })}
          >
            Upgrade to Pro — $9/mo ↗
          </button>
        )}

        <button style={s.signOutBtn} onClick={handleSignOut}>
          Sign out
        </button>
      </div>

      <div style={s.footer}>
        <a href="https://usekindl.com" target="_blank" rel="noreferrer" style={s.footerLink}>
          usekindl.com
        </a>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  center: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', height: 220,
  },
  spinner: {
    width: 24, height: 24,
    border: '2px solid #e8eaed', borderTop: '2px solid #6366f1',
    borderRadius: '50%', animation: 'spin 0.8s linear infinite',
  },
  root: { display: 'flex', flexDirection: 'column', minHeight: 240 },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '11px 16px', borderBottom: '1px solid #f0f0f0',
  },
  logoText: { fontWeight: 700, fontSize: 14, color: '#6366f1' },
  badgeFree: {
    fontSize: 10, fontWeight: 600, padding: '2px 7px',
    borderRadius: 8, background: '#f8f9fa', color: '#80868b', border: '1px solid #e8eaed',
  },
  badgePro: {
    fontSize: 10, fontWeight: 600, padding: '2px 7px',
    borderRadius: 8, background: '#f0f0ff', color: '#6366f1', border: '1px solid #c7d2fe',
  },
  body: { padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 11, flex: 1 },
  userRow: { display: 'flex', alignItems: 'center', gap: 10 },
  avatar: {
    width: 34, height: 34, borderRadius: '50%',
    background: '#6366f1', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 700, fontSize: 15, flexShrink: 0,
  },
  emailText: {
    fontSize: 12, fontWeight: 500, color: '#202124',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    maxWidth: 220,
  },
  usageCard: {
    background: '#f8f9fa', borderRadius: 9,
    padding: '10px 12px', border: '1px solid #f0f0f0',
  },
  usageLabel: {
    fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.5px', color: '#80868b', marginBottom: 4,
  },
  usageCount: { fontSize: 13, color: '#202124', fontWeight: 500, marginBottom: 6 },
  barTrack: { height: 4, background: '#e8eaed', borderRadius: 2, overflow: 'hidden' },
  barFill: { height: '100%', background: '#6366f1', borderRadius: 2, transition: 'width 0.3s' },
  upgradeBtn: {
    background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8,
    padding: '8px 12px', fontSize: 12, fontWeight: 600,
    cursor: 'pointer', width: '100%', fontFamily: 'inherit',
  },
  signOutBtn: {
    background: 'transparent', color: '#80868b', border: '1px solid #e8eaed',
    borderRadius: 8, padding: '7px 12px', fontSize: 12,
    cursor: 'pointer', width: '100%', fontFamily: 'inherit',
  },
  footer: { padding: '10px 16px', borderTop: '1px solid #f0f0f0', textAlign: 'center' },
  footerLink: { fontSize: 11, color: '#bdc1c6', textDecoration: 'none' },
}
