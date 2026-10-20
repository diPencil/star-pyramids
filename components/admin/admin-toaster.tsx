'use client'

import { useSyncExternalStore, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info, Loader2, X, XCircle } from 'lucide-react'
import { useAdminLocale } from './admin-locale'

export type ToastKind = 'success' | 'error' | 'warning' | 'info' | 'loading'

export type Toast = {
  id: string
  kind: ToastKind
  message: ReactNode
  dedupeKey?: string
  createdAt: number
  expiresAt: number | null
  restored?: boolean
  transient?: boolean
}

export type ToastOptions = {
  duration?: number | null
  id?: string
  dedupeKey?: string
}

const MAX_TOASTS = 5
const TOAST_STORE_KEY = 'sp-admin-toasts'

export function toastDuration(kind: ToastKind): number | null {
  switch (kind) {
    case 'success':
    case 'info':
      return 4000
    case 'warning':
      return 5000
    case 'error':
      return 8000
    case 'loading':
      return null
  }
}

function messageKeyOf(input: { message: ReactNode; dedupeKey?: string }): string {
  if (input.dedupeKey) return input.dedupeKey
  return typeof input.message === 'string' ? input.message : ''
}

export function enqueueToast(
  current: Toast[],
  input: { message: ReactNode; duration?: number | null; id?: string; dedupeKey?: string },
  kind: ToastKind,
  now: number,
): { toasts: Toast[]; id: string; deduped: boolean } {
  const key = messageKeyOf(input)
  const expiresAt = input.duration === null
    ? null
    : now + (input.duration ?? toastDuration(kind) ?? 0)
  const id = input.id ?? `t${now}-${Math.random().toString(36).slice(2, 8)}`
  const next: Toast = {
    id,
    kind,
    message: input.message,
    dedupeKey: input.dedupeKey,
    createdAt: now,
    expiresAt,
  }
  if (key) {
    const index = current.findIndex((toast) => messageKeyOf(toast) === key)
    if (index >= 0) {
      const toasts = current.slice()
      toasts[index] = next
      return { toasts, id, deduped: true }
    }
  }
  let toasts = current.filter((toast) => toast.expiresAt === null || toast.expiresAt > now)
  toasts = toasts.length >= MAX_TOASTS ? [...toasts.slice(toasts.length - MAX_TOASTS + 1), next] : [...toasts, next]
  return { toasts, id, deduped: false }
}

export function updateToastList(
  current: Toast[],
  id: string,
  patch: { kind?: ToastKind; message?: ReactNode; duration?: number },
  now: number,
): Toast[] | null {
  const index = current.findIndex((toast) => toast.id === id)
  if (index < 0) return null
  const previous = current[index]!
  const kind = patch.kind ?? previous.kind
  const duration = patch.duration !== undefined ? patch.duration : (patch.kind ? toastDuration(kind) : undefined)
  const expiresAt = duration === null ? null : now + (duration ?? toastDuration(kind) ?? 0)
  const toasts = current.slice()
  toasts[index] = {
    ...previous,
    kind,
    message: patch.message ?? previous.message,
    expiresAt,
  }
  return toasts
}

type PersistedToast = {
  id: string
  kind: ToastKind
  message?: string
  dedupeKey?: string
  createdAt: number
  expiresAt: number | null
}

function persistToasts(list: Toast[]): void {
  try {
    const snapshot: PersistedToast[] = list
      .filter((toast) => !toast.restored && !toast.transient && toast.expiresAt !== null)
      .map((toast) => ({
        id: toast.id,
        kind: toast.kind,
        message: typeof toast.message === 'string' ? toast.message : undefined,
        dedupeKey: toast.dedupeKey,
        createdAt: toast.createdAt,
        expiresAt: toast.expiresAt,
      }))
      .filter((toast) => typeof toast.message === 'string' || typeof toast.dedupeKey === 'string')
    sessionStorage.setItem(TOAST_STORE_KEY, JSON.stringify(snapshot))
  } catch {
    return
  }
}

const listeners = new Set<() => void>()
const timers = new Map<string, ReturnType<typeof setTimeout>>()
let toasts: Toast[] = []
let hydrated = false

function emit(): void {
  for (const listener of listeners) listener()
}

function cancelTimer(id: string): void {
  const timer = timers.get(id)
  if (timer) {
    clearTimeout(timer)
    timers.delete(id)
  }
}

function scheduleTimer(toastItem: Toast): void {
  cancelTimer(toastItem.id)
  if (toastItem.expiresAt === null) return
  const timer = setTimeout(() => dismissToast(toastItem.id), Math.max(0, toastItem.expiresAt - Date.now()))
  timers.set(toastItem.id, timer)
}

