import {
  quotesRepo,
  type Quote,
  type QuoteLineInput,
  type QuoteWithCustomer,
} from './quotes.repo'
import { customersRepo } from './sales.repo'
import type { QuoteStatus } from './quotes.schema'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { type User } from '@/modules/core/users/users.repo'
import { BadRequest, Forbidden, NotFound } from '@/server/http'

const SALES_DEPT_NAME = 'Bán Hàng'

async function isSalesStaff(user: User): Promise<boolean> {
  if (user.role === 'admin') return true
  if (!user.department_id) return false
  const dept = await departmentsRepo.findById(user.department_id)
  return dept?.name === SALES_DEPT_NAME
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

  /**
   * Chốt & gửi khách (FR-SAL-03): draft → sent. Sale tự làm, KHÔNG cần duyệt.
   * Sau khi chốt, báo giá bất biến và tạo được đơn hàng.
   */
  async send(user: User, id: string): Promise<Quote> {
    if (!(await isSalesStaff(user))) throw Forbidden('Chỉ Kinh doanh chốt được báo giá')
    const before = await quotesRepo.findById(id)
    if (!before) throw NotFound('Báo giá không tồn tại')
    if (before.status !== 'draft') throw BadRequest('Báo giá đã chốt rồi')
    if ((await quotesRepo.countLines(id)) === 0) {
      throw BadRequest('Báo giá chưa có dòng sản phẩm nào')
    }
    return quotesRepo.patch(id, { status: 'sent' })
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

export { isSalesStaff }
