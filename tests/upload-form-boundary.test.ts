import { describe, expect, it } from 'vitest'
import { readUploadForm, UploadBodyTooLarge } from '@/lib/server/upload-form'

describe('multipart stream boundary before parsing', () => {
  it.each([undefined, '1'])('rejects an oversized stream with absent or forged length %s', async length => {
    let cancelled = false
    const body = new ReadableStream<Uint8Array>({
      pull(controller) { controller.enqueue(new Uint8Array(65)) },
      cancel() { cancelled = true },
    })
    const headers = new Headers({ 'content-type': 'multipart/form-data; boundary=test' })
    if (length) headers.set('content-length', length)
    const request = new Request('https://example.test/upload', { method: 'POST', headers, body, duplex: 'half' } as RequestInit)
    await expect(readUploadForm(request, 64)).rejects.toBeInstanceOf(UploadBodyTooLarge)
    expect(cancelled).toBe(true)
  })
  it('rejects an oversized declared body before reading any bytes', async () => {
    const request = new Request('https://example.test/upload', { method: 'POST', headers: { 'content-length': '1000' }, body: 'small' })
    await expect(readUploadForm(request, 64)).rejects.toBeInstanceOf(UploadBodyTooLarge)
    expect(request.bodyUsed).toBe(false)
  })
  it('preserves real multipart fields and file bytes at the exact limit', async () => {
    const form = new FormData()
    form.set('scope', 'catalogue')
    form.set('file', new File(['image fixture'], 'image.png', { type: 'image/png' }))
    const request = new Request('https://example.test/upload', { method: 'POST', body: form })
    const size = (await request.clone().arrayBuffer()).byteLength
    const parsed = await readUploadForm(request, size)
    expect(parsed.get('scope')).toBe('catalogue')
    const file = parsed.get('file') as File
    expect(file.name).toBe('image.png')
    expect(file.type).toBe('image/png')
    expect(await file.text()).toBe('image fixture')
  })
})
