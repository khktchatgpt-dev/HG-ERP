import { posService } from '@/modules/dept/supply/pos.service'
import { posRepo } from '@/modules/dept/supply/pos.repo'
import { lsxService } from '@/modules/dept/production/lsx.service'
import { ordersRepo } from '@/modules/dept/sales/orders.repo'
import { stockRepo } from '@/modules/dept/warehouse/stock.repo'
import { assessPoLate } from '@/lib/late-risk'
import { isBigApprovalWith, type ApprovalThresholds } from '@/lib/exec-ops'
import { settingsService } from '@/modules/core/settings/settings.service'
import { assertAction } from '@/modules/core/rbac/rbac.service'
import { approvalEventsRepo } from '@/modules/core/approvals/approvals.repo'
import { usersRepo, type User } from '@/modules/core/users/users.repo'

/**
 * Tầng dữ liệu khu Ban Giám đốc (/exec) — thiết kế lại 15/08/2026 theo mô hình
 * "công việc cần xử lý" (docs/exec-v3-approval-center.md):
 *   · `dashboard()`  — Tổng quan: chờ phê duyệt (nổi bật nhất) + tình hình
 *     hoạt động + cần chú ý. Nguyên tắc: quản trị theo NGOẠI LỆ — việc cần
 *     Giám đốc quyết và thứ đang trục trặc đứng trước mọi con số đẹp.
 *   · `signBox()`    — Trung tâm phê duyệt (/exec/approvals): mọi phiếu chờ
 *     chữ ký gom một danh sách, ký được tại chỗ.
 *   · `purchasing()` — màn theo dõi vế MUA. Chỉ đọc.
 *
 * Guard: `exec.tower.view` (dashboard/purchasing), `exec.approvals.view` (ký).
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

/** Nhịp sản xuất cho thẻ "Tình hình hoạt động" — đếm lệnh, không đi vào công đoạn. */
export type ExecProduction = {
  /** Lệnh đã duyệt đang chạy (approved | in_progress). */
  running: number
  by_status: { status: string; count: number }[]
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
  production: ExecProduction
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

/** Một phiếu đang nằm chờ chữ ký trong Hộp ký (/exec). */
export type SignItem = {
  kind: 'lsx' | 'po'
  id: string
  code: string
  /** Đối tác: khách hàng (LSX) hoặc nhà cung cấp (PO). */
  party: string
  /** Dòng phụ mô tả phiếu — mỗi mảnh là một mẩu ngữ cảnh, UI nối bằng dấu · */
  facts: string[]
  currency: string
  value: number
  /** Đã nằm chờ bao nhiêu ngày (0 = gửi hôm nay). */
  waiting_days: number
  submitted_at: string
  submitted_by: string | null
  /** Cảnh báo cần thấy TRƯỚC khi ký (thiếu BOM, thiếu giá, quá hẹn…). */
  warnings: string[]
  /**
   * Vượt ngưỡng "giá trị lớn" → KHÔNG cho ký hàng loạt, phải mở ra đọc.
   * Chỉ đơn mua mới có cờ này (xem chỗ gán bên dưới).
   */
  big: boolean
  /** Trang thẩm định đầy đủ. */
  href: string
}

export type SignBox = {
  items: SignItem[]
  stats: {
    total: number
    oldest_days: number
    value: { currency: string; value: number }[]
  }
  /** Số phiếu CHÍNH NGƯỜI NÀY đã quyết hôm nay — để biết mình vừa làm gì. */
  decided_today: { approved: number; rejected: number }
  /** Ngưỡng đang áp — hiện ngay trên màn để người ký biết luật mình đang theo. */
  thresholds: ApprovalThresholds
  /**
   * Vì sao hộp rỗng. Phân biệt hai chuyện khác hẳn nhau mà cùng ra "0 phiếu":
   * đã ký hết (tốt) ↔ chưa ai từng lập phiếu trên hệ thống (dữ liệu chưa lên).
   * Không có mấy con số này thì màn hình rỗng nói dối.
   */
  emptiness: { pos_total: number; lsx_total: number }
}

export const execService = {
  /**
   * HỘP KÝ (/exec) — mọi phiếu đang chờ chữ ký Giám đốc, gom một danh sách,
   * xếp theo CHỜ LÂU NHẤT rồi tới GIÁ TRỊ LỚN NHẤT.
   *
   * Vì sao xếp theo thời gian chờ chứ không theo tiền: phiếu để quên mới là thứ
   * làm đứng cả dây chuyền (Cung ứng không đặt được vật tư khi lệnh chưa duyệt).
   * Phiếu to thì đằng nào cũng có người gọi điện nhắc.
   *
   * NẠP NHẸ — cố ý: 5 truy vấn cố định cho cả màn, không phụ thuộc số phiếu.
   * Bản cũ (/exec/approvals) nạp đủ chi tiết MỌI phiếu ngay từ server: mỗi PO
   * một truy vấn dòng, mỗi LSX bốn, cộng ký URL ảnh cho từng sản phẩm. Chi tiết
   * đầy đủ để lại cho trang "Xem kỹ" của từng phiếu.
   */
  async signBox(user: User): Promise<SignBox> {
    await assertAction(user, 'exec.approvals.view')
    const today = new Date().toISOString().slice(0, 10)

    const [pendingPos, pendingLsx, allPos, allLsx, recentEvents, thresholds] =
      await Promise.all([
        posService.list(user, { status: 'pending_approval', page: 1, page_size: 300 }),
        lsxService.list(user, { status: 'pending_approval', page: 1, page_size: 300 }),
        posService.list(user, { page: 1, page_size: 1 }),
        lsxService.list(user, { page: 1, page_size: 1 }),
        approvalEventsRepo.listRecent({ limit: 100 }),
        settingsService.approvalThresholds(),
      ])

    // Tiền tệ nằm ở ĐƠN HÀNG, không ở dòng đơn và cũng không ở lệnh — nên phải
    // tra thêm một lượt. Một truy vấn cho cả màn, không phải một truy vấn/lệnh.
    const [poTotals, orderLines, orderList, creatorNames] = await Promise.all([
      posRepo.totalsByPoIds(pendingPos.rows.map((p) => p.id)),
      ordersRepo.listLinesByOrders(pendingLsx.rows.flatMap((l) => l.order_ids)),
      pendingLsx.rows.length
        ? ordersRepo.list({ page: 1, page_size: 1000 })
        : Promise.resolve({ rows: [], total: 0 }),
      usersRepo.displayNamesByIds(
        [
          ...pendingPos.rows.map((p) => p.created_by),
          ...pendingLsx.rows.map((l) => l.issued_by),
        ].filter((x): x is string => !!x),
      ),
    ])

    const items: SignItem[] = []

    for (const p of pendingPos.rows) {
      const value = poTotals[p.id] ?? 0
      const warnings: string[] = []
      if (value <= 0) warnings.push('Đơn chưa có tiền — dòng vật tư thiếu đơn giá')
      const lateDays = daysSince(p.expected_at, today)
      if (lateDays != null && lateDays > 0) {
        warnings.push(`Ngày hàng về đã qua ${lateDays} ngày`)
      }
      items.push({
        kind: 'po',
        id: p.id,
        code: p.code,
        party: p.supplier_name,
        facts: [
          p.lsx_code ? `lệnh ${p.lsx_code}` : 'ngoài lệnh',
          p.expected_at ? `hàng về ${p.expected_at}` : 'chưa hẹn ngày về',
        ],
        currency: p.currency,
        value,
        waiting_days: daysSince(p.created_at, today) ?? 0,
        submitted_at: p.created_at,
        submitted_by: p.created_by ? (creatorNames.get(p.created_by) ?? null) : null,
        warnings,
        big: isBigApprovalWith(value, p.currency, thresholds),
        href: `/exec/approvals/po/${p.id}`,
      })
    }

    const currencyByOrder = new Map(orderList.rows.map((o) => [o.id, o.currency]))
    const linesByOrder = new Map<string, typeof orderLines>()
    for (const ol of orderLines) {
      const arr = linesByOrder.get(ol.order_id)
      if (arr) arr.push(ol)
      else linesByOrder.set(ol.order_id, [ol])
    }

    for (const l of pendingLsx.rows) {
      const lines = l.order_ids.flatMap((id) => linesByOrder.get(id) ?? [])
      const value = lines.reduce((s, ol) => s + ol.qty * ol.unit_price, 0)
      const bomPending = lines.filter((ol) => ol.bom_status !== 'done').length
      const warnings: string[] = []
      if (bomPending > 0) warnings.push(`${bomPending} sản phẩm chưa chốt BOM`)
      if (value <= 0) warnings.push('Đơn hàng chưa có đơn giá — không thấy giá trị lệnh')
      items.push({
        kind: 'lsx',
        id: l.id,
        code: l.code,
        party: l.customer_name,
        facts: [
          l.order_codes.length > 1
            ? `${l.order_codes.length} đơn`
            : `đơn ${l.order_codes[0] ?? '?'}`,
          `${lines.length} sản phẩm`,
          ...(l.ship_date ? [`giao ${l.ship_date}`] : []),
        ],
        // Lệnh gộp nhiều đơn có thể khác tiền tệ; lấy đơn đầu làm đại diện —
        // hiếm (lệnh gộp luôn cùng khách) và chỉ ảnh hưởng nhãn.
        currency: currencyByOrder.get(l.order_ids[0] ?? '') ?? 'USD',
        value,
        waiting_days: daysSince(l.created_at, today) ?? 0,
        submitted_at: l.created_at,
        submitted_by: l.issued_by ? (creatorNames.get(l.issued_by) ?? null) : null,
        warnings,
        // Lệnh SX KHÔNG bao giờ mang cờ "giá trị lớn" dù số tiền to. Ngưỡng đó
        // canh CAM KẾT CHI TIỀN (đơn mua): ký là công ty mất tiền. Tiền của lệnh
        // sản xuất là DOANH THU sắp thu về, ký lệnh không tiêu đồng nào — gắn cờ
        // vào đây thì mọi lệnh đều đỏ và cái cờ mất nghĩa.
        big: false,
        href: `/exec/approvals/lsx/${l.id}`,
      })
    }

    items.sort((a, b) => b.waiting_days - a.waiting_days || b.value - a.value)

    const mineToday = recentEvents.filter(
      (e) => e.actor_id === user.id && e.created_at.slice(0, 10) === today,
    )

    return {
      items,
      stats: {
        total: items.length,
        oldest_days: items.reduce((m, i) => Math.max(m, i.waiting_days), 0),
        value: sumByCurrency(
          items.map((i) => ({ currency: i.currency, value: i.value })),
        ),
      },
      decided_today: {
        approved: mineToday.filter((e) => e.action === 'approved').length,
        rejected: mineToday.filter((e) => e.action === 'rejected').length,
      },
      thresholds,
      emptiness: { pos_total: allPos.total, lsx_total: allLsx.total },
    }
  },

  async dashboard(user: User): Promise<ExecDashboard> {
    await assertAction(user, 'exec.tower.view')
    const today = new Date().toISOString().slice(0, 10)

    const [pendingPos, pendingLsx, allPos, allLsx, orders, lowStock] = await Promise.all([
      posService.list(user, { status: 'pending_approval', page: 1, page_size: 300 }),
      lsxService.list(user, { status: 'pending_approval', page: 1, page_size: 300 }),
      posService.list(user, { page: 1, page_size: 500 }),
      lsxService.list(user, { page: 1, page_size: 500 }),
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

    // ── Nhịp sản xuất ───────────────────────────────────────────────────────
    const lsxStatusAgg = new Map<string, number>()
    for (const l of allLsx.rows) {
      if (l.status === 'cancelled') continue
      lsxStatusAgg.set(l.status, (lsxStatusAgg.get(l.status) ?? 0) + 1)
    }
    const production: ExecProduction = {
      running: allLsx.rows.filter(
        (l) => l.status === 'approved' || l.status === 'in_progress',
      ).length,
      by_status: [...lsxStatusAgg.entries()]
        .map(([status, count]) => ({ status, count }))
        .sort((a, b) => b.count - a.count),
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

    return { todo, issues, sales, supply, production, gaps }
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
