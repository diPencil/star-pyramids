import 'server-only'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/server/db'
import type { SocialIdentity } from './social-provider'
import { facebookRevocationKey } from './social-seal'

export class SocialIdentityConflict extends Error {}
const maximumFacebookAuthorizationAge = 21 * 60_000

export function isActiveSocialCustomer(user: { status: string; roles: string[] }) {
  return user.status === 'ACTIVE' && user.roles.length === 1 && user.roles[0] === 'CUSTOMER'
}

function identityKey({ provider, namespace, subject }: SocialIdentity) {
  return { provider, namespace, subject }
}

export async function lookupSocialCustomer(identity: SocialIdentity) {
  const row = await db.socialIdentity.findUnique({ where: { provider_namespace_subject: identityKey(identity) },
    select: { user: { select: { id: true, status: true, roles: { select: { role: { select: { key: true } } } } } } } })
  if (!row) return null
  const { id, status, roles } = row.user
  return { id, eligible: isActiveSocialCustomer({ status, roles: roles.map(({ role }) => role.key) }) }
}

export async function attachSocialIdentity(client: Prisma.TransactionClient, userId: string, identity: SocialIdentity, startedAt?: number) {
  let discardEmptyGate: string | undefined
  if (identity.provider === 'facebook') {
    if (startedAt === undefined || !Number.isSafeInteger(startedAt)) throw new SocialIdentityConflict('Facebook authorization must be restarted.')
    const digest = facebookRevocationKey(identity.namespace, identity.subject)
    // Both deletion and linking take this row lock before touching the identity.
    await client.$executeRaw`INSERT INTO facebook_login_revocations (identityKey) VALUES (${digest}) ON DUPLICATE KEY UPDATE identityKey = identityKey`
    const [gate] = await client.$queryRaw<{ revokedThrough: Date | null }[]>`SELECT revokedThrough FROM facebook_login_revocations WHERE identityKey = ${digest} FOR UPDATE`
    if (!gate || startedAt <= Date.now() - maximumFacebookAuthorizationAge || (gate.revokedThrough && startedAt <= gate.revokedThrough.getTime())) {
      throw new SocialIdentityConflict('Facebook authorization must be restarted.')
    }
    if (!gate.revokedThrough) discardEmptyGate = digest
  }
  const key = identityKey(identity)
  const authorizedAt = identity.provider === 'facebook' && startedAt !== undefined ? new Date(startedAt) : undefined
  const link = await client.socialIdentity.upsert({ where: { provider_namespace_subject: key }, create: { ...key, userId, authorizedAt }, update: {}, select: { userId: true } })
  if (link.userId !== userId) throw new SocialIdentityConflict('Social account already linked.')
  if (discardEmptyGate) await client.facebookLoginRevocation.delete({ where: { identityKey: discardEmptyGate } })
}

export async function deleteFacebookIdentity(namespace: string, subject: string, through: Date) {
  const digest = facebookRevocationKey(namespace, subject)
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`INSERT INTO facebook_login_revocations (identityKey, revokedThrough) VALUES (${digest}, ${through})
      ON DUPLICATE KEY UPDATE revokedThrough = GREATEST(COALESCE(revokedThrough, ${through}), ${through})`
    await tx.socialIdentity.deleteMany({ where: { provider: 'facebook', namespace, subject, authorizedAt: { lte: through } } })
  })
  // Older grants cannot link even if their request waited for a lock.
  await db.facebookLoginRevocation.deleteMany({ where: { revokedThrough: { lt: new Date(Date.now() - maximumFacebookAuthorizationAge) } } }).catch(() => undefined)
}
