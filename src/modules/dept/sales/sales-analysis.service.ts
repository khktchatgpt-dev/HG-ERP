import type { User } from '@/modules/core/users/users.repo'
import { canAction } from '@/modules/core/rbac/rbac.service'
import type { DongBan } from '@/lib/phan-tich-doanh-so'
import { salesAnalysisRepo } from './sales-analysis.repo'

export const salesAnalysisService = {
  /**
   * PHÂN TÍCH DOANH SỐ — dòng đơn bán đã chuẩn hoá cho màn hình.
   *
   * GIÁ THÀNH LÀ BÍ MẬT CỦA BÁN HÀNG (quyền riêng `technical.plan_cost.view`):
   * không quyền thì KHÔNG đọc cột giá thành từ DB và `lai` luôn null — ẩn cột ở
   * màn hình là chưa đủ, số đã gửi xuống trình duyệt là số đã lộ.
   */
  async board(user: User): Promise<{ dongs: DongBan[]; canSeeCost: boolean }> {
    const canSeeCost = await canAction(user, 'technical.plan_cost.view')
    const raw = await salesAnalysisRepo.lines(canSeeCost)
    const dongs: DongBan[] = raw.map((r) => ({
      order_id: r.order_id,
      order_code: r.order_code,
      customer: r.customer,
      thang_nhan: r.created_at.slice(0, 7),
      product_id: r.product_id,
      product_code: r.product_code,
      product_name: r.product_name,
      product_type: r.product_type,
      qty: r.qty,
      value: Math.round(r.qty * (r.unit_price ?? 0) * 100) / 100,
      // "Bóc tách" = có cả chi phí trực tiếp lẫn lãi; dòng chỉ có FOB không tính.
      lai:
        canSeeCost && r.plan_profit != null && r.plan_direct_cost != null
          ? Math.round(r.qty * r.plan_profit * 100) / 100
          : null,
    }))
    return { dongs, canSeeCost }
  },
}
