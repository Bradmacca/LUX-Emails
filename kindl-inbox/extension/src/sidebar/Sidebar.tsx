import React, { useState, useCallback } from 'react'
import type { AnalyseResponse } from 'shared'

export type SidebarState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'result'; data: AnalyseResponse }
  | { status: 'error'; message: string }
  | { status: 'auth_required' }
  | { status: 'rate_limited'; count: number; limit: number }

interface SidebarProps {
  state: SidebarState
  panelMode: 'hidden' | 'collapsed' | 'expanded'
  onReanalyse: () => void
  onMinimize: () => void
  onExpand: () => void
}

// ── Copy button with 2-second "Copied!" feedback ─────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API can fail in some browser contexts; silently ignore
    }
  }, [text])

  return (
    <button className="kindl-btn kindl-btn--secondary" onClick={handleCopy}>
      {copied ? '✓ Copied' : 'Copy reply'}
    </button>
  )
}

// ── Skeleton loading state ────────────────────────────────────────────────────

function SkeletonLoading() {
  return (
    <div className="kindl-body">
      <div className="kindl-card">
        <div className="kindl-card-title">Analysis</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          <div className="kindl-skeleton kindl-skeleton--chip" />
          <div className="kindl-skeleton kindl-skeleton--chip" style={{ width: 80 }} />
        </div>
        <div className="kindl-skeleton kindl-skeleton--line" style={{ marginBottom: 7 }} />
        <div className="kindl-skeleton kindl-skeleton--line" style={{ width: '80%', marginBottom: 7 }} />
        <div className="kindl-skeleton kindl-skeleton--line" style={{ width: '90%' }} />
      </div>
      {([1, 2, 3] as const).map((i) => (
        <div key={i} className="kindl-reply-card">
          <div className="kindl-skeleton kindl-skeleton--chip" style={{ width: 110 }} />
          <div className="kindl-skeleton kindl-skeleton--block" style={{ height: 11, marginBottom: 6 }} />
          <div className="kindl-skeleton kindl-skeleton--block" style={{ height: 11, width: '85%', marginBottom: 6 }} />
          <div className="kindl-skeleton kindl-skeleton--block" style={{ height: 11, width: '70%' }} />
        </div>
      ))}
    </div>
  )
}

// ── Result view ───────────────────────────────────────────────────────────────

function ResultView({ data, onReanalyse }: { data: AnalyseResponse; onReanalyse: () => void }) {
  const { analysis, replies } = data

  return (
    <div className="kindl-body">
      <div className="kindl-card">
        <div className="kindl-card-title">Analysis</div>
        <div className="kindl-chips">
          <span className={`kindl-chip kindl-chip--tone-${analysis.tone}`}>
            {analysis.tone}
          </span>
          <span className={`kindl-chip kindl-chip--urgency-${analysis.urgency}`}>
            {analysis.urgency} urgency
          </span>
        </div>
        <div className="kindl-intent">{analysis.intent}</div>
        {analysis.keyPoints.length > 0 && (
          <ul className="kindl-points">
            {analysis.keyPoints.map((point, i) => (
              <li key={i}>{point}</li>
            ))}
          </ul>
        )}
      </div>

      {replies.map((reply, i) => (
        <div key={i} className="kindl-reply-card">
          <div className="kindl-reply-label">{reply.label}</div>
          <div className="kindl-reply-body">{reply.body}</div>
          <CopyButton text={reply.body} />
        </div>
      ))}

      <div className="kindl-reanalyse-row">
        <button className="kindl-btn kindl-btn--ghost" onClick={onReanalyse}>
          ↺ Re-analyse
        </button>
      </div>
    </div>
  )
}

// ── Auth required state ───────────────────────────────────────────────────────

function AuthRequired() {
  return (
    <div className="kindl-body">
      <div className="kindl-centred">
        <div className="kindl-centred-mark">K</div>
        <div className="kindl-centred-title">Sign in to Kindl Inbox</div>
        <div className="kindl-centred-desc">
          Click the Kindl icon in your Chrome toolbar to sign in and start
          analysing emails with AI.
        </div>
      </div>
    </div>
  )
}

