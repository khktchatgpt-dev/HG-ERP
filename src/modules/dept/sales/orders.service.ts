import {
  ordersRepo,
  type Order,
  type OrderLineInput,
  type OrderWithCustomer,
} from './orders.repo'
import { quotesService } from './quotes.service'
import type { OrderBulkPriceInput } from './orders.schema'
import { assertAction } from '@/modules/core/rbac/rbac.service'
import { customersRepo } from './sales.repo'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { jobsRepo } from '@/modules/dept/production/jobs.repo'
import { posRepo } from '@/modules/dept/supply/pos.repo'
import { SUPPLY_DEPT_NAMES } from '@/modules/dept/supply/suppliers.service'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { usersRepo, type User } from '@/modules/core/users/users.repo'
import { emit } from '@/events/bus'
import { BadRequest, Conflict, Forbidden, NotFound } from '@/server/http'
import { canMutateOwned } from '@/lib/record-ownership'

/** Header fields được phép sửa khi khách thay đổi (FR-SAL-05). */
const EDITABLE_FIELDS = [
  'customer_po_no',
  'due_date',
  'deposit_percent',
  'price_term',
  'payment_terms',
  'container_summary',
  'note',
  'qty_tolerance_pct',
  'partial_shipment',
  'transhipment',
  'port_of_loading',
  'port_of_discharge',
  'payment_method',
  'required_docs',
] as const
type EditableField = (typeof EDITABLE_FIELDS)[number]

type OrderUpdateInput = Partial<
  Record<EditableField, string | number | boolean | null>
> & {
  change_note?: string | null
  lines?: OrderLineInput[]
}

/** Một dòng trên bảng điền đơn giá (/sales/orders/gia). */
export type PricingLine = {
  line_id: string
  order_id: string
  order_code: string
  customer_name: string
  currency: string
  status: Order['status']
  due_date: string | null
  product_code: string
  product_name: string
  product_unit: string
  qty: number
  unit_price: number
  /** false = đơn của người khác → UI khoá dòng (xem canMutateOwned). */
  editable: boolean
}

export type PricingBoard = {
  lines: PricingLine[]
  stats: {
    lines_total: number
    unpriced: number
    /** Trong số dòng thiếu giá, bao nhiêu dòng NGƯỜI NÀY sửa được. */
    unpriced_mine: number
    orders_total: number
    orders_unpriced: number
  }
}

/** Đơn ở trạng thái cuối thì bất biến. */
/**
 * Của ai người đó sửa (chốt 07/08/2026). `sales.order.manage` mới chỉ hỏi "có
 * phải người phòng Bán Hàng không" — đây là cửa thứ hai theo CHỦ đơn.
 */
function assertOwner(user: User, order: Order): void {
  if (!canMutateOwned(user, order.created_by)) {
    throw Forbidden(
      'Đơn này do người khác tạo — chỉ người tạo hoặc quản lý mới sửa/huỷ được',
    )
  }
}

function assertEditable(order: Order): void {
  if (order.status === 'delivered' || order.status === 'cancelled') {
    throw BadRequest('Đơn đã giao / đã huỷ — không sửa được nữa')
  }
}

/** Đơn đã phát LSX — sửa/huỷ lúc này phải báo Cung ứng (plan-order-lsx-lifecycle). */
const AFTER_LSX_STATUSES: Order['status'][] = [
  'lsx_pending',
  'lsx_issued',
  'in_production',
]

/** GĐ/QL + nhân sự phòng KH-CƯ (trừ người thao tác) — người cần biết khi đơn đổi/huỷ. */
async function supplyAndManagerIds(excludeId: string): Promise<string[]> {
  const [depts, users] = await Promise.all([departmentsRepo.list(), usersRepo.list()])
  const supplyDeptIds = new Set(
    depts.filter((d) => SUPPLY_DEPT_NAMES.has(d.name)).map((d) => d.id),
  )
  return users
    .filter(
      (u) =>
        u.role === 'admin' ||
        u.role === 'manager' ||
        (u.department_id != null && supplyDeptIds.has(u.department_id)),
    )
    .filter((u) => u.id !== excludeId)
    .map((u) => u.id)
}

