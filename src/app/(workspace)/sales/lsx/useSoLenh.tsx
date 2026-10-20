'use client'

import { useMemo, useState } from 'react'
import { todayVn } from '@/lib/date-vn'
import { matchTab, type LenhRow, type SortKey, type Tab } from './so-lenh.shared'

export type SoLenhProps = {
  rows: LenhRow[]
  /** Đơn đã xác nhận chưa có lệnh — việc "phát lệnh" làm ở trang đơn. */
  awaiting: number
  me: { id: string }
  canIssue: boolean
}

const PAGE = 80

/** State lọc / sắp / phân trang của sổ lệnh — logic thuần trên mảng đã tải. */
export function useSoLenh(p: SoLenhProps) {
  const today = todayVn()
  const [tab, setTab] = useState<Tab>('all')
  const [customer, setCustomer] = useState('all')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<SortKey>('ship')
  const [mineOnly, setMineOnly] = useState(false)
  const [limit, setLimit] = useState(PAGE)

  const mineCount = useMemo(
    () => p.rows.filter((r) => r.created_by === p.me.id).length,
    [p.rows, p.me.id],
  )
  const scope = useMemo(
    () => (mineOnly ? p.rows.filter((r) => r.created_by === p.me.id) : p.rows),
    [p.rows, mineOnly, p.me.id],
  )
  const count = (t: Tab) => scope.filter((r) => matchTab(r, t, today)).length

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    const rows = scope.filter((r) => {
      if (!matchTab(r, tab, today)) return false
      if (customer !== 'all' && r.customer_id !== customer) return false
      if (!ql) return true
      return `${r.code} ${r.customer_name} ${r.order_codes.join(' ')} ${r.next_lot?.po ?? ''}`
        .toLowerCase()
        .includes(ql)
    })
    const shipOf = (r: LenhRow) => r.next_lot?.ship_date ?? r.ship_date ?? '9999'
    const cmp: Record<SortKey, (a: LenhRow, b: LenhRow) => number> = {
      ship: (a, b) => {
        const ka = ['completed', 'cancelled'].includes(a.status) ? 1 : 0
        const kb = ['completed', 'cancelled'].includes(b.status) ? 1 : 0
        return (
          ka - kb || shipOf(a).localeCompare(shipOf(b)) || a.code.localeCompare(b.code)
        )
      },
      new: (a, b) => (b.issued_at ?? '').localeCompare(a.issued_at ?? ''),
      customer: (a, b) =>
        a.customer_name.localeCompare(b.customer_name, 'vi') ||
        a.code.localeCompare(b.code),
      code: (a, b) => a.code.localeCompare(b.code, 'vi', { numeric: true }),
    }
    return rows.sort(cmp[sort])
  }, [scope, tab, customer, q, sort, today])

  const visible = filtered.slice(0, limit)
  const customers = useMemo(() => {
    const m = new Map<string, string>()
    for (const r of scope) m.set(r.customer_id, r.customer_name)
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
    mineOnly,
    setMineOnly,
    mineCount,
    scope,
    count,
    filtered,
    visible,
    more: () => setLimit((n) => n + PAGE),
    customers,
  } as const
}

export type SoLenhCtx = ReturnType<typeof useSoLenh>
