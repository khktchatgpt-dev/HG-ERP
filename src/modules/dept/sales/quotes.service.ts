import {
  quotesRepo,
  type Quote,
  type QuoteLineInput,
  type QuoteWithCustomer,
} from './quotes.repo'
import { customersRepo } from './sales.repo'
import type { QuoteStatus } from './quotes.schema'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { usersRepo, type User } from '@/modules/core/users/users.repo'
import { emit } from '@/events/bus'
import { BadRequest, Forbidden, NotFound } from '@/server/http'

const SALES_DEPT_NAME = 'Bán Hàng'

async function isSalesStaff(user: User): Promise<boolean> {
  if (user.role === 'admin') return true
  if (!user.department_id) return false
  const dept = await departmentsRepo.findById(user.department_id)
  return dept?.name === SALES_DEPT_NAME
}

/** Duyệt báo giá: GĐ/Ban quản lý (đặc tả mục 6 — duyệt báo giá là của Giám đốc). */
function canApprove(user: User): boolean {
  return user.role === 'admin' || user.role === 'manager'
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
        currency: input.currency,
        valid_from: input.valid_from ?? null,
        valid_to: input.valid_to ?? null,
        price_term: input.price_term ?? null,
        payment_terms: input.payment_terms ?? null,
        note: input.note ?? null,
        created_by: user.id,
      },
      input.lines,
    )
  },

  /** Chỉ báo giá NHÁP được sửa — đã gửi duyệt/duyệt rồi thì bất biến (làm BG mới). */
  async update(user: User, id: string, input: QuoteInput): Promise<Quote> {
    if (!(await isSalesStaff(user))) throw Forbidden()
    const before = await quotesRepo.findById(id)
    if (!before) throw NotFound('Báo giá không tồn tại')
    if (before.status !== 'draft') {
      throw BadRequest('Chỉ báo giá nháp mới sửa được — hãy tạo báo giá mới')
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
    if (!(await isSalesStaff(user))) throw Forbidden()
    const before = await quotesRepo.findById(id)
    if (!before) throw NotFound()
    if (before.status !== 'draft') throw BadRequest('Chỉ xoá được báo giá nháp')
    await quotesRepo.delete(id)
  },

  /** Gửi GĐ duyệt (FR-SAL-03): draft → pending, phải có ít nhất 1 dòng SP. */
  async submit(user: User, id: string): Promise<Quote> {
    if (!(await isSalesStaff(user))) throw Forbidden()
    const before = await quotesRepo.findById(id)
    if (!before) throw NotFound('Báo giá không tồn tại')
    if (before.status !== 'draft') throw BadRequest('Báo giá đã gửi duyệt rồi')
    if ((await quotesRepo.countLines(id)) === 0) {
      throw BadRequest('Báo giá chưa có dòng sản phẩm nào')
    }
    const quote = await quotesRepo.patch(id, { status: 'pending' })

    const approvers = (await usersRepo.list()).filter(
      (u) => (u.role === 'admin' || u.role === 'manager') && u.id !== user.id,
    )
    await emit({
      name: 'quote.submitted',
      quote_id: id,
      code: before.code,
      customer_name: before.customer_name,
      submitted_by: user.id,
      approver_ids: approvers.map((a) => a.id),
    })
    return quote
  },

  /** GĐ duyệt / từ chối (BR-04 nửa đầu): pending → approved | rejected. */
  async decide(
    user: User,
    id: string,
    decision: 'approve' | 'reject',
    reason?: string,
  ): Promise<Quote> {
    if (!canApprove(user)) throw Forbidden('Chỉ Ban quản lý/Giám đốc duyệt báo giá')
    const before = await quotesRepo.findById(id)
    if (!before) throw NotFound('Báo giá không tồn tại')
    if (before.status !== 'pending') {
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
      created_by: before.created_by,
      reason,
    })
    return quote
  },

  /**
   * BR-04 (nửa sau) — dùng ở service Đơn hàng (S2): chỉ báo giá approved mới
   * tạo được đơn. Đặt ở đây để logic trạng thái báo giá nằm một chỗ.
   */
  async assertApproved(quoteId: string): Promise<QuoteWithCustomer> {
    const quote = await quotesRepo.findById(quoteId)
    if (!quote) throw NotFound('Báo giá không tồn tại')
    if (quote.status !== 'approved') {
      throw BadRequest('BR-04: chỉ báo giá đã được Giám đốc duyệt mới tạo được đơn hàng')
    }
    return quote
  },
}

export { isSalesStaff }
