import 'server-only'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { cookies, headers } from 'next/headers'
import { resolveSiteUrl } from '@/lib/seo/seo'
import { socialProviders, type SocialProviderId } from '@/lib/auth/social-providers'
import { openSocialValue, sealSocialValue, socialEncryptionReady } from './social-seal'
import { getSocialConfig, socialNamespace, type SocialConfig, type SocialIdentity } from './social-provider'

type Flow = { state: string; verifier: string; screen: 'login' | 'register' | 'test'; provider: SocialProviderId; namespace: string; startedAt: number; adminId?: string; analytics?: string }
type Pending = SocialIdentity & { attempt: string; startedAt: number; analytics?: string }
type TestResult = { provider: SocialProviderId; adminId: string; revision: string; ok: boolean }
type CookieValues = { flow: Flow; pending: Pending; test: TestResult }
const ttl = 600
const cookieName = (kind: keyof CookieValues) => `${process.env.NODE_ENV === 'production' ? '__Host-' : ''}sp-social-${kind}`

export async function readSocialCookie<K extends keyof CookieValues>(kind: K): Promise<CookieValues[K] | null> {
  try {
    const value = openSocialValue((await cookies()).get(cookieName(kind))?.value, 'social-' + kind)
    if (!value) return null
    const parsed = JSON.parse(value) as { expires: number; value: CookieValues[K] }
    return parsed.expires > Date.now() ? parsed.value : null
  } catch { return null }
}

export async function writeSocialCookie<K extends keyof CookieValues>(kind: K, value: CookieValues[K] | null) {
  const sealed = value ? sealSocialValue(JSON.stringify({ value, expires: Date.now() + ttl * 1000 }), 'social-' + kind) : ''
  const jar = await cookies()
  jar.set(cookieName(kind), sealed, { secure: process.env.NODE_ENV === 'production', httpOnly: true, sameSite: 'lax', path: '/', maxAge: value ? ttl : 0 })
}

export function createSocialFlow(config: SocialConfig, screen: Flow['screen'], adminId?: string): Flow {
  return { state: randomBytes(32).toString('base64url'), verifier: randomBytes(32).toString('base64url'),
    screen, provider: config.provider, namespace: socialNamespace(config.clientId), startedAt: Date.now(), adminId }
}

export function matchesSocialState(flow: Flow, state: string): boolean {
  return /^[\w-]{43}$/.test(state) && timingSafeEqual(Buffer.from(flow.state), Buffer.from(state))
}

export function isSocialHost(request: Request): boolean {
  return (request.headers.get('host') ?? new URL(request.url).host) === new URL(resolveSiteUrl()).host
}

export function isSameOriginSocialLink(request: Request): boolean {
  const origin = request.headers.get('origin')
  return isSocialHost(request) && (!origin || origin === 'null') &&
    request.headers.get('sec-fetch-site') === 'same-origin' && request.headers.get('x-sp-social-link') === '1'
}

export async function createPendingSocial(identity: SocialIdentity, startedAt: number, analytics?: string) {
  await writeSocialCookie('pending', { ...identity, startedAt, analytics, attempt: randomBytes(32).toString('base64url') })
}

export async function activePendingSocial(attempt: string): Promise<Pending | null> {
  const pending = await readSocialCookie('pending')
  if (!pending || !/^[\w-]{43}$/.test(attempt) || pending.attempt !== attempt) return null
  const config = await getSocialConfig(pending.provider)
  return config && socialNamespace(config.clientId) === pending.namespace ? pending : null
}

export async function publicSocialOptions() {
  if (!socialEncryptionReady() || (await headers()).get('host') !== new URL(resolveSiteUrl()).host) return { providers: [], pending: null }
  try {
    const [pending, ...configs] = await Promise.all([readSocialCookie('pending'), ...socialProviders.map(provider => getSocialConfig(provider))] as const)
    return { providers: configs.flatMap(config => config ? [config.provider] : []),
      pending: pending && configs.some(config => config?.provider === pending.provider && socialNamespace(config.clientId) === pending.namespace) ? pending.attempt : null }
  } catch { return { providers: [], pending: null } }
}