export const ordersService = {
  /** Đọc: mọi NV đã đăng nhập (ma trận đặc tả mục 6 — các phòng xem Sales). */
  async list(_user: User, opts: Parameters<typeof ordersRepo.list>[0]) {
    return ordersRepo.list(opts)
  },

  async detail(_user: User, id: string) {
    const order = await ordersRepo.findById(id)
    if (!order) throw NotFound('Đơn hàng không tồn tại')
    const [lines, changes, shipments, shippedByLine] = await Promise.all([
      ordersRepo.listLines(id),
      ordersRepo.listChanges(id),
      ordersRepo.listShipments(id),
      ordersRepo.shippedByLine(id),
    ])
    return { order, lines, changes, shipments, shippedByLine }
  },

  /**
   * Tạo đơn (FR-SAL-04). Sale tự tạo — đơn là bản ghi và là mốc phát Lệnh sản
   * xuất (LSX). Hai cách:
   *   - TỪ BÁO GIÁ đã chốt (`quote_id`): snapshot dòng SP + điều khoản từ báo giá.
   *   - TRỰC TIẾP (`customer_id` + `lines`, không cần báo giá).
   * Tạo xong đơn sống độc lập.
   */
  async create(
    user: User,
    input: {
      code: string
      quote_id?: string | null
      customer_id?: string | null
      currency?: string
      price_term?: string | null
      payment_terms?: string | null
      lines?: OrderLineInput[]
      customer_po_no?: string | null
      due_date?: string | null
      deposit_percent?: number | null
      container_summary?: string | null
      note?: string | null
      qty_tolerance_pct?: number | null
      partial_shipment?: boolean | null
      transhipment?: boolean | null
      port_of_loading?: string | null
      port_of_discharge?: string | null
      payment_method?: string | null
      required_docs?: string | null
    },
  ): Promise<Order> {
    await assertAction(user, 'sales.order.manage')
    if (await ordersRepo.existsByCode(input.code)) {
      throw Conflict(`Mã đơn "${input.code}" đã tồn tại`, 'CODE_TAKEN')
    }

    // Nguồn: từ báo giá đã chốt, hoặc nhập trực tiếp.
    let source: {
      quote_id: string | null
      customer_id: string
      currency: string
      price_term: string | null
      payment_terms: string | null
      lines: OrderLineInput[]
    }

    if (input.quote_id) {
      // Báo giá đã chốt cung cấp KHÁCH + tiền tệ + điều khoản; còn dòng SP + SL +
      // đơn giá do client gửi (form đơn nạp sẵn SP/giá từ báo giá, Sale nhập SL).
      // Báo giá không có SL nên không snapshot dòng từ báo giá nữa.
      const quote = await quotesService.assertSent(input.quote_id)
      const lines = input.lines ?? []
      if (lines.length === 0) throw BadRequest('Đơn phải có ít nhất 1 dòng sản phẩm')
      source = {
        quote_id: quote.id,
        customer_id: quote.customer_id, // denorm từ quote — nguồn sự thật
        currency: quote.currency,
        price_term: quote.price_term,
        payment_terms: quote.payment_terms,
        lines,
      }
    } else {
      // Tạo trực tiếp — không cần báo giá.
      if (!input.customer_id) throw BadRequest('Chọn khách hàng để tạo đơn trực tiếp')
      const customer = await customersRepo.findById(input.customer_id)
      if (!customer) throw NotFound('Khách hàng không tồn tại')
      if (!customer.is_active) throw BadRequest('Khách hàng đã ngừng giao dịch')
      const lines = input.lines ?? []
      if (lines.length === 0) throw BadRequest('Đơn phải có ít nhất 1 dòng sản phẩm')
      source = {
        quote_id: null,
        customer_id: input.customer_id,
        currency: input.currency ?? 'USD',
        price_term: input.price_term ?? null,
        payment_terms: input.payment_terms ?? null,
        lines,
      }
    }

    return ordersRepo.insert(
      {
        code: input.code,
        quote_id: source.quote_id,
        customer_id: source.customer_id,
        customer_po_no: input.customer_po_no ?? null,
        currency: source.currency,
        due_date: input.due_date ?? null,
        deposit_percent: input.deposit_percent ?? null,
        price_term: source.price_term,
        payment_terms: source.payment_terms,
        container_summary: input.container_summary ?? null,
        note: input.note ?? null,
        qty_tolerance_pct: input.qty_tolerance_pct ?? null,
        partial_shipment: input.partial_shipment ?? null,
        transhipment: input.transhipment ?? null,
        port_of_loading: input.port_of_loading ?? null,
        port_of_discharge: input.port_of_discharge ?? null,
        payment_method: input.payment_method ?? null,
        required_docs: input.required_docs ?? null,
        created_by: user.id,
      },
      source.lines,
    )
  },

  /**
   * Cập nhật khi khách thay đổi (FR-SAL-05): diff header + dòng SP đều được
   * ghi vào sales_order_changes (append-only) — vận hành linh hoạt nhưng có vết.
   */
  async update(user: User, id: string, input: OrderUpdateInput): Promise<Order> {
    await assertAction(user, 'sales.order.manage')
    const before = await ordersRepo.findById(id)
    if (!before) throw NotFound('Đơn hàng không tồn tại')
    assertOwner(user, before)
    assertEditable(before)

    // Diff header
    const fieldChanges: Record<string, { from: unknown; to: unknown }> = {}
    const patch: Partial<Order> = {}
    for (const f of EDITABLE_FIELDS) {
      if (!(f in input)) continue
      const to = input[f] ?? null
      const from = before[f] ?? null
      if (from !== to) {
        fieldChanges[f] = { from, to }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(patch as any)[f] = to
      }
    }

    // Diff lines (nếu gửi kèm)
    let linesChange: { before: unknown; after: unknown } | undefined
    if (input.lines) {
      const beforeLines = await ordersRepo.listLines(id)
      const norm = (
        ls: {
          product_id: string
          qty: number
          unit_price: number
          ship_date?: string | null
        }[],
      ) =>
        ls
          .map((l) => `${l.product_id}:${l.qty}:${l.unit_price}:${l.ship_date ?? ''}`)
          .join('|')
      if (norm(beforeLines) !== norm(input.lines)) {
        linesChange = {
          before: beforeLines.map((l) => ({
            product_code: l.product_code,
            qty: l.qty,
            unit_price: l.unit_price,
          })),
          after: input.lines,
        }
        await ordersRepo.replaceLines(id, input.lines)
      }
    }

    if (Object.keys(fieldChanges).length === 0 && !linesChange) {
      return before // không có gì đổi — không ghi lịch sử rác
    }

    const order =
      Object.keys(patch).length > 0 ? await ordersRepo.patch(id, patch) : before

    await ordersRepo.insertChange({
      order_id: id,
      changed_by: user.id,
      change: {
        type: 'update',
        ...(Object.keys(fieldChanges).length > 0 ? { fields: fieldChanges } : {}),
        ...(linesChange ? { lines: linesChange } : {}),
      },
      note: input.change_note ?? null,
    })

    // Đơn đã phát LSX mà đổi dòng SP / hạn giao → vật tư có thể đã đặt theo số
    // cũ: báo Cung ứng + GĐ (P2). Đơn 'confirmed' sửa thoải mái, không báo.
    if (
      AFTER_LSX_STATUSES.includes(before.status) &&
      (linesChange || 'due_date' in fieldChanges)
    ) {
      const lsx = await productionRepo.findByOrder(id)
      if (lsx) {
        await emit({
          name: 'order.changed_after_lsx',
          order_id: id,
          order_code: before.code,
          lsx_code: lsx.code,
          changed_fields: Object.keys(fieldChanges),
          lines_changed: !!linesChange,
          changed_by: user.id,
          notify_ids: await supplyAndManagerIds(user.id),
        })
      }
    }
    return order
  },

  /**
   * BẢNG ĐIỀN ĐƠN GIÁ — mọi dòng đơn còn sống, gom một chỗ để điền giá hàng loạt.
   *
   * Vì sao cần: 71/71 dòng đơn hàng đang có `unit_price = 0`, nên mọi con số tiền
   * của phòng Sale và của bảng tin Giám đốc đều ra 0. Sửa bằng màn sửa đơn thì
   * phải mở 20 form, mỗi form gõ lại từng dòng. Xem
   * docs/exec-v2-ky-duyet-plan.md §6.
   *
   * `editable` tính theo `canMutateOwned`: nhân viên chỉ sửa được đơn mình tạo,
   * quản lý/admin sửa mọi đơn. Trả về CẢ dòng không sửa được (khoá lại trên UI)
   * thay vì lọc mất — Sale cần thấy đơn của đồng nghiệp còn thiếu giá để nhắc,
   * chứ không phải tưởng là đã xong hết.
   */
  async pricingBoard(user: User): Promise<PricingBoard> {
    await assertAction(user, 'sales.order.manage')
    const { rows: orders } = await ordersRepo.list({ page: 1, page_size: 1000 })
    // Cùng điều kiện với assertEditable: đơn đã giao / đã huỷ là bất biến, đưa
    // lên bảng chỉ để người ta gõ xong rồi bị API từ chối.
    const editableOrders = orders.filter(
      (o) => o.status !== 'delivered' && o.status !== 'cancelled',
    )
    const lines = await ordersRepo.listLinesByOrders(editableOrders.map((o) => o.id))
    const byOrder = new Map(editableOrders.map((o) => [o.id, o]))

    const rows: PricingLine[] = []
    for (const l of lines) {
      const o = byOrder.get(l.order_id)
      if (!o) continue
      rows.push({
        line_id: l.id,
        order_id: o.id,
        order_code: o.code,
        customer_name: o.customer_name,
        currency: o.currency,
        status: o.status,
        due_date: o.due_date,
        product_code: l.product_code,
        product_name: l.product_name,
        product_unit: l.product_unit,
        qty: l.qty,
        unit_price: l.unit_price,
        editable: canMutateOwned(user, o.created_by),
      })
    }
    rows.sort(
      (a, b) =>
        a.order_code.localeCompare(b.order_code) ||
        a.product_code.localeCompare(b.product_code),
    )

    const unpriced = rows.filter((r) => r.unit_price <= 0)
    return {
      lines: rows,
      stats: {
        lines_total: rows.length,
        unpriced: unpriced.length,
        unpriced_mine: unpriced.filter((r) => r.editable).length,
        orders_total: editableOrders.length,
        orders_unpriced: new Set(unpriced.map((r) => r.order_id)).size,
      },
    }
  },

  /**
   * Điền đơn giá cho nhiều dòng thuộc nhiều đơn trong một lần.
   *
   * Kiểm quyền TRƯỚC KHI ghi bất cứ dòng nào: có một đơn không phải của mình thì
   * từ chối cả lô. Nửa vời (ghi được mấy dòng rồi lỗi) là trạng thái tệ nhất —
   * người dùng không biết đã lưu tới đâu, mà tiền thì đã lệch.
   *
   * KHÔNG phát `order.changed_after_lsx` dù đơn đã phát LSX: sự kiện đó có để
   * cảnh báo Cung ứng rằng *vật tư có thể đã đặt theo số cũ*, tức nó nói về SỐ
   * LƯỢNG và HẠN GIAO. Điền đơn giá bán không đổi một gam vật tư nào. Phát ra
   * chỉ tạo 20 thông báo rác cho Cung ứng + Giám đốc rồi họ học cách bỏ qua
   * thông báo — đắt hơn nhiều so với việc không phát.
   *
   * Vẫn ghi `sales_order_changes` type `price_fill` để có vết: điền giá là đổi
   * giá trị hợp đồng, phải tra lại được ai điền, lúc nào, từ số nào sang số nào.
   */
  async bulkPrice(
    user: User,
    input: OrderBulkPriceInput,
  ): Promise<{ updated: number; orders: number }> {
    await assertAction(user, 'sales.order.manage')

    const lines = await ordersRepo.listLinesByIds(input.items.map((i) => i.line_id))
    if (lines.length !== input.items.length) {
      throw NotFound('Có dòng đơn không còn tồn tại — tải lại trang rồi điền lại')
    }
    const byLine = new Map(lines.map((l) => [l.id, l]))

    const orderIds = [...new Set(lines.map((l) => l.order_id))]
    const orders = await Promise.all(orderIds.map((id) => ordersRepo.findById(id)))
    for (const o of orders) {
      if (!o) throw NotFound('Đơn hàng không tồn tại')
      assertOwner(user, o)
      assertEditable(o)
    }

    // Chỉ ghi dòng THỰC SỰ đổi số — gửi cả bảng lên là chuyện thường của UI,
    // nhưng ghi lịch sử "đổi 5 → 5" thì lịch sử thành rác không đọc được.
    const changed = input.items.filter(
      (i) => (byLine.get(i.line_id)?.unit_price ?? 0) !== i.unit_price,
    )
    if (changed.length === 0) return { updated: 0, orders: 0 }

    await ordersRepo.updateLinePrices(changed)

    let touchedOrders = 0
    for (const o of orders) {
      if (!o) continue
      const mine = changed.filter((c) => byLine.get(c.line_id)?.order_id === o.id)
      if (mine.length === 0) continue
      touchedOrders += 1
      await ordersRepo.insertChange({
        order_id: o.id,
        changed_by: user.id,
        change: {
          type: 'price_fill',
          count: mine.length,
          lines: mine.map((c) => {
            const l = byLine.get(c.line_id)
            return {
              product_code: l?.product_code ?? '?',
              qty: l?.qty ?? 0,
              from: l?.unit_price ?? 0,
              to: c.unit_price,
            }
          }),
        },
        note: input.note ?? null,
      })
    }

    return { updated: changed.length, orders: touchedOrders }
  },

  /**
   * Huỷ đơn (chưa giao) — bắt buộc lý do, ghi lịch sử. Khép chuỗi (P3):
   * LSX chưa hoàn thành → 'cancelled'; PO chưa gửi NCC → tự huỷ; PO đã gửi
   * NCC → KHÔNG đụng (đã cam kết) — notify Cung ứng xử lý tay. Best-effort:
   * bước phụ lỗi thì log + vẫn huỷ đơn (nguồn sự thật huỷ trước).
   */
  async cancel(user: User, id: string, reason: string): Promise<Order> {
    await assertAction(user, 'sales.order.manage')
    const before = await ordersRepo.findById(id)
    if (!before) throw NotFound('Đơn hàng không tồn tại')
    assertOwner(user, before)
    assertEditable(before)

    const order = await ordersRepo.patch(id, { status: 'cancelled' })
    await ordersRepo.insertChange({
      order_id: id,
      changed_by: user.id,
      change: {
        type: 'cancel',
        fields: { status: { from: before.status, to: 'cancelled' } },
      },
      note: reason,
    })

    let lsxCode: string | null = null
    let lsxCancelled = false
    const posCancelled: string[] = []
    const posManual: string[] = []
    try {
      const lsx = await productionRepo.findByOrder(id)
      if (lsx && lsx.order_ids.some((oid) => oid !== id)) {
        // Lệnh gộp nhiều đơn (0113): huỷ MỘT đơn không được dừng cả lệnh —
        // chỉ gỡ đơn đó ra, lệnh vẫn chạy cho các đơn còn lại. PO cũng giữ
        // nguyên vì vật tư mua gộp cho cả lệnh.
        lsxCode = lsx.code
        await productionRepo.detachOrders([id])
        // Bỏ luôn công việc đã lên kế hoạch cho dòng SP của đơn này, không thì
        // gate "hoàn thành lệnh" đứng mãi vì chờ việc của đơn đã huỷ.
        const lines = await ordersRepo.listLines(id)
        await Promise.all(lines.map((l) => jobsRepo.replaceForLine(lsx.id, l.id, [])))
      } else if (lsx) {
        lsxCode = lsx.code
        if (
          lsx.status === 'pending_approval' ||
          lsx.status === 'approved' ||
          lsx.status === 'in_progress'
        ) {
          // Lý do huỷ ghi vào note LSX (production_progress đã bỏ — 0084;
          // lịch sử chuẩn nằm ở sales_order_changes phía trên).
          await productionRepo.patch(lsx.id, {
            status: 'cancelled',
            note: [`[Huỷ theo đơn] ${reason}`, lsx.note].filter(Boolean).join(' · '),
          })
          lsxCancelled = true
        }
        const { rows: pos } = await posRepo.list({
          production_order_id: lsx.id,
          page: 1,
          page_size: 200,
        })
        for (const po of pos) {
          if (po.status === 'pending_approval' || po.status === 'approved') {
            await posRepo.patch(po.id, {
              status: 'cancelled',
              note: [`[Huỷ theo đơn ${before.code}] ${reason}`, po.note]
                .filter(Boolean)
                .join(' · '),
            })
            posCancelled.push(po.code)
          } else if (
            po.status === 'ordered' ||
            po.status === 'confirmed' ||
            po.status === 'in_transit' ||
            po.status === 'partial'
          ) {
            posManual.push(po.code)
          }
        }
      }
    } catch (err) {
      console.error('[orders.cancel] khép chuỗi LSX/PO lỗi (đơn vẫn huỷ):', err)
    }

    await emit({
      name: 'order.cancelled',
      order_id: id,
      order_code: before.code,
      reason,
      lsx_code: lsxCode,
      lsx_cancelled: lsxCancelled,
      pos_cancelled: posCancelled,
      pos_manual: posManual,
      cancelled_by: user.id,
      notify_ids: await supplyAndManagerIds(user.id),
    })
    return order
  },

  /**
   * Xác nhận đã giao hàng — bước cuối khép chuỗi (completed → delivered).
   * Sales hoặc GĐ/Ban quản lý; đơn delivered thành bất biến (assertEditable).
   */
  async deliver(user: User, id: string, note?: string | null): Promise<Order> {
    await assertAction(user, 'sales.order.confirm_delivery')
    const before = await ordersRepo.findById(id)
    if (!before) throw NotFound('Đơn hàng không tồn tại')
    if (before.status !== 'completed') {
      throw BadRequest('Chỉ xác nhận giao cho đơn đã hoàn thành sản xuất')
    }

    const order = await ordersRepo.patch(id, { status: 'delivered' })
    await ordersRepo.insertChange({
      order_id: id,
      changed_by: user.id,
      change: {
        type: 'delivered',
        fields: { status: { from: 'completed', to: 'delivered' } },
      },
      note: note ?? null,
    })
    return order
  },

  /**
   * Ghi một đợt THỰC XUẤT cho một dòng đơn (0120 — cột "ĐÃ XUẤT" của sổ thật).
   * Chặn xuất quá số CÒN LẠI của dòng — muốn giao nhiều hơn (dung sai +10%)
   * thì sửa SL dòng đơn trước (có lịch sử), số liệu không bao giờ âm.
   */
  async recordShipment(
    user: User,
    orderId: string,
    input: {
      order_line_id: string
      qty: number
      shipped_at?: string | null
      note?: string | null
    },
  ): Promise<void> {
    await assertAction(user, 'sales.order.manage')
    const order = await ordersRepo.findById(orderId)
    if (!order) throw NotFound('Đơn hàng không tồn tại')
    assertOwner(user, order)
    assertEditable(order)

    const lines = await ordersRepo.listLines(orderId)
    const line = lines.find((l) => l.id === input.order_line_id)
    if (!line) throw NotFound('Dòng sản phẩm không thuộc đơn này')
    const shipped = (await ordersRepo.shippedByLine(orderId))[line.id] ?? 0
    const left = line.qty - shipped
    if (input.qty > left) {
      throw BadRequest(
        `Dòng ${line.product_code} chỉ còn ${left} ${line.product_unit || 'sp'} chưa xuất — muốn giao nhiều hơn hãy sửa SL dòng đơn trước`,
      )
    }

    await ordersRepo.insertShipment({
      order_id: orderId,
      order_line_id: input.order_line_id,
      qty: input.qty,
      shipped_at: input.shipped_at ?? null,
      note: input.note ?? null,
      created_by: user.id,
    })
    await ordersRepo.insertChange({
      order_id: orderId,
      changed_by: user.id,
      change: {
        type: 'shipment',
        fields: {
          [line.product_code]: {
            from: `đã xuất ${shipped}`,
            to: `đã xuất ${shipped + input.qty}/${line.qty}`,
          },
        },
      },
      note: input.note ?? null,
    })
  },

  /** Gỡ một đợt xuất ghi nhầm — cùng quyền với ghi, có vết trong lịch sử. */
  async removeShipment(user: User, orderId: string, shipmentId: string): Promise<void> {
    await assertAction(user, 'sales.order.manage')
    const order = await ordersRepo.findById(orderId)
    if (!order) throw NotFound('Đơn hàng không tồn tại')
    assertOwner(user, order)
    assertEditable(order)
    const shipment = await ordersRepo.findShipment(shipmentId)
    if (!shipment || shipment.order_id !== orderId)
      throw NotFound('Đợt xuất không tồn tại')
    await ordersRepo.deleteShipment(shipmentId)
    await ordersRepo.insertChange({
      order_id: orderId,
      changed_by: user.id,
      change: {
        type: 'shipment_removed',
        fields: {
          shipment: { from: `${shipment.qty} (${shipment.shipped_at})`, to: null },
        },
      },
      note: null,
    })
  },

  /** Đơn của 1 khách (tab lịch sử đơn — FR-SAL-01). */
  async listByCustomer(_user: User, customerId: string): Promise<OrderWithCustomer[]> {
    const { rows } = await ordersRepo.list({
      customer_id: customerId,
      page: 1,
      page_size: 200,
    })
    return rows
  },
}
