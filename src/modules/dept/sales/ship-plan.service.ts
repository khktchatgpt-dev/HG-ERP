import type { User } from '@/modules/core/users/users.repo'
import { dungDotXuat, type DotXuat } from '@/lib/ke-hoach-xuat'
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
}
