import {
  invoicesRepo,
  type Invoice,
  type InvoiceDirection,
  type InvoiceStatus,
} from './accounting.repo'
import type { User } from '@/modules/core/users/users.repo'
import { hasPermission } from '@/modules/core/rbac/rbac.service'
import { BadRequest, Conflict, Forbidden, NotFound } from '@/server/http'

// Phase 2 RBAC: guard đọc thẳng permission (bỏ hardcode tên phòng).
async function isAccountingStaff(user: User): Promise<boolean> {
  return hasPermission(user, 'accounting.member')
}

type CreateInput = {
  invoice_no: string
  party_name: string
  direction: InvoiceDirection
  amount: number
  currency: string
  issued_date: string
  due_date?: string | null
  notes?: string | null
}

export const invoicesService = {
  async list(
    user: User,
    opts: {
      q?: string
      direction?: InvoiceDirection
      status?: InvoiceStatus
      page: number
      page_size: number
    },
  ) {
    if (!(await isAccountingStaff(user))) throw Forbidden('Chỉ Kế toán xem được')
    return invoicesRepo.list(opts)
  },

  async create(user: User, input: CreateInput): Promise<Invoice> {
    if (!(await isAccountingStaff(user))) throw Forbidden()
    return invoicesRepo.insert({
      invoice_no: input.invoice_no,
      party_name: input.party_name,
      direction: input.direction,
      amount: input.amount,
      currency: input.currency,
      issued_date: input.issued_date,
      due_date: input.due_date ?? null,
      notes: input.notes ?? null,
      created_by: user.id,
    })
  },

  async update(user: User, id: string, patch: Partial<Invoice>): Promise<Invoice> {
    if (!(await isAccountingStaff(user))) throw Forbidden()
    const before = await invoicesRepo.findById(id)
    if (!before) throw NotFound('Hoá đơn không tồn tại')

    // Khi đánh dấu đã thanh toán, stamp paid_at.
    if (patch.status === 'paid' && before.status !== 'paid') {
      patch = { ...patch, paid_at: new Date().toISOString() }
    }
    if (patch.status && patch.status !== 'paid' && before.status === 'paid') {
      patch = { ...patch, paid_at: null }
    }
    return invoicesRepo.patch(id, patch)
  },

  async markPaid(user: User, id: string): Promise<Invoice> {
    return this.update(user, id, { status: 'paid' })
  },
}

export { isAccountingStaff }
