import { customersRepo, type Customer, type CustomerWithOwner } from './sales.repo'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { type User } from '@/modules/core/users/users.repo'
import { Forbidden, NotFound } from '@/server/http'

/**
 * The "Bán Hàng" department's name as stored in `public.departments`.
 * Used to check whether a user belongs to Sales without hard-coding a UUID.
 */
const SALES_DEPT_NAME = 'Bán Hàng'

async function isSalesUser(user: User): Promise<boolean> {
  if (user.role === 'admin') return true
  if (!user.department_id) return false
  const dept = await departmentsRepo.findById(user.department_id)
  return dept?.name === SALES_DEPT_NAME
}

function canEdit(user: User, customer: Customer): boolean {
  if (user.role === 'admin') return true
  if (user.role === 'manager') return true     // manager Sales edits all
  return customer.owner_id === user.id         // sale chỉ sửa KH của mình
}

type CreateInput = {
  name: string
  code?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  notes?: string | null
  owner_id?: string | null
}

type UpdateInput = Partial<CreateInput & { is_active: boolean }>

export const salesService = {
  async list(user: User, opts: { q?: string; owner_id?: string; active_only?: boolean; page: number; page_size: number }) {
    if (!(await isSalesUser(user))) throw Forbidden('Chỉ phòng Bán hàng truy cập được')
    return customersRepo.list({
      q: opts.q,
      owner_id: opts.owner_id,
      active_only: opts.active_only ?? true,
      page: opts.page,
      page_size: opts.page_size,
    })
  },

  async get(user: User, id: string): Promise<CustomerWithOwner> {
    if (!(await isSalesUser(user))) throw Forbidden()
    const c = await customersRepo.findById(id)
    if (!c) throw NotFound('Khách hàng không tồn tại')
    return { ...c, owner_name: null, owner_email: null }
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
