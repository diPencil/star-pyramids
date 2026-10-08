// Same-document history does not fire beforeunload. The Navigation API gives
// us the destination entry without adding sentinel entries or rewriting history.
type Entry = { key: string; index: number }
type TraverseEvent = Event & { navigationType: string; destination: Entry & { sameDocument: boolean } }
type NavigationHistory = EventTarget & { currentEntry: Entry | null; traverseTo(key: string): unknown }
type NavigationWindow = Window & { navigation?: NavigationHistory }
const historyKey = '__starEnquiryHistory'
const trackedDocuments = new WeakSet<Window>()
type Position = { documentId: string; index: number }
function historyPosition(state: unknown): Position | null {
  if (!state || typeof state !== 'object' || !(historyKey in state)) return null
  const value = state[historyKey]
  if (!value || typeof value !== 'object' || !('documentId' in value) || !('index' in value)) return null
  return typeof value.documentId === 'string' && typeof value.index === 'number' ? { documentId: value.documentId, index: value.index } : null
}

export function installEnquiryHistoryTracking(browser: Window) {
  if ((browser as NavigationWindow).navigation || trackedDocuments.has(browser)) return
  trackedDocuments.add(browser)
  const history = browser.history
  // A history marker, not a credential: insecure LAN contexts may not expose
  // randomUUID even though the rest of the admin interface works.
  const documentId = browser.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
  let index = 0
  const push = history.pushState.bind(history)
  const replace = history.replaceState.bind(history)
  const tag = (state: unknown) => ({ ...(state && typeof state === 'object' ? state : {}), [historyKey]: { documentId, index } })
  replace(tag(history.state), '', browser.location.href)
  const pushState: History['pushState'] = (state: unknown, unused, url) => {
    index += 1
    try { push(tag(state), unused, url) } catch (error) { index -= 1; throw error }
  }
  const replaceState: History['replaceState'] = (state: unknown, unused, url) => replace(tag(state), unused, url)
  const update = (event: PopStateEvent) => {
    const position = historyPosition(event.state)
    if (position?.documentId === documentId) index = position.index
  }
  const hashChanged = () => {
    if (historyPosition(history.state)?.documentId === documentId) return
    index += 1
    replace(tag(history.state), '', browser.location.href)
  }
  history.pushState = pushState
  history.replaceState = replaceState
  browser.addEventListener('popstate', update, true)
  browser.addEventListener('hashchange', hashChanged)
  // Document-lifetime bookkeeping: keeping it installed also avoids stacking
  // wrappers during React Strict Mode's effect replay. It never blocks navigation.
}

export function protectEnquiryNavigation(
  browser: Window,
  isDirty: () => boolean,
  requestNavigation: (action: () => void) => void,
) {
  const navigation = (browser as NavigationWindow).navigation
  let origin = navigation?.currentEntry ?? null
  let legacyOrigin = historyPosition(browser.history.state)
  let restoring = false
  let destination: Entry | null = null
  let legacyDelta = 0
  const beforeUnload = (event: BeforeUnloadEvent) => {
    if (!isDirty()) return
    event.preventDefault()
    event.returnValue = ''
  }
  const navigate = (event: Event) => {
    const traversal = event as TraverseEvent
    if (!isDirty() || restoring || traversal.navigationType !== 'traverse' || !traversal.destination.sameDocument) return
    if (traversal.cancelable) {
      traversal.preventDefault()
      const key = traversal.destination.key
      requestNavigation(() => navigation?.traverseTo(key))
    }
    // Some browsers make rapid/repeated traversal non-cancelable. Capture
    // popstate before Next.js, restore the original entry, then ask once.
  }
  const popstate = (event: PopStateEvent) => {
    const current = navigation?.currentEntry
    if (!current || !origin) {
      const position = historyPosition(event.state)
      if (!position || !legacyOrigin || position.documentId !== legacyOrigin.documentId) return
      if (restoring && position.index === legacyOrigin.index) {
        event.stopImmediatePropagation()
        restoring = false
        const delta = legacyDelta
        legacyDelta = 0
        requestNavigation(() => browser.history.go(delta))
        return
      }
      if (!isDirty()) { legacyOrigin = position; return }
      const delta = legacyOrigin.index - position.index
      if (!delta) return
      event.stopImmediatePropagation()
      legacyDelta = -delta
      restoring = true
      browser.history.go(delta)
      return
    }
    if (restoring && current.index === origin.index) {
      event.stopImmediatePropagation()
      restoring = false
      const target = destination
      destination = null
      if (target) requestNavigation(() => navigation?.traverseTo(target.key))
      return
    }
    if (!isDirty()) { origin = current; return }
    const delta = origin.index - current.index
    if (!delta) return
    event.stopImmediatePropagation()
    destination = current
    restoring = true
    browser.history.go(delta)
  }
  const entryChanged = () => {
    if (!isDirty() && !restoring) {
      origin = navigation?.currentEntry ?? null
      legacyOrigin = historyPosition(browser.history.state)
    }
  }
  browser.addEventListener('beforeunload', beforeUnload)
  browser.addEventListener('popstate', popstate, true)
  browser.addEventListener('hashchange', entryChanged)
  navigation?.addEventListener('navigate', navigate)
  navigation?.addEventListener('currententrychange', entryChanged)
  return () => {
    browser.removeEventListener('beforeunload', beforeUnload)
    browser.removeEventListener('popstate', popstate, true)
    browser.removeEventListener('hashchange', entryChanged)
    navigation?.removeEventListener('navigate', navigate)
    navigation?.removeEventListener('currententrychange', entryChanged)
  }
}
