import { createRoot, type Root } from 'react-dom/client'
import React from 'react'
import Sidebar from '../sidebar/Sidebar'
import sidebarCSS from '../sidebar/sidebar.css?inline'
import { SELECTORS } from './gmailSelectors'
import type { ExtResponse } from '../lib/messaging'
import type { AnalyseResponse } from 'shared'

export type SidebarState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'result'; data: AnalyseResponse }
  | { status: 'error'; message: string }
  | { status: 'auth_required' }
  | { status: 'rate_limited'; count: number; limit: number }

let currentState: SidebarState = { status: 'idle' }
let panelMode: 'hidden' | 'collapsed' | 'expanded' = 'hidden'
let reactRoot: Root | null = null
let hostEl: HTMLDivElement | null = null
let lastAnalysedKey: string | null = null
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let cachedUserEmail: string | null = null

// Cache the Kindl sign-in email as a fallback for detecting "sent by me"
chrome.storage.local.get('kindl_session', (result) => {
  cachedUserEmail = result.kindl_session?.email?.toLowerCase() ?? null
})

interface ThreadMessage {
  messageId: string
  senderEmail: string
  senderName: string
  bodyText: string
}

function getGmailUserEmail(): string | null {
  const accountBtn = document.querySelector(SELECTORS.accountButton)
  const label = accountBtn?.getAttribute('aria-label') ?? ''
  const match = label.match(/\(([^)]*@[^)]*)\)/)
  if (match) return match[1].toLowerCase()

  const dataEmail = document.querySelector('[data-email]')?.getAttribute('data-email')
  if (dataEmail?.includes('@')) return dataEmail.toLowerCase()

  return cachedUserEmail
}

function extractBodyText(bodyEl: HTMLElement): string {
  const clone = bodyEl.cloneNode(true) as HTMLElement
  clone.querySelectorAll(SELECTORS.quotedReply).forEach((el) => el.remove())
  return clone.innerText?.trim() ?? ''
}

function getSenderFromRoot(root: Element): { senderEmail: string; senderName: string } {
  const senderEl = root.querySelector<HTMLElement>(SELECTORS.senderEmail)
    ?? root.querySelector<HTMLElement>(SELECTORS.senderName)
  return {
    senderEmail: (senderEl?.getAttribute('email') ?? '').toLowerCase(),
    senderName: senderEl?.getAttribute('name') ?? senderEl?.textContent?.trim() ?? 'Unknown',
  }
}

function getThreadMessages(threadEl: Element): ThreadMessage[] {
  const messages: ThreadMessage[] = []
  const seen = new Set<string>()

  const containers = threadEl.querySelectorAll(
    `${SELECTORS.messageContainer}, ${SELECTORS.messageContainerAlt}`
  )

  containers.forEach((container) => {
    const messageId =
      container.getAttribute('data-message-id') ??
      container.getAttribute('data-legacy-message-id') ??
      ''

    const bodyEl =
      container.querySelector<HTMLElement>(SELECTORS.messageBody) ??
      container.querySelector<HTMLElement>(SELECTORS.messageBodyAlt)
    if (!bodyEl) return

    // Skip compose / reply editor areas
    if (bodyEl.closest('[role="textbox"], .Am, .editable')) return

    const bodyText = extractBodyText(bodyEl)
    if (bodyText.length < 10) return

    const dedupeKey = messageId || bodyText.slice(0, 80)
    if (seen.has(dedupeKey)) return
    seen.add(dedupeKey)

    const { senderEmail, senderName } = getSenderFromRoot(container)
    messages.push({ messageId: dedupeKey, senderEmail, senderName, bodyText })
  })

  // Fallback: walk standalone body nodes if message containers weren't found
  if (messages.length === 0) {
    threadEl.querySelectorAll<HTMLElement>(SELECTORS.messageBody).forEach((bodyEl) => {
      if (bodyEl.closest('[role="textbox"], .Am, .editable')) return
      const bodyText = extractBodyText(bodyEl)
      if (bodyText.length < 10) return
      const root = bodyEl.closest('[data-message-id], .gs') ?? bodyEl
      const { senderEmail, senderName } = getSenderFromRoot(root)
      const dedupeKey = bodyText.slice(0, 80)
      if (seen.has(dedupeKey)) return
      seen.add(dedupeKey)
      messages.push({ messageId: dedupeKey, senderEmail, senderName, bodyText })
    })
  }

  return messages
}

