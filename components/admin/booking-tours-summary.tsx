import Link from 'next/link'

/** One booking row; native disclosure stays keyboard-accessible without a popup. */
export function BookingToursSummary({ titles, reference }: { titles: readonly string[]; reference: string }) {
  const href = `/admin/bookings/${encodeURIComponent(reference)}`
  if (!titles.length) return <>No tour items</>
  return <>
    <Link href={href}>{titles[0]}</Link>
    {titles.length > 1 && <details>
      <summary aria-label={`Show all ${titles.length} booked tours`} style={{ cursor: 'pointer', color: 'var(--sp-blue)' }}>+{titles.length - 1} more</summary>
      <ul>{titles.map((title, index) => <li key={index}><Link href={href}>{title}</Link></li>)}</ul>
    </details>}
  </>
}
