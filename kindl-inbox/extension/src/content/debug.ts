/** Set chrome.storage.local kindl_debug = true to log extraction steps in Gmail DevTools. */
let debugEnabled = false

chrome.storage.local.get('kindl_debug', (result) => {
  debugEnabled = result.kindl_debug === true
})

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.kindl_debug) {
    debugEnabled = changes.kindl_debug.newValue === true
  }
})

export function kindlLog(...args: unknown[]): void {
  if (debugEnabled) console.log('[Kindl]', ...args)
}
