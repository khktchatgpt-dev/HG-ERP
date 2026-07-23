import { materialsRepo, type Material } from './warehouse.repo'
import { type User } from '@/modules/core/users/users.repo'
import { hasPermission, assertAction } from '@/modules/core/rbac/rbac.service'
import { Conflict, Forbidden, NotFound } from '@/server/http'

// Phase 2 RBAC: guard đọc thẳng permission (bỏ hardcode tên phòng).
async function isWarehouseUser(user: User): Promise<boolean> {
  return hasPermission(user, 'warehouse.member')
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
    // Tạo vật tư: permission warehouse.material.create (seed gán Kho + Cung ứng
    // + Ban QL). Cung ứng thêm nhanh hàng mới ngay lúc lên đơn đặt (form PO).
    await assertAction(user, 'warehouse.material.create')
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
    await assertAction(user, 'warehouse.material.update')
    const before = await materialsRepo.findById(id)
    if (!before) throw NotFound('Vật tư không tồn tại')
    if (patch.code && patch.code !== before.code) {
      const dup = await materialsRepo.findByCode(patch.code)
      if (dup) throw Conflict(`Mã vật tư "${patch.code}" đã tồn tại`)
    }
    return materialsRepo.patch(id, patch)
  },

  async remove(user: User, id: string): Promise<void> {
    await assertAction(user, 'warehouse.material.update')
    const before = await materialsRepo.findById(id)
    if (!before) throw NotFound('Vật tư không tồn tại')
    await materialsRepo.delete(id)
  },
}

export { isWarehouseUser, canViewWarehouse }
