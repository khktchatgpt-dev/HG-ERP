import {
  quotesRepo,
  type Quote,
  type QuoteLineInput,
  type QuoteWithCustomer,
} from './quotes.repo'
import { customersRepo } from './sales.repo'
import type { QuoteStatus } from './quotes.schema'
import { usersRepo, type User } from '@/modules/core/users/users.repo'
import { hasPermission, assertAction, canAction } from '@/modules/core/rbac/rbac.service'
import { planCostService } from '@/modules/dept/technical/plan-cost.service'
import { quoteNetPrice } from '@/lib/quote-price'
import { rbacRepo } from '@/modules/core/rbac/rbac.repo'
import { emit } from '@/events/bus'
import { todayVn } from '@/lib/date-vn'
import { BadRequest, Forbidden, NotFound } from '@/server/http'

// Phase 2 RBAC: guard đọc thẳng permission (bỏ hardcode tên phòng).
async function isSalesStaff(user: User): Promise<boolean> {
  return hasPermission(user, 'sales.member')
}

/** yyyy-mm-dd + n ngày. */
function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/**
 * Chụp GIÁ THÀNH KẾ HOẠCH (0220) vào từng dòng lúc chào (0225) — chỉ khi người
 * lập có quyền xem giá thành; không thì null (bí mật Bán hàng không rò qua dòng).
 */
async function withPlanSnapshot(
  user: User,
  lines: QuoteLineInput[],
): Promise<QuoteLineInput[]> {
  if (!lines.length || !(await canAction(user, 'technical.plan_cost.view'))) return lines
  const prices = await planCostService.pricesFor(lines.map((l) => l.product_id))
  return lines.map((l) => ({
    ...l,
    plan_price_snapshot: prices.get(l.product_id)?.price ?? null,
  }))
}

/** Lãi kế hoạch % của một dòng = (net − giá thành) / net. null khi thiếu một trong hai. */
export function quoteLineMargin(
  unitPrice: number,
  discountPct: number | null | undefined,
  planPrice: number | null | undefined,
): number | null {
  const net = quoteNetPrice(unitPrice, discountPct)
  if (!(net > 0) || planPrice == null) return null
  return Math.round(((net - planPrice) / net) * 1000) / 10
}

type QuoteInput = {
  customer_id: string
  currency: string
  valid_from?: string | null
  valid_to?: string | null
  price_term?: string | null
  payment_terms?: string | null
  note?: string | null
  lines: QuoteLineInput[]
}

