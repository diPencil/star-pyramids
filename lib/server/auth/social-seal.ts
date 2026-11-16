import 'server-only'
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto'

export const socialSecretIdKeys: ReadonlyMap<string, string> = new Map([
  ['auth.google.clientSecret', 'auth.google.clientId'],
  ['auth.facebook.appSecret', 'auth.facebook.appId'],
])

export function socialSecretPurpose(key: string, id: string): string {
  return `${key}\0${id}`
}

export function socialEncryptionReady(): boolean {
  return /^[0-9a-f]{64}$/i.test(process.env.SOCIAL_AUTH_ENCRYPTION_KEY ?? '')
}

function key() {
  if (!socialEncryptionReady()) throw new Error('Social login encryption is not configured.')
  return Buffer.from(process.env.SOCIAL_AUTH_ENCRYPTION_KEY!, 'hex')
}

export function facebookRevocationKey(namespace: string, subject: string): string {
  return createHmac('sha256', key()).update(JSON.stringify(['facebook-login-revocation-v1', namespace, subject])).digest('hex')
}

export function sealSocialValue(value: string, purpose: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(), iv)
  cipher.setAAD(Buffer.from(purpose))
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.')
}

export function openSocialValue(value: string | null | undefined, purpose: string): string | null {
  try {
    if (!value || value.length > 4096) return null
    const [version, iv, tag, payload, extra] = value.split('.')
    if (version !== 'v1' || !iv || !tag || !payload || extra !== undefined) return null
    const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'), { authTagLength: 16 })
    decipher.setAAD(Buffer.from(purpose))
    decipher.setAuthTag(Buffer.from(tag, 'base64url'))
    return Buffer.concat([decipher.update(Buffer.from(payload, 'base64url')), decipher.final()]).toString('utf8')
  } catch { return null }
}
