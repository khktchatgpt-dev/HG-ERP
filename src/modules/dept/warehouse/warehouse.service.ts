import { materialsRepo, type Material } from './warehouse.repo'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { type User } from '@/modules/core/users/users.repo'
import { isSupplyStaff } from '@/modules/dept/supply/suppliers.service'
import { shadowGuard } from '@/modules/core/rbac/shadow'
import { Conflict, Forbidden, NotFound } from '@/server/http'

/** Tên phòng Kho trong `public.departments` (không hard-code UUID). */
const WAREHOUSE_DEPT_NAME = 'Kho'

async function isWarehouseUser(user: User): Promise<boolean> {
  if (user.role === 'admin') return true
  const dept = user.department_id
    ? await departmentsRepo.findById(user.department_id)
    : null
  const legacy = dept?.name === WAREHOUSE_DEPT_NAME
  // Phase 1 RBAC: shadow-so với warehouse.member, vẫn trả legacy.
  return shadowGuard(user, 'isWarehouseUser', legacy, 'warehouse.member')
}

/**
 * Xem chéo phòng ban: workspace Kho có openView (workspaces/access.ts) — mọi NV
 * đã đăng nhập xem được vật tư/tồn/phiếu (Sales tra tồn khi báo giá, Cung ứng
 * theo dõi hàng về theo PO). Ghi vẫn khoá phòng Kho ở các mutation bên dưới.
 * Giữ hàm này làm một điểm siết duy nhất nếu sau này cần thu hẹp lại.
 */
async function canViewWarehouse(user: User): Promise<boolean> {
  void user // giữ nguyên chữ ký để sau này siết lại theo user không phải sửa caller
  return true
}

/** Chỉ Kho + admin được sửa danh mục vật tư. */
function canEdit(user: User): boolean {
  return user.role === 'admin' || user.role === 'manager'
}

type CreateInput = {
  code: string
  name: string
  unit: string
  spec?: string | null
  conversion_profile?: 'A' | 'B' | 'C'
  price_unit?: string | null
  unit2_factor?: number | null
  group_name?: string | null
  min_stock: number
  shelf_location?: string | null
  vat_rate?: number | null
  default_supplier_id?: string | null
  last_purchase_price?: number | null
  note?: string | null
}

type UpdateInput = Partial<CreateInput & { is_active: boolean }>

export const materialsService = {
  async list(
    user: User,
    opts: {
      q?: string
      group_name?: string
      active_only?: boolean
      page: number
      page_size: number
    },
  ) {
    if (!(await canViewWarehouse(user))) throw Forbidden('Chỉ phòng Kho truy cập được')
    return materialsRepo.list({
      q: opts.q,
      group_name: opts.group_name,
      active_only: opts.active_only ?? false,
      page: opts.page,
      page_size: opts.page_size,
    })
  },

  async create(user: User, input: CreateInput): Promise<Material> {
    // Cung ứng cũng được TẠO vật tư — hàng mới phát sinh ngay lúc lên đơn đặt
    // (thêm nhanh từ form PO). Sửa/xoá danh mục vẫn là quyền Kho/admin.
    const whManager = (await isWarehouseUser(user)) && canEdit(user)
    if (!whManager && !(await isSupplyStaff(user))) {
      throw Forbidden('Chỉ quản lý Kho / admin / Cung ứng tạo được vật tư')
    }
    const dup = await materialsRepo.findByCode(input.code)
    if (dup) throw Conflict(`Mã vật tư "${input.code}" đã tồn tại`)

    return materialsRepo.insert({
      code: input.code,
      name: input.name,
      unit: input.unit,
      spec: input.spec ?? null,
      conversion_profile: input.conversion_profile ?? 'A',
      price_unit: input.price_unit ?? null,
      unit2_factor: input.unit2_factor ?? null,
      group_name: input.group_name ?? null,
      min_stock: input.min_stock,
      shelf_location: input.shelf_location ?? null,
      vat_rate: input.vat_rate ?? null,
      default_supplier_id: input.default_supplier_id ?? null,
      last_purchase_price: input.last_purchase_price ?? null,
      note: input.note ?? null,
    })
  },

  async update(user: User, id: string, patch: UpdateInput): Promise<Material> {
    if (!(await isWarehouseUser(user)) || !canEdit(user)) throw Forbidden()
    const before = await materialsRepo.findById(id)
    if (!before) throw NotFound('Vật tư không tồn tại')
    if (patch.code && patch.code !== before.code) {
      const dup = await materialsRepo.findByCode(patch.code)
      if (dup) throw Conflict(`Mã vật tư "${patch.code}" đã tồn tại`)
    }
    return materialsRepo.patch(id, patch)
  },

  async remove(user: User, id: string): Promise<void> {
    if (!(await isWarehouseUser(user)) || !canEdit(user)) throw Forbidden()
    const before = await materialsRepo.findById(id)
    if (!before) throw NotFound('Vật tư không tồn tại')
    await materialsRepo.delete(id)
  },
}

export { isWarehouseUser, canViewWarehouse }
