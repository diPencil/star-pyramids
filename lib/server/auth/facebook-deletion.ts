import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { resolveSiteUrl } from '@/lib/seo/seo'
import { openSocialValue, sealSocialValue } from './social-seal'

const day = 86_400
const receiptPurpose = 'facebook-data-deletion-receipt-v1'
export const facebookDeletionUrl = () => `${resolveSiteUrl()}/api/auth/facebook/data-deletion`

export function verifyFacebookDeletion(signedRequest: string, secret: string, now = Date.now()) {
  const [signature, payload, extra] = signedRequest.split('.')
  if (!signature || !payload || extra !== undefined || !/^[\w-]{43}$/.test(signature) || !/^[\w-]{1,3072}$/.test(payload)) return null
  const expected = createHmac('sha256', secret).update(payload).digest('base64url')
  if (!timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return null
  try {
    const { user_id, issued_at, expires, algorithm } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    const seconds = Math.floor(now / 1000)
    if (algorithm !== 'HMAC-SHA256' || typeof user_id !== 'string' || !/^\d{1,64}$/.test(user_id) ||
        !Number.isSafeInteger(issued_at) || issued_at < seconds - 7 * day || issued_at > seconds + 60 ||
        (expires !== undefined && expires !== 0 && (!Number.isSafeInteger(expires) || expires <= seconds))) return null
    return { subject: user_id, through: new Date(Math.min(now, issued_at * 1000 + 999)) }
  } catch { return null }
}

export function facebookDeletionReceipt(signedRequest: string, secret: string, now = Date.now()) {
  const code = createHmac('sha256', secret).update(`${receiptPurpose}\0${signedRequest}`).digest('hex').slice(0, 32)
  const proof = sealSocialValue(JSON.stringify({ code, expires: now + 30 * day * 1000 }), receiptPurpose)
  const url = new URL(facebookDeletionUrl())
  url.searchParams.set('receipt', proof)
  return { url: url.href, confirmation_code: code }
}

export function readFacebookDeletionReceipt(proof: string | null, now = Date.now()): string | null {
  try {
    const receipt = openSocialValue(proof, receiptPurpose)
    if (!receipt) return null
    const { code, expires } = JSON.parse(receipt)
    return typeof code === 'string' && /^[a-f0-9]{32}$/.test(code) && Number.isSafeInteger(expires) && expires > now ? code : null
  } catch { return null }
}
