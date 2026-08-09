import { posService } from '@/modules/dept/supply/pos.service'
import { posRepo } from '@/modules/dept/supply/pos.repo'
import { lsxService } from '@/modules/dept/production/lsx.service'
import { ordersRepo } from '@/modules/dept/sales/orders.repo'
import { stockRepo } from '@/modules/dept/warehouse/stock.repo'
import { assessPoLate } from '@/lib/late-risk'
import { assertAction } from '@/modules/core/rbac/rbac.service'
import type { User } from '@/modules/core/users/users.repo'

/**
 * BẢNG TIN ĐIỀU HÀNH của Ban Giám đốc (/exec) — giới hạn ở thông tin trọng yếu
 * của hai phòng đang thật sự vận hành trên hệ thống: BÁN (Sale) và MUA (Cung ứng).
 * Xem `docs/exec-gd-sale-cung-ung-plan.md`.
 *
 * Nguyên tắc: quản trị theo NGOẠI LỆ — việc cần Giám đốc quyết và thứ đang trục
 * trặc đứng trước mọi con số đẹp. Chỉ đọc, mọi thẻ dẫn về màn tác nghiệp của phòng.
 *
 * Guard: `exec.tower.view` (cùng cổng với khu điều hành cũ) — Giám đốc/quản lý.
 */

const DAY_MS = 86_400_000

/** Số ngày từ mốc tới hôm nay (âm = còn hạn). Cắt theo NGÀY, bỏ phần giờ. */
function daysSince(iso: string | null, todayIso: string): number | null {
  if (!iso) return null
  const a = Date.parse(`${iso.slice(0, 10)}T00:00:00Z`)
  const b = Date.parse(`${todayIso}T00:00:00Z`)
  if (Number.isNaN(a)) return null
  return Math.round((b - a) / DAY_MS)
}

/** Đơn hàng coi là ĐANG MỞ: đã chốt nhưng chưa giao xong / chưa huỷ. */
const OPEN_ORDER_STATUSES = [
  'confirmed',
  'lsx_pending',
  'lsx_issued',
  'in_production',
] as const

/** Đơn mua ĐANG MỞ: đã duyệt và còn đang chạy tới lúc về đủ. */
const OPEN_PO_STATUSES = [
  'approved',
  'ordered',
  'confirmed',
  'in_transit',
  'partial',
] as const

/**
 * Đơn mua đã duyệt mà nằm im quá lâu chưa gửi NCC — tiền đã được duyệt nhưng
 * hàng chưa hề được đặt. Không màn nào của hai phòng nêu chuyện này.
 */
const STUCK_AFTER_DAYS = 7

export type ExecTodo = {
  lsx_pending: number
  lsx_oldest_days: number | null
  po_pending: number
  po_oldest_days: number | null
  /** Tổng tiền đơn mua đang chờ chữ ký, gom theo tiền tệ. */
  po_pending_value: { currency: string; value: number }[]
}

export type ExecIssues = {
  overdue_orders: {
    id: string
    code: string
    customer_name: string
    due_date: string | null
    days_late: number
  }[]
  late_pos: {
    id: string
    code: string
    supplier_name: string
    expected_at: string | null
    days_late: number
  }[]
  stuck_pos: {
    id: string
    code: string
    supplier_name: string
    approved_at: string | null
    days_idle: number
  }[]
  low_stock: {
    material_id: string
    code: string
    name: string
    unit: string
    on_hand: number
    min_stock: number
  }[]
}

export type ExecSales = {
  open_orders: number
  open_value: { currency: string; value: number }[]
  due_soon: {
    id: string
    code: string
    customer_name: string
    due_date: string | null
    days_left: number
  }[]
  top_customers: { name: string; currency: string; value: number; orders: number }[]
}

export type ExecSupply = {
  open_pos: number
  open_value: { currency: string; value: number }[]
  by_status: { status: string; count: number }[]
  top_suppliers: { name: string; currency: string; value: number; pos: number }[]
}

