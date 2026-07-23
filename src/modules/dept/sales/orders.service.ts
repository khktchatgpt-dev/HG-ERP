import {
  ordersRepo,
  type Order,
  type OrderLineInput,
  type OrderWithCustomer,
} from './orders.repo'
import { quotesService } from './quotes.service'
import { assertAction } from '@/modules/core/rbac/rbac.service'
import { customersRepo } from './sales.repo'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { posRepo } from '@/modules/dept/supply/pos.repo'
import { SUPPLY_DEPT_NAMES } from '@/modules/dept/supply/suppliers.service'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { usersRepo, type User } from '@/modules/core/users/users.repo'
import { emit } from '@/events/bus'
import { BadRequest, Conflict, NotFound } from '@/server/http'

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

/** Đơn ở trạng thái cuối thì bất biến. */
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
    const [lines, changes] = await Promise.all([
      ordersRepo.listLines(id),
      ordersRepo.listChanges(id),
    ])
    return { order, lines, changes }
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
      const norm = (ls: { product_id: string; qty: number; unit_price: number }[]) =>
        ls.map((l) => `${l.product_id}:${l.qty}:${l.unit_price}`).join('|')
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
   * Huỷ đơn (chưa giao) — bắt buộc lý do, ghi lịch sử. Khép chuỗi (P3):
   * LSX chưa hoàn thành → 'cancelled'; PO chưa gửi NCC → tự huỷ; PO đã gửi
   * NCC → KHÔNG đụng (đã cam kết) — notify Cung ứng xử lý tay. Best-effort:
   * bước phụ lỗi thì log + vẫn huỷ đơn (nguồn sự thật huỷ trước).
   */
  async cancel(user: User, id: string, reason: string): Promise<Order> {
    await assertAction(user, 'sales.order.manage')
    const before = await ordersRepo.findById(id)
    if (!before) throw NotFound('Đơn hàng không tồn tại')
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
      if (lsx) {
        lsxCode = lsx.code
        if (
          lsx.status === 'pending_approval' ||
          lsx.status === 'approved' ||
          lsx.status === 'in_progress'
        ) {
          await productionRepo.patch(lsx.id, { status: 'cancelled' })
          await productionRepo.insertProgress({
            production_order_id: lsx.id,
            stage: lsx.current_stage ?? 'vat_tu',
            action: 'cancelled',
            note: `Đơn hàng huỷ: ${reason}`,
            updated_by: user.id,
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
