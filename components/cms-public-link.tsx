'use client'
import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'
export function CmsPublicLink({ href, className, style, children, 'aria-label': ariaLabel }: { href: string; className?: string; style?: CSSProperties; children: ReactNode; 'aria-label'?: string }) {
  if (!href) return <span className={className} style={style} aria-disabled="true">{children}</span>
  return <Link href={href} className={className} style={style} aria-label={ariaLabel} target={href.startsWith('https://') ? '_blank' : undefined} rel={href.startsWith('https://') ? 'noopener noreferrer' : undefined}>{children}</Link>
}