// ── Rate limited state ────────────────────────────────────────────────────────

function RateLimited({ count, limit }: { count: number; limit: number }) {
  return (
    <div className="kindl-body">
      <div className="kindl-centred">
        <div className="kindl-centred-icon">⚡</div>
        <div className="kindl-centred-title">
          {count}/{limit} analyses used today
        </div>
        <div className="kindl-centred-desc">
          You've reached the free tier daily limit. Upgrade to Pro for unlimited
          analyses with Claude Sonnet.
        </div>
        <button
          className="kindl-btn kindl-btn--primary"
          onClick={() => chrome.tabs.create({ url: 'https://usekindl.com/upgrade' })}
        >
          Upgrade to Pro — $9/mo
        </button>
      </div>
    </div>
  )
}

// ── Error state ───────────────────────────────────────────────────────────────

function ErrorView({ message, onReanalyse }: { message: string; onReanalyse: () => void }) {
  return (
    <div className="kindl-body">
      <div className="kindl-centred">
        <div className="kindl-centred-icon">⚠️</div>
        <div className="kindl-centred-title">Something went wrong</div>
        <div className="kindl-centred-desc">{message}</div>
        <button className="kindl-btn kindl-btn--secondary" onClick={onReanalyse}>
          Try again
        </button>
      </div>
    </div>
  )
}

// ── Collapsed tab (minimized) ─────────────────────────────────────────────────

function CollapsedTab({
  onExpand,
  hasResult,
  idle,
}: {
  onExpand: () => void
  hasResult: boolean
  idle?: boolean
}) {
  return (
    <button
      type="button"
      className="kindl-tab"
      onClick={onExpand}
      title={idle ? 'Open an email to analyse with Kindl' : 'Open Kindl Inbox'}
      aria-label="Open Kindl Inbox"
    >
      <div className="kindl-tab-mark">K</div>
      {hasResult && <span className="kindl-tab-dot" aria-hidden="true" />}
    </button>
  )
}

// ── Idle state ────────────────────────────────────────────────────────────────

function IdleView() {
  return (
    <div className="kindl-body">
      <div className="kindl-centred">
        <div className="kindl-centred-mark">K</div>
        <div className="kindl-centred-title">Open an email to analyse it</div>
        <div className="kindl-centred-desc">
          Click any email in your inbox and Kindl will analyse it automatically.
        </div>
      </div>
    </div>
  )
}

// ── Root sidebar component ────────────────────────────────────────────────────

export default function Sidebar({
  state,
  panelMode,
  onReanalyse,
  onMinimize,
  onExpand,
}: SidebarProps) {
  if (panelMode === 'hidden') return null

  if (panelMode === 'collapsed') {
    return (
      <CollapsedTab
        onExpand={onExpand}
        hasResult={state.status === 'result'}
        idle={state.status === 'idle'}
      />
    )
  }

  return (
    <div className="kindl-sidebar">
      <div className="kindl-header">
        <div className="kindl-logo">
          <div className="kindl-logo-mark">K</div>
          Kindl Inbox
        </div>
        <button
          type="button"
          className="kindl-minimize-btn"
          onClick={onMinimize}
          title="Minimize"
          aria-label="Minimize sidebar"
        >
          ›
        </button>
      </div>

      {state.status === 'idle'          && <IdleView />}
      {state.status === 'loading'      && <SkeletonLoading />}
      {state.status === 'result'       && <ResultView data={state.data} onReanalyse={onReanalyse} />}
      {state.status === 'auth_required'&& <AuthRequired />}
      {state.status === 'rate_limited' && <RateLimited count={state.count} limit={state.limit} />}
      {state.status === 'error'        && <ErrorView message={state.message} onReanalyse={onReanalyse} />}

      <div className="kindl-footer">
        <button className="kindl-save-btn" disabled title="Coming soon">
          Save to UseKindl →
        </button>
      </div>
    </div>
  )
}
