'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Factory,
  Search,
  ShoppingCart,
  TriangleAlert,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { assessLateRisk } from '@/lib/late-risk'
import { orderProgress, type Stage } from '@/lib/order-progress'
import { PageHeader } from '@/components/erp/PageHeader'
import { EmptyState } from '@/components/erp/EmptyState'
import { KpiCard, ProgressMeter, StatusBadge, fmtMoney } from './order-parts'

/** 1 dòng v_order_tracking (một ĐƠN) — nguồn duy nhất của sổ. */
export type OrderRow = {
  id: string
  code: string
  customer_name: string
  customer_po_no: string | null
  status: string
  currency: string
  due_date: string | null
  quote_code: string | null
  production_order_id: string | null
  lsx_code: string | null
  lsx_status: string | null
  lsx_priority: number | null
  jobs_total: number
  jobs_done: number
  ship_date: string | null
  lines_bom_pending: number
  /** Đơn vật tư ĐÃ DUYỆT chưa về đủ — hàng thật sự đang trên đường (0133). */
  pos_open: number
  /** Đơn vật tư còn nháp / chờ ký — chưa ai đặt gì với NCC (0133). */
  pos_unsent: number
  deposit_percent: number | null
  payment_method: string | null
  order_value: number
  line_count: number
  created_at: string
}

const FINAL = new Set(['delivered', 'cancelled'])

/** VND lớn → tỷ/tr cho KPI; ngoại tệ giữ nguyên số. */
function fmtMoneyShort(value: number, currency: string): string {
  if (currency === 'VND') {
    if (value >= 1_000_000_000)
      return `${(value / 1_000_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tỷ ₫`
    if (value >= 1_000_000)
      return `${(value / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 0 })} tr ₫`
    return `${value.toLocaleString('vi-VN')} ₫`
  }
  return `${value.toLocaleString('vi-VN', { maximumFractionDigits: 0 })} ${currency}`
}

