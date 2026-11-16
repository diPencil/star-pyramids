import { NextResponse } from 'next/server'
import { deleteFacebookIdentity } from '@/lib/server/auth/social-account'
import { readBoundedText } from '@/lib/server/request-json'
import { facebookDeletionReceipt, readFacebookDeletionReceipt, verifyFacebookDeletion } from '@/lib/server/auth/facebook-deletion'
import { isSocialHost } from '@/lib/server/auth/social-flow'
import { getSocialConfig, socialNamespace } from '@/lib/server/auth/social-provider'

const headers = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' }
const error = (status: number) => NextResponse.json({ error: 'Unable to process the Facebook data deletion request.' }, { status, headers })

export async function POST(request: Request) {
  if (!isSocialHost(request)) return error(404)
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/x-www-form-urlencoded') return error(415)
  let signedRequest: string
  try {
    const form = new URLSearchParams(await readBoundedText(request, 4096))
    const values = form.getAll('signed_request')
    if (values.length !== 1) return error(400)
    signedRequest = values[0]
  } catch { return error(400) }

  try {
    const config = await getSocialConfig('facebook', true)
    if (!config) return error(503)
    const deletion = verifyFacebookDeletion(signedRequest, config.secret)
    if (!deletion) return error(403)
    const receipt = facebookDeletionReceipt(signedRequest, config.secret)
    // Meta timestamps use seconds, so preserve authorizations started in later seconds.
    await deleteFacebookIdentity(socialNamespace(config.clientId), deletion.subject, deletion.through)
    return NextResponse.json(receipt, { headers })
  } catch { return error(503) }
}

export function GET(request: Request) {
  const code = isSocialHost(request) && readFacebookDeletionReceipt(new URL(request.url).searchParams.get('receipt'))
  return new Response(code
    ? `Facebook data deletion complete\n\nFacebook login data covered by this request was removed.\nYour STAR PYRAMIDS account and bookings are managed separately.\n\nConfirmation code: ${code}\n`
    : 'This Facebook data deletion confirmation is invalid or has expired.\n',
  { status: code ? 200 : 404, headers: { ...headers, 'Content-Type': 'text/plain; charset=utf-8' } })
}
