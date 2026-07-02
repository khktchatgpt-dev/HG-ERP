'use client'

import { useEffect, useMemo, useState } from 'react'
import { EmptyState } from './EmptyState'

export type Column<T> = {
  key: string
  header: string
  cell?: (row: T, index: number) => React.ReactNode
  sortValue?: (row: T) => string | number
  className?: string
  headerClassName?: string
  /** width css value ('120px', '10%'). Nên set để tránh cột co giãn. */
  width?: string
  align?: 'left' | 'right' | 'center'
}

type Selection<T> = {
  selected: T[]
  onChange: (rows: T[]) => void
  keyFn?: (row: T) => string
}

const DEFAULT_PAGE_SIZES = [10, 25, 50, 100] as const

export function DataTable<T>({
  rows,
  columns,
  emptyState,
  selection,
  rowClassName,
  keyFn = (r) => (r as { id?: string }).id ?? String(r),
  compact = true,
  /** Bật pagination client-side. Default 25 rows/page. */
  pageSize: initialPageSize = 25,
  pageSizeOptions = DEFAULT_PAGE_SIZES,
  /** Set false để tắt pagination — dùng cho bảng ngắn (<20 row đảm bảo). */
  pagination = true,
  /** Key localStorage để nhớ page size. */
  storageKey,
}: {
  rows: T[]
  columns: Column<T>[]
  emptyState?: React.ReactNode
  selection?: Selection<T>
  rowClassName?: (row: T) => string | undefined
  keyFn?: (row: T) => string
  compact?: boolean
  pageSize?: number
  pageSizeOptions?: readonly number[]
  pagination?: boolean
  storageKey?: string
}) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [pageSize, setPageSize] = useState(initialPageSize)
  const [page, setPage] = useState(0)

  // Load persisted page size
  useEffect(() => {
    if (!storageKey || typeof window === 'undefined') return
    const saved = localStorage.getItem(`dt-${storageKey}-size`)
    if (saved) {
      const n = Number(saved)
      if (pageSizeOptions.includes(n as never)) setPageSize(n)
    }
  }, [storageKey, pageSizeOptions])

  function changePageSize(n: number) {
    setPageSize(n)
    setPage(0)
    if (storageKey && typeof window !== 'undefined') {
      localStorage.setItem(`dt-${storageKey}-size`, String(n))
    }
  }

  const sorted = useMemo(() => {
    if (!sortKey) return rows
    const col = columns.find((c) => c.key === sortKey)
    if (!col?.sortValue) return rows
    const dir = sortDir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      const va = col.sortValue!(a)
      const vb = col.sortValue!(b)
      if (va < vb) return -1 * dir
      if (va > vb) return 1 * dir
      return 0
    })
  }, [rows, columns, sortKey, sortDir])

  // Reset page khi rows đổi (filter apply)
  useEffect(() => {
    setPage(0)
  }, [rows.length])

  const total = sorted.length
  const totalPages = pagination ? Math.max(1, Math.ceil(total / pageSize)) : 1
  const safePage = Math.min(page, totalPages - 1)
  const pageRows = pagination
    ? sorted.slice(safePage * pageSize, safePage * pageSize + pageSize)
    : sorted
  const from = pagination && total > 0 ? safePage * pageSize + 1 : total > 0 ? 1 : 0
  const to = pagination ? Math.min((safePage + 1) * pageSize, total) : total

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const cellPad = compact ? 'px-3 py-1.5' : 'px-4 py-3'
  const headPad = compact ? 'px-3 py-2' : 'px-4 py-2.5'

  const selectedKeys = new Set(
    selection?.selected.map((r) => selection.keyFn?.(r) ?? keyFn(r)),
  )
  const allSelected =
    selection && pageRows.length > 0 && pageRows.every((r) => selectedKeys.has(keyFn(r)))
  const someSelected =
    selection && pageRows.some((r) => selectedKeys.has(keyFn(r))) && !allSelected

  return (
    <div className="rounded-b-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="overflow-x-auto">
        <table className="w-full table-fixed text-left text-sm">
          <colgroup>
            {selection && <col style={{ width: '36px' }} />}
            {columns.map((c) => (
              <col key={c.key} style={c.width ? { width: c.width } : undefined} />
            ))}
          </colgroup>
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50">
            <tr>
              {selection && (
                <th className={headPad}>
                  <input
                    type="checkbox"
                    checked={!!allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = !!someSelected
                    }}
                    onChange={(e) =>
                      selection.onChange(e.target.checked ? [...pageRows] : [])
                    }
                    className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700"
                  />
                </th>
              )}
              {columns.map((c) => {
                const isSorted = sortKey === c.key
                const sortable = !!c.sortValue
                const align =
                  c.align === 'right'
                    ? 'text-right'
                    : c.align === 'center'
                      ? 'text-center'
                      : 'text-left'
                return (
                  <th
                    key={c.key}
                    className={`${headPad} ${align} ${c.headerClassName ?? ''}`}
                  >
                    {sortable ? (
                      <button
                        onClick={() => toggleSort(c.key)}
                        className="inline-flex items-center gap-1 hover:text-zinc-900 dark:hover:text-white"
                      >
                        {c.header}
                        <span className="text-zinc-400">
                          {isSorted ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
                        </span>
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (selection ? 1 : 0)}>
                  {emptyState ?? (
                    <EmptyState
                      title="Không có dữ liệu"
                      description="Chưa có bản ghi phù hợp."
                    />
                  )}
                </td>
              </tr>
            ) : (
              pageRows.map((row, idx) => {
                const key = keyFn(row)
                const selected = selectedKeys.has(key)
                const extra = rowClassName?.(row)
                return (
                  <tr
                    key={key}
                    className={`${
                      selected
                        ? 'bg-blue-50 dark:bg-blue-950/20'
                        : 'hover:bg-zinc-50 dark:hover:bg-zinc-900/40'
                    } ${extra ?? ''}`}
                  >
                    {selection && (
                      <td className={cellPad}>
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={(e) => {
                            const rest = selection.selected.filter(
                              (r) => (selection.keyFn?.(r) ?? keyFn(r)) !== key,
                            )
                            selection.onChange(
                              e.target.checked ? [...rest, row] : rest,
                            )
                          }}
                          className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700"
                        />
                      </td>
                    )}
                    {columns.map((c) => {
                      const align =
                        c.align === 'right'
                          ? 'text-right'
                          : c.align === 'center'
                            ? 'text-center'
                            : ''
                      return (
                        <td
                          key={c.key}
                          className={`${cellPad} ${align} ${c.className ?? ''} align-middle`}
                        >
                          {c.cell
                            ? c.cell(row, idx)
                            : String(
                                (row as Record<string, unknown>)[c.key] ?? '',
                              )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {pagination && total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          <div className="flex items-center gap-2">
            <span>
              {from}–{to} / <b>{total}</b>
            </span>
            <span className="text-zinc-300 dark:text-zinc-700">|</span>
            <label className="flex items-center gap-1">
              Hiển thị
              <select
                value={pageSize}
                onChange={(e) => changePageSize(Number(e.target.value))}
                className="rounded border border-zinc-300 bg-white px-1 py-0.5 dark:border-zinc-700 dark:bg-zinc-950"
              >
                {pageSizeOptions.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              dòng
            </label>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(0)}
              disabled={safePage === 0}
              className="rounded border border-zinc-300 bg-white px-2 py-0.5 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-950 dark:hover:bg-zinc-900"
            >
              «
            </button>
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
              className="rounded border border-zinc-300 bg-white px-2 py-0.5 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-950 dark:hover:bg-zinc-900"
            >
              ‹
            </button>
            <span className="px-2">
              {safePage + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={safePage >= totalPages - 1}
              className="rounded border border-zinc-300 bg-white px-2 py-0.5 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-950 dark:hover:bg-zinc-900"
            >
              ›
            </button>
            <button
              onClick={() => setPage(totalPages - 1)}
              disabled={safePage >= totalPages - 1}
              className="rounded border border-zinc-300 bg-white px-2 py-0.5 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-950 dark:hover:bg-zinc-900"
            >
              »
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
