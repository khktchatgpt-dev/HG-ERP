import { BadRequest, Forbidden, NotFound } from '@/server/http'
import { db } from '@/server/db'
import type { User } from '@/modules/core/users/users.repo'
import { isTechnicalStaff } from './technical.service'
import { samplesRepo } from './samples.repo'
import { loansRepo, type Loan, type LoanWithRefs } from './loans.repo'
import {
  SAMPLE_STATUS_LABEL,
  type LoanCreateInput,
  type LoanReturnInput,
} from './samples.schema'

async function assertTechnical(user: User): Promise<void> {
  if (!(await isTechnicalStaff(user))) {
    throw Forbidden('Chỉ phòng Kỹ thuật ghi sổ mượn mẫu')
  }
}

/**
 * Tên người mượn lấy từ hồ sơ, nhưng LƯU LẠI như bản chụp.
 *
 * FK `borrower_user_id`/`borrower_customer_id` là `on delete set null`, nên nếu
 * chỉ dựa vào join thì khách bị xoá là sổ mất tên người mượn. Sổ mà không biết
 * ai mượn thì hết là sổ.
 */
async function resolveBorrowerName(input: LoanCreateInput): Promise<string> {
  if (input.borrower_kind === 'user' && input.borrower_user_id) {
    const { data } = await db()
      .from('users')
      .select('name, email')
      .eq('id', input.borrower_user_id)
      .maybeSingle()
    if (!data) throw NotFound('Không tìm thấy nhân viên')
    return data.name ?? data.email
  }
  if (input.borrower_kind === 'customer' && input.borrower_customer_id) {
    const { data } = await db()
      .from('sales_customers')
      .select('name')
      .eq('id', input.borrower_customer_id)
      .maybeSingle()
    if (!data) throw NotFound('Không tìm thấy khách hàng')
    return data.name
  }
  if (!input.borrower_name) throw BadRequest('Thiếu tên người mượn')
  return input.borrower_name
}

export const loansService = {
  /** Sổ theo dõi — xem mở cho mọi NV đã đăng nhập, như thư viện SP. */
  async list(
    _user: User,
    q: { sample_id?: string; open_only?: boolean; page: number; page_size: number },
  ): Promise<{ rows: LoanWithRefs[]; total: number }> {
    return loansRepo.list(q)
  },

  /**
   * Ghi phiếu mượn. Chỉ mẫu đang ở showroom mới cho mượn được.
   *
   * Chốt chặn thật nằm ở DB: unique index `technical_sample_loan_active_uniq`
   * trên (sample_id) where returned_at is null. Kiểm status ở đây chỉ để báo lỗi
   * tử tế; nếu 2 request vào cùng lúc thì Postgres mới là thứ chặn được.
   */
  async create(user: User, sampleId: string, input: LoanCreateInput): Promise<Loan> {
    await assertTechnical(user)

    const sample = await samplesRepo.findById(sampleId)
    if (!sample) throw NotFound('Không tìm thấy mẫu')
    if (sample.status !== 'in_showroom') {
      throw BadRequest(
        `Mẫu đang "${SAMPLE_STATUS_LABEL[sample.status]}" — không cho mượn được`,
      )
    }

    const borrowerName = await resolveBorrowerName(input)
    const code = await loansRepo.nextCode()

    let loan: Loan
    try {
      loan = await loansRepo.insert({
        code,
        sample_id: sampleId,
        borrower_kind: input.borrower_kind,
        borrower_user_id: input.borrower_user_id ?? null,
        borrower_customer_id: input.borrower_customer_id ?? null,
        borrower_name: borrowerName,
        borrower_contact: input.borrower_contact ?? null,
        purpose: input.purpose ?? null,
        due_at: input.due_at ?? null,
        issued_by: user.id,
        note: input.note ?? null,
      })
    } catch (e) {
      // 23505 = unique_violation → đã có lượt mượn chưa trả (race giữa 2 request).
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('technical_sample_loan_active_uniq') || msg.includes('23505')) {
        throw BadRequest('Mẫu này vừa được cho người khác mượn — tải lại trang')
      }
      throw e
    }

    // Đổi status NGAY sau khi ghi phiếu. Đây là chỗ `status` dễ trôi khỏi sổ nhất.
    await samplesRepo.patch(sampleId, { status: 'on_loan' })
    return loan
  },

  /**
   * Ghi trả. Tình trạng lúc nhận lại quyết định mẫu về showroom hay đi sửa —
   * mẫu trả về hỏng mà vẫn xếp "ở showroom" thì lần sau lại đem cho mượn tiếp.
   */
  async return(user: User, loanId: string, input: LoanReturnInput): Promise<Loan> {
    await assertTechnical(user)

    const loan = await loansRepo.findById(loanId)
    if (!loan) throw NotFound('Không tìm thấy phiếu mượn')
    if (loan.returned_at) throw BadRequest('Phiếu này đã ghi trả rồi')

    const updated = await loansRepo.patch(loanId, {
      returned_at: new Date().toISOString(),
      returned_condition: input.returned_condition,
      received_by: user.id,
      note: input.note ?? loan.note,
    })

    const sample = await samplesRepo.findById(loan.sample_id)
    if (sample) {
      const backTo =
        input.returned_condition === 'damaged' ? 'maintenance' : 'in_showroom'
      await samplesRepo.patch(loan.sample_id, {
        status: backTo,
        condition: input.returned_condition,
      })
      if (sample.condition !== input.returned_condition) {
        await samplesRepo.logEvent({
          sample_id: loan.sample_id,
          actor_id: user.id,
          action: 'condition_changed',
          before: { condition: sample.condition },
          after: { condition: input.returned_condition },
          note: `Ghi trả phiếu ${loan.code}`,
        })
      }
    }
    return updated
  },
}
