'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  ChevronUp,
} from 'lucide-react'
import { EmptyState } from './EmptyState'
import { cn } from '@/lib/utils'

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

  // Load persisted page size — phải sync sau hydration: lazy init đọc
  // localStorage lúc render sẽ lệch với HTML server (hydration mismatch).
  useEffect(() => {
    if (!storageKey || typeof window === 'undefined') return
    const saved = localStorage.getItem(`dt-${storageKey}-size`)
    if (saved) {
      const n = Number(saved)
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync 1 lần từ localStorage sau hydration
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

  // Reset page khi rows đổi (filter apply) — adjust-during-render thay vì effect
  const [prevRowCount, setPrevRowCount] = useState(rows.length)
  if (rows.length !== prevRowCount) {
    setPrevRowCount(rows.length)
    setPage(0)
  }

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

  // Checkbox native (giữ indeterminate qua ref) nhưng ăn màu hành động của theme.
  const checkboxCls = 'size-4 rounded border-[var(--input)] accent-[var(--primary)]'

  // table-fixed + w-full: khung hẹp hơn tổng width cứng thì cột KHÔNG khai
  // width bị bóp về 0px và cột sau đè lên (bug 0133). Đặt sàn min-width = tổng
  // px đã khai + 160px/cột co giãn để overflow-x-auto cuộn ngang thay vì đè.
  const FLEX_COL_MIN = 160
  const tableMinWidth =
    (selection ? 36 : 0) +
    columns.reduce((sum, c) => {
      const px = c.width ? /^(\d+(?:\.\d+)?)px$/.exec(c.width) : null
      return sum + (px ? Number(px[1]) : FLEX_COL_MIN)
    }, 0)

  return (
    <div className="bg-card rounded-b-lg border">
      <div className="overflow-x-auto">
        <table
          className="w-full table-fixed text-left text-sm"
          style={{ minWidth: tableMinWidth }}
        >
          <colgroup>
            {selection && <col style={{ width: '36px' }} />}
            {columns.map((c) => (
              <col key={c.key} style={c.width ? { width: c.width } : undefined} />
            ))}
          </colgroup>
          <thead className="t-label text-muted-foreground bg-muted/50 border-b">
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
                    className={checkboxCls}
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
                    className={`${headPad} ${align} font-medium ${c.headerClassName ?? ''}`}
                  >
                    {sortable ? (
                      <button
                        onClick={() => toggleSort(c.key)}
                        className={cn(
                          'hover:text-foreground inline-flex items-center gap-1 transition-colors',
                          isSorted && 'text-foreground',
                        )}
                      >
                        {c.header}
                        {isSorted ? (
                          sortDir === 'asc' ? (
                            <ChevronUp className="size-3.5 text-[var(--primary)]" />
                          ) : (
                            <ChevronDown className="size-3.5 text-[var(--primary)]" />
                          )
                        ) : (
                          <ChevronsUpDown className="size-3 opacity-60" />
                        )}
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className="divide-border/60 divide-y">
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
                    className={cn(
                      'transition-colors',
                      selected ? 'bg-[var(--accent)]' : 'hover:bg-[var(--accent)]/50',
                      extra,
                    )}
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
                            selection.onChange(e.target.checked ? [...rest, row] : rest)
                          }}
                          className={checkboxCls}
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
                          className={`${cellPad} ${align} ${c.className ?? ''} align-top`}
                        >
                          {c.cell
                            ? c.cell(row, idx)
                            : String((row as Record<string, unknown>)[c.key] ?? '')}
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
        <div className="text-muted-foreground bg-muted/40 flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="t-data text-[12px]">
              {from}–{to} / <b className="text-foreground">{total}</b>
            </span>
            <span className="text-border">|</span>
            <label className="flex items-center gap-1">
              Hiển thị
              <select
                value={pageSize}
                onChange={(e) => changePageSize(Number(e.target.value))}
                className="border-input bg-card focus-visible:border-ring focus-visible:ring-ring/50 rounded-md border px-1.5 py-0.5 outline-none focus-visible:ring-[3px]"
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
            <PagerButton
              onClick={() => setPage(0)}
              disabled={safePage === 0}
              label="Trang đầu"
            >
              «
            </PagerButton>
            <PagerButton
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
              label="Trang trước"
            >
              <ChevronLeft className="size-3.5" />
            </PagerButton>
            <span className="t-data px-2 text-[12px]">
              {safePage + 1} / {totalPages}
            </span>
            <PagerButton
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={safePage >= totalPages - 1}
              label="Trang sau"
            >
              <ChevronRight className="size-3.5" />
            </PagerButton>
            <PagerButton
              onClick={() => setPage(totalPages - 1)}
              disabled={safePage >= totalPages - 1}
              label="Trang cuối"
            >
              »
            </PagerButton>
          </div>
        </div>
      )}
    </div>
  )
}

function PagerButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void
  disabled: boolean
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="border-input bg-card hover:bg-accent hover:text-accent-foreground grid h-6.5 min-w-6.5 place-items-center rounded-md border px-1 transition-colors disabled:pointer-events-none disabled:opacity-40"
    >
      {children}
    </button>
  )
}
