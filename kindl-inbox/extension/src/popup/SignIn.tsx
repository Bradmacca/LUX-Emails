import React, { useState } from 'react'
import type { ExtResponse } from '../lib/messaging'

interface SignInProps {
  onSignedIn: (email: string, accessToken: string) => void
}

type View = 'options' | 'email_input' | 'email_code' | 'loading'

export default function SignIn({ onSignedIn }: SignInProps) {
  const [view, setView] = useState<View>('options')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleGoogleSignIn = () => {
    setView('loading')
    setError(null)
    chrome.runtime.sendMessage(
      { type: 'SIGN_IN_GOOGLE' },
      (response: ExtResponse) => {
        if (response.type === 'SIGN_IN_SUCCESS') {
          onSignedIn(response.email, response.accessToken)
        } else if (response.type === 'SIGN_IN_ERROR') {
          setError(response.error)
          setView('options')
        }
      }
    )
  }

  const handleSendCode = () => {
    if (!email.trim()) return
    setView('loading')
    setError(null)
    chrome.runtime.sendMessage(
      { type: 'SIGN_IN_EMAIL_OTP', payload: { email: email.trim() } },
      (response: ExtResponse) => {
        if (response.type === 'OTP_SENT') {
          setView('email_code')
        } else if (response.type === 'SIGN_IN_ERROR') {
          setError(response.error)
          setView('email_input')
        }
      }
    )
  }

  const handleVerifyCode = () => {
    if (code.length !== 6) return
    setView('loading')
    setError(null)
    chrome.runtime.sendMessage(
      { type: 'VERIFY_EMAIL_OTP', payload: { email: email.trim(), token: code.trim() } },
      (response: ExtResponse) => {
        if (response.type === 'SIGN_IN_SUCCESS') {
          onSignedIn(response.email, response.accessToken)
        } else if (response.type === 'SIGN_IN_ERROR') {
          setError(response.error)
          setView('email_code')
        }
      }
    )
  }

  if (view === 'loading') {
    return (
      <div style={s.center}>
        <div style={s.spinner} />
        <div style={s.hint}>Signing in…</div>
      </div>
    )
  }

  return (
    <div style={s.root}>
      {/* Logo area */}
      <div style={s.logoArea}>
        <div style={s.logoMark}>K</div>
        <div style={s.logoName}>Kindl Inbox</div>
        <div style={s.tagline}>AI email analysis for Gmail</div>
      </div>

      {view === 'options' && (
        <div style={s.body}>
          <button style={s.googleBtn} onClick={handleGoogleSignIn}>
            <GoogleIcon />
            Continue with Google
          </button>

          <div style={s.divider}>
            <div style={s.dividerLine} />
            <span style={s.dividerText}>or</span>
            <div style={s.dividerLine} />
          </div>

          <button style={s.outlineBtn} onClick={() => setView('email_input')}>
            Continue with email
          </button>
        </div>
      )}

      {view === 'email_input' && (
        <div style={s.body}>
          <label style={s.label}>Email address</label>
          <input
            style={s.input}
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendCode()}
            autoFocus
          />
          <button
            style={{ ...s.primaryBtn, opacity: email.trim() ? 1 : 0.55 }}
            onClick={handleSendCode}
            disabled={!email.trim()}
          >
            Send 6-digit code
          </button>
          <button style={s.linkBtn} onClick={() => setView('options')}>
            ← Back
          </button>
        </div>
      )}

      {view === 'email_code' && (
        <div style={s.body}>
          <div style={s.hint}>
            We sent a 6-digit code to <strong>{email}</strong>.
          </div>
          <input
            style={{ ...s.input, textAlign: 'center', letterSpacing: 10, fontSize: 22, fontWeight: 600 }}
            type="text"
            inputMode="numeric"
            placeholder="000000"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            onKeyDown={(e) => e.key === 'Enter' && handleVerifyCode()}
            autoFocus
          />
          <button
            style={{ ...s.primaryBtn, opacity: code.length === 6 ? 1 : 0.55 }}
            onClick={handleVerifyCode}
            disabled={code.length !== 6}
          >
            Verify code
          </button>
          <button style={s.linkBtn} onClick={() => { setView('email_input'); setCode('') }}>
            ← Change email
          </button>
        </div>
      )}

      {error && <div style={s.errorBox}>{error}</div>}

      <div style={s.footer}>
        <a
          href="https://usekindl.com"
          target="_blank"
          rel="noreferrer"
          style={s.footerLink}
        >
          usekindl.com
        </a>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" style={{ flexShrink: 0 }}>
      <path d="M15.68 8.18c0-.57-.05-1.11-.14-1.64H8v3.1h4.3a3.67 3.67 0 01-1.59 2.41v2h2.57C14.79 12.6 15.68 10.57 15.68 8.18z" fill="#4285F4"/>
      <path d="M8 16c2.16 0 3.97-.71 5.29-1.93l-2.57-2a4.8 4.8 0 01-7.18-2.53H.96v2.07A8 8 0 008 16z" fill="#34A853"/>
      <path d="M3.54 9.54A4.82 4.82 0 013.29 8c0-.54.09-1.06.25-1.54V4.39H.96A8 8 0 000 8c0 1.29.31 2.51.96 3.61l2.58-2.07z" fill="#FBBC05"/>
      <path d="M8 3.18c1.22 0 2.31.42 3.17 1.24l2.37-2.37A8 8 0 00.96 4.39l2.58 2.07A4.77 4.77 0 018 3.18z" fill="#EA4335"/>
    </svg>
  )
}

