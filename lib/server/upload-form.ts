import 'server-only'

export class UploadBodyTooLarge extends Error {}

/** Bound the actual stream before multipart parsing, including chunked uploads. */
export async function readUploadForm(request: Request, maxBytes: number): Promise<FormData> {
  const declared = Number(request.headers.get('content-length'))
  if (declared > maxBytes) throw new UploadBodyTooLarge('Upload is too large.')
  const reader = request.body?.getReader()
  if (!reader) throw new Error('Missing upload body.')
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > maxBytes) {
        await reader.cancel()
        throw new UploadBodyTooLarge('Upload is too large.')
      }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  return new Response(Buffer.concat(chunks), { headers: { 'Content-Type': request.headers.get('content-type') ?? '' } }).formData()
}