function dismissToast(id: string): void {
  if (!toasts.some((toastItem) => toastItem.id === id)) return
  cancelTimer(id)
  toasts = toasts.filter((toastItem) => toastItem.id !== id)
  persistToasts(toasts)
  emit()
}

function reconcileTimers(previous: Toast[], next: Toast[], changedIds: Set<string>): void {
  const nextIds = new Set(next.map((toastItem) => toastItem.id))
  for (const toastItem of previous) {
    if (!nextIds.has(toastItem.id)) cancelTimer(toastItem.id)
  }
  for (const toastItem of next) {
    if (changedIds.has(toastItem.id)) scheduleTimer(toastItem)
  }
}

function hydrateToasts(): void {
  try {
    const raw = sessionStorage.getItem(TOAST_STORE_KEY)
    if (!raw) return
    sessionStorage.removeItem(TOAST_STORE_KEY)
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return
    const now = Date.now()
    const restored: Toast[] = []
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue
      const record = item as PersistedToast
      const message: string | undefined = record.message ?? record.dedupeKey
      if (
        (record.kind !== 'success' && record.kind !== 'error' && record.kind !== 'warning' && record.kind !== 'info')
        || typeof message !== 'string'
        || !message
        || typeof record.createdAt !== 'number'
        || record.expiresAt === null
        || typeof record.expiresAt !== 'number'
        || record.expiresAt <= now
      ) continue
      restored.push({
        id: record.id,
        kind: record.kind,
        message,
        dedupeKey: record.dedupeKey,
        createdAt: record.createdAt,
        expiresAt: record.expiresAt,
        restored: true,
      })
    }
    if (!restored.length) return
    toasts = restored.sort((a, b) => a.createdAt - b.createdAt)
    emit()
  } catch {
    return
  }
}

if (typeof window !== 'undefined' && typeof sessionStorage !== 'undefined' && !hydrated) {
  hydrated = true
  hydrateToasts()
}

export function subscribeToasts(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getToasts(): Toast[] {
  return toasts
}

export function getServerToasts(): Toast[] {
  return []
}

export function useToasts(): Toast[] {
  return useSyncExternalStore(subscribeToasts, getToasts, getServerToasts)
}

function pushToast(kind: ToastKind, input: ToastOptions & { message: ReactNode }): string {
  const previous = toasts
  const result = enqueueToast(previous, input, kind, Date.now())
  toasts = result.toasts
  reconcileTimers(previous, result.toasts, new Set([result.id]))
  persistToasts(toasts)
  emit()
  return result.id
}

export function toastUpdate(id: string, patch: { kind?: ToastKind; message?: ReactNode; duration?: number }): boolean {
  const previous = toasts
  const next = updateToastList(previous, id, patch, Date.now())
  if (!next) return false
  toasts = next
  reconcileTimers(previous, next, new Set([id]))
  persistToasts(toasts)
  emit()
  return true
}

export const toast = {
  show(kind: ToastKind, message: ReactNode, options: ToastOptions = {}): string {
    return pushToast(kind, { ...options, message })
  },
  success(message: ReactNode, options: ToastOptions = {}): string {
    return pushToast('success', { ...options, message })
  },
  error(message: ReactNode, options: ToastOptions = {}): string {
    return pushToast('error', { ...options, message })
  },
  warning(message: ReactNode, options: ToastOptions = {}): string {
    return pushToast('warning', { ...options, message })
  },
  info(message: ReactNode, options: ToastOptions = {}): string {
    return pushToast('info', { ...options, message })
  },
  loading(message: ReactNode, options: ToastOptions & { duration?: number } = {}): string {
    return pushToast('loading', { duration: null, ...options, message })
  },
  update: toastUpdate,
  dismiss: dismissToast,
  clear(): void {
    const previous = toasts
    if (!previous.length) return
    for (const toastItem of previous) cancelTimer(toastItem.id)
    toasts = []
    persistToasts(toasts)
    emit()
  },
}

const toastIcons: Record<ToastKind, typeof Info> = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
  loading: Loader2,
}

export function Toaster() {
  const active = useToasts()
  const ar = useAdminLocale() === 'ar'
  if (!active.length) return null
  return (
    <div className="sp-toaster" dir={ar ? 'rtl' : 'ltr'} role="status" aria-live="polite">
      {active.map((item) => {
        const Icon = toastIcons[item.kind] ?? Info
        return (
          <div key={item.id} className={`sp-toast is-${item.kind}`} data-toast-kind={item.kind}>
            <Icon size={18} aria-hidden="true" />
            <div className="sp-toast-copy">{item.message}</div>
            {item.kind === 'loading' ? null : (
              <button
                type="button"
                className="sp-toast-close"
                onClick={() => toast.dismiss(item.id)}
                aria-label={ar ? 'إغلاق التنبيه' : 'Dismiss notification'}
              >
                <X size={14} aria-hidden="true" />
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
