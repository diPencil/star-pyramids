/** Presentation-only lifecycle. No messaging, storage, navigation or API effects. */
export const MOBILE_CHAT_QUERY = '(max-width: 1024px)'

export function bindDesktopChatPanel(doc: Document, panel: HTMLElement, close: () => void) {
  panel.querySelector<HTMLInputElement>('input')?.focus()
  const key=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!event.isComposing)close()}
  doc.addEventListener('keydown',key)
  return ()=>doc.removeEventListener('keydown',key)
}

export function chatViewport(win: Pick<Window, 'visualViewport' | 'innerHeight' | 'innerWidth'>) {
  const viewport = win.visualViewport
  return {
    top: Math.max(0, viewport?.offsetTop ?? 0),
    left: Math.max(0, viewport?.offsetLeft ?? 0),
    width: Math.max(1, viewport?.width || win.innerWidth),
    height: Math.max(1, viewport?.height || win.innerHeight),
  }
}

/** Bind only after the mobile dialog has been portaled directly into body. */
export function bindMobileChatScreen(win: Window, doc: Document, panel: HTMLElement, close: () => void) {
  const previousFocus = doc.activeElement as HTMLElement | null
  const scrollX = win.scrollX, scrollY = win.scrollY
  const previousStyle = { overflow: doc.body.style.overflow, position: doc.body.style.position, top: doc.body.style.top, left: doc.body.style.left, width: doc.body.style.width }
  const previousFlag = doc.body.getAttribute('data-support-chat-open')
  const background = Array.from(doc.body.children).filter(node => node !== panel && !node.contains(panel) && !['SCRIPT','STYLE','LINK'].includes(node.tagName)) as HTMLElement[]
  const inert = background.map(node => ({ node, value: node.inert }))
  inert.forEach(({node}) => { node.inert = true })
  Object.assign(doc.body.style, { overflow:'hidden', position:'fixed', top:`${-scrollY}px`, left:`${-scrollX}px`, width:'100%' })
  doc.body.setAttribute('data-support-chat-open','true')

  let firstSync = true
  const sync = () => {
    const body = panel.querySelector<HTMLElement>('.livechat-body,.wa-body')
    const followLatest = firstSync || body && body.scrollHeight - body.scrollTop - body.clientHeight < 48
    firstSync = false
    for (const [name,value] of Object.entries(chatViewport(win))) panel.style.setProperty(`--support-chat-${name}`, `${value}px`)
    // Keep the most recent message visible as the keyboard resizes the panel;
    // do not pull someone away from older messages they intentionally scrolled to.
    if (body && followLatest) body.scrollTop = body.scrollHeight
  }
  sync()
  const viewport = win.visualViewport
  viewport?.addEventListener('resize',sync)
  viewport?.addEventListener('scroll',sync)
  win.addEventListener('resize',sync)
  win.addEventListener('orientationchange',sync)

  const controls = () => Array.from(panel.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex="0"]')).filter(node => node.getClientRects().length > 0)
  // Focus Back rather than the composer: opening the screen should not summon
  // the keyboard before someone has chosen to type.
  ;(controls()[0] ?? panel).focus({preventScroll:true})
  const onKey = (event: KeyboardEvent) => {
    if (event.isComposing) return
    if (event.key === 'Escape') { event.preventDefault(); close(); return }
    if (event.key !== 'Tab') return
    const items=controls(), first=items[0], last=items[items.length-1]
    if (!first) { event.preventDefault(); panel.focus({preventScroll:true}); return }
    if (!panel.contains(doc.activeElement) || (event.shiftKey ? doc.activeElement===first : doc.activeElement===last)) {
      event.preventDefault(); (event.shiftKey ? last : first)?.focus({preventScroll:true})
    }
  }
  doc.addEventListener('keydown',onKey)
  return () => {
    viewport?.removeEventListener('resize',sync)
    viewport?.removeEventListener('scroll',sync)
    win.removeEventListener('resize',sync)
    win.removeEventListener('orientationchange',sync)
    doc.removeEventListener('keydown',onKey)
    if (panel.contains(doc.activeElement)) (doc.activeElement as HTMLElement | null)?.blur()
    inert.forEach(({node,value}) => { node.inert=value })
    Object.assign(doc.body.style,previousStyle)
    if (previousFlag===null) doc.body.removeAttribute('data-support-chat-open')
    else doc.body.setAttribute('data-support-chat-open',previousFlag)
    for (const name of ['top','left','width','height']) panel.style.removeProperty(`--support-chat-${name}`)
    const behavior=doc.documentElement.style.scrollBehavior
    doc.documentElement.style.scrollBehavior='auto'
    win.scrollTo(scrollX,scrollY)
    doc.documentElement.style.scrollBehavior=behavior
    if (previousFocus?.isConnected) previousFocus.focus({preventScroll:true})
  }
}
