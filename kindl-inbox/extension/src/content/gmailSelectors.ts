// Gmail DOM selectors — centralised so future DOM changes only need one edit.
// These are best-effort; Gmail's class names change without notice.
// All extraction is wrapped in try/catch with a graceful fallback.
export const SELECTORS = {
  // Thread-level identifier — stable attribute for deduplication
  threadContainer: '[data-thread-perm-id]',

  // Individual message in a thread
  messageContainer: '[data-message-id]',
  messageContainerAlt: '.gs',

  // Message body (primary, then fallbacks — Gmail changes class names periodically)
  messageBody: '.a3s.aiL',
  messageBodyAlt: '.ii.gt',
  messageBodyAlt2: '.a3s',

  // Subject line (primary, then fallback)
  subject: 'h2.hP',
  subjectAlt: '.ha h2',
  subjectAlt2: '[data-thread-perm-id] h2',

  // Sender name/email on a message header
  senderName: '.gD',
  senderEmail: '.gD[email]',

  // Quoted reply section to strip before extracting body text
  quotedReply: '.gmail_quote',

  // Gmail main reading pane (messages live here, not inside data-thread-perm-id)
  mainPane: 'div[role="main"]',

  // Thread view container — presence confirms we're in an open thread
  threadView: '.adn.ads',

  // Gmail account button (aria-label contains the signed-in email)
  accountButton: '[aria-label*="Google Account"]',
} as const
