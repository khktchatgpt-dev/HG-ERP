import {
  productionRepo,
  type ProductionOrder,
  type ProductionOrderWithOrders,
} from './production.repo'
import '@/events/register' // Đăng ký handler event ở lần import đầu tiên.
import { jobsRepo } from './jobs.repo'
import { entriesRepo } from './entries.repo'
import { componentsRepo } from './components.repo'
import { lsxLinesService } from './lsx-lines.service'
import { lsxLinesRepo } from './lsx-lines.repo'
import { blockingIssues } from './lsx-line-fill'
import { lsxAudienceIds } from './notify-targets'
import { ordersRepo, type OrderWithCustomer } from '@/modules/dept/sales/orders.repo'
import type { OrderStatus } from '@/modules/dept/sales/orders.schema'
import { usersRepo, type User } from '@/modules/core/users/users.repo'
import { emit } from '@/events/bus'
import { assertAction } from '@/modules/core/rbac/rbac.service'
import { BadRequest, Conflict, Forbidden, NotFound } from '@/server/http'
import { canMutateOwned, canRemoveOrdersFromLsx } from '@/lib/record-ownership'

/**
 * Của ai người đó sửa (chốt 07/08/2026) — cửa thứ hai sau permission
 * `production.lsx.issue`. Người LẬP lệnh (`created_by`, 0119) mới được sửa;
 * admin/quản lý gánh được mọi lệnh. GĐ duyệt/từ chối và xưởng ghi số liệu KHÔNG
 * đi qua cửa này — đó là việc của vai khác trên cùng một lệnh.
 */
function assertLsxOwner(user: User, lsx: ProductionOrder): void {
  if (!canMutateOwned(user, lsx.created_by)) {
    throw Forbidden(
      'Lệnh này do người khác lập — chỉ người lập hoặc quản lý mới sửa được',
    )
  }
}

/**
 * VÒNG ĐỜI lệnh sản xuất (0084 giữ luồng giáp ranh đã chạy tốt):
 * Sales phát → GĐ duyệt/từ chối (→ gửi lại) → Kế hoạch + xưởng chạy →
 * HOÀN THÀNH (gate: mọi công việc đã xong) → đơn completed → Sales giao hàng.
 *
 * Từ 0113 một lệnh gộp NHIỀU ĐƠN của CÙNG MỘT KHÁCH: mọi bước vòng đời ở trên
 * tác động lên TẤT CẢ đơn của lệnh, và thêm/bớt đơn được phép khi lệnh chưa
 * hoàn thành (addOrders/removeOrders).
 */

/** ID Giám đốc/Ban QL để báo duyệt (trừ chính người phát). */
async function approverIds(excludeId: string): Promise<string[]> {
  const users = await usersRepo.list()
  return users
    .filter((u) => (u.role === 'admin' || u.role === 'manager') && u.id !== excludeId)
    .map((u) => u.id)
}

async function lsxOrThrow(id: string): Promise<ProductionOrderWithOrders> {
  const lsx = await productionRepo.findById(id)
  if (!lsx) throw NotFound('LSX không tồn tại')
  return lsx
}

/**
 * Đơn có được gộp vào lệnh không: phải đã xác nhận, chưa thuộc lệnh nào, và
 * cùng khách với lệnh (trigger DB `assert_lsx_same_customer` là chốt chặn cuối).
 */
function assertMergeable(orders: OrderWithCustomer[], customerId: string): void {
  for (const o of orders) {
    if (o.customer_id !== customerId) {
      throw BadRequest(
        `Đơn ${o.code} khác khách hàng — một lệnh chỉ gộp đơn của cùng một khách`,
      )
    }
    if (o.production_order_id) {
      throw Conflict(`Đơn ${o.code} đã thuộc một lệnh sản xuất khác`, 'ORDER_IN_LSX')
    }
    if (o.status !== 'confirmed') {
      throw BadRequest(`Đơn ${o.code} không ở trạng thái Xác nhận — không phát lệnh được`)
    }
  }
}

