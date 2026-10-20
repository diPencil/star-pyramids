import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  enqueueToast,
  toastDuration,
  updateToastList,
  type Toast,
} from '@/components/admin/admin-toaster'

const NOW = 1_000_000

const persistent = (overrides: Partial<Toast> = {}): Toast => ({
  id: 'a',
  kind: 'success',
  message: 'existing',
  createdAt: NOW,
  expiresAt: null,
  ...overrides,
})

describe('toastDuration', () => {
  it('uses the per-kind defaults documented in DESIGN_SYSTEM.md', () => {
    expect(toastDuration('success')).toBe(4000)
    expect(toastDuration('info')).toBe(4000)
    expect(toastDuration('warning')).toBe(5000)
    expect(toastDuration('error')).toBe(8000)
    expect(toastDuration('loading')).toBeNull()
  })
})

describe('enqueueToast', () => {
  it('appends a new toast with the derived expiry', () => {
    const { toasts, id, deduped } = enqueueToast([], { message: 'Saved.' }, 'success', NOW)
    expect(toasts).toHaveLength(1)
    expect(toasts[0]).toMatchObject({ id, kind: 'success', message: 'Saved.', createdAt: NOW, expiresAt: NOW + 4000 })
    expect(deduped).toBe(false)
  })

  it('supports an explicit sticky duration of null', () => {
    const { toasts } = enqueueToast([], { message: 'Uploading…', duration: null }, 'loading', NOW)
    expect(toasts[0]!.expiresAt).toBeNull()
  })

  it('replaces an existing toast with the same dedupeKey in place', () => {
    const first = enqueueToast([], { message: 'old', dedupeKey: 'save' }, 'success', NOW)
    const second = enqueueToast(first.toasts, { message: 'new', dedupeKey: 'save' }, 'error', NOW + 10)
    expect(second.deduped).toBe(true)
    expect(second.toasts).toHaveLength(1)
    expect(second.toasts[0]!.message).toBe('new')
    expect(second.toasts[0]!.kind).toBe('error')
    expect(second.toasts[0]!.expiresAt).toBe(NOW + 10 + 8000)
    expect(second.id).toBe(second.toasts[0]!.id)
  })

  it('dedupes identical string messages without a dedupeKey (shared with updateToastList)', () => {
    const first = enqueueToast([], { message: 'Duplicate text' }, 'warning', NOW)
    const second = enqueueToast(first.toasts, { message: 'Duplicate text' }, 'warning', NOW + 10)
    expect(second.deduped).toBe(true)
    expect(second.toasts).toHaveLength(1)
  })

  it('does not dedupe separate ReactNode (non-string) messages', () => {
    const a = () => 'a'
    const b = () => 'b'
    const first = enqueueToast([], { message: a() }, 'info', NOW)
    const second = enqueueToast(first.toasts, { message: b() }, 'info', NOW + 10)
    expect(second.deduped).toBe(false)
    expect(second.toasts).toHaveLength(2)
  })

  it('never exceeds MAX_TOASTS (5) and drops the oldest toast', () => {
    let current: Toast[] = []
    for (let i = 0; i < 6; i++) {
      current = enqueueToast(current, { message: `msg-${i}`, dedupeKey: `key-${i}` }, 'success', NOW).toasts
    }
    expect(current.length).toBeLessThanOrEqual(5)
    expect(current.some((toast) => toast.message === 'msg-0')).toBe(false)
    expect(current[current.length - 1]!.message).toBe('msg-5')
  })

  it('is a faithful optimistic path: replace-in-place keeps at most one toast per dedupeKey', () => {
    let current = [persistent({ message: 'first', dedupeKey: 'stream' })]
    current = enqueueToast(current, { message: 'second', dedupeKey: 'stream' }, 'success', NOW).toasts
    current = enqueueToast(current, { message: 'third', dedupeKey: 'stream' }, 'success', NOW + 10).toasts
    expect(current).toHaveLength(1)
    expect(current[0]!.message).toBe('third')
  })
})

describe('updateToastList', () => {
  it('replaces a loading toast with its final kind, duration and message', () => {
    const loading = enqueueToast([], { message: 'Working…', duration: null }, 'loading', NOW)
    const id = loading.id
    const next = updateToastList(loading.toasts, id, { kind: 'success', message: 'Done.' }, NOW + 10)
    expect(next).not.toBeNull()
    expect(next![0]!.kind).toBe('success')
    expect(next![0]!.message).toBe('Done.')
    expect(next![0]!.expiresAt).toBe(NOW + 10 + 4000)
  })

  it('returns null when the id is missing instead of throwing', () => {
    expect(updateToastList([], 'missing', { message: 'x' }, NOW)).toBeNull()
  })

  it('keeps the previous message when only the kind changes', () => {
    const base = [persistent({ id: 'keep', kind: 'info', message: 'Same text', expiresAt: NOW + 1000 })]
    const next = updateToastList(base, 'keep', { kind: 'error' }, NOW + 10)
    expect(next![0]!.message).toBe('Same text')
    expect(next![0]!.kind).toBe('error')
    expect(next![0]!.expiresAt).toBe(NOW + 10 + 8000)
  })
})

describe('toast system integration coverage', () => {
  const read = (path: string) => readFileSync(path, 'utf8')

  it('mounts the shared Toaster exactly once in the admin shell', () => {
    const shell = read('components/admin/admin-shell.tsx')
    expect(shell).toContain("import { Toaster } from './admin-toaster'")
    expect(shell.split('<Toaster />').length - 1).toBe(1)
  })

  it('documents the toast styles with z-index 60 below the modal backdrop (80)', () => {
    const css = read('app/admin/admin.css')
    expect(css).toContain('.sp-toaster')
    expect(css).toContain('.sp-toast')
    const toasterIndex = css.indexOf('.sp-toaster')
    expect(css.slice(toasterIndex, toasterIndex + 400)).toMatch(/z-index:\s*60/)
    const backdropRule = css.match(/\.sp-modal-backdrop\s*\{[^}]*\}/)
    expect(backdropRule).not.toBeNull()
    expect(backdropRule![0]).toMatch(/z-index:\s*80/)
  })

  it('never duplicates the Toaster across admin pages', () => {
    const page = read('app/admin/trips/page.tsx')
    expect(page).toContain("import { toast } from '@/components/admin/admin-toaster'")
    expect(page).not.toContain('<Toaster')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })
})