export const quotesService = {
  /** Đọc: mọi NV đã đăng nhập (Ban QL/phòng khác xem — ma trận phân quyền đặc tả mục 6). */
  async list(
    _user: User,
    opts: {
      q?: string
      customer_id?: string
      status?: QuoteStatus
      page: number
      page_size: number
    },
  ) {
    return quotesRepo.list(opts)
  },

  async detail(user: User, id: string) {
    const quote = await quotesRepo.findById(id)
    if (!quote) throw NotFound('Báo giá không tồn tại')
    const [lines, canSeeCost, orders, revisions] = await Promise.all([
      quotesRepo.listLines(id),
      canAction(user, 'technical.plan_cost.view'),
      quotesRepo.ordersByQuoteIds([id]),
      quotesRepo.listRevisions(id),
    ])
    // Giá thành KH là bí mật Bán hàng — không có quyền thì không trả cột (kể cả snapshot).
    const planPrices = canSeeCost
      ? await planCostService.pricesFor(lines.map((l) => l.product_id))
      : new Map<string, { price: number; currency: string }>()
    return {
      quote,
      lines: canSeeCost ? lines : lines.map((l) => ({ ...l, plan_price_snapshot: null })),
      canSeeCost,
      planPrices: Object.fromEntries(planPrices),
      orders: orders.get(id) ?? [],
      revisions,
    }
  },

  /** Giá thành KH cho form lập báo giá — rỗng khi không có quyền (không 403, form vẫn dùng được). */
  async planPricesFor(user: User, productIds: string[]) {
    if (!(await canAction(user, 'technical.plan_cost.view'))) return {}
    return Object.fromEntries(await planCostService.pricesFor(productIds))
  },

  async create(user: User, input: QuoteInput): Promise<Quote> {
    if (!(await isSalesStaff(user))) {
      throw Forbidden('Chỉ Kinh doanh lập được báo giá')
    }
    const customer = await customersRepo.findById(input.customer_id)
    if (!customer) throw NotFound('Khách hàng không tồn tại')
    if (!customer.is_active) throw BadRequest('Khách hàng đã ngừng giao dịch')

    const code = await quotesRepo.nextCode()
    const today = todayVn()
    return quotesRepo.insert(
      {
        code,
        customer_id: input.customer_id,
        // Auto-fill điều khoản mặc định của KH khi báo giá không nêu rõ (FR-SAL-02).
        currency: input.currency,
        valid_from: input.valid_from ?? today,
        // Hiệu lực mặc định 30 ngày (07/10/2026) — bản in từng ra "From … to …" rỗng.
        valid_to: input.valid_to ?? addDays(input.valid_from ?? today, 30),
        price_term: input.price_term ?? customer.default_price_term ?? null,
        payment_terms: input.payment_terms ?? customer.default_payment_terms ?? null,
        note: input.note ?? null,
        created_by: user.id,
      },
      await withPlanSnapshot(user, input.lines),
    )
  },

  /**
   * Chỉ báo giá NHÁP hoặc BỊ TỪ CHỐI được sửa (0149): bị từ chối thì Sale sửa
   * theo lý do của GĐ rồi trình lại. Từ pending_approval trở đi là bất biến —
   * nội dung trên bàn GĐ / đã gửi khách không đổi sau lưng.
   */
  async update(user: User, id: string, input: QuoteInput): Promise<Quote> {
    await assertAction(user, 'sales.quote.manage')
    const before = await quotesRepo.findById(id)
    if (!before) throw NotFound('Báo giá không tồn tại')
    if (before.status !== 'draft' && before.status !== 'rejected') {
      throw BadRequest('Chỉ báo giá nháp / bị từ chối mới sửa được — hãy tạo báo giá mới')
    }
    const quote = await quotesRepo.patch(id, {
      customer_id: input.customer_id,
      currency: input.currency,
      valid_from: input.valid_from ?? null,
      valid_to: input.valid_to ?? null,
      price_term: input.price_term ?? null,
      payment_terms: input.payment_terms ?? null,
      note: input.note ?? null,
    })
    await quotesRepo.replaceLines(id, await withPlanSnapshot(user, input.lines))
    return quote
  },

  /**
   * BẢN SỬA ĐỔI (0225): sao chép đầu + dòng thành NHÁP mới, revision_no + 1,
   * revision_of = bản này; bản này sang 'superseded' KHI bản mới được gửi khách
   * (trước đó bản cũ vẫn là bản đang hiệu lực). Trước 07/10/2026 "hãy tạo báo
   * giá mới" = chọn lại từng SP, gõ lại từng giá.
   */
  async revise(user: User, id: string): Promise<Quote> {
    await assertAction(user, 'sales.quote.manage')
    const before = await quotesRepo.findById(id)
    if (!before) throw NotFound('Báo giá không tồn tại')
    if (!['sent', 'approved', 'won', 'lost'].includes(before.status)) {
      throw BadRequest(
        'Chỉ lập bản sửa đổi từ báo giá đã gửi / đã duyệt — nháp thì sửa thẳng',
      )
    }
    const lines = await quotesRepo.listLines(id)
    return quotesRepo.insert(
      {
        code: await quotesRepo.nextCode(),
        customer_id: before.customer_id,
        currency: before.currency,
        valid_from: todayVn(),
        valid_to: addDays(todayVn(), 30),
        price_term: before.price_term,
        payment_terms: before.payment_terms,
        note: before.note,
        created_by: user.id,
        revision_no: before.revision_no + 1,
        revision_of: before.id,
      },
      await withPlanSnapshot(
        user,
        lines.map((l) => ({
          product_id: l.product_id,
          qty: l.qty,
          unit_price: l.unit_price,
          discount_pct: l.discount_pct,
          note: l.note,
        })),
      ),
    )
  },

  /** NHÂN BẢN sang khách khác (hoặc cùng khách, mùa sau): nháp mới bản 1, không nối chuỗi. */
  async copy(user: User, id: string, customerId?: string | null): Promise<Quote> {
    await assertAction(user, 'sales.quote.manage')
    const before = await quotesRepo.findById(id)
    if (!before) throw NotFound('Báo giá không tồn tại')
    const cid = customerId ?? before.customer_id
    const customer = await customersRepo.findById(cid)
    if (!customer) throw NotFound('Khách hàng không tồn tại')
    if (!customer.is_active) throw BadRequest('Khách hàng đã ngừng giao dịch')
    const lines = await quotesRepo.listLines(id)
    return quotesRepo.insert(
      {
        code: await quotesRepo.nextCode(),
        customer_id: cid,
        currency:
          cid === before.customer_id
            ? before.currency
            : (customer.default_currency ?? before.currency),
        valid_from: todayVn(),
        valid_to: addDays(todayVn(), 30),
        price_term:
          cid === before.customer_id
            ? before.price_term
            : (customer.default_price_term ?? null),
        payment_terms:
          cid === before.customer_id
            ? before.payment_terms
            : (customer.default_payment_terms ?? null),
        note: before.note,
        created_by: user.id,
      },
      await withPlanSnapshot(
        user,
        lines.map((l) => ({
          product_id: l.product_id,
          qty: l.qty,
          unit_price: l.unit_price,
          discount_pct: l.discount_pct,
          note: l.note,
        })),
      ),
    )
  },

  /** KẾT CỤC thua — chỉ báo giá đã gửi; lý do bắt buộc. */
  async markLost(user: User, id: string, reason: string): Promise<Quote> {
    await assertAction(user, 'sales.quote.manage')
    const before = await quotesRepo.findById(id)
    if (!before) throw NotFound('Báo giá không tồn tại')
    if (before.status !== 'sent')
      throw BadRequest('Chỉ đánh dấu thua cho báo giá đã gửi khách')
    return quotesRepo.patch(id, { status: 'lost', lost_reason: reason })
  },

  /** Sale rút báo giá (nháp / từ chối / đã gửi chưa ra đơn) — bất biến sau đó. */
  async cancel(user: User, id: string): Promise<Quote> {
    await assertAction(user, 'sales.quote.manage')
    const before = await quotesRepo.findById(id)
    if (!before) throw NotFound('Báo giá không tồn tại')
    if (!['draft', 'rejected', 'sent', 'approved'].includes(before.status)) {
      throw BadRequest('Báo giá này không huỷ được nữa')
    }
    return quotesRepo.patch(id, { status: 'cancelled' })
  },

  /** Đơn hàng vừa tạo từ báo giá → 'won' (gọi từ ordersService.create, best-effort). */
  async markWon(quoteId: string): Promise<void> {
    const q = await quotesRepo.findById(quoteId)
    if (q && q.status === 'sent') await quotesRepo.patch(quoteId, { status: 'won' })
  },

  async remove(user: User, id: string): Promise<void> {
    await assertAction(user, 'sales.quote.manage')
    const before = await quotesRepo.findById(id)
    if (!before) throw NotFound()
    if (before.status !== 'draft') throw BadRequest('Chỉ xoá được báo giá nháp')
    await quotesRepo.delete(id)
  },

  /**
   * Chốt & gửi khách (FR-SAL-03): draft|approved → sent.
   * Duyệt GĐ là TUỲ CHỌN (0149): báo giá thường Sale tự chốt từ nháp; báo giá
   * đã trình thì phải được GĐ ký (approved) mới gửi khách được.
   */
  async send(user: User, id: string): Promise<Quote> {
    await assertAction(user, 'sales.quote.manage')
    const before = await quotesRepo.findById(id)
    if (!before) throw NotFound('Báo giá không tồn tại')
    if (before.status === 'pending_approval') {
      throw BadRequest('Báo giá đang chờ Giám đốc duyệt — chưa gửi khách được')
    }
    if (before.status !== 'draft' && before.status !== 'approved') {
      throw BadRequest('Báo giá đã chốt rồi')
    }
    const lines = await quotesRepo.listLines(id)
    if (lines.length === 0) {
      throw BadRequest('Báo giá chưa có dòng sản phẩm nào')
    }
    // Giá 0 gửi khách là gửi tờ giấy trắng; hết hiệu lực là gửi giá đã chết.
    const zero = lines.filter((l) => !(l.unit_price > 0))
    if (zero.length) {
      throw BadRequest(
        `Còn ${zero.length} dòng chưa có đơn giá — điền giá rồi mới gửi khách`,
      )
    }
    if (before.valid_to && before.valid_to < todayVn()) {
      throw BadRequest(
        `Báo giá hết hiệu lực từ ${before.valid_to} — sửa ngày hiệu lực rồi mới gửi`,
      )
    }
    const sent = await quotesRepo.patch(id, { status: 'sent' })
    // Bản sửa đổi được gửi → bản trước không còn là bản đang chào (0225).
    if (before.revision_of) {
      const prev = await quotesRepo.findById(before.revision_of)
      if (prev && ['sent', 'approved'].includes(prev.status)) {
        await quotesRepo.patch(prev.id, { status: 'superseded' })
      }
    }
    return sent
  },

  /**
   * TRÌNH GĐ DUYỆT (0149 — tuỳ chọn, Sale tự quyết): draft|rejected →
   * pending_approval. Từ đây báo giá bất biến cho tới khi GĐ quyết.
   */
  async submit(user: User, id: string): Promise<Quote> {
    await assertAction(user, 'sales.quote.manage')
    const before = await quotesRepo.findById(id)
    if (!before) throw NotFound('Báo giá không tồn tại')
    if (before.status !== 'draft' && before.status !== 'rejected') {
      throw BadRequest('Chỉ báo giá nháp / bị từ chối mới trình duyệt được')
    }
    if ((await quotesRepo.countLines(id)) === 0) {
      throw BadRequest('Báo giá chưa có dòng sản phẩm nào')
    }
    const quote = await quotesRepo.patch(id, {
      status: 'pending_approval',
      submitted_at: new Date().toISOString(),
      submitted_by: user.id,
      rejected_reason: null,
    })
    await emit({
      name: 'quote.submitted',
      quote_id: id,
      code: before.code,
      customer_name: before.customer_name,
      submitted_by: user.id,
      approver_ids: await quoteApproverIds(user.id),
      resubmitted: before.status === 'rejected',
    })
    return quote
  },

  /** GĐ DUYỆT / TỪ CHỐI (0149): pending_approval → approved | rejected. */
  async decide(
    user: User,
    id: string,
    decision: 'approve' | 'reject',
    reason?: string,
  ): Promise<Quote> {
    await assertAction(user, 'sales.quote.approve')
    const before = await quotesRepo.findById(id)
    if (!before) throw NotFound('Báo giá không tồn tại')
    if (before.status !== 'pending_approval') {
      throw BadRequest('Chỉ duyệt được báo giá đang chờ duyệt')
    }
    const quote = await quotesRepo.patch(
      id,
      decision === 'approve'
        ? {
            status: 'approved',
            approved_by: user.id,
            approved_at: new Date().toISOString(),
          }
        : { status: 'rejected', rejected_reason: reason ?? null },
    )
    await emit({
      name: 'quote.decided',
      quote_id: id,
      code: before.code,
      decision: decision === 'approve' ? 'approved' : 'rejected',
      decided_by: user.id,
      owner_id: before.created_by,
      reason,
    })
    return quote
  },

  /**
   * Cổng tạo đơn hàng — dùng ở service Đơn hàng (S2): chỉ báo giá đã chốt (sent)
   * mới tạo được đơn. Đặt ở đây để logic trạng thái báo giá nằm một chỗ.
   */
  async assertSent(quoteId: string): Promise<QuoteWithCustomer> {
    const quote = await quotesRepo.findById(quoteId)
    if (!quote) throw NotFound('Báo giá không tồn tại')
    if (quote.status !== 'sent' && quote.status !== 'won') {
      throw BadRequest('Chỉ tạo được đơn hàng từ báo giá đã chốt (gửi khách)')
    }
    if (quote.valid_to && quote.valid_to < todayVn()) {
      throw BadRequest(
        `Báo giá ${quote.code} hết hiệu lực từ ${quote.valid_to} — lập báo giá mới hoặc tạo đơn trực tiếp`,
      )
    }
    return quote
  },
}

/**
 * Người NHẬN thông báo trình báo giá: ai có quyền `sales.quote.approve` thật
 * (vai director) ∪ admin — cùng công thức với approverIds của PO (G3).
 */
async function quoteApproverIds(excludeUserId: string): Promise<string[]> {
  const [withPerm, users] = await Promise.all([
    rbacRepo.userIdsWithPermission('sales.quote.approve'),
    usersRepo.list(),
  ])
  const ids = new Set(withPerm)
  for (const u of users) if (u.role === 'admin') ids.add(u.id)
  ids.delete(excludeUserId)
  return [...ids]
}

export { isSalesStaff }
