import type { User } from '@/modules/core/users/users.repo'
import { materialsRepo } from '@/modules/dept/warehouse/warehouse.repo'
import { suppliersRepo } from './supply.repo'
import { materialProfileRepo } from './material-profile.repo'
import { gomGoiY, type VtHoSo } from '@/lib/vat-tu-ho-so'

export const materialProfileService = {
  /**
   * HỒ SƠ VẬT TƯ cho người mua — `null` khi mã không tồn tại.
   *
   * Mức lộ như lịch sử giá mua (`materialPriceHistory`): ai đăng nhập vào được
   * khu Mua hàng là xem được (layout gác khu); chỉ ĐỌC. Đổi NCC mặc định đi qua
   * route sửa vật tư sẵn có, nơi `materialsService.update` kiểm quyền từng trường.
   */
  async get(_user: User, id: string): Promise<VtHoSo | null> {
    const m = await materialsRepo.findById(id)
    if (!m) return null
    const [lines, onHand, def, cungNhom] = await Promise.all([
      materialProfileRepo.lines(id),
      materialProfileRepo.onHand(id),
      m.default_supplier_id ? suppliersRepo.findById(m.default_supplier_id) : null,
      // Không có nhóm con thì "cùng nhóm" quá rộng để gợi ý (cả nhóm Nhôm…).
      m.group_name && m.sub_group
        ? materialProfileRepo.sameSubGroup(id, m.group_name, m.sub_group)
        : [],
    ])
    return {
      vt: {
        id: m.id,
        code: m.code,
        name: m.name,
        unit: m.unit,
        group_name: m.group_name,
        sub_group: m.sub_group,
        spec: m.spec,
        price_unit: m.price_unit,
        shelf: m.shelf_location,
        min_stock: m.min_stock,
        is_active: m.is_active,
        on_hand: onHand,
        default_supplier: def ? { id: def.id, name: def.name } : null,
      },
      lines,
      goi_y: gomGoiY(cungNhom, new Set(lines.map((l) => l.supplier_id))),
    }
  },
}
