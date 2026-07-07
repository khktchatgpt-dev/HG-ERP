import { suppliersRepo, type Supplier } from './supply.repo'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import type { User } from '@/modules/core/users/users.repo'
import { Forbidden, NotFound } from '@/server/http'

/** Tên phòng đúng như public.departments (đừng lặp lại bug 'Kinh Doanh'). */
const SUPPLY_DEPT_NAME = 'Kế Hoạch Sản Xuất-cung ứng'

async function isSupplyStaff(user: User): Promise<boolean> {
  if (user.role === 'admin') return true
  if (!user.department_id) return false
  const dept = await departmentsRepo.findById(user.department_id)
  return dept?.name === SUPPLY_DEPT_NAME
}

type SupplierInput = {
  code?: string | null
  name: string
  email?: string | null
  phone?: string | null
  address?: string | null
  tax_no?: string | null
  note?: string | null
}

export const suppliersService = {
  /** Đọc: mọi NV (Kho/Kế toán tra thông tin NCC — ma trận đặc tả mục 6). */
  async list(
    _user: User,
    opts: { q?: string; active_only?: boolean; page: number; page_size: number },
  ) {
    return suppliersRepo.list({
      q: opts.q,
      active_only: opts.active_only ?? false,
      page: opts.page,
      page_size: opts.page_size,
    })
  },

  async create(user: User, input: SupplierInput): Promise<Supplier> {
    if (!(await isSupplyStaff(user))) {
      throw Forbidden('Chỉ phòng Kế hoạch - Cung ứng quản lý NCC')
    }
    return suppliersRepo.insert({
      code: input.code || null,
      name: input.name,
      email: input.email || null,
      phone: input.phone ?? null,
      address: input.address ?? null,
      tax_no: input.tax_no ?? null,
      note: input.note ?? null,
    })
  },

  async update(user: User, id: string, patch: Partial<Supplier>): Promise<Supplier> {
    if (!(await isSupplyStaff(user))) throw Forbidden()
    const before = await suppliersRepo.findById(id)
    if (!before) throw NotFound('NCC không tồn tại')
    return suppliersRepo.patch(id, patch)
  },
}

export { isSupplyStaff }
