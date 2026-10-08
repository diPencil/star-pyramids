'use client'

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { AdminText } from './admin-ui'
import { useAdminLocale } from './admin-locale'
import { cn } from '@/lib/utils'

/**
 * Reusable admin confirmation dialog.
 *
 * Visual language reuses the existing `.sp-modal-*` admin CSS (previously
 * unclaimed by any markup) and the accessibility pattern of AdminLanguageModal:
 * `role="dialog"`, `aria-modal`, labelled heading, backdrop mousedown to
 * close, Escape to close, lightweight Tab trap, and focus returned to the
 * previously focused control.
 * EN/AR through `AdminText` nodes passed by the caller; RTL-safe via the
 * logical properties already present in the modal CSS.
 */
export function AdminConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone = 'primary',
  canConfirm = true,
  children,
  demoNote,
  hideConfirm = false,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: React.ReactNode
  description?: React.ReactNode
  confirmLabel: React.ReactNode
  cancelLabel?: React.ReactNode
  tone?: 'primary' | 'danger'
  canConfirm?: boolean
  children?: React.ReactNode
  demoNote?: React.ReactNode
  /** Read-only dialogs (e.g. role permissions) render only the neutral
   * footer action — never a second, disabled confirm button. */
  hideConfirm?: boolean
}) {
  const ar = useAdminLocale() === 'ar'
  const panelRef = useRef<HTMLDivElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const restoreRef = useRef<Element | null>(null)
  // Use refs for callbacks to avoid re-running focus effect on every parent render
  // when inline arrow functions are passed (common pattern).
  const onCloseRef = useRef(onClose)
  const onConfirmRef = useRef(onConfirm)
  onCloseRef.current = onClose
  onConfirmRef.current = onConfirm

  useEffect(() => {
    if (!open) return
    restoreRef.current = document.activeElement
    // Focus the confirm control when usable so keyboard users land on the
    // action; single-action dialogs land on the neutral footer button.
    const target = hideConfirm ? cancelRef.current : canConfirm ? confirmRef.current : panelRef.current
    target?.focus()
    const focusables = () => {
      if (!panelRef.current) return [] as HTMLElement[]
      return Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), select, textarea, input, a[href], [tabindex]:not([tabindex="-1"])',
        ),
      )
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      // Lightweight focus trap: keep Tab / Shift+Tab inside the open dialog.
      if (event.key === 'Tab') {
        const items = focusables()
        if (!items.length) return
        const first = items[0]
        const last = items[items.length - 1]
        const active = document.activeElement
        if (event.shiftKey && (active === first || !panelRef.current?.contains(active))) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && active === last) {
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
  }, [open, canConfirm, hideConfirm])

  if (!open) return null

  return (
    <div className="sp-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        ref={panelRef}
        className="sp-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sp-confirm-title"
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="sp-modal-head">
          <div>
            <strong id="sp-confirm-title">{title}</strong>
            {description && <small>{description}</small>}
          </div>
          <button type="button" className="sp-icon-btn" onClick={onClose} aria-label={ar ? 'إغلاق الحوار' : 'Close dialog'}>
            <X size={18} />
          </button>
        </div>
        {children}
        {demoNote && (
          <p className="sp-confirm-demo" role="note">{demoNote}</p>
        )}
        <div className="sp-confirm-actions">
          <button type="button" ref={cancelRef} className="sp-btn" onClick={onClose}>
            {cancelLabel ?? <AdminText en="Back" ar="رجوع" />}
          </button>
          {!hideConfirm && (
            <button
              ref={confirmRef}
              type="button"
              className={cn('sp-btn', tone === 'danger' ? 'dark' : 'primary')}
              onClick={onConfirm}
              disabled={!canConfirm}
            >
              {confirmLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