async function findOrdersOrThrow(orderIds: string[]): Promise<OrderWithCustomer[]> {
  const rows = await Promise.all(orderIds.map((id) => ordersRepo.findById(id)))
  const missing = rows.findIndex((o) => !o)
  if (missing >= 0) throw NotFound('Đơn hàng không tồn tại')
  return rows as OrderWithCustomer[]
}

/** Chuyển trạng thái + ghi vết cho MỌI đơn của lệnh (một bước vòng đời). */
async function moveOrders(
  orders: { id: string }[],
  status: OrderStatus,
  changedBy: string,
  change: Record<string, unknown>,
  note: string | null = null,
): Promise<void> {
  await Promise.all(
    orders.map(async (o) => {
      await ordersRepo.patch(o.id, { status })
      await ordersRepo.insertChange({
        order_id: o.id,
        changed_by: changedBy,
        change,
        note,
      })
    }),
  )
}

export const lsxService = {
  async list(_user: User, opts: Parameters<typeof productionRepo.list>[0]) {
    return productionRepo.list(opts)
  },

  async detail(_user: User, id: string) {
    const lsx = await lsxOrThrow(id)
    const jobs = await jobsRepo.listByLsx(id)
    return { lsx, jobs }
  },

  /** Bảng theo dõi đơn (FR-SAL-07) — mọi NV đã đăng nhập xem được. */
  async tracking() {
    return productionRepo.listTracking()
  },

  /**
   * Sales TẠO LSX NHÁP từ MỘT HOẶC NHIỀU đơn (FR-SAL-06, BR-02/07).
   *
   * 0117 (chốt 06/08/2026): tạo lệnh KHÔNG gửi GĐ ngay. Luồng cũ vào thẳng
   * `pending_approval` rồi Sales mới đi soạn dòng — GĐ nhận phiếu lúc nội dung
   * còn dang dở, mà mỗi lần Sales sửa tiếp lại đẻ thêm một bản chỉnh sửa. Nay
   * lệnh nằm ở NHÁP: soạn dòng / sửa đầu lệnh thoải mái, bấm `submit` mới tới
   * bàn duyệt và mới notify. Đơn cũng chỉ chuyển 'lsx_pending' lúc submit —
   * nhưng đã gắn `production_order_id` ngay từ nháp nên không bị đề xuất phát
   * lệnh lần hai.
   * - 0113: gộp nhiều đơn cùng khách; mỗi đơn chỉ thuộc một lệnh.
   * - BR-02: LSX dùng chung dòng SP của đơn.
   * - BR-07: KHÔNG chặn khi thiếu BOM — chỉ cảnh báo.
   */
  async issue(
    user: User,
    input: {
      code: string
      order_ids: string[]
      ship_date?: string | null
      received_date?: string | null
      container_summary?: string | null
      note?: string | null
    },
  ): Promise<ProductionOrder> {
    await assertAction(user, 'production.lsx.issue')
    const orderIds = [...new Set(input.order_ids)]
    if (!orderIds.length) throw BadRequest('Chọn ít nhất một đơn hàng để phát lệnh')

    const orders = await findOrdersOrThrow(orderIds)
    assertMergeable(orders, orders[0].customer_id)
    if (await productionRepo.existsByCode(input.code)) {
      throw Conflict(`Số LSX "${input.code}" đã tồn tại`, 'CODE_TAKEN')
    }

    const { order: lsx, duplicate } = await productionRepo.insert({
      code: input.code,
      customer_id: orders[0].customer_id,
      status: 'draft',
      ship_date: input.ship_date ?? null,
      received_date: input.received_date ?? null,
      container_summary: input.container_summary ?? null,
      // created_by = người LẬP lệnh, giữ nguyên suốt vòng đời. issued_by cũng
      // đặt = người này lúc tạo, nhưng nó sẽ bị `resubmit()` ghi đè khi lệnh bị
      // từ chối rồi gửi lại — nên đừng dùng issued_by để truy người lập (0119).
      created_by: user.id,
      issued_by: user.id,
      issued_at: new Date().toISOString(),
      note: input.note ?? null,
    })
    if (duplicate || !lsx) {
      throw Conflict(`Số LSX "${input.code}" đã tồn tại`, 'CODE_TAKEN')
    }
    await productionRepo.attachOrders(lsx.id, orderIds)
    // Nạp sẵn nhóm + dòng lệnh từ dòng đơn (0114) — Sales tách đợt xuất / sửa
    // spec sau ở màn soạn lệnh. Lỗi nạp không được chặn việc tạo lệnh.
    try {
      await lsxLinesService.seedFromOrders(lsx.id)
    } catch (err) {
      console.error('[lsx.issue] nạp dòng lệnh từ đơn lỗi (lệnh vẫn tạo):', err)
    }
    return lsx
  },

  /**
   * Sales GỬI GĐ DUYỆT (0117): draft → pending_approval. CHỈ lúc này mới đẩy
   * đơn sang 'lsx_pending' và notify người duyệt — `lsx.submitted` chuyển từ
   * `issue()` sang đây.
   */
  async submit(user: User, id: string): Promise<ProductionOrder> {
    await assertAction(user, 'production.lsx.issue')
    const lsx = await lsxOrThrow(id)
    assertLsxOwner(user, lsx)
    if (lsx.status !== 'draft') throw BadRequest('Chỉ lệnh nháp mới gửi duyệt được')

    // Đếm dòng thẳng từ repo (không qua `sheet()` — chỗ này không cần mẫu cột).
    const lsxLines = await lsxLinesRepo.listLines(id)
    if (lsxLines.length === 0) {
      throw BadRequest('Lệnh chưa có dòng sản phẩm nào — soạn dòng rồi hãy gửi duyệt')
    }
    // Gate mức A (0117) — dùng CHÍNH luật của màn soạn (`blockingIssues`), chặn
    // chỉ ở client thì lách được qua API và bug UI sẽ lọt thẳng xuống xưởng.
    const bad = lsxLines.filter((l) => blockingIssues(l).length > 0)
    if (bad.length) {
      const names = bad
        .slice(0, 3)
        .map((l) => (l.product_code ?? '').trim() || '(chưa có mã)')
        .join(', ')
      throw BadRequest(
        `${bad.length} dòng thiếu Mã SP / Số lượng / ĐVT (${names}${
          bad.length > 3 ? '…' : ''
        }) — bổ sung rồi hãy gửi duyệt`,
      )
    }

    const orders = await findOrdersOrThrow(lsx.order_ids)
    const updated = await productionRepo.patch(id, { status: 'pending_approval' })

    await Promise.all(
      orders.map(async (o) => {
        await ordersRepo.patch(o.id, { status: 'lsx_pending' })
        await ordersRepo.insertChange({
          order_id: o.id,
          changed_by: user.id,
          change: {
            type: 'lsx_submitted',
            fields: { status: { from: o.status, to: 'lsx_pending' } },
            lsx_code: lsx.code,
            order_codes: orders.map((x) => x.code),
          },
          note: null,
        })
      }),
    )

    const lines = await ordersRepo.listLinesByOrders(lsx.order_ids)
    await emit({
      name: 'lsx.submitted',
      production_order_id: id,
      code: lsx.code,
      order_codes: orders.map((o) => o.code),
      customer_name: orders[0]?.customer_name ?? lsx.customer_name,
      lines_bom_pending: lines.filter((l) => l.bom_status !== 'done').length,
      submitted_by: user.id,
      approver_ids: await approverIds(user.id),
    })
    return updated
  },

  /** GĐ DUYỆT LSX: pending_approval → approved; MỌI đơn → lsx_issued; báo các bộ phận. */
  async approve(user: User, id: string): Promise<ProductionOrder> {
    await assertAction(user, 'production.lsx.approve')
    const lsx = await lsxOrThrow(id)
    if (lsx.status !== 'pending_approval')
      throw BadRequest('LSX không ở trạng thái chờ duyệt')

    const updated = await productionRepo.patch(id, {
      status: 'approved',
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    })
    await moveOrders(
      lsx.order_ids.map((oid) => ({ id: oid })),
      'lsx_issued',
      user.id,
      { type: 'lsx_approved', lsx_code: lsx.code },
    )
    await emit({
      name: 'lsx.decided',
      production_order_id: id,
      code: lsx.code,
      decision: 'approved',
      decided_by: user.id,
      issued_by: lsx.issued_by,
      notify_ids: await lsxAudienceIds(),
    })
    return updated
  },

  /** GĐ TỪ CHỐI LSX: pending_approval → rejected; MỌI đơn về confirmed; báo người phát. */
  async reject(user: User, id: string, reason: string): Promise<ProductionOrder> {
    await assertAction(user, 'production.lsx.approve')
    const lsx = await lsxOrThrow(id)
    if (lsx.status !== 'pending_approval')
      throw BadRequest('LSX không ở trạng thái chờ duyệt')

    const updated = await productionRepo.patch(id, {
      status: 'rejected',
      rejected_reason: reason,
    })
    await moveOrders(
      lsx.order_ids.map((oid) => ({ id: oid })),
      'confirmed',
      user.id,
      { type: 'lsx_rejected', lsx_code: lsx.code },
      reason,
    )
    await emit({
      name: 'lsx.decided',
      production_order_id: id,
      code: lsx.code,
      decision: 'rejected',
      decided_by: user.id,
      issued_by: lsx.issued_by,
      reason,
      notify_ids: lsx.issued_by ? [lsx.issued_by] : [],
    })
    return updated
  },

  /**
   * SỬA THÔNG TIN ĐẦU LỆNH (0117) — số lệnh, ưu tiên, ngày nhận/hạn xuất,
   * container, ghi chú. Trước đây chỉ sửa được kèm lúc gửi duyệt lại lệnh bị
   * từ chối, nên gõ nhầm số lệnh hay khách dời ngày là bó tay.
   *
   * Chặn khi lệnh đã kết thúc (completed/cancelled) — lúc đó phiếu đã là hồ sơ.
   * Đổi số lệnh phải giữ tính duy nhất (DB có unique, đây là chặn sớm cho lỗi
   * đọc được). Không đụng trạng thái/dòng lệnh, không notify: đây là sửa dữ
   * liệu đầu phiếu, còn thay đổi ảnh hưởng xưởng nằm ở dòng lệnh (revision).
   */
  async updateHeader(
    user: User,
    id: string,
    input: {
      code?: string
      priority?: number
      ship_date?: string | null
      received_date?: string | null
      container_summary?: string | null
      note?: string | null
    },
  ): Promise<ProductionOrder> {
    await assertAction(user, 'production.lsx.issue')
    const lsx = await lsxOrThrow(id)
    assertLsxOwner(user, lsx)
    if (lsx.status === 'completed' || lsx.status === 'cancelled') {
      throw BadRequest('Lệnh đã kết thúc — không sửa thông tin được')
    }

    const patch: Partial<ProductionOrder> = {}
    if (input.code !== undefined && input.code !== lsx.code) {
      if (await productionRepo.existsByCode(input.code)) {
        throw Conflict(`Số LSX "${input.code}" đã tồn tại`, 'CODE_TAKEN')
      }
      patch.code = input.code
    }
    if (input.priority !== undefined) patch.priority = input.priority
    if (input.ship_date !== undefined) patch.ship_date = input.ship_date
    if (input.received_date !== undefined) patch.received_date = input.received_date
    if (input.container_summary !== undefined)
      patch.container_summary = input.container_summary
    if (input.note !== undefined) patch.note = input.note

    if (!Object.keys(patch).length) return lsx
    return productionRepo.patch(id, patch)
  },

  /**
   * Sales GỬI DUYỆT LẠI LSX bị từ chối: không tạo bản mới — sửa kèm header rồi
   * quay về pending_approval, GĐ nhận báo duyệt lại. Muốn đổi danh sách đơn thì
   * dùng addOrders/removeOrders trước khi gửi lại.
   */
  async resubmit(
    user: User,
    id: string,
    input: {
      ship_date?: string | null
      received_date?: string | null
      container_summary?: string | null
      note?: string | null
    },
  ): Promise<ProductionOrder> {
    await assertAction(user, 'production.lsx.issue')
    const lsx = await lsxOrThrow(id)
    assertLsxOwner(user, lsx)
    if (lsx.status !== 'rejected') {
      throw BadRequest('Chỉ gửi duyệt lại được LSX bị từ chối')
    }
    const orders = await ordersRepo.listByProductionOrder(id)
    if (!orders.length)
      throw BadRequest('Lệnh không còn đơn nào — thêm đơn trước khi gửi lại')
    const stuck = orders.find((o) => o.status !== 'confirmed')
    if (stuck) {
      throw BadRequest(
        `Đơn ${stuck.code} không còn ở trạng thái Xác nhận — không gửi duyệt lại được`,
      )
    }

    const patch: Partial<ProductionOrder> = {
      status: 'pending_approval',
      rejected_reason: null,
      issued_by: user.id,
      issued_at: new Date().toISOString(),
    }
    if (input.ship_date !== undefined) patch.ship_date = input.ship_date
    if (input.received_date !== undefined) patch.received_date = input.received_date
    if (input.container_summary !== undefined)
      patch.container_summary = input.container_summary
    if (input.note !== undefined) patch.note = input.note
    const updated = await productionRepo.patch(id, patch)

    await moveOrders(orders, 'lsx_pending', user.id, {
      type: 'lsx_resubmitted',
      lsx_code: lsx.code,
    })

    const lines = await ordersRepo.listLinesByOrders(orders.map((o) => o.id))
    await emit({
      name: 'lsx.submitted',
      production_order_id: id,
      code: lsx.code,
      order_codes: orders.map((o) => o.code),
      customer_name: orders[0].customer_name,
      lines_bom_pending: lines.filter((l) => l.bom_status !== 'done').length,
      submitted_by: user.id,
      approver_ids: await approverIds(user.id),
      resubmitted: true,
    })
    return updated
  },

  /**
   * Xưởng xác nhận đã nhận vật tư xuất kho theo LSX (FR-PROD-02) — mốc 1 lần
   * trên header lệnh (0085), có thể xác nhận lại (cập nhật mốc mới).
   */
  async confirmMaterialsReceived(user: User, id: string): Promise<ProductionOrder> {
    await assertAction(user, 'production.progress.track')
    const lsx = await lsxOrThrow(id)
    if (lsx.status !== 'approved' && lsx.status !== 'in_progress') {
      throw BadRequest('LSX không ở trạng thái đang chạy')
    }
    return productionRepo.patch(id, {
      materials_received_at: new Date().toISOString(),
      materials_received_by: user.id,
    })
  },

  /**
   * ĐẶT HẠN VẬT TƯ PHẢI VỀ (0126 — ô "Hạn VT phải về" của sổ Tổng hợp ĐH).
   * Việc của Kế hoạch-Cung ứng nên gác bằng quyền quản đơn đặt, không phải quyền
   * xưởng. null = xoá hạn. Không ràng theo trạng thái lệnh: hạn đặt được từ lúc
   * lệnh còn chờ duyệt (kế hoạch đi trước).
   */
  async setMaterialsDue(
    user: User,
    id: string,
    dueAt: string | null,
  ): Promise<ProductionOrder> {
    await assertAction(user, 'supply.po.manage')
    await lsxOrThrow(id)
    return productionRepo.patch(id, { materials_due_at: dueAt })
  },

  /**
   * HOÀN THÀNH LSX (quản đốc/GĐ) — GATE: mọi công việc (jobs) đã xong.
   * Chưa xong → chặn; admin/manager ép qua (override) kèm lý do. Sau đó đơn
   * → completed, Sales xác nhận giao hàng (ordersService.deliver) khép chuỗi.
   */
  async complete(
    user: User,
    id: string,
    opts: { note?: string | null; override?: boolean } = {},
  ): Promise<ProductionOrder> {
    await assertAction(user, 'production.progress.track')
    const lsx = await lsxOrThrow(id)
    if (lsx.status === 'completed') return lsx as ProductionOrder
    if (lsx.status === 'pending_approval' || lsx.status === 'rejected') {
      throw BadRequest('LSX chưa được duyệt')
    }
    if (lsx.status === 'cancelled') throw BadRequest('LSX đã huỷ theo đơn hàng')

    const jobs = await jobsRepo.listByLsx(id)
    const open = jobs.filter((j) => j.status !== 'done')
    const noPlan = jobs.length === 0
    if (noPlan || open.length) {
      if (!opts.override) {
        throw BadRequest(
          noPlan
            ? 'Lệnh chưa có kế hoạch sản xuất (chưa có công việc nào) — không xác nhận hoàn thành được'
            : `Còn ${open.length} công việc chưa xong — xác nhận từng công đoạn trước, hoặc Ban quản lý ép hoàn thành kèm lý do`,
          'LSX_NOT_READY',
        )
      }
      if (user.role !== 'admin' && user.role !== 'manager') {
        throw Forbidden('Chỉ Ban quản lý được ép hoàn thành khi còn việc dở')
      }
      if (!opts.note?.trim()) throw BadRequest('Ép hoàn thành phải ghi lý do')
    }

    const updated = await productionRepo.patch(id, {
      status: 'completed',
      completed_at: new Date().toISOString(),
      note: opts.note?.trim()
        ? `${lsx.note ? `${lsx.note}\n` : ''}[hoàn thành] ${opts.note.trim()}`
        : lsx.note,
    })
    await moveOrders(
      lsx.order_ids.map((oid) => ({ id: oid })),
      'completed',
      user.id,
      { type: 'production_completed', lsx_code: lsx.code },
      opts.note ?? null,
    )
    return updated
  },

  /**
   * GỘP THÊM ĐƠN vào lệnh (0113) — được phép tới khi lệnh hoàn thành. Đơn thêm
   * vào phải cùng khách, đã xác nhận và chưa thuộc lệnh nào. Trạng thái đơn mới
   * bám theo trạng thái LỆNH để cả nhóm nhìn như nhau:
   * chờ duyệt → lsx_pending · bị từ chối → confirmed · đang chạy → lsx_issued.
   */
  async addOrders(
    user: User,
    id: string,
    orderIdsInput: string[],
  ): Promise<ProductionOrderWithOrders> {
    await assertAction(user, 'production.lsx.issue')
    const lsx = await lsxOrThrow(id)
    assertLsxOwner(user, lsx)
    if (lsx.status === 'completed' || lsx.status === 'cancelled') {
      throw BadRequest('Lệnh đã kết thúc — không gộp thêm đơn được')
    }
    const orderIds = [...new Set(orderIdsInput)]
    if (!orderIds.length) throw BadRequest('Chọn đơn cần gộp vào lệnh')

    const orders = await findOrdersOrThrow(orderIds)
    assertMergeable(orders, lsx.customer_id)
    await productionRepo.attachOrders(id, orderIds)
    try {
      await lsxLinesService.seedFromOrders(id) // thêm nhóm + dòng cho đơn mới
    } catch (err) {
      console.error('[lsx.addOrders] nạp dòng lệnh lỗi (đơn vẫn gộp):', err)
    }

    const status: OrderStatus =
      lsx.status === 'pending_approval'
        ? 'lsx_pending'
        : lsx.status === 'rejected'
          ? 'confirmed'
          : 'lsx_issued'
    await moveOrders(orders, status, user.id, {
      type: 'lsx_order_added',
      lsx_code: lsx.code,
    })

    // Lệnh ĐANG CHẠY mà đổi phạm vi thì Kế hoạch/Cung ứng/xưởng phải biết ngay
    // (vật tư đã đặt theo số cũ, kế hoạch phải thêm việc cho dòng SP mới).
    if (lsx.status === 'approved' || lsx.status === 'in_progress') {
      await emit({
        name: 'lsx.orders.changed',
        production_order_id: id,
        code: lsx.code,
        added: orders.map((o) => o.code),
        removed: [],
        changed_by: user.id,
        notify_ids: await lsxAudienceIds(),
      })
    }
    return lsxOrThrow(id)
  },

  /**
   * GỠ ĐƠN khỏi lệnh (0113) — đơn quay lại Xác nhận, chờ xếp vào lệnh khác.
   * CHẶN khi phần việc của đơn đã chạy: có sổ số liệu, hoặc job đã doing/done.
   * Chưa chạy thì gỡ kèm dữ liệu dẫn xuất của riêng đơn đó (job 'todo' + dòng
   * định hình) — chúng chỉ là kế hoạch, giữ lại thành rác treo trong lệnh.
   */
  async removeOrders(
    user: User,
    id: string,
    orderIdsInput: string[],
  ): Promise<ProductionOrderWithOrders> {
    await assertAction(user, 'production.lsx.issue')
    const lsx = await lsxOrThrow(id)
    assertLsxOwner(user, lsx)
    // Duyệt rồi thì nội dung lệnh là cam kết với xưởng — chỉ SỬA/CẬP NHẬT, không
    // gỡ bớt đơn ra nữa (chốt 07/08/2026). Muốn dừng hẳn thì huỷ ĐƠN, lệnh khép theo.
    if (!canRemoveOrdersFromLsx(lsx.status)) {
      throw BadRequest(
        'Lệnh đã được duyệt — không gỡ đơn khỏi lệnh được nữa, chỉ sửa/cập nhật. Muốn dừng thì huỷ đơn.',
      )
    }
    const orderIds = [...new Set(orderIdsInput)]
    if (!orderIds.length) throw BadRequest('Chọn đơn cần gỡ khỏi lệnh')

    const orders = await ordersRepo.listByProductionOrder(id)
    const removing = orders.filter((o) => orderIds.includes(o.id))
    if (removing.length !== orderIds.length) {
      throw BadRequest('Có đơn không thuộc lệnh này')
    }
    if (removing.length === orders.length) {
      throw BadRequest('Lệnh phải còn ít nhất một đơn — huỷ đơn nếu muốn dừng lệnh')
    }

    // Phần lệnh thuộc đơn bị gỡ = các NHÓM gắn đơn đó (0114) và dòng của chúng.
    const groups = (await lsxLinesRepo.listGroups(id)).filter(
      (g) => g.sales_order_id && orderIds.includes(g.sales_order_id),
    )
    const groupIds = new Set(groups.map((g) => g.id))
    const lines = (await lsxLinesRepo.listLines(id)).filter((l) =>
      groupIds.has(l.group_id),
    )
    const lineIds = new Set(lines.map((l) => l.id))

    const jobs = (await jobsRepo.listByLsx(id)).filter((j) =>
      lineIds.has(j.production_order_line_id),
    )
    if (jobs.some((j) => j.status !== 'todo')) {
      throw BadRequest(
        'Đơn đã vào sản xuất (có công đoạn đang chạy/đã xong) — không gỡ khỏi lệnh được',
      )
    }
    const componentIds = new Set(
      (await componentsRepo.listByLsx(id))
        .filter((c) => lineIds.has(c.production_order_line_id))
        .map((c) => c.id),
    )
    const entries = await entriesRepo.listByLsx(id)
    if (entries.some((e) => componentIds.has(e.component_id))) {
      throw BadRequest('Đơn đã có sổ số liệu — không gỡ khỏi lệnh được')
    }

    // Xoá nhóm → cascade dòng → cascade job/định hình của riêng đơn đó.
    await lsxLinesRepo.deleteGroups([...groupIds])
    await productionRepo.detachOrders(orderIds)
    await moveOrders(removing, 'confirmed', user.id, {
      type: 'lsx_order_removed',
      lsx_code: lsx.code,
    })

    if (lsx.status === 'approved' || lsx.status === 'in_progress') {
      await emit({
        name: 'lsx.orders.changed',
        production_order_id: id,
        code: lsx.code,
        added: [],
        removed: removing.map((o) => o.code),
        changed_by: user.id,
        notify_ids: await lsxAudienceIds(),
      })
    }
    return lsxOrThrow(id)
  },
}
