import { NextResponse } from 'next/server'
import { isSocialProvider } from '@/lib/auth/social-providers'
import { getCurrentUser, hasPermission } from '@/lib/server/auth/auth'
import { createSocialFlow, isSocialHost, readSocialCookie, writeSocialCookie } from '@/lib/server/auth/social-flow'
import { getSocialConfig, socialAuthorizationUrl, socialCallbackUrl, socialNamespace } from '@/lib/server/auth/social-provider'
import { resolveSiteUrl } from '@/lib/seo/seo'
import { facebookDeletionUrl } from '@/lib/server/auth/facebook-deletion'
import { SOCIAL_MEASUREMENT_HEADER } from '@/lib/tracking/auth/social-measurement'
import { isProductionTrackingHost, isTrackingGrant } from '@/lib/tracking/tracking'

type Context = { params: Promise<{ provider: string }> }
const headers = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' }

export async function GET(request: Request, { params }: Context) {
  const { provider } = await params
  if (!isSocialProvider(provider) || !isSocialHost(request)) return NextResponse.json({}, { status: 404, headers })
  try {
    const actor = await getCurrentUser()
    if (!actor || !hasPermission(actor, 'settings.edit')) return NextResponse.json({}, { status: 403, headers })
    const config = await getSocialConfig(provider, true)
    const result = await readSocialCookie('test')
    const matches = config && result?.provider === provider && result.adminId === actor.id && result.revision === socialNamespace(config.clientId + '\0' + config.secret)
    return NextResponse.json({ configured: Boolean(config), test: matches ? result.ok : null, callbackUrl: socialCallbackUrl(provider),
      ...(provider === 'facebook' ? { deletionUrl: facebookDeletionUrl() } : {}) }, { headers })
  } catch { return NextResponse.json({}, { status: 503, headers }) }
}

export async function POST(request: Request, { params }: Context) {
  const { provider } = await params
  const origin = resolveSiteUrl()
  const sentOrigin = request.headers.get('origin')
  const sameOrigin = sentOrigin === origin || ((!sentOrigin || sentOrigin === 'null') && request.headers.get('sec-fetch-site') === 'same-origin')
  if (!isSocialProvider(provider) || !isSocialHost(request) || !sameOrigin || request.headers.get('x-sp-social-start') !== '1') return NextResponse.json({}, { status: 403, headers })
  const mode = new URL(request.url).searchParams.get('mode')
  if (mode !== 'login' && mode !== 'register' && mode !== 'test') return NextResponse.json({}, { status: 400, headers })
  try {
    const actor = mode === 'test' ? await getCurrentUser() : null
    if (mode === 'test' && (!actor || !hasPermission(actor, 'settings.edit'))) return NextResponse.json({}, { status: 403, headers })
    const config = await getSocialConfig(provider, mode === 'test')
    if (config) {
      const flow = createSocialFlow(config, mode, actor?.id)
      const grant = request.headers.get(SOCIAL_MEASUREMENT_HEADER)
      if (mode !== 'test' && isProductionTrackingHost(process.env.NODE_ENV, new URL(origin).host) && isTrackingGrant(grant)) flow.analytics = grant
      await writeSocialCookie(mode === 'test' ? 'test' : 'pending', null)
      await writeSocialCookie('flow', flow)
      return NextResponse.json({ authorizationUrl: socialAuthorizationUrl(config, flow.state, flow.verifier).href }, { headers })
    }
  } catch { /* Provider availability does not affect password authentication. */ }
  return NextResponse.json({}, { status: 503, headers })
}
