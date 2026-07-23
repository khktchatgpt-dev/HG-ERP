import { customersRepo, type Customer, type CustomerWithOwner } from './sales.repo'
import { type User } from '@/modules/core/users/users.repo'
import { hasPermission } from '@/modules/core/rbac/rbac.service'
import { Forbidden, NotFound } from '@/server/http'

// Phase 2 RBAC: guard đọc thẳng permission (bỏ hardcode tên phòng).
async function isSalesUser(user: User): Promise<boolean> {
  return hasPermission(user, 'sales.member')
}

// canEdit: manager-tier sửa mọi KH; sale chỉ sửa KH của mình (row-level, giữ ở
// service). Không hardcode tên phòng nên không cần permission riêng (seed cũng
// chưa có sales.edit) — giữ role-tier + ownership.
function canEdit(user: User, customer: Customer): boolean {
  if (user.role === 'admin') return true
  if (user.role === 'manager') return true // manager Sales edits all
  return customer.owner_id === user.id // sale chỉ sửa KH của mình
}

type CreateInput = {
  name: string
  code?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  notes?: string | null
  owner_id?: string | null
  tax_code?: string | null
  country?: string | null
  contact_person?: string | null
  default_currency?: string | null
  default_price_term?: string | null
  default_payment_terms?: string | null
  port_of_discharge?: string | null
  fax?: string | null
  representative_title?: string | null
  fsc_cert?: string | null
}

type UpdateInput = Partial<CreateInput & { is_active: boolean }>

export const salesService = {
  // Xem mở cho mọi NV đã đăng nhập — workspace Sales có openView (xem chéo
  // phòng ban, workspaces/access.ts); ghi vẫn khoá phòng Bán hàng bên dưới.
  async list(
    _user: User,
    opts: {
      q?: string
      owner_id?: string
      active_only?: boolean
      page: number
      page_size: number
    },
  ) {
    return customersRepo.list({
      q: opts.q,
      owner_id: opts.owner_id,
      active_only: opts.active_only ?? true,
      page: opts.page,
      page_size: opts.page_size,
    })
  },

  async get(_user: User, id: string): Promise<CustomerWithOwner> {
    const c = await customersRepo.findById(id)
    if (!c) throw NotFound('Khách hàng không tồn tại')
    return c
  },

  async create(user: User, input: CreateInput): Promise<Customer> {
    if (!(await isSalesUser(user))) throw Forbidden('Chỉ phòng Bán hàng tạo được')
    // Default owner = current user when not specified.
    const owner_id = input.owner_id ?? user.id

    return customersRepo.insert({
      name: input.name,
      code: input.code ?? null,
      email: input.email || null,
      phone: input.phone ?? null,
      address: input.address ?? null,
      notes: input.notes ?? null,
      owner_id,
      tax_code: input.tax_code ?? null,
      country: input.country ?? null,
      contact_person: input.contact_person ?? null,
      default_currency: input.default_currency ?? null,
      default_price_term: input.default_price_term ?? null,
      default_payment_terms: input.default_payment_terms ?? null,
      port_of_discharge: input.port_of_discharge ?? null,
      fax: input.fax ?? null,
      representative_title: input.representative_title ?? null,
      fsc_cert: input.fsc_cert ?? null,
    })
  },

  async update(user: User, id: string, patch: UpdateInput): Promise<Customer> {
    if (!(await isSalesUser(user))) throw Forbidden()
    const before = await customersRepo.findById(id)
    if (!before) throw NotFound('Khách hàng không tồn tại')
    if (!canEdit(user, before)) {
      throw Forbidden('Bạn chỉ sửa được KH do mình phụ trách')
    }
    return customersRepo.patch(id, patch)
  },

  async remove(user: User, id: string): Promise<void> {
    if (!(await isSalesUser(user))) throw Forbidden()
    const before = await customersRepo.findById(id)
    if (!before) throw NotFound('Khách hàng không tồn tại')
    if (!canEdit(user, before)) {
      throw Forbidden('Bạn chỉ xoá được KH do mình phụ trách')
    }
    await customersRepo.delete(id)
  },
}

export { isSalesUser }
