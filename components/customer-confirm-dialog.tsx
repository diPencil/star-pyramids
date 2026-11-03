'use client'
import {useEffect,useRef,type ReactNode} from 'react'
import {X} from 'lucide-react'
import {tx,useLocale} from './locale'

export function CustomerConfirmDialog({ open, title, copy, confirmLabel, cancelLabel, onConfirm, onClose, children, primary, busy }: {
  children?: ReactNode
  primary?: boolean
  busy?: boolean
  open: boolean
  title: string
  copy: string
  /** Omitted = blocking notice mode: no destructive confirm is offered. */
  confirmLabel?: string
  /** Defaults to a short keep/dismiss wording. */
  cancelLabel?: string
  onConfirm: () => void
  onClose: () => void
}) {
  const { locale } = useLocale()

  const panelRef = useRef<HTMLDivElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)
  const restoreRef = useRef<Element | null>(null)
  useEffect(() => {
    if (!open) return
    restoreRef.current = document.activeElement
    if (primary) panelRef.current?.focus()
    else if (confirmRef.current) confirmRef.current.focus()
    else panelRef.current?.focus()
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key === 'Tab' && panelRef.current) {
        const items = Array.from(
          panelRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
          ),
        )
        if (!items.length) return
        const first = items[0]
        const last = items[items.length - 1]
        const active = document.activeElement
        if (event.shiftKey && (active === panelRef.current || active === first || !panelRef.current.contains(active))) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && (active === last || !panelRef.current.contains(active))) {
          event.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      if (restoreRef.current instanceof HTMLElement) restoreRef.current.focus()
    }
  }, [open, onClose, primary])
  if (!open) return null
  return (
    <div className="language-backdrop" role="presentation" onMouseDown={onClose}>
      <div ref={panelRef} tabIndex={-1} className="language-modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <div className="language-modal-head">
          <h2>{title}</h2>
          <button type="button" className="language-close" onClick={onClose} aria-label={tx(locale, { en: 'Close dialog', es: 'Cerrar el diálogo', it: 'Chiudi la finestra', ar: 'إغلاق الحوار' })}><X size={18} /></button>
        </div>
        <p style={{ margin: '12px 0 0', color: '#667085', fontSize: 13, lineHeight: 1.7 }}>{copy}</p>
        {children}<div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: 18 }}>
          <button type="button" className={primary ? 'outline-btn' : 'account-icon-action'} onClick={onClose}>{cancelLabel ?? (tx(locale, { en: 'Keep it', es: 'Mantener', it: 'Mantieni', ar: 'تراجع' }))}</button>
          {confirmLabel && <button ref={confirmRef} disabled={busy} type="button" className={primary ? "primary-btn" : "account-icon-action danger"} onClick={onConfirm}>{confirmLabel}</button>}
        </div>
      </div>
    </div>
  )
}