/**
 * Chỗ dữ liệu còn TRỐNG khiến các thẻ tiền ra 0 — nêu thẳng thay vì để Giám đốc
 * nhìn số 0 rồi tưởng công ty không bán được gì.
 */
export type ExecDataGaps = {
  order_lines_total: number
  order_lines_without_price: number
}

export type ExecDashboard = {
  todo: ExecTodo
  issues: ExecIssues
  sales: ExecSales
  supply: ExecSupply
  gaps: ExecDataGaps
}

/** Một đơn mua trên màn Mua hàng & NCC của Giám đốc — chỉ đọc. */
export type ExecPoRow = {
  id: string
  code: string
  supplier_name: string
  lsx_code: string | null
  status: string
  currency: string
  total: number
  expected_at: string | null
  assignee_name: string | null
  created_at: string
  /** >0 = quá hẹn giao bấy nhiêu ngày. */
  days_late: number
  /** Đã duyệt mà nằm im chưa gửi NCC bấy nhiêu ngày (0 nếu không thuộc diện). */
  days_idle: number
}

export type ExecPurchasing = {
  rows: ExecPoRow[]
  by_status: { status: string; count: number }[]
  open_value: { currency: string; value: number }[]
  pending_value: { currency: string; value: number }[]
  late_count: number
  stuck_count: number
  suppliers: { name: string; currency: string; value: number; pos: number }[]
}

/** Cộng tiền theo tiền tệ — đơn USD và đơn VND KHÔNG được cộng chung. */
function sumByCurrency(rows: { currency: string; value: number }[]) {
  const m = new Map<string, number>()
  for (const r of rows) m.set(r.currency, (m.get(r.currency) ?? 0) + r.value)
  return [...m.entries()]
    .map(([currency, value]) => ({ currency, value }))
    .sort((a, b) => b.value - a.value)
}