function pickIncomingMessage(messages: ThreadMessage[]): ThreadMessage | null {
  if (messages.length === 0) return null

  const userEmail = getGmailUserEmail()
  if (userEmail) {
    const incoming = messages.filter(
      (m) => m.senderEmail && m.senderEmail !== userEmail
    )
    if (incoming.length > 0) return incoming[incoming.length - 1]
  }

  // No user email detected — assume the first message is the original inbound email
  return messages[0]
}

function setPanelMode(mode: 'hidden' | 'collapsed' | 'expanded') {
  panelMode = mode
  if (hostEl) {
    hostEl.style.width = mode === 'hidden' ? '0' : mode === 'collapsed' ? '44px' : '340px'
  }
}

function setState(next: SidebarState) {
  currentState = next
  if (next.status === 'idle') {
    setPanelMode('hidden')
  } else if (next.status === 'loading') {
    setPanelMode('expanded')
  }
  render()
}

function handleMinimize() {
  if (currentState.status !== 'idle') setPanelMode('collapsed')
}

function handleExpand() {
  if (currentState.status !== 'idle') setPanelMode('expanded')
}

function render() {
  if (!reactRoot) return
  reactRoot.render(
    React.createElement(Sidebar, {
      state: currentState,
      panelMode,
      onReanalyse: handleReanalyse,
      onMinimize: handleMinimize,
      onExpand: handleExpand,
    })
  )
}

function handleReanalyse() {
  lastAnalysedKey = null
  checkAndAnalyse()
}

function mountSidebar(): Root {
  document.getElementById('kindl-inbox-root')?.remove()

  const host = document.createElement('div')
  host.id = 'kindl-inbox-root'
  Object.assign(host.style, {
    position: 'fixed',
    top: '0',
    right: '0',
    width: '0',
    height: '100vh',
    zIndex: '9999',
    pointerEvents: 'none',
    transition: 'width 0.22s ease',
    overflow: 'visible',
  })
  document.body.appendChild(host)
  hostEl = host

  const shadow = host.attachShadow({ mode: 'open' })

  const style = document.createElement('style')
  style.textContent = sidebarCSS
  shadow.appendChild(style)

  const container = document.createElement('div')
  container.style.cssText = 'width:100%;height:100%;display:flex;pointer-events:all;position:relative;'
  shadow.appendChild(container)

  return createRoot(container)
}

function extractEmail(): {
  emailText: string
  emailSubject: string
  senderName: string
  threadId: string
} | null {
  try {
    const threadEl = document.querySelector(SELECTORS.threadContainer)
    if (!threadEl) return null

    const threadId = threadEl.getAttribute('data-thread-perm-id')
    if (!threadId) return null

    const subjectEl =
      document.querySelector<HTMLElement>(SELECTORS.subject) ??
      document.querySelector<HTMLElement>(SELECTORS.subjectAlt)
    const emailSubject = subjectEl?.textContent?.trim() ?? '(No subject)'

    const target = pickIncomingMessage(getThreadMessages(threadEl))
    if (!target) return null

    return {
      emailText: target.bodyText,
      emailSubject,
      senderName: target.senderName,
      threadId,
    }
  } catch {
    return null
  }
}

function checkAndAnalyse() {
  const email = extractEmail()
  if (!email) {
    if (currentState.status !== 'idle') setState({ status: 'idle' })
    return
  }

  const analyseKey = `${email.threadId}:${email.senderName}:${email.emailText.slice(0, 60)}`
  if (analyseKey === lastAnalysedKey) return

  lastAnalysedKey = analyseKey
  setState({ status: 'loading' })

  chrome.runtime.sendMessage(
    { type: 'ANALYSE_EMAIL', payload: email },
    (response: ExtResponse) => {
      if (chrome.runtime.lastError) {
        setState({ status: 'error', message: 'Extension connection error — please refresh Gmail.' })
        setPanelMode('expanded')
        return
      }
      switch (response.type) {
        case 'ANALYSE_RESULT':
          setState({ status: 'result', data: response.data })
          setPanelMode('expanded')
          break
        case 'AUTH_REQUIRED':
          setState({ status: 'auth_required' })
          setPanelMode('expanded')
          break
        case 'RATE_LIMITED':
          setState({ status: 'rate_limited', count: response.count, limit: response.limit })
          setPanelMode('expanded')
          break
        case 'ANALYSE_ERROR':
          setState({ status: 'error', message: response.error })
          setPanelMode('expanded')
          break
      }
    }
  )
}

function onDomMutation() {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(checkAndAnalyse, 300)
}

// Boot: mount sidebar and start observing
reactRoot = mountSidebar()
render()

const observer = new MutationObserver(onDomMutation)
observer.observe(document.body, { childList: true, subtree: true })

// Check immediately in case an email is already open
checkAndAnalyse()
