import { NextResponse } from 'next/server'
import { isSocialProvider } from '@/lib/auth/social-providers'
import { getCurrentUser, hasPermission } from '@/lib/server/auth/auth'
import { lookupSocialCustomer } from '@/lib/server/auth/social-account'
import { createPendingSocial, isSocialHost, matchesSocialState, readSocialCookie, writeSocialCookie } from '@/lib/server/auth/social-flow'
import { exchangeSocialIdentity, getSocialConfig, socialNamespace } from '@/lib/server/auth/social-provider'
import { createSession } from '@/lib/server/auth/session'
import { markLoggedIn } from '@/lib/server/auth/users'
import { resolveSiteUrl } from '@/lib/seo/seo'
import { saveSocialMeasurement } from '@/lib/server/auth/social-measurement'

const redirect = (path: string) => NextResponse.redirect(new URL(path, resolveSiteUrl()), { status: 303,
  headers: { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' } })

export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params
  if (!isSocialProvider(provider) || !isSocialHost(request)) return NextResponse.json({}, { status: 404 })
  const flow = await readSocialCookie('flow')
  const query = new URL(request.url).searchParams
  if (!flow || flow.provider !== provider || query.getAll('state').length !== 1 || !matchesSocialState(flow, query.get('state')!)) return redirect('/login?social=failed')
  const testing = flow.screen === 'test'
  const fallback = testing ? `/admin/settings?socialTest=${provider}` : `/${flow.screen}?social=failed`
  try {
    await writeSocialCookie('flow', null)
    if (testing) {
      const actor = await getCurrentUser()
      if (!actor || actor.id !== flow.adminId || !hasPermission(actor, 'settings.edit')) return redirect('/admin/settings')
    }
    const config = await getSocialConfig(provider, testing)
    if (!config || socialNamespace(config.clientId) !== flow.namespace) return redirect(fallback)
    const code = query.get('code')
    const exchange = async () => {
      if (query.has('error') || query.getAll('code').length !== 1 || !code || !/^[\x21-\x7e]{1,2048}$/.test(code)) throw new Error('No provider code.')
      return exchangeSocialIdentity(config, code, flow.verifier)
    }
    if (testing) {
      const ok = await exchange().then(() => true, () => false)
      await writeSocialCookie('test', { provider, adminId: flow.adminId!, revision: socialNamespace(config.clientId + '\0' + config.secret), ok })
      return redirect(fallback)
    }
    const identity = await exchange()
    const user = await lookupSocialCustomer(identity)
    if (user) {
      if (!user.eligible) return redirect(fallback)
      await markLoggedIn(user.id)
      await createSession(user.id, { customerOnly: true, userAgent: request.headers.get('user-agent') ?? undefined })
      await saveSocialMeasurement('sp_login', provider, flow.analytics)
      return redirect('/account')
    }
    await createPendingSocial(identity, flow.startedAt, flow.analytics)
    return redirect(`/${flow.screen}?social=link`)
  } catch { return redirect(fallback) }
}
