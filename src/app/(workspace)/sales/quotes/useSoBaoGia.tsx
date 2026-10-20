'use client'

import { useMemo, useState } from 'react'
import { todayVn } from '@/lib/date-vn'
import {
  isExpired,
  matchTab,
  type BaoGiaRow,
  type SortKey,
  type Tab,
} from './so-bao-gia.shared'

export type SoBaoGiaProps = {
  rows: BaoGiaRow[]
  me: { id: string; ownsCustomers: boolean }
  canEdit: boolean
  canApprove: boolean
}

const PAGE = 80

export function useSoBaoGia(p: SoBaoGiaProps) {
  const today = todayVn()
  const [tab, setTab] = useState<Tab>('all')
  const [customer, setCustomer] = useState('all')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<SortKey>('new')
  const [limit, setLimit] = useState(PAGE)
  const mineCount = useMemo(
    () => p.rows.filter((r) => r.created_by === p.me.id).length,
    [p.rows, p.me.id],
  )
  const [mineOnly, setMineOnly] = useState(() => p.me.ownsCustomers && mineCount > 0)

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
      return `${r.code} ${r.customer_name} ${r.orders.map((o) => o.code).join(' ')}`
        .toLowerCase()
        .includes(ql)
    })
    const cmp: Record<SortKey, (a: BaoGiaRow, b: BaoGiaRow) => number> = {
      new: (a, b) => b.created_at.localeCompare(a.created_at),
      valid: (a, b) => (a.valid_to ?? '9999').localeCompare(b.valid_to ?? '9999'),
      customer: (a, b) =>
        a.customer_name.localeCompare(b.customer_name, 'vi') ||
        b.created_at.localeCompare(a.created_at),
      value: (a, b) => b.ref_value - a.ref_value,
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
    expired: (r: BaoGiaRow) => isExpired(r, today),
  } as const
}

export type SoBaoGiaCtx = ReturnType<typeof useSoBaoGia>
