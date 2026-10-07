'use client'

import { useMemo, useState } from 'react'
import { todayVn } from '@/lib/date-vn'
import {
  daysBetween,
  isClosed,
  isLate,
  isMine,
  matchTab,
  type DonRow,
  type SortKey,
  type Tab,
} from './so-don-hang.shared'

export type SoDonHangProps = {
  orders: DonRow[]
  customers: { id: string; name: string }[]
  canEdit: boolean
  me: { id: string; name: string; ownsCustomers: boolean }
  /** Tổng đơn trong sổ (kể cả phần chưa tải) — báo khi chạm trần tải. */
  total: number
}

const PAGE = 80

/** State lọc / sắp / phân trang của sổ đơn — logic thuần trên mảng đã tải. */
export function useSoDonHang(p: SoDonHangProps) {
  const today = todayVn()
  const [tab, setTab] = useState<Tab>('all')
  const [customer, setCustomer] = useState('all')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<SortKey>('due')
  const [hideClosed, setHideClosed] = useState(true)
  const [limit, setLimit] = useState(PAGE)
  // Ôm khách mà chưa có đơn nào → mở "của tôi" là sổ trống; chỉ mở ở "của tôi"
  // khi thật sự có đơn của mình.
  const mineCount = useMemo(
    () => p.orders.filter((o) => isMine(o, p.me.id)).length,
    [p.orders, p.me.id],
  )
  const [mineOnly, setMineOnly] = useState(() => p.me.ownsCustomers && mineCount > 0)

  /** Phạm vi = của tôi / cả phòng — mọi số đếm trên dải ô đếm tính trên phạm vi này. */
  const scope = useMemo(
    () => (mineOnly ? p.orders.filter((o) => isMine(o, p.me.id)) : p.orders),
    [p.orders, mineOnly, p.me.id],
  )
  const count = (t: Tab) => scope.filter((o) => matchTab(o, t, today)).length

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    const rows = scope.filter((o) => {
      if (!matchTab(o, tab, today)) return false
      if (customer !== 'all' && o.customer_id !== customer) return false
      if (hideClosed && tab === 'all' && isClosed(o)) return false
      if (!ql) return true
      return `${o.code} ${o.customer_name} ${o.customer_po_no ?? ''} ${o.lsx_code ?? ''} ${o.search}`
        .toLowerCase()
        .includes(ql)
    })
    const cmp: Record<SortKey, (a: DonRow, b: DonRow) => number> = {
      due: (a, b) => {
        // Đơn đã đóng xuống cuối; không hạn xuống sau có hạn.
        const ka = isClosed(a) ? 2 : a.due_date ? 0 : 1
        const kb = isClosed(b) ? 2 : b.due_date ? 0 : 1
        if (ka !== kb) return ka - kb
        return (
          (a.due_date ?? '').localeCompare(b.due_date ?? '') ||
          a.code.localeCompare(b.code)
        )
      },
      new: (a, b) => b.created_at.localeCompare(a.created_at),
      customer: (a, b) =>
        a.customer_name.localeCompare(b.customer_name, 'vi') ||
        a.code.localeCompare(b.code),
      value: (a, b) => b.total - a.total,
    }
    return rows.sort(cmp[sort])
  }, [scope, tab, customer, hideClosed, q, sort, today])

  const visible = filtered.slice(0, limit)
  const customersInScope = useMemo(() => {
    const m = new Map<string, string>()
    for (const o of scope) m.set(o.customer_id, o.customer_name)
    return [...m.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
  }, [scope])

  return {
    ...p,
    today,
    tab,
    setTab: (t: Tab) => {
      setTab(t)
      setLimit(PAGE)
    },
    customer,
    setCustomer,
    q,
    setQ,
    sort,
    setSort,
    hideClosed,
    setHideClosed,
    mineOnly,
    setMineOnly,
    mineCount,
    scope,
    count,
    filtered,
    visible,
    more: () => setLimit((n) => n + PAGE),
    customersInScope,
    lateDays: (o: DonRow) => (o.due_date ? daysBetween(today, o.due_date) : null),
    isLate: (o: DonRow) => isLate(o, today),
  } as const
}

export type SoDonHangCtx = ReturnType<typeof useSoDonHang>
