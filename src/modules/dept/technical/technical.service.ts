import { productsRepo, type Product } from './technical.repo'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import type { User } from '@/modules/core/users/users.repo'
import { Conflict, Forbidden, NotFound } from '@/server/http'

const TECH_DEPT_NAME = 'Kỹ Thuật'

async function isTechnicalStaff(user: User): Promise<boolean> {
  if (user.role === 'admin') return true
  if (!user.department_id) return false
  const dept = await departmentsRepo.findById(user.department_id)
  return dept?.name === TECH_DEPT_NAME
}

function canEdit(user: User): boolean {
  // Sửa thư viện SP: KT manager hoặc admin (NV xem read-only)
  return user.role === 'admin' || user.role === 'manager'
}

type CreateInput = {
  code: string
  name: string
  category?: string | null
  drawing_url?: string | null
  bom_url?: string | null
  notes?: string | null
}

export const productsService = {
  async list(user: User, opts: { q?: string; category?: string; active_only?: boolean; page: number; page_size: number }) {
    // Mọi NV trong công ty (không chỉ KT) đều xem được thư viện SP — đây là tài sản chung.
    // Có thể siết lại sau nếu cần.
    return productsRepo.list({
      q: opts.q,
      category: opts.category,
      active_only: opts.active_only ?? true,
      page: opts.page,
      page_size: opts.page_size,
    })
  },

  async create(user: User, input: CreateInput): Promise<Product> {
    if (!(await isTechnicalStaff(user)) || !canEdit(user)) {
      throw Forbidden('Chỉ Kỹ thuật / Admin tạo được sản phẩm')
    }
    if (await productsRepo.existsByCode(input.code)) {
      throw Conflict(`Mã "${input.code}" đã tồn tại`, 'CODE_TAKEN')
    }
    return productsRepo.insert({
      code: input.code,
      name: input.name,
      category: input.category ?? null,
      drawing_url: input.drawing_url || null,
      bom_url: input.bom_url || null,
      notes: input.notes ?? null,
    })
  },

  async update(user: User, id: string, patch: Partial<Product>): Promise<Product> {
    if (!(await isTechnicalStaff(user)) || !canEdit(user)) throw Forbidden()
    const before = await productsRepo.findById(id)
    if (!before) throw NotFound('Sản phẩm không tồn tại')
    return productsRepo.patch(id, patch)
  },

  async remove(user: User, id: string): Promise<void> {
    if (!(await isTechnicalStaff(user)) || !canEdit(user)) throw Forbidden()
    const before = await productsRepo.findById(id)
    if (!before) throw NotFound()
    await productsRepo.delete(id)
  },
}

export { isTechnicalStaff }
