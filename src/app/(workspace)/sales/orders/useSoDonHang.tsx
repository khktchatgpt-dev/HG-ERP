'use client'

import { useMemo, useState } from 'react'
import { todayVn } from '@/lib/date-vn'
import { useLocalPref } from '@/lib/use-local-pref'
import {
  countActive,
  daysBetween,
  DEFAULT_PREFS,
  EMPTY_FILTERS,
  isClosed,
  isLate,
  isMine,
  matchFilters,
  matchTab,
  monthRange,
  ownerOf,
  sortRows,
  weekRange,
  type DonRow,
  type Filters,
  type Prefs,
  type SortCol,
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

function readPrefs(raw: string): Prefs {
  try {
    const o = JSON.parse(raw) as Partial<Prefs>
    return { ...DEFAULT_PREFS, ...o }
  } catch {
    return DEFAULT_PREFS
  }
}

/**
 * State lọc / sắp / phân trang của sổ đơn — logic thuần trên mảng đã tải.
 * Tuỳ chọn cá nhân (phạm vi, cỡ trang, cột sắp, ẩn đã đóng) nhớ theo người
 * dùng trong localStorage; bộ lọc mịn là của phiên.
 */
export function useSoDonHang(p: SoDonHangProps) {
  const today = todayVn()
  const [rawPrefs, setRawPrefs] = useLocalPref(`hg:so-don-hang:${p.me.id}`, '{}')
  const prefs = useMemo(() => readPrefs(rawPrefs), [rawPrefs])
  const setPref = <K extends keyof Prefs>(k: K, v: Prefs[K]) =>
    setRawPrefs(JSON.stringify({ ...prefs, [k]: v }))

  const [tab, setTabRaw] = useState<Tab>('all')
  const [f, setF] = useState<Filters>(EMPTY_FILTERS)
  const [page, setPage] = useState(1)

  const mineCount = useMemo(
    () => p.orders.filter((o) => isMine(o, p.me.id)).length,
    [p.orders, p.me.id],
  )
  // Chưa chọn bao giờ → tự quyết: ôm khách và có đơn của mình thì mở "của tôi".
  const mineOnly = prefs.mineOnly ?? (p.me.ownsCustomers && mineCount > 0)

  const scope = useMemo(
    () => (mineOnly ? p.orders.filter((o) => isMine(o, p.me.id)) : p.orders),
    [p.orders, mineOnly, p.me.id],
  )
  const count = (t: Tab) => scope.filter((o) => matchTab(o, t, today)).length

  const filtered = useMemo(() => {
    const rows = scope.filter(
      (o) =>
        matchTab(o, tab, today) &&
        !(prefs.hideClosed && tab === 'all' && isClosed(o)) &&
        matchFilters(o, f, p.me.id),
    )
    return sortRows(rows, prefs.sort, prefs.dir)
  }, [scope, tab, prefs.hideClosed, prefs.sort, prefs.dir, f, p.me.id, today])

  const pageCount = Math.max(1, Math.ceil(filtered.length / prefs.pageSize))
  const safePage = Math.min(page, pageCount)
  const visible = filtered.slice(
    (safePage - 1) * prefs.pageSize,
    safePage * prefs.pageSize,
  )

  const customersInScope = useMemo(() => {
    const m = new Map<string, string>()
    for (const o of scope) m.set(o.customer_id, o.customer_name)
    return [...m.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
  }, [scope])
  const owners = useMemo(() => {
    const m = new Map<string, string>()
    for (const o of p.orders) {
      const id = ownerOf(o)
      const name = o.owner_id ? o.owner_name : o.created_by_name
      if (id && name) m.set(id, name)
    }
    return [...m.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
  }, [p.orders])
  const currencies = useMemo(
    () => [...new Set(p.orders.map((o) => o.currency))].sort(),
    [p.orders],
  )

  const setFilter = <K extends keyof Filters>(k: K, v: Filters[K]) => {
    setF((x) => ({ ...x, [k]: v }))
    setPage(1)
  }
  const setTab = (t: Tab) => {
    setTabRaw(t)
    setPage(1)
  }
  const quickDue = (which: 'week' | 'month' | 'late' | 'clear') => {
    if (which === 'clear') setF((x) => ({ ...x, dueFrom: '', dueTo: '' }))
    else if (which === 'late') setF((x) => ({ ...x, dueFrom: '', dueTo: today }))
    else {
      const [a, b] = which === 'week' ? weekRange(today) : monthRange(today)
      setF((x) => ({ ...x, dueFrom: a, dueTo: b }))
    }
    setPage(1)
  }
  /** Bấm tiêu đề cột: cùng cột thì đảo chiều, cột khác thì tăng dần. */
  const sortBy = (col: SortCol) => {
    if (prefs.sort === col) setPref('dir', prefs.dir === 'asc' ? 'desc' : 'asc')
    else setRawPrefs(JSON.stringify({ ...prefs, sort: col, dir: 'asc' }))
    setPage(1)
  }

  return {
    ...p,
    today,
    prefs,
    setPref,
    tab,
    setTab,
    f,
    setFilter,
    clearFilters: () => {
      setF(EMPTY_FILTERS)
      setPage(1)
    },
    activeFilters: countActive(f),
    quickDue,
    mineOnly,
    setMineOnly: (v: boolean) => {
      setPref('mineOnly', v)
      setPage(1)
    },
    mineCount,
    scope,
    count,
    filtered,
    visible,
    page: safePage,
    pageCount,
    setPage: (n: number) => setPage(Math.min(Math.max(1, n), pageCount)),
    setPageSize: (n: number) => {
      setPref('pageSize', n)
      setPage(1)
    },
    sortBy,
    customersInScope,
    owners,
    currencies,
    lateDays: (o: DonRow) => (o.due_date ? daysBetween(today, o.due_date) : null),
    isLate: (o: DonRow) => isLate(o, today),
  } as const
}

export type SoDonHangCtx = ReturnType<typeof useSoDonHang>