const s: Record<string, React.CSSProperties> = {
  root: { display: 'flex', flexDirection: 'column', minHeight: 300 },
  center: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', height: 280, gap: 10,
  },
  spinner: {
    width: 24, height: 24,
    border: '2px solid #e8eaed',
    borderTop: '2px solid #6366f1',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  logoArea: {
    padding: '22px 20px 14px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
  },
  logoMark: {
    width: 42, height: 42,
    background: '#6366f1', borderRadius: 11,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', fontSize: 22, fontWeight: 800,
    marginBottom: 4,
  },
  logoName: { fontWeight: 700, fontSize: 16, color: '#202124' },
  tagline: { fontSize: 12, color: '#80868b' },
  body: { padding: '0 18px', display: 'flex', flexDirection: 'column', gap: 9 },
  googleBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: '9px 12px', border: '1px solid #e0e0e0', borderRadius: 8,
    background: '#fff', color: '#202124', fontSize: 13, fontWeight: 500,
    cursor: 'pointer', width: '100%', fontFamily: 'inherit',
  },
  divider: { display: 'flex', alignItems: 'center', gap: 8, margin: '1px 0' },
  dividerLine: { flex: 1, height: 1, background: '#e8eaed' },
  dividerText: { fontSize: 11, color: '#9aa0a6' },
  outlineBtn: {
    padding: '9px 12px', border: '1px solid #e0e0e0', borderRadius: 8,
    background: '#f8f9fa', color: '#3c4043', fontSize: 13, fontWeight: 500,
    cursor: 'pointer', width: '100%', fontFamily: 'inherit',
  },
  label: { fontSize: 11, fontWeight: 600, color: '#5f6368' },
  input: {
    padding: '8px 10px', border: '1px solid #e0e0e0', borderRadius: 8,
    fontSize: 13, color: '#202124', background: '#fff',
    outline: 'none', width: '100%', fontFamily: 'inherit',
  },
  primaryBtn: {
    padding: '9px 12px', background: '#6366f1', color: '#fff',
    border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500,
    cursor: 'pointer', width: '100%', fontFamily: 'inherit',
  },
  linkBtn: {
    background: 'transparent', border: 'none', color: '#6366f1',
    fontSize: 12, cursor: 'pointer', padding: '2px 0',
    textAlign: 'center', fontFamily: 'inherit',
  },
  hint: { fontSize: 12, color: '#5f6368', lineHeight: 1.5, textAlign: 'center' },
  errorBox: {
    margin: '4px 18px 0',
    padding: '8px 10px',
    background: '#fce8e6', color: '#c5221f',
    borderRadius: 7, fontSize: 12, lineHeight: 1.4,
  },
  footer: { marginTop: 'auto', padding: '14px 18px', textAlign: 'center' },
  footerLink: { fontSize: 11, color: '#bdc1c6', textDecoration: 'none' },
}
