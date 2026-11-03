import 'server-only'

/** Bound the stream, not just Content-Length, before parsing public JSON requests. */
export async function readBoundedJson(request: Request, maxBytes = 128 * 1024): Promise<unknown> {
  if (Number(request.headers.get('content-length')) > maxBytes) throw Error('Request too large')
  const reader = request.body?.getReader()
  if (!reader) throw Error('Missing body')
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let bytes = 0, text = ''
  try {
    for (;;) {
      const chunk = await reader.read()
      if (chunk.done) break
      bytes += chunk.value.byteLength
      if (bytes > maxBytes) { await reader.cancel(); throw Error('Request too large') }
      text += decoder.decode(chunk.value, { stream: true })
    }
    return JSON.parse(text + decoder.decode())
  } finally { reader.releaseLock() }
}
