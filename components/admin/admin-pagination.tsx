'use client'

import { useEffect, useMemo, useState } from 'react'
import { AdminText } from './admin-ui'
import { useAdminLocale } from './admin-locale'

export function usePagination<T>(rows: readonly T[], initialSize = 10) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(initialSize)
  const total = rows.length
  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  useEffect(() => {
    setPage(1)
  }, [total, pageSize])

  useEffect(() => {
    if (page > pageCount) setPage(pageCount)
  }, [page, pageCount])

  const pageRows = useMemo(() => rows.slice((page - 1) * pageSize, page * pageSize), [rows, page, pageSize])
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  return { page, pageSize, setPage, setPageSize, pageRows, total, from, to, pageCount }
}

function pageWindow(current: number, count: number): (number | '…')[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1)
  const set = new Set([1, 2, current - 1, current, current + 1, count - 1, count].filter((n) => n >= 1 && n <= count))
  const sorted = [...set].sort((a, b) => a - b)
  const out: (number | '…')[] = []
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1] > 1) out.push('…')
    out.push(n)
  })
  return out
}

export function AdminPagination({
  page,
  pageCount,
  onPage,
  pageSize,
  onPageSize,
  from,
  to,
  total,
}: {
  page: number
  pageCount: number
  onPage: (page: number) => void
  pageSize: number
  onPageSize: (size: number) => void
  from: number
  to: number
  total: number
}) {
  const ar = useAdminLocale() === 'ar'
  return (
    <div className="sp-pagination">
      <div className="sp-pagination-info">
        <span><AdminText en={`Showing ${from}–${to} of ${total}`} ar={`عرض ${from}–${to} من ${total}`} /></span>
        <label>
          <AdminText en="Rows:" ar="الصفوف:" />
          <select value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))} aria-label={ar ? 'عدد الصفوف في الصفحة' : 'Rows per page'}>
            {[10, 20, 30, 50].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>
      <div className="sp-page-btns" role="navigation" aria-label={ar ? 'ترقيم الصفحات' : 'Pagination'}>
        <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label={ar ? 'الصفحة السابقة' : 'Previous page'}>‹</button>
        {pageWindow(page, pageCount).map((n, i) =>
          n === '…' ? <span key={`gap-${i}`} className="sp-page-gap">…</span> : (
            <button key={n} type="button" className={n === page ? 'active' : ''} aria-current={n === page ? 'page' : undefined} onClick={() => onPage(n)}>{n}</button>
          )
        )}
        <button type="button" disabled={page >= pageCount} onClick={() => onPage(page + 1)} aria-label={ar ? 'الصفحة التالية' : 'Next page'}>›</button>
      </div>
    </div>
  )
}
