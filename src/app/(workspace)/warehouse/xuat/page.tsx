import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { todayVn } from '@/lib/date-vn'
import { XuatScreen } from './XuatScreen'

export const metadata = { title: 'Kho · Xuất kho' }
export const dynamic = 'force-dynamic'

/**
 * XUẤT KHO THEO THỰC TẾ LẤY — `/warehouse/xuat` (Bước 2 Kho,
 * `docs/kho-buoc-2-xuat-kho.md`). Chủ dự án chốt 16/09/2026: không so định
 * mức; thủ kho ghi mã, số lượng, lệnh hoặc tổ nhận.
 *
 * Trang nạp ba danh mục nhỏ cho dải chip: lệnh đang chạy (đã duyệt / đang
 * SX — đúng tập service cho xuất), tên tổ để gợi ý ô người nhận, và quyền
 * ghi sổ. Vật tư KHÔNG nạp trước (13.229 mã) — tìm từng mã qua API lúc thêm
 * dòng, tồn dùng được tra cùng lúc.
 */
export default async function WarehouseIssuePage() {
  const user = await authService.requirePageUser()
  const [lsx, deps, canEdit] = await Promise.all([
    productionRepo.listActive(),
    departmentsRepo.list(),
    user.role === 'admin'
      ? Promise.resolve(true)
      : canAction(user, 'warehouse.stock.write'),
  ])

  // Tổ nhận vật tư: các phòng tên "Tổ …" + hai tổ đặt tên khác (Cắt Vải, Xưởng).
  const to = deps
    .map((d) => d.name)
    .filter((n) => /^tổ\b/i.test(n) || /cắt vải|xưởng/i.test(n))
    .sort((a, b) => a.localeCompare(b, 'vi'))

  return (
    <XuatScreen
      lsx={lsx.map((l) => ({ id: l.id, code: l.code, customer_name: l.customer_name }))}
      to={to}
      today={todayVn()}
      nguoiLap={user.name ?? user.email}
      canEdit={canEdit}
    />
  )
}
