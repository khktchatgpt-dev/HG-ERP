import { suppliersRepo, materialGroupsRepo, type Supplier } from './supply.repo'
import type { supplierCreateSchema } from './suppliers.schema'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import type { User } from '@/modules/core/users/users.repo'
import type { z } from 'zod'
import { Forbidden, NotFound } from '@/server/http'

/**
 * Vai CUNG ỨNG (mua hàng: PO/NCC/theo dõi hàng về). Tách vai 07/2026:
 * - 'Cung Ứng - Mua Hàng'          — phòng mới, CHỈ vai mua hàng.
 * - 'Kế Hoạch Sản Xuất-cung ứng'   — phòng gộp cũ, giữ CẢ HAI vai (người kiêm
 *   nhiệm ở lại đây); có nhân sự mới thì IT đổi phòng ở /admin/users, không
 *   cần sửa code. Vai KẾ HOẠCH (định hình) xem production/perms.ts.
 * Tên phòng đúng như public.departments (đừng lặp lại bug 'Kinh Doanh').
 */
const SUPPLY_DEPT_NAMES = new Set(['Kế Hoạch Sản Xuất-cung ứng', 'Cung Ứng - Mua Hàng'])

async function isSupplyStaff(user: User): Promise<boolean> {
  if (user.role === 'admin') return true
  if (!user.department_id) return false
  const dept = await departmentsRepo.findById(user.department_id)
  return !!dept && SUPPLY_DEPT_NAMES.has(dept.name)
}

type SupplierInput = z.infer<typeof supplierCreateSchema>

/** '' → null cho các trường text (form gửi chuỗi rỗng). */
function nn<T>(v: T | '' | undefined | null): T | null {
  return v === '' || v === undefined ? null : (v as T | null)
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
    const status = input.status ?? 'active'
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { is_active: _ignore, ...rest } = input as SupplierInput & {
      is_active?: boolean
    }
    return suppliersRepo.insert({
      ...toRow(rest),
      name: input.name,
      status,
      is_active: status === 'active', // đồng bộ cổng chọn NCC khi tạo PO
      can_order: input.can_order ?? true,
      created_by: user.id,
      updated_by: user.id,
    })
  },

  async update(
    user: User,
    id: string,
    patch: Partial<SupplierInput> & { is_active?: boolean },
  ): Promise<Supplier> {
    if (!(await isSupplyStaff(user))) throw Forbidden()
    const before = await suppliersRepo.findById(id)
    if (!before) throw NotFound('NCC không tồn tại')

    const row: Partial<Supplier> = { ...toRow(patch), updated_by: user.id }
    // Đồng bộ status ↔ is_active 2 chiều.
    if (patch.status !== undefined) row.is_active = patch.status === 'active'
    else if (patch.is_active !== undefined) {
      row.is_active = patch.is_active
      row.status = patch.is_active ? 'active' : 'suspended'
    }
    // Có chấm điểm/hạng → ghi mốc đánh giá (M5).
    const scored =
      patch.quality_score !== undefined ||
      patch.service_score !== undefined ||
      patch.price_score !== undefined ||
      patch.complaint_count !== undefined ||
      patch.rating !== undefined
    if (scored) {
      row.evaluated_at = new Date().toISOString()
      row.evaluated_by = user.id
    }
    return suppliersRepo.patch(id, row)
  },

  /** Nhóm hàng NCC cung cấp (M4). */
  async listGroups(_user: User, supplierId: string): Promise<string[]> {
    return materialGroupsRepo.forSupplier(supplierId)
  },

  async setGroups(user: User, supplierId: string, groupIds: string[]): Promise<void> {
    if (!(await isSupplyStaff(user))) throw Forbidden()
    await materialGroupsRepo.setForSupplier(supplierId, groupIds)
  },
}

/** Chuẩn hoá payload text → null; loại field không thuộc bảng. */
function toRow(
  input: Partial<SupplierInput> & { is_active?: boolean },
): Partial<Supplier> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(input)) {
    if (k === 'is_active' || k === 'lead_time_days' || k === 'can_order') continue
    out[k] = nn(v as string)
  }
  if (input.lead_time_days !== undefined) out.lead_time_days = input.lead_time_days
  return out as Partial<Supplier>
}

export { isSupplyStaff, SUPPLY_DEPT_NAMES }
