import {
  quotesRepo,
  type Quote,
  type QuoteLineInput,
  type QuoteWithCustomer,
} from './quotes.repo'
import { customersRepo } from './sales.repo'
import type { QuoteStatus } from './quotes.schema'
import { usersRepo, type User } from '@/modules/core/users/users.repo'
import { hasPermission, assertAction } from '@/modules/core/rbac/rbac.service'
import { rbacRepo } from '@/modules/core/rbac/rbac.repo'
import { emit } from '@/events/bus'
import { BadRequest, Forbidden, NotFound } from '@/server/http'

// Phase 2 RBAC: guard đọc thẳng permission (bỏ hardcode tên phòng).
async function isSalesStaff(user: User): Promise<boolean> {
  return hasPermission(user, 'sales.member')
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

  async detail(_user: User, id: string) {
    const quote = await quotesRepo.findById(id)
    if (!quote) throw NotFound('Báo giá không tồn tại')
    const lines = await quotesRepo.listLines(id)
    return { quote, lines }
  },

  async create(user: User, input: QuoteInput): Promise<Quote> {
    if (!(await isSalesStaff(user))) {
      throw Forbidden('Chỉ Kinh doanh lập được báo giá')
    }
    const customer = await customersRepo.findById(input.customer_id)
    if (!customer) throw NotFound('Khách hàng không tồn tại')
    if (!customer.is_active) throw BadRequest('Khách hàng đã ngừng giao dịch')

    const code = await quotesRepo.nextCode()
    return quotesRepo.insert(
      {
        code,
        customer_id: input.customer_id,
        // Auto-fill điều khoản mặc định của KH khi báo giá không nêu rõ (FR-SAL-02).
        currency: input.currency,
        valid_from: input.valid_from ?? null,
        valid_to: input.valid_to ?? null,
        price_term: input.price_term ?? customer.default_price_term ?? null,
        payment_terms: input.payment_terms ?? customer.default_payment_terms ?? null,
        note: input.note ?? null,
        created_by: user.id,
      },
      input.lines,
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
    await quotesRepo.replaceLines(id, input.lines)
    return quote
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
    if ((await quotesRepo.countLines(id)) === 0) {
      throw BadRequest('Báo giá chưa có dòng sản phẩm nào')
    }
    return quotesRepo.patch(id, { status: 'sent' })
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
    if (quote.status !== 'sent') {
      throw BadRequest('Chỉ tạo được đơn hàng từ báo giá đã chốt (gửi khách)')
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
