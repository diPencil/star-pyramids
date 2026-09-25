'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react'

type SortDirection = 'asc' | 'desc'
type SortValue = string | number | boolean | null | undefined

export function useAdminTableSort<T>(
  rows: readonly T[],
  accessors: Record<string, (row: T) => SortValue>,
  initialKey: string,
  initialDirection: SortDirection = 'desc',
) {
  const [sortKey, setSortKey] = useState(initialKey)
  const [direction, setDirection] = useState<SortDirection>(initialDirection)

  const sortedRows = useMemo(() => {
    const accessor = accessors[sortKey]
    if (!accessor) return [...rows]
    const factor = direction === 'asc' ? 1 : -1
    return rows
      .map((row, index) => ({ row, index }))
      .sort((left, right) => {
        const a = accessor(left.row)
        const b = accessor(right.row)
        let result = 0
        if (typeof a === 'number' && typeof b === 'number') result = a - b
        else if (typeof a === 'boolean' && typeof b === 'boolean') result = Number(a) - Number(b)
        else result = String(a ?? '').localeCompare(String(b ?? ''), undefined, { numeric: true, sensitivity: 'base' })
        return result === 0 ? left.index - right.index : result * factor
      })
      .map(({ row }) => row)
  }, [accessors, direction, rows, sortKey])

  const sortBy = (key: string) => {
    if (key === sortKey) setDirection((value) => value === 'asc' ? 'desc' : 'asc')
    else {
      setSortKey(key)
      setDirection('asc')
    }
  }

  return { sortedRows, sortKey, direction, sortBy }
}

export function SortableTh({ label, column, sortKey, direction, onSort }: {
  label: React.ReactNode
  column: string
  sortKey: string
  direction: SortDirection
  onSort: (key: string) => void
}) {
  const active = sortKey === column
  const Icon = !active ? ChevronsUpDown : direction === 'asc' ? ChevronUp : ChevronDown
  return <th aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
    <button type="button" className={active ? 'sp-sort-head active' : 'sp-sort-head'} onClick={() => onSort(column)}>
      <span>{label}</span><Icon size={14} aria-hidden="true" />
    </button>
  </th>
}
