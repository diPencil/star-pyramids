'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { bindDesktopChatPanel, bindMobileChatScreen, MOBILE_CHAT_QUERY } from '@/lib/support/mobile-chat-screen'
import { PublicAppearancePortal } from '../cms/public-appearance'

/** Same conversation component on both sizes; only its presentation changes. */
export function SupportChatPanel({ className, label, onClose, children }: {
  className: 'livechat-panel' | 'wa-panel'
  label: string
  onClose(): void
  children(mobile: boolean): ReactNode
}) {
  const [mobile,setMobile]=useState(false)
  const [ready,setReady]=useState(false)
  const panel=useRef<HTMLElement>(null)
  const close=useRef(onClose)
  close.current=onClose

  useEffect(()=>{
    const query=window.matchMedia(MOBILE_CHAT_QUERY)
    const sync=()=>{setMobile(query.matches);setReady(true)}
    sync();query.addEventListener('change',sync)
    return ()=>query.removeEventListener('change',sync)
  },[])

  useEffect(()=>{
    if(!ready||!panel.current)return
    if(mobile)return bindMobileChatScreen(window,document,panel.current,()=>close.current())
    // Preserve desktop's floating panel and composer autofocus.
    return bindDesktopChatPanel(document,panel.current,()=>close.current())
  },[mobile,ready])

  const view=<section ref={panel} className={`${className} support-chat-screen`} role="dialog" aria-label={label} aria-modal={mobile} tabIndex={-1}>{children(mobile)}</section>
  return mobile ? createPortal(<PublicAppearancePortal>{view}</PublicAppearancePortal>,document.body) : view
}
