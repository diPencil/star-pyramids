import { NextResponse } from 'next/server'
import { getCurrentUser, hasPermission } from '@/lib/server/auth'
import { isSameOriginRequest } from '@/lib/server/csrf'
import { checkMediaUploadRateLimit, storeUploadedImage, MediaUploadError } from '@/lib/server/media'
import { storeUploadedVideo, VideoUploadError } from '@/lib/server/journey-video-storage'
import { MAX_HERO_VIDEO_BYTES } from '@/lib/website-heroes'
import { readUploadForm, UploadBodyTooLarge } from '@/lib/server/upload-form'
export const runtime = 'nodejs'
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  if (!hasPermission(user, 'settings.edit')) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  const limit = await checkMediaUploadRateLimit(user.id)
  if (!limit.allowed) return NextResponse.json({ error: 'Too many uploads.' }, { status: 429 })
  let form: FormData
  try { form = await readUploadForm(request, MAX_HERO_VIDEO_BYTES + 65536) }
  catch (error) { return NextResponse.json({ error: error instanceof UploadBodyTooLarge ? 'Upload is too large.' : 'Invalid upload.' }, { status: error instanceof UploadBodyTooLarge ? 413 : 400 }) }
  const file = form.get('file')
  const type = form.get('type')
  if (!(file instanceof File) || (type !== 'image' && type !== 'video')) return NextResponse.json({ error: 'Choose an image or MP4/WebM video.' }, { status: 400 })
  const validName = type === 'video' ? /\.(mp4|webm)$/i.test(file.name) : /\.(jpe?g|png|webp|gif)$/i.test(file.name)
  const validMime = type === 'video' ? ['video/mp4', 'video/webm'].includes(file.type) : ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)
  if (!validName || !validMime) return NextResponse.json({ error: 'File extension and MIME type must match a supported media format.' }, { status: 400 })
  try {
    const media = type === 'video'
      ? await storeUploadedVideo({ file, uploaderId: user.id, maxBytes: MAX_HERO_VIDEO_BYTES })
      : await storeUploadedImage({ file, uploaderId: user.id, scope: 'brand' })
    return NextResponse.json({ media }, { status: 201 })
  } catch (error) {
    if (error instanceof MediaUploadError || error instanceof VideoUploadError) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ error: 'Could not save hero media.' }, { status: 503 })
  }
}