export const execService = {
  async dashboard(user: User): Promise<ExecDashboard> {
    await assertAction(user, 'exec.tower.view')
    const today = new Date().toISOString().slice(0, 10)

    const [pendingPos, pendingLsx, allPos, orders, lowStock] = await Promise.all([
      posService.list(user, { status: 'pending_approval', page: 1, page_size: 300 }),
      lsxService.list(user, { status: 'pending_approval', page: 1, page_size: 300 }),
      posService.list(user, { page: 1, page_size: 500 }),
      ordersRepo.list({ page: 1, page_size: 500 }),
      stockRepo.list({ low_only: true }),
    ])

    // Tiền của đơn mua: Σ dòng — 1 truy vấn gộp cho mọi đơn đang xét.
    const poIds = [...new Set([...pendingPos.rows, ...allPos.rows].map((p) => p.id))]
    const poTotals = await posRepo.totalsByPoIds(poIds)

    // ── Cần Giám đốc quyết ──────────────────────────────────────────────────
    const poWaitDays = pendingPos.rows
      .map((p) => daysSince(p.created_at, today))
      .filter((d): d is number => d != null)
    const lsxWaitDays = pendingLsx.rows
      .map((l) => daysSince(l.created_at, today))
      .filter((d): d is number => d != null)

    const todo: ExecTodo = {
      lsx_pending: pendingLsx.rows.length,
      lsx_oldest_days: lsxWaitDays.length ? Math.max(...lsxWaitDays) : null,
      po_pending: pendingPos.rows.length,
      po_oldest_days: poWaitDays.length ? Math.max(...poWaitDays) : null,
      po_pending_value: sumByCurrency(
        pendingPos.rows.map((p) => ({
          currency: p.currency,
          value: poTotals[p.id] ?? 0,
        })),
      ),
    }

    // ── Đang trục trặc ──────────────────────────────────────────────────────
    const openOrders = orders.rows.filter((o) =>
      (OPEN_ORDER_STATUSES as readonly string[]).includes(o.status),
    )

    const overdue_orders = openOrders
      .map((o) => ({ o, late: daysSince(o.due_date, today) }))
      .filter((x) => x.late != null && x.late > 0)
      .map((x) => ({
        id: x.o.id,
        code: x.o.code,
        customer_name: x.o.customer_name,
        due_date: x.o.due_date,
        days_late: x.late as number,
      }))
      .sort((a, b) => b.days_late - a.days_late)

    const late_pos = allPos.rows
      .filter((p) => assessPoLate(p, today) === 'overdue')
      .map((p) => ({
        id: p.id,
        code: p.code,
        supplier_name: p.supplier_name,
        expected_at: p.expected_at,
        days_late: daysSince(p.expected_at, today) ?? 0,
      }))
      .sort((a, b) => b.days_late - a.days_late)

    const stuck_pos = allPos.rows
      .filter((p) => p.status === 'approved')
      .map((p) => ({ p, idle: daysSince(p.approved_at, today) }))
      .filter((x) => x.idle != null && x.idle >= STUCK_AFTER_DAYS)
      .map((x) => ({
        id: x.p.id,
        code: x.p.code,
        supplier_name: x.p.supplier_name,
        approved_at: x.p.approved_at,
        days_idle: x.idle as number,
      }))
      .sort((a, b) => b.days_idle - a.days_idle)

    const issues: ExecIssues = {
      overdue_orders,
      late_pos,
      stuck_pos,
      low_stock: lowStock.map((s) => ({
        material_id: s.material_id,
        code: s.code,
        name: s.name,
        unit: s.unit,
        on_hand: s.on_hand,
        min_stock: s.min_stock,
      })),
    }

    // ── Vế BÁN ──────────────────────────────────────────────────────────────
    const orderTotals = await ordersRepo.lineSummaryByOrderIds(
      openOrders.map((o) => o.id),
    )

    const due_soon = openOrders
      .map((o) => ({ o, left: daysSince(o.due_date, today) }))
      .filter((x) => x.left != null && x.left <= 0 && x.left >= -7)
      .map((x) => ({
        id: x.o.id,
        code: x.o.code,
        customer_name: x.o.customer_name,
        due_date: x.o.due_date,
        days_left: -(x.left as number),
      }))
      .sort((a, b) => a.days_left - b.days_left)

    const custAgg = new Map<string, { value: number; orders: number }>()
    for (const o of openOrders) {
      const key = `${o.customer_name}|${o.currency}`
      const cur = custAgg.get(key) ?? { value: 0, orders: 0 }
      cur.value += orderTotals[o.id]?.total ?? 0
      cur.orders += 1
      custAgg.set(key, cur)
    }

    const sales: ExecSales = {
      open_orders: openOrders.length,
      open_value: sumByCurrency(
        openOrders.map((o) => ({
          currency: o.currency,
          value: orderTotals[o.id]?.total ?? 0,
        })),
      ),
      due_soon,
      top_customers: [...custAgg.entries()]
        .map(([key, v]) => {
          const [name, currency] = key.split('|')
          return { name, currency, value: v.value, orders: v.orders }
        })
        .sort((a, b) => b.value - a.value)
        .slice(0, 5),
    }

    // ── Vế MUA ──────────────────────────────────────────────────────────────
    const openPos = allPos.rows.filter((p) =>
      (OPEN_PO_STATUSES as readonly string[]).includes(p.status),
    )
    const statusAgg = new Map<string, number>()
    for (const p of allPos.rows) {
      if (p.status === 'cancelled') continue
      statusAgg.set(p.status, (statusAgg.get(p.status) ?? 0) + 1)
    }
    const supAgg = new Map<string, { value: number; pos: number }>()
    for (const p of openPos) {
      const key = `${p.supplier_name}|${p.currency}`
      const cur = supAgg.get(key) ?? { value: 0, pos: 0 }
      cur.value += poTotals[p.id] ?? 0
      cur.pos += 1
      supAgg.set(key, cur)
    }

    const supply: ExecSupply = {
      open_pos: openPos.length,
      open_value: sumByCurrency(
        openPos.map((p) => ({ currency: p.currency, value: poTotals[p.id] ?? 0 })),
      ),
      by_status: [...statusAgg.entries()]
        .map(([status, count]) => ({ status, count }))
        .sort((a, b) => b.count - a.count),
      top_suppliers: [...supAgg.entries()]
        .map(([key, v]) => {
          const [name, currency] = key.split('|')
          return { name, currency, value: v.value, pos: v.pos }
        })
        .sort((a, b) => b.value - a.value)
        .slice(0, 5),
    }

    // ── Lỗ hổng dữ liệu khiến số tiền ra 0 ──────────────────────────────────
    const allIds = orders.rows.map((o) => o.id)
    const [allLines, unpriced] = await Promise.all([
      ordersRepo.lineSummaryByOrderIds(allIds),
      ordersRepo.countLinesWithoutPrice(allIds),
    ])
    const gaps: ExecDataGaps = {
      order_lines_total: Object.values(allLines).reduce((s, v) => s + v.lines, 0),
      order_lines_without_price: unpriced,
    }

    return { todo, issues, sales, supply, gaps }
  },

  /**
   * Màn MUA HÀNG & NCC (/exec/purchasing) — vế mua đầy đủ cho Giám đốc: mọi đơn
   * mua còn sống kèm cờ quá hẹn / đọng chưa gửi, và tổng chi theo NCC. Chỉ đọc;
   * thao tác vẫn ở màn của phòng Cung ứng.
   */
  async purchasing(user: User): Promise<ExecPurchasing> {
    await assertAction(user, 'exec.tower.view')
    const today = new Date().toISOString().slice(0, 10)

    const all = await posService.list(user, { page: 1, page_size: 1000 })
    const totals = await posRepo.totalsByPoIds(all.rows.map((p) => p.id))

    const rows: ExecPoRow[] = all.rows
      .filter((p) => p.status !== 'cancelled')
      .map((p) => {
        const late = assessPoLate(p, today) === 'overdue'
        const idle = p.status === 'approved' ? (daysSince(p.approved_at, today) ?? 0) : 0
        return {
          id: p.id,
          code: p.code,
          supplier_name: p.supplier_name,
          lsx_code: p.lsx_code,
          status: p.status,
          currency: p.currency,
          total: totals[p.id] ?? 0,
          expected_at: p.expected_at,
          assignee_name: p.assignee_name,
          created_at: p.created_at,
          days_late: late ? (daysSince(p.expected_at, today) ?? 0) : 0,
          days_idle: idle >= STUCK_AFTER_DAYS ? idle : 0,
        }
      })

    const statusAgg = new Map<string, number>()
    for (const r of rows) statusAgg.set(r.status, (statusAgg.get(r.status) ?? 0) + 1)

    const openRows = rows.filter((r) =>
      (OPEN_PO_STATUSES as readonly string[]).includes(r.status),
    )
    const supAgg = new Map<string, { value: number; pos: number }>()
    for (const r of openRows) {
      const key = `${r.supplier_name}|${r.currency}`
      const cur = supAgg.get(key) ?? { value: 0, pos: 0 }
      cur.value += r.total
      cur.pos += 1
      supAgg.set(key, cur)
    }

    return {
      rows,
      by_status: [...statusAgg.entries()]
        .map(([status, count]) => ({ status, count }))
        .sort((a, b) => b.count - a.count),
      open_value: sumByCurrency(
        openRows.map((r) => ({ currency: r.currency, value: r.total })),
      ),
      pending_value: sumByCurrency(
        rows
          .filter((r) => r.status === 'pending_approval')
          .map((r) => ({ currency: r.currency, value: r.total })),
      ),
      late_count: rows.filter((r) => r.days_late > 0).length,
      stuck_count: rows.filter((r) => r.days_idle > 0).length,
      suppliers: [...supAgg.entries()]
        .map(([key, v]) => {
          const [name, currency] = key.split('|')
          return { name, currency, value: v.value, pos: v.pos }
        })
        .sort((a, b) => b.value - a.value),
    }
  },
}
