'use client'

import { useEffect, useMemo, useState } from 'react'
import { defaultBrandSettings, type BrandSettings } from './brand-settings'
export { defaultBrandSettings, type BrandSettings } from './brand-settings'
import { useBrandSeed } from '@/components/brand-context'
import { ensureStorefrontBrandSeed, ensureStorefrontSettings, getDbAccessStrip, getDbBrand, getDbPromoText, getDbSeoTitle, getDbSocial } from './storefront-settings'
import type { AccessStripOverride } from './access-strip'

// Slug helper used by catalogue forms. It is no longer prefixed with the
// former local-override 'custom-' marker, which is gone with the store.
export function slugify(title: string) {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return base || `item-${Date.now().toString(36)}`
}

/**
 * Staff preview marker.
 *
 * `publicId` is the authoritative identifier of the customer being previewed.
 * Display fields are convenience labels only - the actual records shown are
 * fetched from the permission-gated CRM API, never from this object.
 */
export type ImpersonatedCustomer = {
  publicId: string
  name: string
  email?: string
  avatar?: string
  at: string
}

const IMPERSONATE_KEY = 'sp-impersonate-customer'

export function readImpersonation(): ImpersonatedCustomer | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(IMPERSONATE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ImpersonatedCustomer
    // A publicId is required: without it no real customer record can be read.
    if (!parsed || typeof parsed.publicId !== 'string' || !parsed.publicId) return null
    return parsed
  } catch {
    return null
  }
}

export function setImpersonationMarker(customer: { publicId: string; name: string; email?: string; avatar?: string }) {
  try {
    window.localStorage.setItem(IMPERSONATE_KEY, JSON.stringify({ ...customer, at: new Date().toISOString() }))
    window.dispatchEvent(new Event('sp-impersonate'))
  } catch {
    // Impersonation unavailable without storage access.
  }
}

export async function startImpersonation(customer: { publicId: string; name: string; email?: string; avatar?: string }) {
  const previewWindow = window.open('about:blank', '_blank')
  if (previewWindow) previewWindow.opener = null
  try {
    const response = await fetch('/api/admin/customer-preview', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publicId: customer.publicId }),
    })
    const payload = (await response.json().catch(() => null)) as { error?: string } | null
    if (!response.ok) throw new Error(payload?.error || 'Could not open customer preview.')
    setImpersonationMarker(customer)
    if (previewWindow) previewWindow.location.replace('/account')
    else window.location.assign('/account')
  } catch (error) {
    previewWindow?.close()
    throw error
  }
}

export async function stopImpersonation() {
  try {
    window.localStorage.removeItem(IMPERSONATE_KEY)
    window.dispatchEvent(new Event('sp-impersonate'))
  } catch {
    // Nothing stored to clear.
  }
  await fetch('/api/admin/customer-preview', {
    method: 'DELETE',
    credentials: 'same-origin',
  }).catch(() => undefined)
}

export type InquiryChannel = 'whatsapp' | 'email'

export type Inquiry = {
  id: string
  channel: InquiryChannel
  name: string
  contact: string
  message: string
  tourSlug: string
  tourTitle: string
  at: string
}

const INQUIRY_KEY = 'sp-inquiries-v1'

export function readInquiries(): Inquiry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(INQUIRY_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (entry): entry is Inquiry =>
        typeof entry === 'object' && entry !== null &&
        typeof (entry as Inquiry).id === 'string' &&
        typeof (entry as Inquiry).message === 'string'
    )
  } catch {
    return []
  }
}

export function saveInquiry(input: Omit<Inquiry, 'id' | 'at'>): Inquiry {
  const item: Inquiry = { ...input, id: `inq-${Date.now().toString(36)}`, at: new Date().toISOString() }
  try {
    window.localStorage.setItem(INQUIRY_KEY, JSON.stringify([item, ...readInquiries()]))
    window.dispatchEvent(new Event('sp-inquiries'))
  } catch {
    // Inquiry kept for this session only.
  }
  return item
}

export function useInquiries(): Inquiry[] {
  const [inquiries, setInquiries] = useState<Inquiry[]>([])
  useEffect(() => {
    const sync = () => setInquiries(readInquiries())
    sync()
    window.addEventListener('sp-inquiries', sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener('sp-inquiries', sync)
      window.removeEventListener('storage', sync)
    }
  }, [])
  return inquiries
}

export type AdminProfile = {
  name: string
  username: string
  email: string
  country: string
  dialCode: string
  phone: string
  avatar: string
}

const PROFILE_KEY = 'sp-admin-profile-v1'

export const defaultAdminProfile: AdminProfile = {
  name: 'Super Admin',
  username: 'admin',
  email: 'admin@starpyramids.com',
  country: 'Egypt',
  dialCode: '+20',
  phone: '+20 1288222962',
  avatar: 'https://randomuser.me/api/portraits/men/32.jpg',
}

export function readAdminProfile(): AdminProfile {
  if (typeof window === 'undefined') return defaultAdminProfile
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY)
    if (!raw) return defaultAdminProfile
    const parsed = JSON.parse(raw) as Partial<AdminProfile>
    return { ...defaultAdminProfile, ...parsed }
  } catch {
    return defaultAdminProfile
  }
}

export function saveAdminProfile(patch: Partial<AdminProfile>) {
  try {
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify({ ...readAdminProfile(), ...patch }))
    window.dispatchEvent(new Event('sp-profile'))
  } catch {
    // Profile kept in memory only for this session.
  }
}

