import 'server-only'
import { createHash, createHmac } from 'node:crypto'
import { resolveSiteUrl } from '@/lib/seo/seo'
import { db } from '@/lib/server/db'
import type { SocialProviderId } from '@/lib/auth/social-providers'
import { openSocialValue, socialSecretPurpose } from './social-seal'

const graphVersion = 'v25.0'
export type SocialConfig = { provider: SocialProviderId; clientId: string; secret: string }
export type SocialIdentity = { provider: SocialProviderId; namespace: string; subject: string }

export const socialCallbackUrl = (provider: SocialProviderId) => `${resolveSiteUrl()}/api/auth/callback/${provider}`
export const socialNamespace = (clientId: string) => createHash('sha256').update(clientId).digest('hex')

export async function getSocialConfig(provider: SocialProviderId, testing = false): Promise<SocialConfig | null> {
  const prefix = 'auth.' + provider
  const idKey = prefix + (provider === 'google' ? '.clientId' : '.appId')
  const secretKey = prefix + (provider === 'google' ? '.clientSecret' : '.appSecret')
  const enabledKey = prefix + '.enabled'
  const settings = await db.siteSetting.findMany({ where: { key: { in: [idKey, secretKey, enabledKey] } }, select: { key: true, value: true } })
  const values = new Map(settings.map(({ key, value }) => [key, value]))
  const id = values.get(idKey)
  const pattern = provider === 'google' ? /^[\w-]+\.apps\.googleusercontent\.com$/ : /^\d{5,32}$/
  if ((!testing && values.get(enabledKey) !== 'true') || !id || !pattern.test(id)) return null
  const secret = openSocialValue(values.get(secretKey), socialSecretPurpose(secretKey, id))
  if (!secret) return null
  return { provider, clientId: id, secret }
}

export function socialAuthorizationUrl(config: SocialConfig, state: string, verifier: string): URL {
  const google = config.provider === 'google'
  const url = new URL(google ? 'https://accounts.google.com/o/oauth2/v2/auth' : `https://www.facebook.com/${graphVersion}/dialog/oauth`)
  url.search = new URLSearchParams({ client_id: config.clientId, redirect_uri: socialCallbackUrl(config.provider),
    response_type: 'code', scope: google ? 'openid' : 'public_profile', state,
    ...(google ? { code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' } : {}),
  }).toString()
  return url
}

async function readJson(url: URL, options: RequestInit = {}) {
  const response = await fetch(url, { ...options, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(8000) })
  if (!response.ok) throw new Error('Provider request failed.')
  return await response.json() as Record<string, unknown>
}

export async function exchangeSocialIdentity(config: SocialConfig, code: string, verifier: string): Promise<SocialIdentity> {
  const google = config.provider === 'google'
  const tokenUrl = new URL(google ? 'https://oauth2.googleapis.com/token' : `https://graph.facebook.com/${graphVersion}/oauth/access_token`)
  const body = new URLSearchParams({ client_id: config.clientId, client_secret: config.secret,
    redirect_uri: socialCallbackUrl(config.provider), code,
    ...(google ? { grant_type: 'authorization_code', code_verifier: verifier } : {}),
  })
  if (!google) tokenUrl.search = body.toString()
  const response = await readJson(tokenUrl, google ? { method: 'POST', body } : undefined)
  const token = response.access_token
  if (typeof token !== 'string' || !/^[\x21-\x7e]{1,4096}$/.test(token)) throw new Error('Provider token unavailable.')
  const userUrl = new URL(google ? 'https://openidconnect.googleapis.com/v1/userinfo' : `https://graph.facebook.com/${graphVersion}/me`)
  if (!google) {
    userUrl.searchParams.set('fields', 'id')
    userUrl.searchParams.set('appsecret_proof', createHmac('sha256', config.secret).update(token).digest('hex'))
  }
  const profile = await readJson(userUrl, { headers: { Authorization: `Bearer ${token}` } })
  const subject = google ? profile.sub : profile.id
  const pattern = google ? /^[A-Za-z0-9_-]{1,255}$/ : /^\d{1,64}$/
  if (typeof subject !== 'string' || !pattern.test(subject)) throw new Error('Provider identity unavailable.')
  return { provider: config.provider, namespace: socialNamespace(config.clientId), subject }
}
