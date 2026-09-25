import Link from 'next/link'
import { Search, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

const palette = ['#163A96', '#F7951D', '#0E9F6E', '#7C3AED', '#DB2777', '#0EA5E9']

function initials(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function colorFor(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 997
  return palette[h % palette.length]
}

export function Avatar({
  name,
  src,
  size = 40,
  online,
  className,
}: {
  name: string
  src?: string
  size?: number
  online?: boolean
  className?: string
}) {
  return (
    <span className={cn('sp-avatar', className)} style={{ width: size, height: size }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} width={size} height={size} loading="lazy" />
      ) : (
        <span className="sp-avatar-fallback" style={{ background: colorFor(name) }}>
          {initials(name)}
        </span>
      )}
      {online !== undefined && <i className={online ? 'on' : 'off'} />}
    </span>
  )
}

export function Delta({ value }: { value: number }) {
  const up = value >= 0
  return (
    <span className={up ? 'sp-delta up' : 'sp-delta down'}>
      {up ? '+' : ''}
      {value}%
    </span>
  )
}

export function Card({
  title,
  sub,
  action,
  children,
  className,
}: {
  title: React.ReactNode
  sub?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn('sp-card', className)}>
      <header className="sp-card-head">
        <div>
          <h3>{title}</h3>
          {sub && <p>{sub}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  )
}

export function StatusPill({ status }: { status: string }) {
  return <span className={`sp-pill is-${status}`}>{status}</span>
}

export type AdminStat = {
  label: React.ReactNode
  value: React.ReactNode
  note?: React.ReactNode
  icon: React.ComponentType<{ size?: number; className?: string }>
  tone?: 'blue' | 'orange' | 'green' | 'violet'
}

export function AdminStats({ items }: { items: AdminStat[] }) {
  return <div className="sp-module-stats">
    {items.map(({ label, value, note, icon: Icon, tone = 'blue' }, index) => <section className="sp-module-stat" key={index}>
      <span className={`sp-module-stat-icon ${tone}`}><Icon size={19} /></span>
      <div><small>{label}</small><strong>{value}</strong>{note && <p>{note}</p>}</div>
    </section>)}
  </div>
}

export function AdminTableTools({
  query,
  onQueryChange,
  placeholder = 'Search records...',
  children,
}: {
  query: string
  onQueryChange: (value: string) => void
  placeholder?: string
  children?: React.ReactNode
}) {
  return <div className="sp-table-tools">
    <label className="sp-table-search">
      <Search size={16} aria-hidden="true" />
      <input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder={placeholder} aria-label={placeholder} />
    </label>
    {children && <div className="sp-table-filters">{children}</div>}
  </div>
}

export function AdminTableWrap({ children }: { children: React.ReactNode }) {
  return <div className="sp-table-wrap">{children}</div>
}

export function AdminIconAction({
  icon: Icon,
  label,
  href,
  onClick,
  tone = 'default',
  disabled,
}: {
  icon: LucideIcon
  label: string
  href?: string
  onClick?: () => void
  tone?: 'default' | 'success' | 'danger'
  disabled?: boolean
}) {
  const className = cn('sp-table-action', tone !== 'default' && tone)
  if (href) return <Link href={href} className={className} aria-label={label} title={label}><Icon size={16} /></Link>
  return <button type="button" className={className} onClick={onClick} disabled={disabled} aria-label={label} title={label}><Icon size={16} /></button>
}

export function AdminTableActions({ children }: { children: React.ReactNode }) {
  return <span className="sp-table-actions">{children}</span>
}

export function AdminEmpty({ title = 'No matching records', copy = 'Try changing the search or filters.' }: { title?: React.ReactNode; copy?: React.ReactNode }) {
  return <div className="sp-admin-empty"><Search size={24} /><strong>{title}</strong><span>{copy}</span></div>
}

export function AdminText({ en, ar }: { en: React.ReactNode; ar: React.ReactNode }) {
  return <><span className="sp-l10n-en">{en}</span><span className="sp-l10n-ar">{ar}</span></>
}