/**
 * Upload an image file to server-side media storage and resolve to its
 * public URL. The server decides the real format, generates the filename
 * and records the file; the browser never produces a data URL, so the
 * stored value survives refresh, re-login and shared links.
 *
 * `scope` selects the permission gate only — it never influences the path.
 */
export type MediaScopeInput = 'avatar' | 'brand' | 'catalogue'

export const MAX_IMAGE_UPLOAD_BYTES = 1_500_000

export async function uploadImageFile(
  file: File,
  scope: MediaScopeInput = 'catalogue',
): Promise<string | null> {
  if (!file.type.startsWith('image/') || file.size > MAX_IMAGE_UPLOAD_BYTES) {
    return null
  }
  try {
    const body = new FormData()
    body.append('scope', scope)
    body.append('file', file, file.name)
    const response = await fetch('/api/media', {
      method: 'POST',
      body,
      credentials: 'same-origin',
    })
    if (!response.ok) return null
    const data = (await response.json()) as { media?: { url?: unknown } }
    const url = data.media?.url
    return typeof url === 'string' && url.length > 0 ? url : null
  } catch {
    return null
  }
}

export function readBrandSettings(): BrandSettings {
  // Database is the source of truth (fetched once per page load);
  // useBrandSettings supplies initial server branding; no localStorage mirror.
  return { ...defaultBrandSettings, ...(getDbBrand() ?? {}) }
}

export function useBrandSettings(): BrandSettings {
  const seed = useBrandSeed()
  const [snapshot, setSnapshot] = useState(() => ({ seed, brand: { ...defaultBrandSettings, ...seed } }))
  useEffect(() => {
    // A server seed is authoritative for first paint. Never replace it with a
    // warm, possibly older module cache while the fresh settings request runs.
    setSnapshot({ seed, brand: { ...defaultBrandSettings, ...seed } })
    const sync = () => setSnapshot({ seed, brand: readBrandSettings() })
    window.addEventListener('sp-brand', sync)
    if (seed) ensureStorefrontBrandSeed(seed)
    else { sync(); ensureStorefrontSettings() }
    return () => {
      window.removeEventListener('sp-brand', sync)
    }
  }, [seed])
  return snapshot.seed === seed ? snapshot.brand : { ...defaultBrandSettings, ...seed }
}

export type SocialNetwork = 'facebook' | 'instagram' | 'tiktok' | 'youtube' | 'x' | 'linkedin' | 'whatsapp' | 'telegram' | 'pinterest'

export type SocialLink = {
  id: string
  network: SocialNetwork
  url: string
  header: boolean
  footer: boolean
}

export const SOCIAL_NETWORKS: { id: SocialNetwork; label: string }[] = [
  { id: 'facebook', label: 'Facebook' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'x', label: 'X' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'telegram', label: 'Telegram' },
  { id: 'pinterest', label: 'Pinterest' },
]

export const defaultSocialLinks: SocialLink[] = [
  { id: 'soc-facebook', network: 'facebook', url: 'https://www.facebook.com/', header: true, footer: true },
  { id: 'soc-instagram', network: 'instagram', url: 'https://www.instagram.com/', header: true, footer: true },
  { id: 'soc-tiktok', network: 'tiktok', url: 'https://www.tiktok.com/', header: true, footer: true },
  { id: 'soc-youtube', network: 'youtube', url: 'https://www.youtube.com/', header: false, footer: true },
]

export function readSocialLinks(): SocialLink[] {
  // Database is the source of truth; built-in defaults render until it arrives.
  return getDbSocial() ?? defaultSocialLinks
}

export function useSocialLinks(): SocialLink[] {
  const [links, setLinks] = useState<SocialLink[]>(defaultSocialLinks)
  useEffect(() => {
    ensureStorefrontSettings()
    const sync = () => setLinks(readSocialLinks())
    sync()
    window.addEventListener('sp-social', sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener('sp-social', sync)
      window.removeEventListener('storage', sync)
    }
  }, [])
  return links
}

export const FALLBACK_SEO_TITLE = 'STAR PYRAMIDS | Discover Egypt'
export const FALLBACK_PROMO_TEXT = 'Add two nights to any multi-day package and save 15%, with a special upgrade included.'

export function readSeoTitle(): string {
  return getDbSeoTitle() ?? FALLBACK_SEO_TITLE
}

export function readPromoText(): string {
  return getDbPromoText() ?? FALLBACK_PROMO_TEXT
}

export function useSeoTitle(): string {
  const [title, setTitle] = useState<string>(FALLBACK_SEO_TITLE)
  useEffect(() => {
    ensureStorefrontSettings()
    const sync = () => setTitle(readSeoTitle())
    sync()
    window.addEventListener('sp-seo', sync)
    return () => window.removeEventListener('sp-seo', sync)
  }, [])
  return title
}

export function usePromoText(): string {
  const [text, setText] = useState<string>(FALLBACK_PROMO_TEXT)
  useEffect(() => {
    ensureStorefrontSettings()
    const sync = () => setText(readPromoText())
    sync()
    window.addEventListener('sp-promo', sync)
    return () => window.removeEventListener('sp-promo', sync)
  }, [])
  return text
}

/** Footer accessibility strip override (null = built-in defaults). */
export function readAccessStrip(): AccessStripOverride | null {
  return getDbAccessStrip()
}

export function useAccessStrip(): AccessStripOverride | null {
  const [strip, setStrip] = useState<AccessStripOverride | null>(null)
  useEffect(() => {
    ensureStorefrontSettings()
    const sync = () => setStrip(readAccessStrip())
    sync()
    window.addEventListener('sp-access', sync)
    return () => window.removeEventListener('sp-access', sync)
  }, [])
  return strip
}
