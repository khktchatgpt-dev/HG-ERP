import type { User } from '@/modules/core/users/users.repo'
import {
  dungDotXuat,
  gomTheoLenh,
  type DotXuat,
  type LenhXuat,
} from '@/lib/ke-hoach-xuat'
import { shipPlanRepo } from './ship-plan.repo'

export const shipPlanService = {
  /**
   * KẾ HOẠCH XUẤT HÀNG — mọi đợt xuất (nhóm lệnh) của lệnh còn sống.
   * Cùng mức lộ với danh sách đơn bán (`ordersService.list`): layout khu Bán
   * hàng gác ai vào được; chỉ ĐỌC.
   */
  async board(user: User): Promise<DotXuat[]> {
    void user // giữ chữ ký service (user đầu tiên) để sau gác quyền không phải đổi chỗ gọi
    return dungDotXuat(await shipPlanRepo.load())
  },

  /**
   * Kế hoạch xuất THEO LỆNH (06/10/2026 — Sale lên kế hoạch xuất cho từng lệnh):
   * mỗi lệnh = các đợt (PO khách + ngày xuất) × SP. Trả cả `dots` (cùng một lần
   * đọc DB) cho khung "Tổng theo tháng".
   */
  async plan(user: User): Promise<{ lenhs: LenhXuat[]; dots: DotXuat[] }> {
    void user
    const raw = await shipPlanRepo.load()
    const lenhs = gomTheoLenh(raw)
    return { lenhs, dots: lenhs.flatMap((l) => l.dots) }
  },
}
