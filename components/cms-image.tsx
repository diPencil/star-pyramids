'use client'
import Image from 'next/image'
import type { ComponentProps } from 'react'

export function CmsImage(props: ComponentProps<typeof Image> & { src: string }) {
  let unoptimized = false
  if (!props.src.startsWith('/')) {
    try { unoptimized = !['images.unsplash.com', 'upload.wikimedia.org'].includes(new URL(props.src).hostname) }
    catch { unoptimized = true }
  }
  return <Image {...props} unoptimized={unoptimized} />
}