function fmtD(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y.slice(2)}`
}

function sumByCur(rows: OrderRow[]): [string, number][] {
  const m = new Map<string, number>()
  for (const r of rows) m.set(r.currency, (m.get(r.currency) ?? 0) + r.order_value)
  return [...m.entries()].sort((a, b) => b[1] - a[1])
}

const SEGMENTS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'pending', label: 'Chờ GĐ duyệt' },
  { key: 'inprod', label: 'Đang sản xuất' },
  { key: 'risk', label: '⚠ Nguy cơ trễ' },
  { key: 'to_deliver', label: 'Chờ giao' },
] as const
type SegmentKey = (typeof SEGMENTS)[number]['key']

/** Nhóm LỆNH SX trong một khách — số lệnh lấy từ dòng đầu (view lặp theo đơn). */
type LsxGroup = {
  key: string
  production_order_id: string | null
  lsx_code: string | null
  rep: OrderRow
  orders: OrderRow[]
}

type CustomerGroup = {
  name: string
  orders: OrderRow[]
  lsxGroups: LsxGroup[]
}

/**
 * SỔ ĐƠN HÀNG của Giám đốc — phân tầng theo đúng chuỗi nghiệp vụ
 * KHÁCH → ĐƠN → LỆNH SX → VẬT TƯ (docs/exec-orders-redesign.md).
 *
 * Bản trước đổ phẳng 20 thẻ đơn: ROSCO chiếm 13 thẻ gần giống hệt nhau vì 13
 * đơn cùng vào một lệnh (0113). Đơn vị hiển thị nay là KHÁCH; mỗi khách mở ra
 * các lệnh, mỗi lệnh liệt kê đơn nó gộp + tiến độ SX + tình hình vật tư.
 *
 * Sổ này để XEM và đi sâu — duyệt phiếu là việc của Hộp ký (/exec). Bấm lệnh
 * mở /exec/lsx/[id] (hồ sơ đầy đủ, duyệt được ở đó).
 */
export function OrdersOverview({ rows, stages }: { rows: OrderRow[]; stages: Stage[] }) {
  const today = new Date().toISOString().slice(0, 10)
  const [q, setQ] = useState('')
  const [seg, setSeg] = useState<SegmentKey>('all')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const riskOf = (r: OrderRow) => assessLateRisk(r, today)

  // ── KPI toàn sổ (trước lọc — con số tổng không đổi theo chip) ─────────────
  const kpi = useMemo(() => {
    const bookByCur = new Map<string, number>()
    let activeCount = 0
    let inProd = 0
    let pending = 0
    let atRisk = 0
    let overdue = 0
    let dueSoon = 0
    for (const r of rows) {
      const active = !FINAL.has(r.status)
      if (active) {
        activeCount++
        bookByCur.set(r.currency, (bookByCur.get(r.currency) ?? 0) + r.order_value)
      }
      if (r.status === 'in_production') inProd++
      if (r.lsx_status === 'pending_approval') pending++
      const risk = riskOf(r)
      if (risk?.level === 'overdue') overdue++
      else if (risk?.level === 'at_risk') atRisk++
      const d = r.due_date
        ? Math.round((Date.parse(r.due_date) - Date.parse(today)) / 86_400_000)
        : null
      if (active && d != null && d >= 0 && d <= 7) dueSoon++
    }
    const book =
      [...bookByCur.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([cur, v]) => fmtMoneyShort(v, cur))
        .join(' · ') || '—'
    return { book, activeCount, inProd, pending, atRisk, overdue, dueSoon }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows])

  // ── Lọc theo ĐƠN, rồi dựng cây Khách → Lệnh → Đơn từ phần còn lại ─────────
  const customers = useMemo(() => {
    const ql = q.trim().toLowerCase()
    const filtered = rows.filter((r) => {
      if (seg === 'pending' && r.lsx_status !== 'pending_approval') return false
      if (seg === 'inprod' && r.status !== 'in_production') return false
      if (seg === 'risk' && !riskOf(r)) return false
      if (seg === 'to_deliver' && r.status !== 'completed') return false
      if (
        ql &&
        !`${r.code} ${r.customer_name} ${r.customer_po_no ?? ''} ${r.lsx_code ?? ''}`
          .toLowerCase()
          .includes(ql)
      )
        return false
      return true
    })

    const byCustomer = new Map<string, OrderRow[]>()
    for (const r of filtered) {
      const arr = byCustomer.get(r.customer_name)
      if (arr) arr.push(r)
      else byCustomer.set(r.customer_name, [r])
    }

    const groups: CustomerGroup[] = [...byCustomer.entries()].map(([name, list]) => {
      const byLsx = new Map<string, OrderRow[]>()
      for (const r of list) {
        const key = r.production_order_id ?? '∅'
        const arr = byLsx.get(key)
        if (arr) arr.push(r)
        else byLsx.set(key, [r])
      }
      const lsxGroups: LsxGroup[] = [...byLsx.entries()]
        .map(([key, orders]) => ({
          key,
          production_order_id: orders[0].production_order_id,
          lsx_code: orders[0].lsx_code,
          rep: orders[0],
          orders: [...orders].sort((a, b) =>
            (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'),
          ),
        }))
        // Nhóm "chưa phát lệnh" (∅) nổi lên đầu — việc còn nằm ngoài sản xuất.
        .sort((a, b) =>
          a.production_order_id === null
            ? -1
            : b.production_order_id === null
              ? 1
              : (a.lsx_code ?? '').localeCompare(b.lsx_code ?? ''),
        )
      return { name, orders: list, lsxGroups }
    })

    // Khách nhiều tiền nhất trước; tiền bằng nhau (đang toàn 0) thì nhiều đơn trước.
    const total = (g: CustomerGroup) => g.orders.reduce((s, r) => s + r.order_value, 0)
    return groups.sort(
      (a, b) =>
        total(b) - total(a) ||
        b.orders.length - a.orders.length ||
        a.name.localeCompare(b.name),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, q, seg])

  const shownOrders = customers.reduce((s, c) => s + c.orders.length, 0)

  function toggle(name: string) {
    setCollapsed((s) => {
      const next = new Set(s)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        breadcrumbs={[{ label: 'Ban Giám đốc', href: '/exec' }, { label: 'Sổ đơn hàng' }]}
        title="Sổ đơn hàng"
        description="Theo từng khách: đơn nào vào lệnh nào, sản xuất tới đâu, vật tư mua tới đâu. Duyệt phiếu ở Hộp ký."
      />

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard
          label="Sổ đơn đang chạy"
          value={kpi.book}
          hint={`${kpi.activeCount} đơn mở`}
        />
        <KpiCard label="Đang sản xuất" value={kpi.inProd} />
        <KpiCard
          label="Chờ GĐ duyệt"
          value={kpi.pending}
          tone={kpi.pending ? 'amber' : 'default'}
        />
        <KpiCard label="Sắp giao ≤7 ngày" value={kpi.dueSoon} />
        <KpiCard
          label="Nguy cơ trễ"
          value={kpi.atRisk}
          tone={kpi.atRisk ? 'amber' : 'default'}
        />
        <KpiCard
          label="Trễ hạn"
          value={kpi.overdue}
          tone={kpi.overdue ? 'red' : 'default'}
        />
      </div>

      {/* Tìm + chip lọc */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative">
          <Search
            className="text-muted-foreground pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2"
            aria-hidden
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm đơn, PO khách, khách, lệnh…"
            className="bg-card h-9 w-64 rounded-md border ps-8 pe-3 text-sm"
          />
        </label>
        {SEGMENTS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setSeg(s.key)}
            className={cn(
              'h-9 rounded-md border px-3 text-sm',
              seg === s.key
                ? 'border-primary bg-primary text-primary-foreground'
                : 'bg-card hover:bg-accent/50',
            )}
          >
            {s.label}
          </button>
        ))}
        <span className="text-muted-foreground ms-auto text-sm tabular-nums">
          {shownOrders} đơn · {customers.length} khách
        </span>
      </div>

      {customers.length === 0 ? (
        <EmptyState
          title="Không có đơn nào khớp"
          description="Đổi bộ lọc hoặc xoá từ khoá tìm kiếm."
        />
      ) : (
        customers.map((c) => {
          const open = !collapsed.has(c.name)
          const value = sumByCur(c.orders)
          const overdue = c.orders.filter((r) => riskOf(r)?.level === 'overdue').length
          const pending = c.orders.filter(
            (r) => r.lsx_status === 'pending_approval',
          ).length
          const nLsx = new Set(c.orders.map((r) => r.production_order_id).filter(Boolean))
            .size
          return (
            <section key={c.name} className="bg-card overflow-hidden rounded-xl border">
              {/* ── Đầu khối KHÁCH ── */}
              <button
                type="button"
                onClick={() => toggle(c.name)}
                aria-expanded={open}
                className="hover:bg-accent/40 flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-start"
              >
                {open ? (
                  <ChevronDown className="text-muted-foreground size-4 shrink-0" />
                ) : (
                  <ChevronRight className="text-muted-foreground size-4 shrink-0" />
                )}
                <span className="min-w-0 flex-1 truncate font-semibold">{c.name}</span>
                {overdue > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300">
                    <TriangleAlert className="size-3" aria-hidden /> {overdue} trễ
                  </span>
                )}
                {pending > 0 && (
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                    {pending} chờ duyệt
                  </span>
                )}
                <span className="text-muted-foreground text-sm tabular-nums">
                  {c.orders.length} đơn · {nLsx} lệnh
                </span>
                <span className="text-sm font-medium tabular-nums">
                  {value.length
                    ? value.map(([cur, v]) => fmtMoneyShort(v, cur)).join(' · ')
                    : '—'}
                </span>
              </button>

              {/* ── Các LỆNH của khách ── */}
              {open && (
                <div className="space-y-3 border-t px-4 py-3">
                  {c.lsxGroups.map((g) => (
                    <LsxBlock key={g.key} g={g} stages={stages} today={today} />
                  ))}
                </div>
              )}
            </section>
          )
        })
      )}
    </div>
  )
}

/** Một LỆNH SX (hoặc nhóm "chưa phát lệnh") + các đơn nó gộp. */
function LsxBlock({ g, stages, today }: { g: LsxGroup; stages: Stage[]; today: string }) {
  const rep = g.rep
  const noLsx = g.production_order_id === null
  const p = orderProgress(rep, stages, today)

  return (
    <div
      className={cn(
        'rounded-lg border',
        noLsx &&
          'border-amber-300 bg-amber-50/40 dark:border-amber-800 dark:bg-amber-950/20',
      )}
    >
      {/* Đầu lệnh: mã + trạng thái + tiến độ SX + vật tư — nguyên chuỗi một dòng */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b px-3 py-2">
        <span className="inline-flex min-w-0 items-center gap-1.5 text-sm font-medium">
          <Factory className="text-muted-foreground size-4 shrink-0" aria-hidden />
          {noLsx ? (
            <span className="text-amber-700 dark:text-amber-400">
              Chưa phát lệnh sản xuất
            </span>
          ) : (
            <span className="truncate">Lệnh {g.lsx_code}</span>
          )}
        </span>
        {!noLsx && <StatusBadge status={rep.status} />}
        {!noLsx && (
          <span className="w-44">
            <ProgressMeter p={p} />
          </span>
        )}
        {!noLsx && (
          <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
            <ShoppingCart className="size-3.5" aria-hidden />
            {rep.pos_open === 0 && rep.pos_unsent === 0 ? (
              'chưa có đơn vật tư'
            ) : (
              <>
                {rep.pos_open > 0 && `vật tư đang về ${rep.pos_open}`}
                {rep.pos_open > 0 && rep.pos_unsent > 0 && ' · '}
                {rep.pos_unsent > 0 && `chưa gửi NCC ${rep.pos_unsent}`}
              </>
            )}
          </span>
        )}
        {rep.lines_bom_pending > 0 && (
          <span className="text-xs text-amber-700 dark:text-amber-400">
            {rep.lines_bom_pending} SP chưa chốt BOM
          </span>
        )}
        {!noLsx && (
          <Link
            href={`/exec/lsx/${g.production_order_id}`}
            className="text-primary ms-auto inline-flex items-center gap-1 text-xs hover:underline"
          >
            Hồ sơ lệnh <ExternalLink className="size-3" aria-hidden />
          </Link>
        )}
      </div>

      {/* Các đơn trong lệnh */}
      <ul className="divide-y">
        {g.orders.map((r) => {
          const risk = assessLateRisk(r, today)
          return (
            <li
              key={r.id}
              className="grid grid-cols-2 items-center gap-x-3 gap-y-0.5 px-3 py-2 text-sm sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{r.code}</span>
                {r.customer_po_no && (
                  <span className="text-muted-foreground block truncate text-xs">
                    PO khách: {r.customer_po_no}
                  </span>
                )}
              </span>
              <span className="text-muted-foreground text-xs tabular-nums sm:w-20 sm:text-end">
                {r.line_count} dòng SP
              </span>
              <span className="tabular-nums sm:w-28 sm:text-end">
                {r.order_value > 0 ? fmtMoney(r.order_value, r.currency) : '—'}
              </span>
              <span className="col-span-2 flex items-center gap-2 sm:col-span-1 sm:w-40 sm:justify-end">
                <span className="text-muted-foreground text-xs">
                  giao {fmtD(r.due_date)}
                </span>
                {risk && (
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.5 text-[11px] font-medium',
                      risk.level === 'overdue'
                        ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                        : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
                    )}
                  >
                    {risk.level === 'overdue' ? 'trễ hạn' : 'nguy cơ trễ'}
                  </span>
                )}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
